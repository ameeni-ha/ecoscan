const mongoose = require("mongoose");
const User = require("../models/User");
const TokenManager = require("../utils/tokenManager");

// Create auth middleware factory
const createAuthMiddleware = (tokenManager) => {
  return async (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message:
          "Base de donnees indisponible. Verifie la connexion MongoDB puis reessaie.",
      });
    }

    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");

    if (!token) {
      return res.status(401).json({ message: "Authentification requise" });
    }

    try {
      const payload = tokenManager.verifyAccessToken(token);
      const user = await User.findById(payload.sub);

      if (!user) {
        return res.status(401).json({ message: "Utilisateur introuvable" });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ message: error.message || "Session invalide" });
    }
  };
};

// Check database availability
const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message:
        "Base de donnees indisponible. Verifie la connexion MongoDB puis reessaie.",
    });
  }
  return next();
};

module.exports = {
  createAuthMiddleware,
  requireDatabase,
};
