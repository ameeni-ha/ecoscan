import * as tf from "@tensorflow/tfjs";
import * as coco from "@tensorflow-models/coco-ssd";

let model = null;
let wasteClassifierModel = null;
let wasteClassifierMetadata = null;
let wasteClassifierClassConfig = null;
let wasteClassifierUnavailable = false;
let wasteClassifierLabelMismatch = false;

const WASTE_CLASSIFIER_BASE_URL =
  process.env.REACT_APP_WASTE_MODEL_URL || "/models/waste-classifier";
const WASTE_CLASSIFIER_INPUT_SIZE = 224;

// Load the COCO-SSD model
export const loadModel = async () => {
  await loadWasteClassifier();
  if (model) return model;
  try {
    model = await coco.load();
    return model;
  } catch (error) {
    console.error("Erreur lors du chargement du modèle:", error);
    throw error;
  }
};

const loadWasteClassifier = async () => {
  if (wasteClassifierUnavailable) return null;
  if (wasteClassifierModel) return wasteClassifierModel;

  try {
    const [loadedModel, metadataResponse, classConfigResponse] = await Promise.all([
      tf.loadLayersModel(`${WASTE_CLASSIFIER_BASE_URL}/model.json`),
      fetch(`${WASTE_CLASSIFIER_BASE_URL}/metadata.json`),
      fetch(`${WASTE_CLASSIFIER_BASE_URL}/classes.json`).catch(() => null),
    ]);

    if (!metadataResponse.ok) {
      throw new Error("metadata.json introuvable");
    }

    wasteClassifierModel = loadedModel;
    wasteClassifierMetadata = await metadataResponse.json();
    wasteClassifierClassConfig =
      classConfigResponse?.ok ? await classConfigResponse.json() : null;
    return wasteClassifierModel;
  } catch (error) {
    wasteClassifierUnavailable = true;
    return null;
  }
};

const MIN_DETECTION_SCORE = 0.45;

const IRRELEVANT_CLASSES = new Set([
  "person",
  "hand",
  "face",
  "eye",
  "nose",
  "mouth",
  "ear",
  "hair",
  "background",
  "wall",
  "floor",
  "ceiling",
  "table",
  "chair",
  "couch",
  "bed",
  "door",
  "window",
  "curtain",
  "rug",
  "carpet",
  "dining table",
]);

// Detect objects in an image
export const detectObjects = async (imageElement) => {
  try {
    const customPrediction = await detectWithWasteClassifier(imageElement);
    if (customPrediction) {
      return [customPrediction];
    }

    const loadedModel = await loadModel();
    const predictions = await loadedModel.detect(imageElement, 12, MIN_DETECTION_SCORE);

    return predictions
      .filter((p) => !IRRELEVANT_CLASSES.has(String(p.class || "").toLowerCase()))
      .sort((a, b) => getDetectionPriority(b, imageElement) - getDetectionPriority(a, imageElement));
  } catch (error) {
    console.error("Erreur lors de la détection:", error);
    throw error;
  }
};

