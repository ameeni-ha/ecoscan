const CENTER_TAG_TO_INSCRIPTION = {
  plastic: "plastique",
  glass: "verre",
  paper: "papier_carton",
  metal: "metal",
  electronic: "electronique",
  organic: "organique",
};

export const getExternalSourceKey = (center) => {
  const source = String(center?.source || "").toLowerCase();
  if (source.includes("anged")) return "anged";
  if (source.includes("openstreetmap") || source.includes("osm")) return "osm";
  return "";
};

export const getExternalLinkKey = (source, sourceId) => {
  if (!source || !sourceId) return "";
  return `${source}:${String(sourceId)}`;
};

export const mapCenterTagsToInscriptionMaterials = (materials) => {
  if (!Array.isArray(materials)) return [];
  return [
    ...new Set(
      materials
        .map((tag) => CENTER_TAG_TO_INSCRIPTION[tag] || tag)
        .filter((tag) => Object.values(CENTER_TAG_TO_INSCRIPTION).includes(tag))
    ),
  ];
};

export const buildCenterRegistrationUrl = (center) => {
  const params = new URLSearchParams();
  const externalSource = getExternalSourceKey(center);
  const externalSourceId = String(center?.id || center?._id || "").trim();

  params.set("accountType", "centre_de_collecte");
  if (center?.centerName) params.set("centerName", center.centerName);
  if (center?.city) params.set("city", center.city);
  if (center?.district) params.set("district", center.district);
  if (center?.openingHours && center.openingHours !== "N/A") {
    params.set("openingHours", center.openingHours);
  }
  if (center?.description) params.set("description", center.description);
  if (Number.isFinite(Number(center?.latitude))) params.set("latitude", String(center.latitude));
  if (Number.isFinite(Number(center?.longitude))) params.set("longitude", String(center.longitude));
  if (externalSource && externalSourceId) {
    params.set("externalSource", externalSource);
    params.set("externalSourceId", externalSourceId);
  }

  const inscriptionMaterials = mapCenterTagsToInscriptionMaterials(center?.materialsAccepted);
  if (inscriptionMaterials.length > 0) {
    params.set("materials", inscriptionMaterials.join(","));
  }

  return `/inscription?${params.toString()}`;
};

export const mergeCenterSources = (localCenters, angedCenters, osmCenters) => {
  const linkedExternalKeys = new Set(
    localCenters
      .filter((center) => center.externalSource && center.externalSourceId)
      .map((center) => getExternalLinkKey(center.externalSource, center.externalSourceId))
  );

  const enrichedLocal = localCenters.map((center) => ({
    ...center,
    source: "EcoScan",
    isLinkedExternal: Boolean(center.externalSource && center.externalSourceId),
    linkedExternalLabel:
      center.externalSource === "anged"
        ? "ANGed"
        : center.externalSource === "osm"
        ? "OpenStreetMap"
        : null,
  }));

  const filterExternal = (center, sourceKey) => {
    const id = String(center.id || center._id || "");
    if (!id) return true;
    return !linkedExternalKeys.has(getExternalLinkKey(sourceKey, id));
  };

  const externalAnged = angedCenters
    .filter((center) => filterExternal(center, "anged"))
    .map((center) => ({
      ...center,
      source: center.source || "ANGed",
      canReceiveMeetings: false,
      needsEcoScanAccount: true,
    }));

  const externalOsm = osmCenters
    .filter((center) => filterExternal(center, "osm"))
    .map((center) => ({
      ...center,
      source: center.source || "OpenStreetMap",
      canReceiveMeetings: false,
      needsEcoScanAccount: true,
    }));

  const seen = new Set();
  const merged = [];

  for (const center of [...enrichedLocal, ...externalAnged, ...externalOsm]) {
    const key = String(center.id || center._id || "");
    const lat = Number(center.latitude);
    const lon = Number(center.longitude);
    const coordKey =
      Number.isFinite(lat) && Number.isFinite(lon)
        ? `${lat.toFixed(5)},${lon.toFixed(5)}`
        : `name:${center.centerName || ""}:${center.city || ""}`;

    const dedupeKey = key || coordKey;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(center);
  }

  return merged;
};
