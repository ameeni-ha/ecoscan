import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";

let model = null;
let wasteClassifierModel = null;
let wasteClassifierMetadata = null;
let wasteClassifierClassConfig = null;
let wasteClassifierUnavailable = false;
let wasteClassifierLabelMismatch = false;

const WASTE_CLASSIFIER_BASE_URL =
  process.env.REACT_APP_WASTE_MODEL_URL || "/models/waste-classifier";
const WASTE_CLASSIFIER_CACHE_BUST = "2026-06-14-tm-preprocess-v1";
const WASTE_CLASSIFIER_INPUT_SIZE = 224;
const WASTE_CLASSIFIER_MIN_CONFIDENCE = 60;
const WASTE_CLASSIFIER_MIN_MARGIN = 10;

// Load the custom waste classifier and the generic MobileNet fallback.
export const loadModel = async () => {
  await loadWasteClassifier();
  if (model) return model;
  try {
    model = await mobilenet.load({ version: 2, alpha: 1.0 });
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
      tf.loadLayersModel(`${WASTE_CLASSIFIER_BASE_URL}/model.json?v=${WASTE_CLASSIFIER_CACHE_BUST}`),
      fetch(`${WASTE_CLASSIFIER_BASE_URL}/metadata.json?v=${WASTE_CLASSIFIER_CACHE_BUST}`),
      fetch(`${WASTE_CLASSIFIER_BASE_URL}/classes.json?v=${WASTE_CLASSIFIER_CACHE_BUST}`).catch(() => null),
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

// MobileNet only (for hybrid scan: object name in browser, material via Python/Keras)
const MOBILENET_ONLY_MIN_SCORE = 0.12;

export const detectObjectsWithMobileNetOnly = async (imageElement) => {
  try {
    if (!model) {
      model = await mobilenet.load({ version: 2, alpha: 1.0 });
    }
    const predictions = await model.classify(imageElement, 8);
    return predictions
      .map((p) => ({
        class: String(p.className || "").split(",")[0].trim(),
        className: p.className,
        score: p.probability || 0,
        bbox: [0, 0, getImageSize(imageElement).width, getImageSize(imageElement).height],
      }))
      .filter((p) => p.score >= MOBILENET_ONLY_MIN_SCORE)
      .filter((p) => !IRRELEVANT_CLASSES.has(String(p.class || "").toLowerCase()))
      .sort((a, b) => getDetectionPriority(b, imageElement) - getDetectionPriority(a, imageElement));
  } catch (error) {
    console.error("Erreur MobileNet:", error);
    throw error;
  }
};

// Detect objects in an image
export const detectObjects = async (imageElement) => {
  try {
    const customPrediction = await detectWithWasteClassifier(imageElement);
    if (customPrediction) {
      return [customPrediction];
    }

    const loadedModel = await loadModel();
    const predictions = await loadedModel.classify(imageElement, 8);

    return predictions
      .map((p) => ({
        class: String(p.className || "").split(",")[0].trim(),
        className: p.className,
        score: p.probability || 0,
        bbox: [0, 0, getImageSize(imageElement).width, getImageSize(imageElement).height],
      }))
      .filter((p) => p.score >= MIN_DETECTION_SCORE)
      .filter((p) => !IRRELEVANT_CLASSES.has(String(p.class || "").toLowerCase()))
      .sort((a, b) => getDetectionPriority(b, imageElement) - getDetectionPriority(a, imageElement));
  } catch (error) {
    console.error("Erreur lors de la détection:", error);
    throw error;
  }
};

const MATERIAL_CLASSIFICATION = {
  "water bottle": {
    material: "plastique",
    recyclable: true,
    label: "Bouteille plastique",
    reason: "MobileNet reconnaît une bouteille. Les bouteilles PET/PEHD propres sont généralement recyclables.",
  },
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
  "cellular telephone": {
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
  { pattern: /bottle|plastic|pet|flacon|bidon|water bottle|pop bottle/i, material: "plastique", recyclable: true },
  { pattern: /glass|verre|jar|bocal|wine bottle|beer bottle/i, material: "verre", recyclable: true },
  { pattern: /paper|carton|cardboard|box|book|papier|envelope|packet/i, material: "papier_carton", recyclable: true },
  { pattern: /metal|can|tin|aluminum|alu|boite|steel|iron/i, material: "metal", recyclable: true },
  { pattern: /phone|laptop|computer|tv|keyboard|mouse|electronic|cellular telephone|remote|monitor/i, material: "electronique", recyclable: true },
  { pattern: /food|organic|apple|banana|orange|carrot|pizza|vegetable|fruit/i, material: "organique", recyclable: true },
];

const WASTE_LABEL_RULES = [
  {
    pattern: /^recyclable$/i,
    material: "recyclable",
    recyclable: true,
    label: "Recyclable",
    reason: "Le modèle TensorFlow MobileNet classe cet objet comme recyclable.",
  },
  {
    pattern: /recyclage[_\s-]*specialise|recyclage[_\s-]*spécialisé|specialized|special/i,
    material: "recyclage_specialise",
    recyclable: true,
    label: "Recyclage spécialisé",
    reason: "Le modèle TensorFlow MobileNet recommande une filière spécialisée.",
  },
  {
    pattern: /non.?recyclable|not.?recyclable|déchet|trash|autre|other/i,
    material: "autre",
    recyclable: false,
    label: "Non recyclable",
    reason: "Le modèle TensorFlow MobileNet a reconnu un objet non recyclable ou hors filière.",
  },
];

const normalizeLabelKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

const MATERIAL_FROM_TM_LABEL = [
  { pattern: /plastique|plastic|pet|bouteille|flacon|bidon/, material: "plastique", label: "Plastique" },
  { pattern: /verre|glass|bocal|jar/, material: "verre", label: "Verre" },
  { pattern: /papier_carton|papier|paper|carton|cardboard/, material: "papier_carton", label: "Papier / carton" },
  { pattern: /metal|metaux|métaux|aluminium|canette/, material: "metal", label: "Métal" },
  { pattern: /electronique|electronic|deee|telephone|phone|batterie|battery|pile|chargeur/, material: "electronique", label: "Électronique" },
  { pattern: /organique|organic|compost|food|aliment/, material: "organique", label: "Organique" },
];

const SORTING_CLASS_LABELS = {
  recyclable: "Recyclable",
  non_recyclable: "Non recyclable",
  recyclage_specialise: "Recyclage spécialisé",
};

const inferSortingClass = (labelKey, material, recyclable) => {
  if (/non_recyclable|nonrecyclable|not_recyclable|trash|dechet|déchet/.test(labelKey)) {
    return "non_recyclable";
  }
  if (/recyclage_specialise|recyclage_specialisé|specialise|spécialisé|specialized|deee/.test(labelKey)) {
    return "recyclage_specialise";
  }
  if (recyclable === false || material === "autre") return "non_recyclable";
  return "recyclable";
};

const inferConfiguredWasteClass = (label) => {
  const labelKey = normalizeLabelKey(label);
  const materialMatch = MATERIAL_FROM_TM_LABEL.find((entry) => entry.pattern.test(labelKey));

  if (!materialMatch && !/recyclable|specialise|spécialisé|specialized|deee|dechet|déchet|trash/.test(labelKey)) {
    return null;
  }

  const sortingClass = inferSortingClass(labelKey, materialMatch?.material || "autre", undefined);
  const recyclable = sortingClass !== "non_recyclable";
  const material =
    sortingClass === "non_recyclable"
      ? "autre"
      : materialMatch?.material || (sortingClass === "recyclage_specialise" ? "recyclage_specialise" : "recyclable");
  const materialLabel = materialMatch?.label || SORTING_CLASS_LABELS[sortingClass];

  return {
    label:
      materialMatch && SORTING_CLASS_LABELS[sortingClass]
        ? `${materialLabel} - ${SORTING_CLASS_LABELS[sortingClass]}`
        : materialLabel || label,
    material,
    sortingClass,
    recyclable,
    reason:
      sortingClass === "recyclage_specialise"
        ? "Le modèle TensorFlow MobileNet recommande une filière spécialisée pour cette matière."
        : sortingClass === "non_recyclable"
        ? "Le modèle TensorFlow MobileNet classe cet objet comme non recyclable."
        : "Le modèle TensorFlow MobileNet a reconnu une matière recyclable.",
  };
};

const getConfiguredWasteClass = (label) => {
  const classes = wasteClassifierClassConfig?.classes;
  if (!classes) return inferConfiguredWasteClass(label);

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
  return matchedKey ? classes[matchedKey] : inferConfiguredWasteClass(label);
};

const isTeachableMachineExport = () =>
  Boolean(wasteClassifierMetadata?.tmVersion) ||
  wasteClassifierMetadata?.packageName === "@teachablemachine/image";

const preprocessWasteClassifierImage = (imageElement) =>
  tf.tidy(() => {
    const imageTensor = tf.browser
      .fromPixels(imageElement)
      .resizeBilinear([WASTE_CLASSIFIER_INPUT_SIZE, WASTE_CLASSIFIER_INPUT_SIZE])
      .toFloat();

    const normalized = isTeachableMachineExport()
      ? imageTensor.div(127.5).sub(1)
      : imageTensor.div(255);

    return normalized.expandDims(0);
  });

const classifyWasteLabel = (label, confidence, margin = 100) => {
  const configuredClass = getConfiguredWasteClass(label);
  const isReliable = confidence >= WASTE_CLASSIFIER_MIN_CONFIDENCE && margin >= WASTE_CLASSIFIER_MIN_MARGIN;

  if (configuredClass) {
    const isRecyclable = Boolean(configuredClass.recyclable) && isReliable;
    return {
      material: configuredClass.material || "autre",
      confidence,
      detectedObject: configuredClass.label || configuredClass.name || label || "Objet détecté",
      rawDetectedObject: label || "",
      recyclable: isRecyclable,
      sortingClass:
        configuredClass.sortingClass ||
        configuredClass.triClass ||
        inferSortingClass(normalizeLabelKey(label), configuredClass.material || "autre", configuredClass.recyclable),
      detectionStatus: isReliable ? "custom_model_configured" : "custom_model_low_confidence",
      reason:
        isReliable
          ? configuredClass.reason || "Classe reconnue par le modèle déchets personnalisé."
          : "Le modèle personnalisé hésite. Corrigez la classe ou ajoutez plus d'exemples d'entraînement.",
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
    recyclable: rule.recyclable && isReliable,
    sortingClass: inferSortingClass(normalizeLabelKey(label), rule.material, rule.recyclable),
    detectionStatus: isReliable ? "custom_model_recognized" : "custom_model_low_confidence",
    reason:
      isReliable
        ? rule.reason
        : "Le modèle personnalisé hésite. Corrigez la classe ou ajoutez plus d'exemples d'entraînement.",
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

  const input = preprocessWasteClassifierImage(imageElement);

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

    const ranked = scores
      .map((score, index) => ({ score, index, label: labels[index] }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0] || { score: 0, index: 0, label: labels[0] };
    const label = best.label || `Classe ${best.index + 1}`;
    const confidence = Math.round(best.score * 100);
    const secondConfidence = Math.round((ranked[1]?.score || 0) * 100);
    const margin = confidence - secondConfidence;
    const classification = classifyWasteLabel(label, confidence, margin);
    const size = getImageSize(imageElement);
    const topPredictions = ranked.slice(0, 3).map(({ label: rawLabel, score }) => {
      const configuredClass = getConfiguredWasteClass(rawLabel);
      return {
        label: rawLabel,
        displayLabel: configuredClass?.label || rawLabel,
        confidence: Math.round(score * 100),
      };
    });

    return {
      class: classification.detectedObject,
      score: best.score,
      bbox: [0, 0, size.width, size.height],
      customClassification: classification,
      topPredictions,
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

export const ELECTRONICS_MOBILENET_CLASSES = new Set([
  "cell phone",
  "remote",
  "keyboard",
  "mouse",
  "laptop",
  "tv",
  "microwave",
  "oven",
  "toaster",
  "refrigerator",
]);

const isElectronicClassName = (className) =>
  /cell phone|cellular telephone|remote|keyboard|mouse|laptop|notebook|computer|monitor|television|tv|microwave|oven|toaster|refrigerator/i.test(
    className || ""
  );

/** Prefer electronics when MobileNet sees phone/remote/etc. even if another object scores higher. */
export const buildMobileNetSuggestionFromPredictions = (predictions) => {
  if (!predictions?.length) return null;

  const sorted = [...predictions].sort((a, b) => b.score - a.score);
  const topLabels = sorted
    .slice(0, 4)
    .map((p) => `${p.className || p.class} ${Math.round((p.score || 0) * 100)}%`)
    .join(" · ");

  const electronicsHit = sorted.find((p) => isElectronicClassName(p.className || p.class));

  if (electronicsHit && electronicsHit.score >= 0.18) {
    const objectName = String(electronicsHit.class).toLowerCase();
    const classification = MATERIAL_CLASSIFICATION[objectName];
    const confidence = Math.round((electronicsHit.score || 0) * 100);
    return {
      material: "recyclage_specialise",
      confidence,
      detectedObject: classification?.label || electronicsHit.class,
      rawDetectedObject: electronicsHit.class,
      recyclable: true,
      detectionStatus: "mobilenet_specialized_recycling",
      reason:
        classification?.reason ||
        "Appareil électronique reconnu. Déposez-le en point de collecte spécialisé.",
      modelSource: "tensorflow-mobilenet",
      allMobileNetTop: topLabels,
    };
  }

  const base = suggestMaterial(predictions);
  if (!base) return null;
  return { ...base, allMobileNetTop: topLabels };
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
    name: wasteClassifierModel ? "EcoScan Waste Classifier" : "MobileNet",
    version: wasteClassifierModel ? "custom-tfjs-mobilenet" : "2.1.1",
    framework: "TensorFlow.js",
    isLoaded: wasteClassifierModel !== null || model !== null,
    customModelAvailable: wasteClassifierModel !== null,
    customModelPath: WASTE_CLASSIFIER_BASE_URL,
    description: wasteClassifierModel
      ? "Classification personnalisée des déchets"
      : "Classification d'image générique avec fallback MobileNet",
    capabilities: [
      "Support modèle TensorFlow.js MobileNet personnalisé",
      "Fallback MobileNet si le modèle personnalisé est absent",
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
  fallbackModel: "MobileNet",
});

/** Classification matière via modèle TensorFlow.js MobileNet (navigateur). */
export const predictWasteMaterial = async (imageElement) => {
  const prediction = await detectWithWasteClassifier(imageElement);
  if (!prediction?.customClassification) return null;

  return {
    ...prediction.customClassification,
    topPredictions: prediction.topPredictions || [],
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
  if (wasteClassifierModel) {
    wasteClassifierModel.dispose?.();
    wasteClassifierModel = null;
  }
  wasteClassifierMetadata = null;
  wasteClassifierClassConfig = null;
  wasteClassifierUnavailable = false;
};
