import * as tf from "@tensorflow/tfjs";
import * as coco from "@tensorflow-models/coco-ssd";

let model = null;

// Load the COCO-SSD model
export const loadModel = async () => {
  if (model) return model;
  try {
    model = await coco.load();
    return model;
  } catch (error) {
    console.error("Erreur lors du chargement du modèle:", error);
    throw error;
  }
};

// Detect objects in an image
export const detectObjects = async (imageElement) => {
  try {
    const loadedModel = await loadModel();
    // Utiliser detect() au lieu de estimateObjects() pour COCO-SSD
    const predictions = await loadedModel.detect(imageElement);
    // Augmenter le seuil de confiance pour une meilleure précision
    const filtered = predictions.filter((p) => p.score >= 0.7);

    // Filtrer les classes non pertinentes pour le recyclage
    const irrelevantClasses = [
      "person", "hand", "face", "eye", "nose", "mouth", "ear", "hair",
      "background", "wall", "floor", "ceiling", "table", "chair", "couch",
      "bed", "door", "window", "curtain", "rug", "carpet"
    ];
    const relevantPredictions = filtered.filter(
      (p) => !irrelevantClasses.includes(String(p.class || "").toLowerCase())
    );

    return relevantPredictions;
  } catch (error) {
    console.error("Erreur lors de la détection:", error);
    throw error;
  }
};

// Map detected objects to materials
const OBJECT_TO_MATERIAL_MAP = {
  // Plastique
  bottle: "plastique",
  cup: "plastique",
  backpack: "plastique",
  handbag: "plastique",
  chair: "plastique",
  couch: "plastique",
  pottedplant: "plastique",
  container: "plastique",
  bag: "plastique",

  // Verre
  "wine glass": "verre",
  "cup": "verre",
  "bottle": "verre",
  "jar": "verre",

  // Papier/Carton
  book: "papier_carton",
  suitcase: "papier_carton",
  box: "papier_carton",
  paper: "papier_carton",
  "cardboard": "papier_carton",
  "carton": "papier_carton",
  "envelope": "papier_carton",

  // Métal
  bicycle: "metal",
  car: "metal",
  bus: "metal",
  train: "metal",
  truck: "metal",
  motorcycle: "metal",
  fork: "metal",
  spoon: "metal",
  knife: "metal",
  scissors: "metal",
  can: "metal",
  "aluminum": "metal",
  "tin": "metal",

  // Électronique
  keyboard: "electronique",
  mouse: "electronique",
  cellphone: "electronique",
  laptop: "electronique",
  monitor: "electronique",
  remote: "electronique",
  tv: "electronique",
  "computer": "electronique",
  "phone": "electronique",

  // Organique
  apple: "organique",
  banana: "organique",
  orange: "organique",
  broccoli: "organique",
  carrot: "organique",
  sandwich: "organique",
  pizza: "organique",
  donut: "organique",
  cake: "organique",
  "food": "organique",
};

// Suggest material based on detected objects
export const suggestMaterial = (predictions) => {
  if (!predictions || predictions.length === 0) {
    return null;
  }

  const sorted = [...predictions].sort((a, b) => b.score - a.score);
  const matchedPrediction = sorted.find(
    (p) => OBJECT_TO_MATERIAL_MAP[String(p.class || "").toLowerCase()]
  );

  const topPrediction = matchedPrediction || sorted[0];
  const objectName = String(topPrediction.class || "").toLowerCase();

  if (OBJECT_TO_MATERIAL_MAP[objectName]) {
    const confidence = Math.round(topPrediction.score * 100);
    return {
      material: OBJECT_TO_MATERIAL_MAP[objectName],
      confidence,
      detectedObject: topPrediction.class,
      recyclable: confidence >= 70, // Confirmer recyclabilité seulement si confiance >= 70%
    };
  }

  // Partial match
  for (const [key, material] of Object.entries(OBJECT_TO_MATERIAL_MAP)) {
    if (objectName.includes(key) || key.includes(objectName)) {
      const confidence = Math.round(topPrediction.score * 100);
      return {
        material,
        confidence,
        detectedObject: topPrediction.class,
        recyclable: confidence >= 70, // Confirmer recyclabilité seulement si confiance >= 70%
      };
    }
  }

  // Default fallback - non recyclable si pas de mapping
  const confidence = Math.round(topPrediction.score * 100);
  return {
    material: null,
    confidence,
    detectedObject: topPrediction.class,
    recyclable: false, // Non recyclable par défaut
  };
};

// Convert blob to data URL
export const blobToDataUrl = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Traiter une image (File) et détecter les objets
 * @param {File} file - Fichier image
 * @returns {Promise<Object>} { detections, suggestedMaterial, imageUrl, confidence }
 */
export const processImageFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const img = new Image();
        img.src = event.target.result;

        img.onload = async () => {
          const detections = await detectObjects(img);
          const suggestion = suggestMaterial(detections);

          resolve({
            detections,
            suggestedMaterial: suggestion?.material || null,
            detectedObject: suggestion?.detectedObject || null,
            imageUrl: event.target.result,
            confidence: suggestion?.confidence || 0,
          });
        };

        img.onerror = () => reject(new Error("Erreur lors du chargement de l'image"));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier"));
    reader.readAsDataURL(file);
  });
};

/**
 * Traiter une vidéo en direct (stream)
 * @param {HTMLVideoElement} videoElement - Élément vidéo
 * @returns {Promise<Object>} Détections en temps réel
 */
export const detectFromVideoStream = async (videoElement) => {
  try {
    const detections = await detectObjects(videoElement);
    return {
      detections,
      suggestion: suggestMaterial(detections),
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Erreur détection vidéo:", error);
    throw error;
  }
};

/**
 * Obtenir les informations du modèle
 * @returns {Object} Infos sur le modèle
 */
export const getModelInfo = () => {
  return {
    name: "COCO-SSD",
    version: "2.2.3",
    framework: "TensorFlow.js",
    isLoaded: model !== null,
    description: "Détection d'objets en temps réel",
    capabilities: [
      "Détection de 90 classes d'objets",
      "Fonctionnement en temps réel",
      "Support des images et vidéos",
      "Exécution côté client",
    ],
  };
};

/**
 * Libérer la mémoire du modèle
 */
export const unloadModel = () => {
  if (model) {
    tf.disposeVariables();
    model = null;
  }
};
