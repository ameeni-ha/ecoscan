#!/usr/bin/env python3
"""
Petit service HTTP pour analyser les dechets avec le modele Keras EcoScan.

Il evite la conversion TensorFlow.js sous Windows : React/Node envoie une image
ici, et ce service charge directement public/models/waste-classifier/waste_classifier.keras.
"""

import json
import os
from pathlib import Path

import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "public" / "models" / "waste-classifier"
MODEL_PATH = Path(os.environ.get("ECOSCAN_KERAS_MODEL", MODEL_DIR / "waste_classifier.keras"))
METADATA_PATH = MODEL_DIR / "metadata.json"
CLASSES_PATH = MODEL_DIR / "classes.json"
INPUT_SIZE = int(os.environ.get("ECOSCAN_MODEL_INPUT_SIZE", "224"))
MIN_CONFIDENCE = float(os.environ.get("ECOSCAN_MIN_CONFIDENCE", "0.55"))
MIN_MARGIN = float(os.environ.get("ECOSCAN_MIN_MARGIN", "0.15"))
TOP_K = int(os.environ.get("ECOSCAN_TOP_K", "3"))

app = Flask(__name__)
model = None
metadata = {}
class_config = {}


def load_json(path):
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_labels():
    labels = metadata.get("labels") or metadata.get("modelSettings", {}).get("labels") or []
    return list(labels)


def get_class_details(raw_label):
    config = class_config.get(raw_label, {})
    material = config.get("material") or "autre"

    return {
        "rawLabel": raw_label,
        "label": config.get("label") or raw_label or "Objet detecte",
        "material": material,
        "recyclable": bool(config.get("recyclable")) and material != "autre",
        "reason": config.get("reason") or "Matiere estimee par le modele dechets EcoScan.",
    }


def load_assets():
    global model, metadata, class_config

    if model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Modele Keras introuvable: {MODEL_PATH}")
        model = tf.keras.models.load_model(MODEL_PATH)

    if not metadata:
        metadata = load_json(METADATA_PATH)

    if not class_config:
        class_config = load_json(CLASSES_PATH).get("classes", {})

    return model


def image_to_array(image):
    resized = image.resize((INPUT_SIZE, INPUT_SIZE))
    array = np.asarray(resized, dtype=np.float32) / 255.0
    return array


