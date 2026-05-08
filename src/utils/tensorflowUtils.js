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
    const predictions = await loadedModel.estimateObjects(imageElement);
    return predictions;
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
  "plastic bag": "plastique",
  "water bottle": "plastique",
  
  // Verre
  glass: "verre",
  "wine glass": "verre",
  "drinking glass": "verre",
  
  // Papier/Carton
  book: "papier_carton",
  newspaper: "papier_carton",
  cardboard: "papier_carton",
  box: "papier_carton",
  
  // Métal
  can: "metal",
  aluminum: "metal",
  fork: "metal",
  spoon: "metal",
  knife: "metal",
  
  // Électronique
  keyboard: "electronique",
  mouse: "electronique",
  phone: "electronique",
  laptop: "electronique",
  computer: "electronique",
  monitor: "electronique",
  remote: "electronique",
  
  // Organique
  apple: "organique",
  banana: "organique",
  orange: "organique",
  food: "organique",
  fruit: "organique",
  vegetable: "organique",
};

// Suggest material based on detected objects
export const suggestMaterial = (predictions) => {
  if (!predictions || predictions.length === 0) {
    return null;
  }

  // Get the most confident prediction
  const topPrediction = predictions.reduce((prev, current) =>
    prev.score > current.score ? prev : current
  );

  const objectName = topPrediction.class.toLowerCase();
  
  // Direct match
  if (OBJECT_TO_MATERIAL_MAP[objectName]) {
    return {
      material: OBJECT_TO_MATERIAL_MAP[objectName],
      confidence: Math.round(topPrediction.score * 100),
      detectedObject: topPrediction.class,
    };
  }

  // Partial match
  for (const [key, material] of Object.entries(OBJECT_TO_MATERIAL_MAP)) {
    if (objectName.includes(key) || key.includes(objectName)) {
      return {
        material,
        confidence: Math.round(topPrediction.score * 100),
        detectedObject: topPrediction.class,
      };
    }
  }

  // Default fallback
  return {
    material: null,
    confidence: Math.round(topPrediction.score * 100),
    detectedObject: topPrediction.class,
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
