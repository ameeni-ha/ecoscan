const express = require("express");
const MeetingController = require("../controllers/meetingController");
const authMiddleware = require("../middleware/auth");

const createMeetingRoutes = () => {
  const router = express.Router();

  // Toutes les routes nécessitent l'authentification
  router.use(authMiddleware);

  // POST /api/meetings - Créer une demande
  router.post("/", (req, res) => MeetingController.createMeeting(req, res));

  // GET /api/meetings/my - Mes demandes
  router.get("/my", (req, res) => MeetingController.getMyMeetings(req, res));

  // GET /api/meetings/inbox - Demandes reçues (pour les centres)
  router.get("/inbox", (req, res) => MeetingController.getInbox(req, res));

  // GET /api/meetings/nearby - Centres proches (géolocalisation)
  router.get("/nearby", (req, res) => MeetingController.getNearByCenters(req, res));

  // PATCH /api/meetings/:meetingId/accept - Accepter une demande
  router.patch("/:meetingId/accept", (req, res) => MeetingController.acceptMeeting(req, res));

  // PATCH /api/meetings/:meetingId/reject - Rejeter une demande
  router.patch("/:meetingId/reject", (req, res) => MeetingController.rejectMeeting(req, res));

  return router;
};

module.exports = createMeetingRoutes;
