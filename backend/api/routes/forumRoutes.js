const express = require("express");
const ForumController = require("../controllers/forumController");

const createForumRoutes = (uploadMiddleware) => {
  const router = express.Router();

  router.get("/posts", (req, res) => ForumController.getPosts(req, res));

  router.post("/posts", uploadMiddleware, (req, res) => ForumController.createPost(req, res));

  router.get("/posts/:id", (req, res) => ForumController.getPost(req, res));

  router.put("/posts/:id", (req, res) => ForumController.updatePost(req, res));

  router.delete("/posts/:id", (req, res) => ForumController.deletePost(req, res));

  router.post("/posts/:id/comments", (req, res) =>
    ForumController.createComment(req, res)
  );

  router.put("/posts/:id/comments/:commentId", (req, res) =>
    ForumController.updateComment(req, res)
  );

  router.delete("/posts/:id/comments/:commentId", (req, res) =>
    ForumController.deleteComment(req, res)
  );

  return router;
};

module.exports = createForumRoutes;
