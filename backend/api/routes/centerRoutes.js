const express = require("express");
const CenterController = require("../controllers/centerController");

const createCenterRoutes = () => {
  const router = express.Router();

  router.get("/", (req, res) => CenterController.getCenters(req, res));

  router.get("/nearby", (req, res) => CenterController.getNearby(req, res));

  router.get("/anged", (req, res) => CenterController.getAngedCenters(req, res));

  router.get("/osm", (req, res) => CenterController.getOSMCenters(req, res));

  router.get("/osm-recycling-centers", (req, res) => CenterController.getOSMCenters(req, res));

  return router;
};

module.exports = createCenterRoutes;
