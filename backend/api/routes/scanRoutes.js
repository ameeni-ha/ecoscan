const express = require("express");
const ScanController = require("../controllers/scanController");

const createScanRoutes = (uploadMiddleware) => {
  const router = express.Router();

  router.post("/predict", uploadMiddleware, (req, res) => ScanController.predictScan(req, res));

  router.post("/dataset-feedback", uploadMiddleware, (req, res) =>
    ScanController.addScanToDataset(req, res)
  );

  router.post("/", uploadMiddleware, (req, res) => ScanController.createScan(req, res));

  router.get("/my", (req, res) => ScanController.getMyScans(req, res));

  router.get("/:id", (req, res) => ScanController.getScan(req, res));

  router.delete("/:id", (req, res) => ScanController.deleteScan(req, res));

  return router;
};

module.exports = createScanRoutes;