def build_candidate_crops(image):
    width, height = image.size
    crops = [("full", image)]

    # The camera preview often contains a lot of background. Test overlapping
    # square crops so small objects, like a shoe held in hand, fill more pixels.
    crop_size = min(width, height)
    if crop_size <= 0:
        return crops

    x_positions = sorted(set([0, max((width - crop_size) // 2, 0), max(width - crop_size, 0)]))
    y_positions = sorted(set([0, max((height - crop_size) // 2, 0), max(height - crop_size, 0)]))

    for y in y_positions:
        for x in x_positions:
            box = (x, y, x + crop_size, y + crop_size)
            crops.append((f"crop_{x}_{y}", image.crop(box)))

    return crops


def preprocess_image(file_storage):
    image = Image.open(file_storage.stream).convert("RGB")
    crops = build_candidate_crops(image)
    batch = np.stack([image_to_array(crop) for _, crop in crops], axis=0)
    return batch, [name for name, _ in crops]


def aggregate_crop_scores(batch_scores, crop_names):
    if len(batch_scores) == 1:
        return batch_scores[0], 1.0

    weights = np.ones(len(batch_scores), dtype=np.float32)
    for index, name in enumerate(crop_names):
        if name == "full":
            weights[index] = 2.0
        elif "_0_" not in name and not name.endswith("_0"):
            weights[index] = 1.25

    scores = np.average(batch_scores, axis=0, weights=weights)
    top_per_crop = np.argmax(batch_scores, axis=1)
    top_label = int(np.argmax(scores))
    consensus = float(np.mean(top_per_crop == top_label))
    return scores, consensus


def aggregate_material_scores(scores, labels):
    """Regroupe les classes qui representent la meme matiere.

    Le modele peut partager la confiance entre classes proches. Pour la
    decision de tri, la matiere agregee est plus fiable que la meilleure
    classe seule.
    """
    material_scores = {}
    material_best = {}

    for index, raw_label in enumerate(labels):
        score = float(scores[index])
        details = get_class_details(raw_label)
        material = details["material"]
        material_scores[material] = material_scores.get(material, 0.0) + score

        current_best = material_best.get(material)
        if current_best is None or score > current_best["score"]:
            material_best[material] = {**details, "score": score}

    ranked_materials = sorted(material_scores.items(), key=lambda item: item[1], reverse=True)
    if not ranked_materials:
        return None

    best_material, best_score = ranked_materials[0]
    second_score = ranked_materials[1][1] if len(ranked_materials) > 1 else 0.0
    best_class = material_best[best_material]

    return {
        **best_class,
        "materialScore": float(best_score),
        "materialMargin": float(best_score - second_score),
    }


def classify_label(classification, accepted, status):
    details = classification or get_class_details("")

    return {
        "rawLabel": details["rawLabel"],
        "label": details["label"] if accepted else "Objet a verifier",
        "material": details["material"] if accepted else "autre",
        "recyclable": details["recyclable"] and accepted,
        "reason": (
            details["reason"]
            if accepted
            else "Le modele hesite ou confond plusieurs matieres. Rapprochez l'objet, centrez-le et reprenez la photo."
        ),
        "detectionStatus": status,
    }


@app.get("/health")
def health():
    try:
        load_assets()
        labels = get_labels()
        output_shape = getattr(model, "output_shape", None)
        return jsonify(
            {
                "status": "ok",
                "modelPath": str(MODEL_PATH),
                "labels": len(labels),
                "outputShape": output_shape,
            }
        )
    except Exception as error:
        return jsonify({"status": "error", "message": str(error)}), 500


@app.post("/predict")
def predict():
    if "photo" not in request.files:
        return jsonify({"message": "Photo requise"}), 400

    try:
        classifier = load_assets()
        labels = get_labels()
        if not labels:
            return jsonify({"message": "Labels du modele introuvables"}), 500

        input_tensor, crop_names = preprocess_image(request.files["photo"])
        batch_scores = classifier.predict(input_tensor, verbose=0)
        scores, consensus = aggregate_crop_scores(batch_scores, crop_names)

        if len(labels) != len(scores):
            return (
                jsonify(
                    {
                        "message": "Le nombre de labels ne correspond pas aux sorties du modele",
                        "labels": len(labels),
                        "outputs": len(scores),
                    }
                ),
                500,
            )

        ranked_indices = np.argsort(scores)[::-1]
        best_index = int(ranked_indices[0])
        best_class_score = float(scores[best_index])
        material_result = aggregate_material_scores(scores, labels)
        raw_label = material_result["rawLabel"] if material_result else labels[best_index]
        score = float(material_result["materialScore"]) if material_result else best_class_score
        confidence = round(score * 100)
        second_score = float(scores[int(ranked_indices[1])]) if len(ranked_indices) > 1 else 0.0
        class_margin = best_class_score - second_score
        margin = float(material_result["materialMargin"]) if material_result else class_margin
        accepted = score >= MIN_CONFIDENCE and margin >= MIN_MARGIN and consensus >= 0.4
        status = (
            "python_keras_material_recognized"
            if accepted
            else "python_keras_ambiguous"
            if score >= MIN_CONFIDENCE
            else "python_keras_low_confidence"
        )
        classification = classify_label(material_result, accepted, status)
        top_predictions = [
            {
                "label": labels[int(index)],
                "displayLabel": class_config.get(labels[int(index)], {}).get("label") or labels[int(index)],
                "confidence": round(float(scores[int(index)]) * 100),
            }
            for index in ranked_indices[:TOP_K]
        ]

        return jsonify(
            {
                "label": classification["label"],
                "detectedObject": classification["label"],
                "rawDetectedObject": raw_label,
                "material": classification["material"],
                "recyclable": classification["recyclable"],
                "confidence": confidence,
                "score": score,
                "margin": margin,
                "classScore": best_class_score,
                "classMargin": class_margin,
                "consensus": consensus,
                "topPredictions": top_predictions,
                "detectionStatus": classification["detectionStatus"],
                "reason": classification["reason"],
                "modelSource": "python-keras",
            }
        )
    except Exception as error:
        return jsonify({"message": str(error)}), 500


if __name__ == "__main__":
    print("Chargement du modele Keras au demarrage...")
    load_assets()
    print(f"Modele pret: {MODEL_PATH} ({len(get_labels())} classes)")
    port = int(os.environ.get("PORT", os.environ.get("ECOSCAN_AI_PORT", "5001")))
    app.run(host="0.0.0.0", port=port, debug=False)
