const express = require("express");
const AuthController = require("../controllers/authController");

const createAuthRoutes = (tokenManager, requireDatabase) => {
  const router = express.Router();
  const authController = new AuthController(tokenManager);

  router.post("/register", requireDatabase, (req, res) =>
    authController.register(req, res)
  );

  router.post("/login", requireDatabase, (req, res) =>
    authController.login(req, res)
  );

  router.post("/refresh", requireDatabase, (req, res) =>
    authController.refresh(req, res)
  );

  router.post("/logout", requireDatabase, (req, res) =>
    authController.logout(req, res)
  );

  return router;
};

module.exports = createAuthRoutes;
