const User = require("../models/User");
const { ALLOWED_MATERIALS } = require("../utils/constants");
const { sanitizeUser } = require("../utils/helpers");

class UserController {
  // Update user profile
  static async updateProfile(req, res) {
    try {
      const { firstName, lastName, phone, address, password } = req.body || {};
      const updates = {};

      if (firstName !== undefined) updates.firstName = String(firstName).trim();
      if (lastName !== undefined) updates.lastName = String(lastName).trim();
      if (phone !== undefined) updates.phone = String(phone).trim();
      if (address !== undefined) updates.address = String(address).trim();

      if (updates.firstName !== undefined && !updates.firstName) {
        return res.status(400).json({ message: "Prénom invalide" });
      }
      if (updates.lastName !== undefined && !updates.lastName) {
        return res.status(400).json({ message: "Nom invalide" });
      }

      if (password) {
        const nextPassword = String(password);
        if (nextPassword.length < 6) {
          return res.status(400).json({
            message: "Le mot de passe doit contenir au moins 6 caractères",
          });
        }
        updates.passwordHash = await User.hashPassword(nextPassword);
        updates.refreshTokens = [];
      }

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      });

      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    return res.json({ user: sanitizeUser(req.user) });
  }
}

module.exports = UserController;
