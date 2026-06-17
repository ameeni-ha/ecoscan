const express = require("express");
const router = express.Router();
const NotificationService = require("../utils/NotificationService");

/**
 * GET /api/notifications
 * Obtenir toutes les notifications de l'utilisateur avec pagination
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await NotificationService.getAll(req.user._id, limit, page);

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

/**
 * GET /api/notifications/unread
 * Obtenir les notifications non lues
 */
router.get("/unread", async (req, res) => {
  try {
    const result = await NotificationService.getUnread(req.user._id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

/**
 * GET /api/notifications/unread/count
 * Obtenir le nombre de notifications non lues
 */
router.get("/unread/count", async (req, res) => {
  try {
    const result = await NotificationService.getUnreadCount(req.user._id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marquer une notification comme lue
 */
router.patch("/:id/read", async (req, res) => {
  try {
    const result = await NotificationService.markAsRead(req.params.id, req.user._id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Marquer toutes les notifications comme lues
 */
router.patch("/read-all", async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user._id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

/**
 * DELETE /api/notifications/clear-read
 * Supprimer toutes les notifications lues
 */
router.delete("/clear-read", async (req, res) => {
  try {
    const result = await NotificationService.deleteRead(req.user._id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

/**
 * DELETE /api/notifications/:id
 * Supprimer une notification
 */
router.delete("/:id", async (req, res) => {
  try {
    const result = await NotificationService.delete(req.params.id, req.user._id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

module.exports = () => router;
