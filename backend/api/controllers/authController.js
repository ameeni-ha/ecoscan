const User = require("../models/User");
const RecyclingCenter = require("../models/RecyclingCenter");
const { sanitizeUser } = require("../utils/helpers");
const { ALLOWED_MATERIALS, SCAN_MATERIAL_TO_CENTER_TAGS } = require("../utils/constants");

const CENTER_MATERIAL_TAGS = ["plastic", "paper", "glass", "metal", "electronic", "textile", "organic", "mixed"];

class AuthController {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
  }

  setRefreshTokenCookie(res, refreshToken, isProduction) {
    res.cookie("ecoscan_refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  clearRefreshTokenCookie(res, isProduction) {
    res.clearCookie("ecoscan_refresh_token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    });
  }

  // Register a new user
  async register(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        role,
        accountType,
        phone,
        address,
        collectionCenter,
      } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "Champs obligatoires manquants" });
      }

      if (!["collecteur", "centre_de_collecte"].includes(accountType || "collecteur")) {
        return res.status(400).json({ message: "Type de compte invalide" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedAccountType = accountType || "collecteur";
      const existingUser = await User.findOne({ email: normalizedEmail });

      if (existingUser) {
        return res.status(409).json({ message: "Un compte existe deja avec cet email" });
      }

      const passwordHash = await User.hashPassword(password);
      const user = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        passwordHash,
        role: role || "client",
        accountType: normalizedAccountType,
        phone: phone || "",
        address: address || "",
      });

      if (normalizedAccountType === "centre_de_collecte") {
        const centerProfile = collectionCenter || {};
        const centerName = String(centerProfile.centerName || "").trim();
        const managerName = String(centerProfile.managerName || "").trim();

        if (!centerName || !managerName) {
          await User.deleteOne({ _id: user._id });
          return res.status(400).json({ message: "Informations du centre manquantes" });
        }

        const materialsAccepted = Array.from(
          new Set(
            Array.isArray(centerProfile.materialsAccepted)
              ? centerProfile.materialsAccepted.flatMap((material) => {
                  if (CENTER_MATERIAL_TAGS.includes(material)) return [material];
                  if (!ALLOWED_MATERIALS.includes(material)) return [];
                  return SCAN_MATERIAL_TO_CENTER_TAGS[material] || [];
                })
              : []
          )
        );

        const externalSource = ["anged", "osm"].includes(
          String(centerProfile.externalSource || "").trim().toLowerCase()
        )
          ? String(centerProfile.externalSource || "").trim().toLowerCase()
          : "";
        const externalSourceId = String(centerProfile.externalSourceId || "").trim();

        if (externalSource && externalSourceId) {
          const duplicateLink = await RecyclingCenter.findOne({
            externalSource,
            externalSourceId,
            email: { $ne: normalizedEmail },
          })
            .select("_id")
            .lean();

          if (duplicateLink) {
            await User.deleteOne({ _id: user._id });
            return res.status(409).json({
              message: "Ce centre externe est déjà lié à un autre compte EcoScan.",
            });
          }
        }

        const parsedLatitude = Number(centerProfile.latitude);
        const parsedLongitude = Number(centerProfile.longitude);

        const existingCenter = await RecyclingCenter.findOne({ email: normalizedEmail });
        const centerPayload = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: normalizedEmail,
          passwordHash,
          phone: phone || "",
          centerName,
          managerName,
          centerType: "public",
          materialsAccepted,
          city: String(centerProfile.city || address || "Tunisie").trim(),
          address: String(
            centerProfile.address || address || centerProfile.city || "Tunisie"
          ).trim(),
          openingHours: String(centerProfile.openingHours || "9:00 AM - 6:00 PM").trim(),
          district: String(centerProfile.district || "").trim(),
          capacityPerDayKg: Number(centerProfile.capacityPerDayKg) || 1000,
          description: String(centerProfile.description || "").trim(),
          externalSource,
          externalSourceId,
          latitude: Number.isFinite(parsedLatitude) ? parsedLatitude : null,
          longitude: Number.isFinite(parsedLongitude) ? parsedLongitude : null,
        };

        if (existingCenter) {
          await RecyclingCenter.updateOne({ _id: existingCenter._id }, centerPayload);
        } else {
          await RecyclingCenter.create({
            ...centerPayload,
            registrationNumber: `AUTO-${Date.now()}-${user._id.toString().slice(-6)}`,
          });
        }
      }

      const tokens = await this.tokenManager.issueTokensForUser(user);
      this.setRefreshTokenCookie(res, tokens.refreshToken, process.env.NODE_ENV === "production");

      return res.status(201).json({
        message: "Inscription reussie",
        token: tokens.accessToken,
        user: sanitizeUser(user),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email et mot de passe requis" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        return res.status(401).json({ message: "Identifiants invalides" });
      }

      const isValidPassword = await user.comparePassword(password);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Identifiants invalides" });
      }

      const tokens = await this.tokenManager.issueTokensForUser(user);
      this.setRefreshTokenCookie(res, tokens.refreshToken, process.env.NODE_ENV === "production");

      return res.json({
        message: "Connexion reussie",
        token: tokens.accessToken,
        user: sanitizeUser(user),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Refresh access token
  async refresh(req, res) {
    try {
      const refreshToken = req.cookies["ecoscan_refresh_token"];

      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token manquant" });
      }

      let payload;

      try {
        payload = this.tokenManager.verifyRefreshToken(refreshToken);
      } catch (error) {
        this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
        return res.status(401).json({ message: "Refresh token invalide" });
      }

      if (payload.type !== "refresh" || !payload.sub || !payload.jti) {
        this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
        return res.status(401).json({ message: "Refresh token invalide" });
      }

      const user = await User.findById(payload.sub);

      if (!user) {
        this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
        return res.status(401).json({ message: "Utilisateur introuvable" });
      }

      const { hashTokenId } = require("../utils/helpers");
      const tokenIdHash = hashTokenId(payload.jti);
      const storedToken = (user.refreshTokens || []).find(
        (item) => item.tokenIdHash === tokenIdHash
      );

      if (
        !storedToken ||
        storedToken.revokedAt ||
        new Date(storedToken.expiresAt) <= new Date()
      ) {
        this.tokenManager.revokeRefreshTokenByHash(user, tokenIdHash);
        await user.save();
        this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
        return res.status(401).json({ message: "Session invalide" });
      }

      const tokens = await this.tokenManager.issueTokensForUser(user, tokenIdHash);
      this.setRefreshTokenCookie(res, tokens.refreshToken, process.env.NODE_ENV === "production");

      return res.json({
        message: "Session rafraichie",
        token: tokens.accessToken,
        user: sanitizeUser(user),
      });
    } catch (error) {
      this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      const refreshToken = req.cookies["ecoscan_refresh_token"];

      if (refreshToken) {
        try {
          const payload = this.tokenManager.verifyRefreshToken(refreshToken);
          const user = await User.findById(payload.sub);

          if (user && payload.jti) {
            const { hashTokenId } = require("../utils/helpers");
            const tokenIdHash = hashTokenId(payload.jti);
            this.tokenManager.revokeRefreshTokenByHash(user, tokenIdHash);
            await user.save();
          }
        } catch (error) {
          // Continue with logout even if token is expired
        }
      }

      this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
      return res.status(204).send();
    } catch (error) {
      this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Logout from all devices
  async logoutAll(req, res) {
    try {
      req.user.refreshTokens = [];
      await req.user.save();
      this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
      return res.status(204).send();
    } catch (error) {
      this.clearRefreshTokenCookie(res, process.env.NODE_ENV === "production");
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }
}

module.exports = AuthController;
