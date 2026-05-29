const Scan = require("../models/Scan");
const User = require("../models/User");
const { MATERIAL_DATABASE, ALLOWED_MATERIALS } = require("../utils/constants");

class ScanController {
  // Create scan
  static async createScan(req, res) {
    try {
      if (req.user.accountType === "centre_de_collecte") {
        return res.status(403).json({
          message: "Les centres de collecte ne peuvent pas utiliser la fonctionnalite Scanner.",
        });
      }

      const label = String(req.body?.label || "").trim();
      const material = String(req.body?.material || "").trim();

      if (!label || !material) {
        return res.status(400).json({ message: "Label et matériau requis" });
      }

      if (!ALLOWED_MATERIALS.includes(material)) {
        return res.status(400).json({ message: "Matériau invalide" });
      }

      const materialData = MATERIAL_DATABASE[material] || {
        recyclable: true,
        points: 0,
        instructions: "Informations non disponibles pour ce matériau.",
      };

      // Utiliser la valeur recyclable envoyée depuis le frontend si disponible
      const recyclableFromFrontend = req.body?.recyclable !== undefined
        ? req.body.recyclable === "true"
        : materialData.recyclable;

      let photoUrl = "";
      if (req.file?.filename) {
        photoUrl = `/uploads/${req.file.filename}`;
      }

      const scan = await Scan.create({
        userId: req.user._id,
        label,
        material,
        recyclable: recyclableFromFrontend,
        instructions: materialData.instructions,
        points: materialData.points,
        photoUrl,
      });

      let userPointsAfter = typeof req.user.points === "number" ? req.user.points : 0;
      if (materialData.points > 0) {
        const updatedUser = await User.findByIdAndUpdate(
          req.user._id,
          { $inc: { points: materialData.points } },
          { new: true }
        ).lean();
        if (updatedUser && typeof updatedUser.points === "number")
          userPointsAfter = updatedUser.points;
      }

      return res.status(201).json({
        message: "Scan créé avec succès",
        scan: {
          id: scan._id.toString(),
          label: scan.label,
          material: scan.material,
          recyclable: scan.recyclable,
          instructions: scan.instructions,
          points: scan.points,
          photoUrl: scan.photoUrl,
          createdAt: scan.createdAt,
        },
        userPoints: userPointsAfter,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Get scan by ID
  static async getScan(req, res) {
    try {
      const scan = await Scan.findById(req.params.id).lean();

      if (!scan) {
        return res.status(404).json({ message: "Scan introuvable" });
      }

      return res.json({
        scan: {
          id: scan._id.toString(),
          label: scan.label,
          material: scan.material,
          recyclable: scan.recyclable,
          instructions: scan.instructions,
          points: scan.points,
          photoUrl: scan.photoUrl,
          createdAt: scan.createdAt,
        },
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Get user's scans
  static async getMyScans(req, res) {
    try {
      const scans = await Scan.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return res.json({
        scans: scans.map((scan) => ({
          id: scan._id.toString(),
          label: scan.label,
          material: scan.material,
          recyclable: scan.recyclable,
          instructions: scan.instructions,
          points: scan.points,
          photoUrl: scan.photoUrl,
          createdAt: scan.createdAt,
        })),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Delete scan
  static async deleteScan(req, res) {
    try {
      const scan = await Scan.findById(req.params.id);

      if (!scan) {
        return res.status(404).json({ message: "Scan introuvable" });
      }

      // Vérifier que l'utilisateur est le propriétaire du scan
      if (scan.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé à supprimer ce scan" });
      }

      // Supprimer les points associés au scan
      if (scan.points > 0) {
        await User.findByIdAndUpdate(
          req.user._id,
          { $inc: { points: -scan.points } }
        );
      }

      await Scan.findByIdAndDelete(req.params.id);

      return res.json({ message: "Scan supprimé avec succès" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }
}

module.exports = ScanController;
