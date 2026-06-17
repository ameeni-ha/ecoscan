// Constants
const ALLOWED_CENTER_TYPES = [
  "centre_prive",
  "centre_public",
  "point_depot",
  "ong_association",
];

const ALLOWED_MATERIALS = [
  "recyclable",
  "recyclage_specialise",
  "plastique",
  "verre",
  "papier_carton",
  "metal",
  "electronique",
  "organique",
  "autre",
];

const SCAN_MATERIAL_TO_CENTER_TAGS = {
  recyclable: [],
  recyclage_specialise: ["electronic", "mixed"],
  plastique: ["plastic"],
  verre: ["glass"],
  papier_carton: ["paper"],
  metal: ["metal"],
  electronique: ["electronic"],
  organique: ["organic"],
  autre: [],
};

const MATERIAL_DATABASE = {
  recyclable: {
    recyclable: true,
    points: 3,
    instructions:
      "Objet classé comme recyclable. Vérifiez la matière exacte et déposez-le dans le bac ou centre adapté selon les consignes locales.",
  },
  recyclage_specialise: {
    recyclable: true,
    points: 8,
    instructions:
      "Objet à orienter vers une filière spécialisée. Ne le jetez pas avec les déchets ménagers; cherchez un point de dépôt adapté.",
  },
  plastique: {
    recyclable: true,
    points: 5,
    instructions:
      "Rincez et videz les contenants. Retirez les bouchons et les étiquettes. Mettez dans le bac de recyclage plastique.",
  },
  verre: {
    recyclable: true,
    points: 3,
    instructions:
      "Nettoyez le verre. Retirez les bouchons en métal ou plastique. Déposez dans le bac de recyclage du verre.",
  },
  papier_carton: {
    recyclable: true,
    points: 2,
    instructions:
      "Aplatissez les cartons. Enlevez le polystyrène ou les plastiques. Mettez dans le bac à papier/carton.",
  },
  metal: {
    recyclable: true,
    points: 4,
    instructions:
      "Rincez les conserves. Aplatissez-les pour économiser l'espace. Déposez dans le bac de recyclage des métaux.",
  },
  electronique: {
    recyclable: true,
    points: 10,
    instructions:
      "Ne mettez pas à la poubelle! Apportez à un centre de collecte d'appareils électroniques pour un traitement sécurisé.",
  },
  organique: {
    recyclable: true,
    points: 1,
    instructions:
      "Composez les déchets organiques dans un composteur ou mettez dans le bac de compostage.",
  },
  autre: {
    recyclable: false,
    points: 0,
    instructions:
      "Objet non reconnu comme recyclable par EcoScan. Consultez les consignes locales ou un centre spécialisé avant de le jeter.",
  },
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

// Must match Teachable Machine metadata labels and train_waste_model.py CLASS_NAMES
const DATASET_CLASS_NAMES = [
  "plastique_recyclable",
  "verre_recyclable",
  "papier_carton_recyclable",
  "metal_recyclable",
  "organique_recyclable",
  "electronique_recyclage_specialise",
  "batterie_recyclage_specialise",
  "autre_non_recyclable",
];

const DATASET_CLASS_LABELS = {
  plastique_recyclable: "Plastique - recyclable",
  verre_recyclable: "Verre - recyclable",
  papier_carton_recyclable: "Papier / carton - recyclable",
  metal_recyclable: "Métal - recyclable",
  organique_recyclable: "Organique - recyclable",
  electronique_recyclage_specialise: "Électronique - recyclage spécialisé",
  batterie_recyclage_specialise: "Pile / batterie - recyclage spécialisé",
  autre_non_recyclable: "Autre - non recyclable",
};

module.exports = {
  ALLOWED_CENTER_TYPES,
  ALLOWED_MATERIALS,
  SCAN_MATERIAL_TO_CENTER_TAGS,
  MATERIAL_DATABASE,
  OVERPASS_ENDPOINTS,
  DATASET_CLASS_NAMES,
  DATASET_CLASS_LABELS,
};
