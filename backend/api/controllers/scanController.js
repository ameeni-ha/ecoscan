const Scan = require("../models/Scan");
const User = require("../models/User");
const axios = require("axios");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const FormData = require("form-data");
const PointsService = require("../utils/PointsService");
const {
  MATERIAL_DATABASE,
  ALLOWED_MATERIALS,
  DATASET_CLASS_NAMES,
  DATASET_CLASS_LABELS,
} = require("../utils/constants");
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://127.0.0.1:5001";
const DATASET_ROOT = path.join(__dirname, "../../../waste_dataset");

class ScanController {
  // Predict material with the local Python/Keras service
  static async predictScan(req, res) {
    try {
      if (req.user.role === "admin" || req.user.accountType === "centre_de_collecte") {
        return res.status(403).json({
          message: "La fonctionnalite Scanner est reservee aux collecteurs.",
        });
      }

      if (!req.file?.path) {
        return res.status(400).json({ message: "Photo requise" });
      }

      const formData = new FormData();
      formData.append("photo", fs.createReadStream(req.file.path), {
        filename: req.file.originalname || "scan.jpg",
        contentType: req.file.mimetype || "application/octet-stream",
      });

      const response = await axios.post(`${PYTHON_AI_URL}/predict`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000,
      });

      return res.json({
        prediction: response.data,
      });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Service IA Python indisponible";
      return res.status(502).json({
        message: `Prediction IA impossible: ${message}`,
      });
    } finally {
      if (req.file?.path) {
        fsp.unlink(req.file.path).catch(() => {});
      }
    }
  }

  // Save a corrected scan photo into waste_dataset/{class}/ for retraining
  static async addScanToDataset(req, res) {
    try {
      if (req.user.role === "admin" || req.user.accountType === "centre_de_collecte") {
        return res.status(403).json({
          message: "La fonctionnalite Scanner est reservee aux collecteurs.",
        });
      }

      if (!req.file?.path) {
        return res.status(400).json({ message: "Photo requise" });
      }

      const datasetClass = String(req.body?.datasetClass || "").trim();
      const predictedClass = String(req.body?.predictedClass || "").trim();

      if (!datasetClass || !DATASET_CLASS_NAMES.includes(datasetClass)) {
        return res.status(400).json({ message: "Classe dataset invalide" });
      }

      const classDir = path.join(DATASET_ROOT, datasetClass);
      await fsp.mkdir(classDir, { recursive: true });

      const ext = path.extname(req.file.originalname || "").toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".bmp"].includes(ext) ? ext : ".jpg";
      const filename = `ecoscan_${req.user._id}_${Date.now()}${safeExt}`;
      const destination = path.join(classDir, filename);

      await fsp.copyFile(req.file.path, destination);

      const files = await fsp.readdir(classDir);
      const imageCount = files.filter((name) =>
        /\.(jpe?g|png|webp|bmp)$/i.test(name)
      ).length;

      return res.status(201).json({
        message: `Photo ajoutée au dataset (${DATASET_CLASS_LABELS[datasetClass] || datasetClass}). Relancez l'entraînement pour améliorer l'IA.`,
        datasetClass,
        datasetLabel: DATASET_CLASS_LABELS[datasetClass] || datasetClass,
        savedPath: destination,
        imagesInClass: imageCount,
        predictedClass: predictedClass || null,
        retrainCommand: "venv\\Scripts\\python.exe train_waste_model.py",
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    } finally {
      if (req.file?.path) {
        fsp.unlink(req.file.path).catch(() => {});
      }
    }
  }

  // Create scan
  static async createScan(req, res) {
    try {
      if (req.user.role === "admin" || req.user.accountType === "centre_de_collecte") {
        return res.status(403).json({
          message: "La fonctionnalite Scanner est reservee aux collecteurs.",
        });
      }

      const label = String(req.body?.label || "").trim();
      const material = String(req.body?.material || "").trim();
      const detectedObject = String(req.body?.detectedObject || "").trim();
      const detectionStatus = String(req.body?.detectionStatus || "").trim();
      const detectionReason = String(req.body?.detectionReason || "").trim();
      const confidence = Math.max(
        0,
        Math.min(100, Number.parseInt(req.body?.confidence || "0", 10) || 0)
      );

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

      // Recyclable = matériau reconnu recyclable côté serveur (prioritaire sur le frontend)
      const recyclableFromRequest =
        req.body?.recyclable !== undefined
          ? req.body.recyclable === "true" || req.body.recyclable === true
          : material !== "autre" && materialData.recyclable;
      const isRecyclable = material !== "autre" && materialData.recyclable && recyclableFromRequest;
      const points = isRecyclable ? materialData.points : 0;
      const instructions = isRecyclable
        ? materialData.instructions
        : detectionReason || materialData.instructions;
      let photoUrl = "";
      if (req.file?.filename) {
        photoUrl = `/uploads/${req.file.filename}`;
      }

      const scan = await Scan.create({
        userId: req.user._id,
        label,
        material,
        recyclable: isRecyclable,
        instructions,
        points,
        photoUrl,
        detectedObject,
        confidence,
        detectionStatus,
        detectionReason,
      });

      let userPointsAfter = typeof req.user.points === "number" ? req.user.points : 0;
      if (points > 0) {
        try {
          const pointsResult = await PointsService.addPoints(req.user._id, points, "scan", {
            scanId: scan._id,
            material,
            confidence,
            photoUrl,
            description: `Points gagnés pour scan recyclable : ${label}`,
          });
          userPointsAfter = pointsResult.totalPoints;
        } catch (pointsError) {
          const fallback = await PointsService.applyPointsDelta(req.user._id, points);
          userPointsAfter = fallback.totalPoints;
        }
      }

      return res.status(201).json({
        message:
          points > 0
            ? `Scan enregistré. +${points} points gagnés !`
            : "Scan enregistré avec succès",
        scan: {
          id: scan._id.toString(),
          label: scan.label,
          material: scan.material,
          recyclable: scan.recyclable,
          instructions: scan.instructions,
          points: scan.points,
          photoUrl: scan.photoUrl,
          detectedObject: scan.detectedObject,
          confidence: scan.confidence,
          detectionStatus: scan.detectionStatus,
          detectionReason: scan.detectionReason,
          createdAt: scan.createdAt,
        },
        userPoints: userPointsAfter,
        pointsEarned: points,
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

      if (scan.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé à consulter ce scan" });
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
          detectedObject: scan.detectedObject,
          confidence: scan.confidence,
          detectionStatus: scan.detectionStatus,
          detectionReason: scan.detectionReason,
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
          detectedObject: scan.detectedObject,
          confidence: scan.confidence,
          detectionStatus: scan.detectionStatus,
          detectionReason: scan.detectionReason,
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

      if (scan.points > 0) {
        await PointsService.deductPoints(req.user._id, scan.points, "deduction", {
          scanId: scan._id,
          material: scan.material,
          description: `Annulation des points du scan : ${scan.label}`,
        });
      }
      await Scan.findByIdAndDelete(req.params.id);

      return res.json({ message: "Scan supprimé avec succès" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }
}

module.exports = ScanController;
