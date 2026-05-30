const express = require("express");
const AdminController = require("../controllers/adminController");

const createAdminRoutes = () => {
  const router = express.Router();

  router.get("/stats", (req, res) => AdminController.stats(req, res));

  router.get("/users", (req, res) => AdminController.users(req, res));
  router.patch("/users/:id", (req, res) => AdminController.updateUser(req, res));
  router.delete("/users/:id", (req, res) => AdminController.deleteUser(req, res));

  router.get("/scans", (req, res) => AdminController.scans(req, res));
  router.patch("/scans/:id", (req, res) => AdminController.updateScan(req, res));
  router.delete("/scans/:id", (req, res) => AdminController.deleteScan(req, res));

  router.get("/centers", (req, res) => AdminController.centers(req, res));
  router.delete("/centers/:id", (req, res) => AdminController.deleteCenter(req, res));

  router.get("/posts", (req, res) => AdminController.posts(req, res));
  router.patch("/posts/:id/status", (req, res) => AdminController.updatePostStatus(req, res));
  router.patch("/posts/:id", (req, res) => AdminController.updatePost(req, res));
  router.delete("/posts/:id", (req, res) => AdminController.deletePost(req, res));
  router.patch("/comments/:commentId/status", (req, res) =>
    AdminController.updateCommentStatus(req, res)
  );
  router.patch("/comments/:commentId", (req, res) => AdminController.updateComment(req, res));
  router.delete("/comments/:commentId", (req, res) => AdminController.deleteComment(req, res));

  return router;
};

module.exports = createAdminRoutes;
