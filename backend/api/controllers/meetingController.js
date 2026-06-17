const MeetingRequest = require("../models/MeetingRequest");
const RecyclingCenter = require("../models/RecyclingCenter");
const User = require("../models/User");
const Scan = require("../models/Scan");
const NotificationService = require("../utils/NotificationService");
const { centerAcceptsScanMaterial } = require("../utils/helpers");
const mongoose = require("mongoose");

const formatMeetingScan = (scan) => ({
  id: scan._id.toString(),
  material: scan.material,
  sortingClass: scan.sortingClass || "",
  label: scan.label,
  photoUrl: scan.photoUrl,
  points: scan.points,
});

const getManagedCenterIdsForUser = async (user) => {
  if (user.role === "admin") return null;
  const rcByEmail = await RecyclingCenter.find({
    email: String(user.email || "").trim().toLowerCase(),
  })
    .select("_id")
    .lean();
  return rcByEmail.map((center) => center._id.toString());
};

class MeetingController {
  // Create meeting request
  static async createMeeting(req, res) {
    try {
      const centerUserId = req.body?.centerUserId ? String(req.body.centerUserId).trim() : "";
      const preferredDateRaw = req.body?.preferredDate;
      const message = String(req.body?.message || "").trim().slice(0, 2000);
      const material = String(req.body?.material || "").trim();
      const scanId = req.body?.scanId || null;
      const scanIdsInput = Array.isArray(req.body?.scanIds)
        ? req.body.scanIds
        : scanId
        ? [scanId]
        : [];
      const scanIds = [...new Set(scanIdsInput.map((id) => String(id || "").trim()))].filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (!centerUserId) {
        return res.status(400).json({ message: "Centre obligatoire" });
      }

      const centerDoc = await RecyclingCenter.findById(centerUserId)
        .select("_id centerName email materialsAccepted")
        .lean();
      if (!centerDoc) {
        return res.status(404).json({ message: "Centre inconnu ou sans fiche recycleur" });
      }

      const centerAccount = await User.findOne({
        email: String(centerDoc.email || "").trim().toLowerCase(),
        accountType: "centre_de_collecte",
      })
        .select("_id")
        .lean();

      if (!centerAccount) {
        return res.status(400).json({
          message:
            "Ce centre est affiché sur la carte mais n'a pas encore de compte EcoScan. Il ne peut pas recevoir de notification de rendez-vous.",
        });
      }

      let selectedScans = [];
      if (scanIds.length > 0) {
        selectedScans = await Scan.find({
          _id: { $in: scanIds },
          userId: req.user._id,
        })
          .select("_id label material sortingClass photoUrl points")
          .lean();

        if (selectedScans.length !== scanIds.length) {
          return res.status(400).json({
            message: "Un ou plusieurs scans sélectionnés sont introuvables ou ne vous appartiennent pas.",
          });
        }

        const refusedMaterials = selectedScans
          .map((scan) => scan.material)
          .filter((scanMaterial) => !centerAcceptsScanMaterial(centerDoc, scanMaterial));

        if (refusedMaterials.length > 0) {
          return res.status(400).json({
            message: `Ce centre n'accepte pas tous les matériaux sélectionnés (${[
              ...new Set(refusedMaterials),
            ].join(", ")}). Choisissez un autre centre ou retirez ces scans.`,
          });
        }
      }

      let preferredDate = null;
      if (preferredDateRaw) {
        const d = new Date(preferredDateRaw);
        preferredDate = Number.isNaN(d.getTime()) ? null : d;
        if (!preferredDate || preferredDate.getTime() < Date.now()) {
          return res.status(400).json({
            message: "La date du rendez-vous ne peut pas être avant la date actuelle.",
          });
        }
      }

      const meetingMaterial =
        selectedScans.length > 0
          ? [...new Set(selectedScans.map((scan) => scan.material).filter(Boolean))].join(", ")
          : material;

      const mr = await MeetingRequest.create({
        requesterId: req.user._id,
        centerUserId: centerDoc._id,
        preferredDate,
        message,
        material: meetingMaterial,
        scanId: scanIds[0] || null,
        scanIds,
        status: "pending",
      });

      // Notifier le centre
      const requester = await User.findById(req.user._id).select("firstName lastName");
      await NotificationService.notifyNewMeetingRequest(
        centerAccount._id,
        `${requester.firstName} ${requester.lastName}`,
        meetingMaterial || "matériau inconnu"
      );

      return res.status(201).json({ 
        message: "Demande créée avec succès",
        meetingId: mr._id.toString(),
        meeting: mr 
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Get my meetings
  static async getMyMeetings(req, res) {
    try {
      const rows = await MeetingRequest.find({ requesterId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("centerUserId", "centerName city phone address district")
        .populate("scanId", "material label photoUrl points")
        .populate("scanIds", "material sortingClass label photoUrl points")
        .lean();

      const meetings = rows.map((m) => ({
        id: m._id.toString(),
        status: m.status,
        material: m.material,
        message: m.message,
        preferredDate: m.preferredDate,
        createdAt: m.createdAt,
        acceptedAt: m.acceptedAt,
        rejectedAt: m.rejectedAt,
        rejectionReason: m.rejectionReason,
        center: m.centerUserId
          ? {
              id: m.centerUserId._id.toString(),
              centerName: m.centerUserId.centerName,
              city: m.centerUserId.city,
              phone: m.centerUserId.phone,
              address: m.centerUserId.address,
              district: m.centerUserId.district,
            }
          : null,
        scan: m.scanId ? formatMeetingScan(m.scanId) : null,
        scans: Array.isArray(m.scanIds) ? m.scanIds.map(formatMeetingScan) : [],
      }));

      return res.json({ meetings });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Get inbox meetings (pour les centres)
  static async getInbox(req, res) {
    try {
      let rows;

      if (req.user.role === "admin") {
        rows = await MeetingRequest.find({})
          .sort({ createdAt: -1 })
          .limit(200)
          .populate("requesterId", "firstName lastName email")
          .populate("scanId", "material label photoUrl")
          .populate("scanIds", "material sortingClass label photoUrl points")
          .lean();
      } else {
        const myCenterIds = (await getManagedCenterIdsForUser(req.user)) || [];

        const oids = myCenterIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        if (!oids.length) {
          return res.json({ meetings: [] });
        }

        rows = await MeetingRequest.find({ centerUserId: { $in: oids } })
          .sort({ createdAt: -1 })
          .limit(100)
          .populate("requesterId", "firstName lastName email phone")
          .populate("scanId", "material label photoUrl points")
          .populate("scanIds", "material sortingClass label photoUrl points")
          .lean();
      }

      const meetings = rows.map((m) => ({
        id: m._id.toString(),
        status: m.status,
        material: m.material,
        message: m.message,
        preferredDate: m.preferredDate,
        createdAt: m.createdAt,
        acceptedAt: m.acceptedAt,
        meetingConfirmedDate: m.meetingConfirmedDate,
        requester: m.requesterId
          ? {
              id: m.requesterId._id.toString(),
              firstName: m.requesterId.firstName,
              lastName: m.requesterId.lastName,
              email: m.requesterId.email,
              phone: m.requesterId.phone,
            }
          : null,
        scan: m.scanId ? formatMeetingScan(m.scanId) : null,
        scans: Array.isArray(m.scanIds) ? m.scanIds.map(formatMeetingScan) : [],
      }));

      return res.json({ meetings });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  /**
   * Accepter une demande de rendez-vous
   * PATCH /api/meetings/:meetingId/accept
   */
  static async acceptMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const { meetingDate, notes } = req.body;

      if (!req.user?._id) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const meeting = await MeetingRequest.findById(meetingId);

      if (!meeting) {
        return res.status(404).json({ message: "Demande non trouvée" });
      }

      const managedCenterIds = await getManagedCenterIdsForUser(req.user);
      if (managedCenterIds && !managedCenterIds.includes(meeting.centerUserId.toString())) {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé" });
      }

      if (meeting.status !== "pending") {
        return res.status(400).json({
          message: `Cette demande a déjà été ${meeting.status}`,
        });
      }

      meeting.status = "accepted";
      meeting.acceptedAt = new Date();
      meeting.meetingConfirmedDate = meetingDate ? new Date(meetingDate) : null;
      if (
        meeting.meetingConfirmedDate &&
        Number.isFinite(meeting.meetingConfirmedDate.getTime()) &&
        meeting.meetingConfirmedDate.getTime() < Date.now()
      ) {
        return res.status(400).json({
          message: "La date confirmée ne peut pas être avant la date actuelle.",
        });
      }
      meeting.notes = notes || "";
      await meeting.save();

      // Notifier l'utilisateur
      const center = await RecyclingCenter.findById(meeting.centerUserId);
      await NotificationService.notifyMeetingAccepted(
        meeting.requesterId,
        center.centerName,
        meeting.meetingConfirmedDate
      );

      return res.json({
        message: "Demande acceptée avec succès",
        meeting,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  /**
   * Rejeter une demande de rendez-vous
   * PATCH /api/meetings/:meetingId/reject
   */
  static async rejectMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const { rejectionReason } = req.body;

      if (!req.user?._id) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const meeting = await MeetingRequest.findById(meetingId);

      if (!meeting) {
        return res.status(404).json({ message: "Demande non trouvée" });
      }

      const managedCenterIds = await getManagedCenterIdsForUser(req.user);
      if (managedCenterIds && !managedCenterIds.includes(meeting.centerUserId.toString())) {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé" });
      }

      if (meeting.status !== "pending") {
        return res.status(400).json({
          message: `Cette demande a déjà été ${meeting.status}`,
        });
      }

      meeting.status = "rejected";
      meeting.rejectedAt = new Date();
      meeting.rejectionReason = rejectionReason || "";
      await meeting.save();

      // Notifier l'utilisateur
      const center = await RecyclingCenter.findById(meeting.centerUserId);
      await NotificationService.notifyMeetingRejected(
        meeting.requesterId,
        center.centerName
      );

      return res.json({
        message: "Demande rejetée",
        meeting,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  /**
   * Obtenir les centres proches (géolocalisation)
   * GET /api/meetings/nearby?lat=X&lng=Y&material=plastique
   */
  static async getNearByCenters(req, res) {
    try {
      const { lat, lng, material } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ message: "lat et lng sont requis" });
      }

      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radiusKm = 50;

      const centers = await RecyclingCenter.find({
        ...(material && { materialsAccepted: material }),
        isVerified: true,
      })
        .select(
          "centerName city address phone openingHours closingDays materialsAccepted latitude longitude rating totalReviews _id"
        )
        .lean();

      const centersWithDistance = centers
        .map((center) => {
          const distance = this.haversineDistance(
            userLat,
            userLng,
            center.latitude || 0,
            center.longitude || 0
          );

          return {
            ...center,
            distance: Math.round(distance * 10) / 10,
          };
        })
        .filter((center) => center.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);

      return res.json({
        success: true,
        centers: centersWithDistance,
        count: centersWithDistance.length,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  /**
   * Haversine distance calculation (km)
   */
  static haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = MeetingController;
