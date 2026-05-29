const express = require("express");
const UserController = require("../controllers/userController");

const createUserRoutes = () => {
  const router = express.Router();

  router.patch("/me", (req, res) => UserController.updateProfile(req, res));

  router.get("/me", (req, res) => UserController.getProfile(req, res));

  router.post("/logout-all", (req, res) => {
    req.user.refreshTokens = [];
    req.user.save().then(() => {
      res.clearCookie("ecoscan_refresh_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      res.status(204).send();
    });
  });

  return router;
};

module.exports = createUserRoutes;
