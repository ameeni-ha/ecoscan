const RecyclingCenter = require("../models/RecyclingCenter");
const { haversineKm, centerAcceptsScanMaterial } = require("../utils/helpers");
const { ALLOWED_MATERIALS } = require("../utils/constants");
const { runOverpassQuery } = require("../utils/osm");

class CenterController {
  // Get all recycling centers with filters
  static async getCenters(req, res) {
    try {
      const { city, material, includeUnverified = "true" } = req.query;
      const filter = includeUnverified !== "false" ? {} : { isVerified: true };

      if (city) {
        filter.city = { $regex: city, $options: "i" };
      }

      if (material) {
        filter.materialsAccepted = { $in: [material] };
      }

      const centers = await RecyclingCenter.find(filter)
        .select(
          "centerName managerName city address district openingHours phone materialsAccepted description latitude longitude rating totalReviews capacityPerDayKg centerType registrationNumber"
        )
        .limit(100)
        .lean();

      const formattedCenters = centers.map((center) => ({
        _id: center._id,
        id: center._id.toString(),
        centerName: center.centerName,
        managerName: center.managerName,
        city: center.city,
        address: center.address,
        district: center.district,
        openingHours: center.openingHours,
        phone: center.phone,
        materialsAccepted: center.materialsAccepted,
        description: center.description,
        latitude: center.latitude,
        longitude: center.longitude,
        rating: center.rating,
        totalReviews: center.totalReviews,
        capacityPerDayKg: center.capacityPerDayKg,
        centerType: center.centerType,
      }));

      res.json({ centers: formattedCenters, count: formattedCenters.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch centers", message: error.message });
    }
  }

  // Get nearby centers sorted by distance
  static async getNearby(req, res) {
    try {
      const lat = Number.parseFloat(req.query.lat);
      const lng = Number.parseFloat(req.query.lng);
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "8", 10) || 8, 1), 25);
      const materialRaw = typeof req.query.material === "string" ? req.query.material.trim() : "";

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return res
          .status(400)
          .json({ message: "Parametres lat et lng obligatoires (nombres decimaux)." });
      }

      const centers = await RecyclingCenter.find({
        latitude: { $nin: [null], $exists: true },
        longitude: { $nin: [null], $exists: true },
      })
        .select(
          "_id centerName managerName city address district openingHours phone materialsAccepted description latitude longitude rating totalReviews registrationNumber centerType"
        )
        .limit(400)
        .lean();

      const materialKey = ALLOWED_MATERIALS.includes(materialRaw) ? materialRaw : "";

      const withDist = centers
        .map((center) => {
          const plat = typeof center.latitude === "number" ? center.latitude : null;
          const plng = typeof center.longitude === "number" ? center.longitude : null;
          if (plat == null || plng == null) return null;
          if (!centerAcceptsScanMaterial(center, materialKey)) return null;

          const distanceKm = haversineKm(lat, lng, plat, plng);
          const idStr = center._id.toString();
          return {
            id: idStr,
            centerName: center.centerName,
            managerName: center.managerName,
            city: center.city,
            address: center.address,
            district: center.district,
            openingHours: center.openingHours,
            phone: center.phone,
            materialsAccepted: center.materialsAccepted,
            description: center.description,
            latitude: plat,
            longitude: plng,
            rating: center.rating,
            totalReviews: center.totalReviews,
            registrationNumber: center.registrationNumber,
            centerType: center.centerType,
            distanceKm: Number(distanceKm.toFixed(2)),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit);

      return res.json({ centers: withDist });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Get centers from OpenStreetMap Overpass API
  static async getOSMCenters(req, res) {
    try {
      const { country = "Tunisia", limit = 100 } = req.query;

      const areaSelector =
        String(country).trim().toLowerCase() === "tunisia"
          ? 'area["ISO3166-1"="TN"][admin_level=2]'
          : `area["name"="${country}"]`;

      const overpassQuery = `
        [out:json];
        ${areaSelector}->.searchArea;
        (
          node["amenity"="recycling"](area.searchArea);
          way["amenity"="recycling"](area.searchArea);
          relation["amenity"="recycling"](area.searchArea);
        );
        out center;
      `;
      const response = await runOverpassQuery(overpassQuery);

      const rawElements = Array.isArray(response?.data?.elements) ? response.data.elements : [];

      const centers = rawElements
        .map((el) => {
          const latitude = el.lat ?? el.center?.lat ?? null;
          const longitude = el.lon ?? el.center?.lon ?? null;

          if (latitude === null || longitude === null) return null;

          return {
            id: `osm_${el.id}`,
            centerName: el.tags?.name || `Recycling Center ${el.id}`,
            latitude,
            longitude,
            materialsAccepted: el.tags?.recycling_type
              ? String(el.tags.recycling_type)
                  .split(";")
                  .map((m) => m.trim())
                  .filter(Boolean)
              : [],
            address: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "N/A",
            city: el.tags?.["addr:city"] || el.tags?.["addr:town"] || el.tags?.["addr:village"] || country,
            district: el.tags?.["addr:suburb"] || el.tags?.["addr:district"] || "",
            phone: el.tags?.phone || el.tags?.contact_phone || el.tags?.["contact:phone"] || "",
            email: el.tags?.email || el.tags?.["contact:email"] || "",
            website: el.tags?.website || el.tags?.["contact:website"] || "",
            openingHours: el.tags?.opening_hours || "N/A",
            centerType: "public",
            operator: el.tags?.operator || "",
            description: el.tags?.description || el.tags?.amenity || "",
            source: "OpenStreetMap Overpass API",
          };
        })
        .filter(Boolean)
        .slice(0, Number.parseInt(limit, 10) || 100);

      res.json({
        centers,
        count: centers.length,
        source: "openstreetmap",
        country,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch from Overpass API",
        message: error.message,
      });
    }
  }

  // Get centers from OpenStreetMap (lightweight format)
  static async getRecyclingCenters(req, res) {
    try {
      const { country = "Tunisia" } = req.query;

      const areaSelector =
        String(country).trim().toLowerCase() === "tunisia"
          ? 'area["ISO3166-1"="TN"][admin_level=2]'
          : `area["name"="${country}"]`;

      const overpassQuery = `
        [out:json];
        ${areaSelector}->.searchArea;
        (
          node["amenity"="recycling"](area.searchArea);
          way["amenity"="recycling"](area.searchArea);
          relation["amenity"="recycling"](area.searchArea);
        );
        out center;
      `;
      const response = await runOverpassQuery(overpassQuery);

      const rawElements = Array.isArray(response?.data?.elements) ? response.data.elements : [];

      const centers = rawElements
        .map((el) => {
          const latitude = el.lat ?? el.center?.lat ?? null;
          const longitude = el.lon ?? el.center?.lon ?? null;
          if (latitude === null || longitude === null) return null;

          return {
            id: el.id,
            name: el.tags?.name || "Recycling Center",
            latitude,
            longitude,
            materials: el.tags?.recycling_type || "unknown",
            address: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "N/A",
          };
        })
        .filter(Boolean);

      res.json(centers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching data" });
    }
  }
}

module.exports = CenterController;
