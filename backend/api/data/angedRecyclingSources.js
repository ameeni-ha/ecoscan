const ANGED_BASE_URL = "http://www.anged.nat.tn";

const withUrl = (path) => `${ANGED_BASE_URL}/${path}`;

const ANGED_AUTHORIZED_LISTS = [
  {
    id: "anged_non_dangerous_organique",
    title: "Sociétés autorisées - déchets organiques",
    materialsAccepted: ["organic"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Organique_WA_3.pdf"),
  },
  {
    id: "anged_non_dangerous_papier",
    title: "Sociétés autorisées - papiers",
    materialsAccepted: ["paper"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Papier_WA_12.pdf"),
  },
  {
    id: "anged_non_dangerous_carton",
    title: "Sociétés autorisées - cartons",
    materialsAccepted: ["paper"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Carton_WA_12.pdf"),
  },
  {
    id: "anged_non_dangerous_metaux",
    title: "Sociétés autorisées - métaux",
    materialsAccepted: ["metal"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Metaux_WA_16.pdf"),
  },
  {
    id: "anged_non_dangerous_plastiques",
    title: "Sociétés autorisées - plastiques",
    materialsAccepted: ["plastic"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Plastiques_WA_15.pdf"),
  },
  {
    id: "anged_non_dangerous_pneus",
    title: "Sociétés autorisées - pneus",
    materialsAccepted: ["mixed"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Pneu_WA_6.pdf"),
  },
  {
    id: "anged_non_dangerous_verre",
    title: "Sociétés autorisées - verres",
    materialsAccepted: ["glass"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Verre_WA_6.pdf"),
  },
  {
    id: "anged_non_dangerous_textile",
    title: "Sociétés autorisées - textiles",
    materialsAccepted: ["textile"],
    category: "Déchets non dangereux",
    pdfUrl: withUrl("user_files/actualites/99/Dechets_Textile_WA_9.pdf"),
  },
  {
    id: "anged_dangerous_batteries",
    title: "Sociétés autorisées - batteries",
    materialsAccepted: ["electronic"],
    category: "Déchets dangereux",
    pdfUrl: withUrl("Liste_societes_autorisees_dechets_dangereux.html"),
  },
  {
    id: "anged_dangerous_deee",
    title: "Sociétés autorisées - déchets électriques et électroniques (DEEE)",
    materialsAccepted: ["electronic"],
    category: "Déchets dangereux",
    pdfUrl: withUrl("Liste_societes_autorisees_dechets_dangereux.html"),
  },
];

// ANGed exposes these official facilities on its public map page. The public
// HTML does not expose exact marker coordinates, so coordinates below are
// approximate governorate/locality positions for map display.
const ANGED_OFFICIAL_FACILITIES = [
  {
    id: "anged_dc_beni_nafaa",
    centerName: "Décharge contrôlée Beni Nafaa",
    city: "Bizerte",
    latitude: 37.2744,
    longitude: 9.8739,
  },
  {
    id: "anged_dc_nabeul",
    centerName: "Décharge contrôlée des O.M et assimilés de Nabeul",
    city: "Nabeul",
    latitude: 36.4513,
    longitude: 10.7353,
  },
  {
    id: "anged_dc_jebel_chakir",
    centerName: "Décharge contrôlée Jebel Chakir",
    city: "Tunis",
    latitude: 36.743,
    longitude: 10.079,
  },
  {
    id: "anged_dc_oued_laya",
    centerName: "Décharge contrôlée de Oued Laya",
    city: "Sousse",
    latitude: 35.775,
    longitude: 10.55,
  },
  {
    id: "anged_dc_menzel_harb",
    centerName: "Décharge contrôlée Menzel Harb",
    city: "Monastir",
    latitude: 35.725,
    longitude: 10.818,
  },
  {
    id: "anged_dc_dissa_gabes",
    centerName: "Décharge contrôlée Dissa Gabès",
    city: "Gabès",
    latitude: 33.88,
    longitude: 10.1,
  },
  {
    id: "anged_dc_medenine",
    centerName: "Décharge contrôlée de Médenine",
    city: "Medenine",
    latitude: 33.354,
    longitude: 10.505,
  },
  {
    id: "anged_dc_guellala",
    centerName: "Décharge contrôlée Guellala",
    city: "Medenine",
    district: "Djerba",
    latitude: 33.724,
    longitude: 10.855,
  },
  {
    id: "anged_dc_kerkena",
    centerName: "Décharge contrôlée Kerkena",
    city: "Sfax",
    district: "Kerkennah",
    latitude: 34.7,
    longitude: 11.17,
  },
  {
    id: "anged_dc_el_margueb",
    centerName: "Décharge contrôlée El Margueb",
    city: "Tozeur",
    latitude: 33.9197,
    longitude: 8.1335,
  },
  {
    id: "anged_dc_bled_ettalla",
    centerName: "Décharge contrôlée Bled Ettalla",
    city: "Zaghouan",
    latitude: 36.402,
    longitude: 10.142,
  },
  {
    id: "anged_dc_sfax",
    centerName: "Décharge contrôlée Sfax",
    city: "Sfax",
    latitude: 34.7406,
    longitude: 10.7603,
  },
  {
    id: "anged_dc_kairouan",
    centerName: "Décharge contrôlée Kairouan",
    city: "Kairouan",
    latitude: 35.678,
    longitude: 10.1,
  },
].map((center) => ({
  ...center,
  materialsAccepted: ["mixed"],
  address: center.district ? `${center.district}, ${center.city}` : center.city,
  openingHours: "Non précisé",
  phone: "",
  centerType: "Installation ANGed",
  description:
    "Installation issue de la carte officielle ANGed. Les coordonnées sont approximatives car la page publique ne fournit pas les coordonnées GPS exactes.",
  source: "ANGed - carte officielle",
  website: withUrl("carte-de-localisation-des-decharges-contrelees.html"),
}));

module.exports = {
  ANGED_AUTHORIZED_LISTS,
  ANGED_OFFICIAL_FACILITIES,
};