const MATERIAL_CLASSIFICATION = {
  bottle: {
    material: "plastique",
    recyclable: true,
    label: "Bouteille",
    reason: "Les bouteilles PET/PEHD propres sont généralement recyclables.",
  },
  "wine glass": {
    material: "verre",
    recyclable: true,
    label: "Objet en verre",
    reason: "Le verre d'emballage est recyclable s'il est vide et propre.",
  },
  cup: {
    material: "plastique",
    recyclable: false,
    label: "Gobelet",
    reason: "Les gobelets jetables ou souillés sont souvent refusés dans le tri classique.",
  },
  bowl: {
    material: "autre",
    recyclable: false,
    label: "Bol / récipient",
    reason: "La céramique et les objets mélangés ne vont pas dans le bac recyclable.",
  },
  book: {
    material: "papier_carton",
    recyclable: true,
    label: "Livre / papier",
    reason: "Le papier et le carton propres peuvent être recyclés.",
  },
  scissors: {
    material: "metal",
    recyclable: true,
    label: "Objet métallique",
    reason: "Le métal est recyclable dans les filières adaptées.",
  },
  fork: {
    material: "metal",
    recyclable: true,
    label: "Couvert métallique",
    reason: "Le métal est recyclable dans les filières adaptées.",
  },
  knife: {
    material: "metal",
    recyclable: true,
    label: "Couvert métallique",
    reason: "Le métal est recyclable dans les filières adaptées.",
  },
  spoon: {
    material: "metal",
    recyclable: true,
    label: "Couvert métallique",
    reason: "Le métal est recyclable dans les filières adaptées.",
  },
  "cell phone": {
    material: "electronique",
    recyclable: true,
    label: "Téléphone",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  laptop: {
    material: "electronique",
    recyclable: true,
    label: "Ordinateur portable",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  keyboard: {
    material: "electronique",
    recyclable: true,
    label: "Clavier",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  mouse: {
    material: "electronique",
    recyclable: true,
    label: "Souris",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  remote: {
    material: "electronique",
    recyclable: true,
    label: "Télécommande",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  tv: {
    material: "electronique",
    recyclable: true,
    label: "Téléviseur",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  microwave: {
    material: "electronique",
    recyclable: true,
    label: "Appareil électroménager",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  oven: {
    material: "electronique",
    recyclable: true,
    label: "Appareil électroménager",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  toaster: {
    material: "electronique",
    recyclable: true,
    label: "Appareil électroménager",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  refrigerator: {
    material: "electronique",
    recyclable: true,
    label: "Réfrigérateur",
    reason: "Les appareils électroniques doivent être déposés en point spécialisé.",
  },
  apple: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les déchets alimentaires peuvent être compostés.",
  },
  banana: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les déchets alimentaires peuvent être compostés.",
  },
  orange: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les déchets alimentaires peuvent être compostés.",
  },
  broccoli: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les déchets alimentaires peuvent être compostés.",
  },
  carrot: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les déchets alimentaires peuvent être compostés.",
  },
  sandwich: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les restes alimentaires peuvent être compostés si la filière existe.",
  },
  pizza: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les restes alimentaires peuvent être compostés si la filière existe.",
  },
  donut: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les restes alimentaires peuvent être compostés si la filière existe.",
  },
  cake: {
    material: "organique",
    recyclable: true,
    label: "Déchet organique",
    reason: "Les restes alimentaires peuvent être compostés si la filière existe.",
  },
  vase: {
    material: "autre",
    recyclable: false,
    label: "Vase / verre spécial",
    reason: "Le verre de vaisselle ou décoratif ne se recycle pas avec le verre d'emballage.",
  },
  toothbrush: {
    material: "autre",
    recyclable: false,
    label: "Brosse à dents",
    reason: "Objet composite difficile à recycler dans le tri classique.",
  },
  "teddy bear": {
    material: "autre",
    recyclable: false,
    label: "Textile / jouet",
    reason: "Objet composite à orienter vers don, réparation ou filière spécialisée.",
  },
};

const MATERIAL_WORDS = [
  { pattern: /bottle|plastic|pet|flacon|bidon/i, material: "plastique", recyclable: true },
  { pattern: /glass|verre|jar|bocal/i, material: "verre", recyclable: true },
  { pattern: /paper|carton|cardboard|box|book|papier/i, material: "papier_carton", recyclable: true },
  { pattern: /metal|can|tin|aluminum|alu|boite/i, material: "metal", recyclable: true },
  { pattern: /phone|laptop|computer|tv|keyboard|mouse|electronic/i, material: "electronique", recyclable: true },
  { pattern: /food|organic|apple|banana|orange|carrot|pizza/i, material: "organique", recyclable: true },
];

const WASTE_LABEL_RULES = [
  {
    pattern: /battery|batterie|pile/i,
    material: "electronique",
    recyclable: true,
    label: "Pile / batterie",
    reason: "Les piles et batteries doivent être déposées en point de collecte spécialisé.",
  },
  {
    pattern: /plastique|plastic|pet|bouteille|bottle|flacon|bidon/i,
    material: "plastique",
    recyclable: true,
    label: "Plastique recyclable",
    reason: "Le modèle personnalisé a reconnu un objet plastique recyclable.",
  },
  {
    pattern: /verre|glass|bocal|jar|bouteille verre/i,
    material: "verre",
    recyclable: true,
    label: "Verre recyclable",
    reason: "Le modèle personnalisé a reconnu du verre recyclable.",
  },
  {
    pattern: /cardboard|carton/i,
    material: "papier_carton",
    recyclable: true,
    label: "Carton recyclable",
    reason: "Le modèle personnalisé a reconnu du carton recyclable.",
  },
  {
    pattern: /clothes|vetement|vêtement|textile|habit/i,
    material: "autre",
    recyclable: false,
    label: "Vêtements",
    reason: "Les vêtements doivent être orientés vers don, réemploi ou collecte textile spécialisée.",
  },
  {
    pattern: /papier|paper|carton|cardboard|box|livre/i,
    material: "papier_carton",
    recyclable: true,
    label: "Papier / carton recyclable",
    reason: "Le modèle personnalisé a reconnu du papier ou carton recyclable.",
  },
  {
    pattern: /metal|métal|canette|can|aluminium|aluminum|boite/i,
    material: "metal",
    recyclable: true,
    label: "Métal recyclable",
    reason: "Le modèle personnalisé a reconnu du métal recyclable.",
  },
  {
    pattern: /electronique|électronique|electronic|phone|laptop|ordinateur|clavier|tv/i,
    material: "electronique",
    recyclable: true,
    label: "Électronique recyclable",
    reason: "Le modèle personnalisé a reconnu un objet électronique à déposer en point spécialisé.",
  },
  {
    pattern: /organique|organic|food|aliment|fruit|légume|compost/i,
    material: "organique",
    recyclable: true,
    label: "Organique compostable",
    reason: "Le modèle personnalisé a reconnu un déchet organique compostable.",
  },
  {
    pattern: /shoes|chaussure|basket/i,
    material: "autre",
    recyclable: false,
    label: "Chaussures",
    reason: "Les chaussures doivent être orientées vers don, réemploi ou collecte textile spécialisée.",
  },
  {
    pattern: /trash|garbage|ordure|dechet|déchet/i,
    material: "autre",
    recyclable: false,
    label: "Déchet non recyclable",
    reason: "Le modèle personnalisé a reconnu un déchet à jeter ou à vérifier selon les consignes locales.",
  },
  {
    pattern: /non.?recyclable|not.?recyclable|déchet|trash|autre|other/i,
    material: "autre",
    recyclable: false,
    label: "Non recyclable",
    reason: "Le modèle personnalisé a reconnu un objet non recyclable ou hors filière.",
  },
];

const normalizeLabelKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

const getConfiguredWasteClass = (label) => {
  const classes = wasteClassifierClassConfig?.classes;
  if (!classes) return null;

  if (Array.isArray(classes)) {
    return classes.find((entry) => {
      const aliases = [entry.id, entry.name, entry.label, ...(entry.aliases || [])];
      return aliases.some((alias) => normalizeLabelKey(alias) === normalizeLabelKey(label));
    });
  }

  const exact = classes[label];
  if (exact) return exact;

  const normalizedLabel = normalizeLabelKey(label);
  const matchedKey = Object.keys(classes).find(
    (key) => normalizeLabelKey(key) === normalizedLabel
  );
  return matchedKey ? classes[matchedKey] : null;
};

const classifyWasteLabel = (label, confidence) => {
  const configuredClass = getConfiguredWasteClass(label);

  if (configuredClass) {
    const isRecyclable = Boolean(configuredClass.recyclable) && confidence >= 55;
    return {
      material: configuredClass.material || "autre",
      confidence,
      detectedObject: configuredClass.label || configuredClass.name || label || "Objet détecté",
      rawDetectedObject: label || "",
      recyclable: isRecyclable,
      detectionStatus: confidence >= 55 ? "custom_model_configured" : "custom_model_low_confidence",
      reason:
        confidence >= 55
          ? configuredClass.reason || "Classe reconnue par le modèle déchets personnalisé."
          : "Le modèle personnalisé hésite. Reprenez une photo plus nette avant de trier.",
      modelSource: "custom",
    };
  }

  const rule = WASTE_LABEL_RULES.find((entry) => entry.pattern.test(label));

  if (!rule) {
    return {
      material: "autre",
      confidence,
      detectedObject: label || "Objet détecté",
      rawDetectedObject: label || "",
      recyclable: false,
      detectionStatus: "custom_model_unknown_label",
      reason:
        "Classe reconnue par le modèle personnalisé, mais non reliée à un matériau EcoScan.",
      modelSource: "custom",
    };
  }

  return {
    material: rule.material,
    confidence,
    detectedObject: rule.label,
    rawDetectedObject: label,
    recyclable: rule.recyclable && confidence >= 55,
    detectionStatus: confidence >= 55 ? "custom_model_recognized" : "custom_model_low_confidence",
    reason:
      confidence >= 55
        ? rule.reason
        : "Le modèle personnalisé hésite. Reprenez une photo plus nette avant de trier.",
    modelSource: "custom",
  };
};

const detectWithWasteClassifier = async (imageElement) => {
  const classifier = await loadWasteClassifier();
  if (!classifier) return null;

  const labels =
    wasteClassifierMetadata?.labels ||
    wasteClassifierMetadata?.modelSettings?.labels ||
    [];

  if (!Array.isArray(labels) || labels.length === 0) return null;

  const input = tf.tidy(() =>
    tf.browser
      .fromPixels(imageElement)
      .resizeBilinear([WASTE_CLASSIFIER_INPUT_SIZE, WASTE_CLASSIFIER_INPUT_SIZE])
      .toFloat()
      .div(255)
      .expandDims(0)
  );

  try {
    const output = classifier.predict(input);
    const scores = Array.from(await output.data());
    output.dispose?.();

    if (labels.length !== scores.length) {
      wasteClassifierLabelMismatch = true;
      console.warn(
        `EcoScan custom model ignored: metadata labels (${labels.length}) do not match model outputs (${scores.length}). Retrain/export the model.`
      );
      return null;
    }

    wasteClassifierLabelMismatch = false;

    const best = scores.reduce(
      (acc, score, index) => (score > acc.score ? { score, index } : acc),
      { score: 0, index: 0 }
    );
    const label = labels[best.index] || `Classe ${best.index + 1}`;
    const confidence = Math.round(best.score * 100);
    const classification = classifyWasteLabel(label, confidence);
    const size = getImageSize(imageElement);

    return {
      class: classification.detectedObject,
      score: best.score,
      bbox: [0, 0, size.width, size.height],
      customClassification: classification,
    };
  } finally {
    input.dispose();
  }
};

const getImageSize = (imageElement) => ({
  width: imageElement?.videoWidth || imageElement?.naturalWidth || imageElement?.width || 1,
  height: imageElement?.videoHeight || imageElement?.naturalHeight || imageElement?.height || 1,
});

const getDetectionPriority = (prediction, imageElement) => {
  const [x = 0, y = 0, width = 0, height = 0] = prediction.bbox || [];
  const size = getImageSize(imageElement);
  const areaRatio = Math.min((width * height) / (size.width * size.height), 1);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const dx = Math.abs(centerX - size.width / 2) / size.width;
  const dy = Math.abs(centerY - size.height / 2) / size.height;
  const centeredScore = 1 - Math.min(Math.sqrt(dx * dx + dy * dy), 1);

  return prediction.score * 0.65 + areaRatio * 0.25 + centeredScore * 0.1;
};

const buildFallbackClassification = (objectName, confidence) => {
  const wordMatch = MATERIAL_WORDS.find((entry) => entry.pattern.test(objectName));

  return {
    material: wordMatch?.material || "autre",
    confidence,
    detectedObject: objectName || "Objet détecté",
    recyclable: Boolean(wordMatch?.recyclable),
    detectionStatus: wordMatch ? "matched_by_keyword" : "unknown_object",
    reason:
      wordMatch?.recyclable
        ? "Classification estimée à partir du nom détecté par l'IA."
        : "Objet reconnu mais non associé à une filière recyclable fiable.",
  };
};

const LOW_CONFIDENCE_RECYCLABLE_CLASSES = new Set([
  "bottle",
  "wine glass",
  "book",
  "scissors",
  "fork",
  "knife",
  "spoon",
  "cell phone",
  "laptop",
  "keyboard",
  "mouse",
  "remote",
  "tv",
  "microwave",
  "oven",
  "toaster",
  "refrigerator",
]);

// Suggest material based on detected objects
export const suggestMaterial = (predictions) => {
  if (!predictions || predictions.length === 0) {
    return null;
  }

  const customPrediction = predictions.find((p) => p.customClassification);
  if (customPrediction) {
    return customPrediction.customClassification;
  }

  const sorted = [...predictions].sort((a, b) => b.score - a.score);
  const matchedPrediction = sorted.find((p) => {
    const objectName = String(p.class || "").toLowerCase();
    return MATERIAL_CLASSIFICATION[objectName];
  });

  const topPrediction = matchedPrediction || sorted[0];
  const objectName = String(topPrediction.class || "").toLowerCase();
  const confidence = Math.round(topPrediction.score * 100);
  const classification = MATERIAL_CLASSIFICATION[objectName];

  if (classification) {
    const isKnownRecyclable =
      classification.recyclable && LOW_CONFIDENCE_RECYCLABLE_CLASSES.has(objectName);
    const isRecyclable = classification.recyclable && (confidence >= 45 || isKnownRecyclable);

    return {
      material: classification.material,
      confidence,
      detectedObject: classification.label || topPrediction.class,
      rawDetectedObject: topPrediction.class,
      recyclable: isRecyclable,
      detectionStatus: confidence >= 50 ? "recognized" : "low_confidence",
      reason:
        isRecyclable
          ? classification.reason
          : "Confiance IA faible. Reprenez une photo plus nette avant de trier.",
    };
  }

  return buildFallbackClassification(objectName, confidence);
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
            recyclable: suggestion?.recyclable || false,
            reason: suggestion?.reason || "",
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
    name: wasteClassifierModel ? "EcoScan Waste Classifier" : "COCO-SSD",
    version: wasteClassifierModel ? "custom-tfjs" : "2.2.3",
    framework: "TensorFlow.js",
    isLoaded: wasteClassifierModel !== null || model !== null,
    customModelAvailable: wasteClassifierModel !== null,
    customModelPath: WASTE_CLASSIFIER_BASE_URL,
    description: wasteClassifierModel
      ? "Classification personnalisée des déchets"
      : "Détection d'objets générique avec fallback COCO-SSD",
    capabilities: [
      "Support modèle Teachable Machine / TensorFlow.js",
      "Fallback COCO-SSD si le modèle personnalisé est absent",
      "Support des images et vidéos",
      "Exécution côté client",
    ],
  };
};

export const getWasteClassifierStatus = () => ({
  customModelAvailable: wasteClassifierModel !== null,
  customModelUnavailable: wasteClassifierUnavailable,
  labelMismatch: wasteClassifierLabelMismatch,
  customModelPath: WASTE_CLASSIFIER_BASE_URL,
  fallbackModel: "COCO-SSD",
});

/**
 * Libérer la mémoire du modèle
 */
export const unloadModel = () => {
  if (model) {
    tf.disposeVariables();
    model = null;
  }
  if (wasteClassifierModel) {
    wasteClassifierModel.dispose?.();
    wasteClassifierModel = null;
  }
  wasteClassifierMetadata = null;
  wasteClassifierClassConfig = null;
  wasteClassifierUnavailable = false;
};
