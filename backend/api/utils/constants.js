// Constants
const ALLOWED_CENTER_TYPES = [
  "centre_prive",
  "centre_public",
  "point_depot",
  "ong_association",
];

const ALLOWED_MATERIALS = [
  "plastique",
  "verre",
  "papier_carton",
  "metal",
  "electronique",
  "organique",
];

const SCAN_MATERIAL_TO_CENTER_TAGS = {
  plastique: ["plastic"],
  verre: ["glass"],
  papier_carton: ["paper"],
  metal: ["metal"],
  electronique: ["electronic"],
  organique: ["organic"],
};

const MATERIAL_DATABASE = {
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
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

module.exports = {
  ALLOWED_CENTER_TYPES,
  ALLOWED_MATERIALS,
  SCAN_MATERIAL_TO_CENTER_TAGS,
  MATERIAL_DATABASE,
  OVERPASS_ENDPOINTS,
};
