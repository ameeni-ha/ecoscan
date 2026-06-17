require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const User = require("./models/User");
const RecyclingCenter = require("./models/RecyclingCenter");
const CenterController = require("./controllers/centerController");
const createForumRoutes = require("./routes/forumRoutes");
const createScanRoutes = require("./routes/scanRoutes");
const createMeetingRoutes = require("./routes/meetingRoutes");
const createUserRoutes = require("./routes/userRoutes");
const createAdminRoutes = require("./routes/adminRoutes");
const createNotificationRoutes = require("./routes/notificationRoutes");
const PointsService = require("./utils/PointsService");
const { sanitizeUser: sanitizeUserFromHelpers } = require("./utils/helpers");

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const MONGO_URI = process.env.MONGO_URI;
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || process.env.TOKEN_SECRET || "ecoscan-dev-secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "ecoscan-dev-refresh-secret";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
const REFRESH_COOKIE_NAME = "ecoscan_refresh_token";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const sanitizeUser = (user) => sanitizeUserFromHelpers(user);

const ALLOWED_MATERIALS = [
  "recyclable",
  "recyclage_specialise",
  "plastique",
  "verre",
  "papier_carton",
  "metal",
  "electronique",
  "organique",
  "autre",
];

const CENTER_MATERIAL_TAGS = [
  "plastic",
  "paper",
  "glass",
  "metal",
  "electronic",
  "textile",
  "organic",
  "mixed",
];

const SCAN_MATERIAL_TO_CENTER_TAGS = {
  recyclable: [],
  recyclage_specialise: ["electronic", "mixed"],
  plastique: ["plastic"],
  verre: ["glass"],
  papier_carton: ["paper"],
  metal: ["metal"],
  electronique: ["electronic"],
  organique: ["organic"],
  autre: [],
};

const normalizeCenterMaterials = (materialsAccepted) =>
  Array.from(
    new Set(
      Array.isArray(materialsAccepted)
        ? materialsAccepted.flatMap((material) => {
            if (CENTER_MATERIAL_TAGS.includes(material)) return [material];
            if (!ALLOWED_MATERIALS.includes(material)) return [];
            return SCAN_MATERIAL_TO_CENTER_TAGS[material] || [];
          })
        : []
    )
  );

const buildCenterPayloadFromRegistration = (user, passwordHash, collectionCenter = {}) => {
  const parsedLatitude = Number(collectionCenter.latitude);
  const parsedLongitude = Number(collectionCenter.longitude);
  const externalSource = ["anged", "osm"].includes(
    String(collectionCenter.externalSource || "").trim().toLowerCase()
  )
    ? String(collectionCenter.externalSource || "").trim().toLowerCase()
    : "";

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: String(user.email || "").trim().toLowerCase(),
    passwordHash,
    phone: user.phone || "",
    centerName: String(collectionCenter.centerName || "").trim(),
    managerName: String(collectionCenter.managerName || "").trim(),
    centerType: "public",
    materialsAccepted: normalizeCenterMaterials(collectionCenter.materialsAccepted),
    city: String(collectionCenter.city || user.address || "Tunisie").trim(),
    address: String(collectionCenter.address || user.address || collectionCenter.city || "Tunisie").trim(),
    openingHours: String(collectionCenter.openingHours || "9:00 AM - 6:00 PM").trim(),
    district: String(collectionCenter.district || "").trim(),
    capacityPerDayKg: Number(collectionCenter.capacityPerDayKg) || 1000,
    description: String(collectionCenter.description || "").trim(),
    externalSource,
    externalSourceId: String(collectionCenter.externalSourceId || "").trim(),
    latitude: Number.isFinite(parsedLatitude) ? parsedLatitude : null,
    longitude: Number.isFinite(parsedLongitude) ? parsedLongitude : null,
  };
};

const upsertCenterProfileForUser = async (user, passwordHash, collectionCenter = {}) => {
  const centerPayload = buildCenterPayloadFromRegistration(user, passwordHash, collectionCenter);

  if (!centerPayload.centerName || !centerPayload.managerName) {
    throw new Error("Informations du centre manquantes");
  }

  if (centerPayload.externalSource && centerPayload.externalSourceId) {
    const duplicateLink = await RecyclingCenter.findOne({
      externalSource: centerPayload.externalSource,
      externalSourceId: centerPayload.externalSourceId,
      email: { $ne: centerPayload.email },
    })
      .select("_id")
      .lean();

    if (duplicateLink) {
      const error = new Error("Ce centre externe est déjà lié à un autre compte EcoScan.");
      error.statusCode = 409;
      throw error;
    }
  }

  const existingCenter = await RecyclingCenter.findOne({ email: centerPayload.email });
  if (existingCenter) {
    await RecyclingCenter.updateOne({ _id: existingCenter._id }, centerPayload);
    return;
  }

  await RecyclingCenter.create({
    ...centerPayload,
    registrationNumber: `AUTO-${Date.now()}-${user._id.toString().slice(-6)}`,
  });
};

const createAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const createRefreshTokenId = () => crypto.randomBytes(32).toString("hex");

const hashTokenId = (tokenId) => crypto.createHash("sha256").update(tokenId).digest("hex");

const parseDurationMs = (value) => {
  const match = String(value).trim().match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const createRefreshToken = (userId, tokenId) =>
  jwt.sign({ sub: userId, jti: tokenId, type: "refresh" }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

const setRefreshTokenCookie = (res, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
  };

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
  });
};

const revokeRefreshTokenByHash = (user, tokenIdHash) => {
  user.refreshTokens = (user.refreshTokens || []).map((item) => {
    if (item.tokenIdHash === tokenIdHash && !item.revokedAt) {
      item.revokedAt = new Date();
    }
    return item;
  });
};

const issueTokensForUser = async (user, previousTokenIdHash = null) => {
  const refreshTokenId = createRefreshTokenId();
  const refreshTokenIdHash = hashTokenId(refreshTokenId);

  user.refreshTokens = (user.refreshTokens || []).filter(
    (item) => !item.revokedAt && new Date(item.expiresAt) > new Date()
  );

  if (previousTokenIdHash) {
    const previousToken = user.refreshTokens.find(
      (item) => item.tokenIdHash === previousTokenIdHash
    );

    if (previousToken) {
      previousToken.revokedAt = new Date();
      previousToken.replacedByTokenIdHash = refreshTokenIdHash;
    }
  }

  user.refreshTokens.push({
    tokenIdHash: refreshTokenIdHash,
    expiresAt: new Date(Date.now() + parseDurationMs(REFRESH_TOKEN_EXPIRES_IN)),
  });

  if ((user.points || 0) < 0) {
    user.points = 0;
  }

  await user.save();

  return {
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user._id.toString(), refreshTokenId),
  };
};

const connectToDatabase = async () => {
  if (!MONGO_URI) {
    throw new Error("La variable MONGO_URI est requise");
  }

  await mongoose.connect(MONGO_URI);
};

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");

  if (!token) {
    return res.status(401).json({ message: "Authentification requise" });
  }

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
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

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Serve uploaded images (forum posts, etc.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Forum routes (multipart uploads for photos)
const forumUpload = multer({ dest: path.join(__dirname, "uploads") }).array("photos", 6);
const scanUpload = multer({ dest: path.join(__dirname, "uploads") }).single("photo");

app.use("/api/forum", authMiddleware, createForumRoutes(forumUpload));
app.use("/api/scans", authMiddleware, createScanRoutes(scanUpload));
app.use("/api/meetings", authMiddleware, createMeetingRoutes());
app.use("/api/notifications", authMiddleware, createNotificationRoutes());
app.use("/api/users", authMiddleware, createUserRoutes());
app.use("/api/admin", authMiddleware, createAdminRoutes());

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://127.0.0.1:5001";

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/ai/health", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_AI_URL}/health`, { timeout: 15000 });
    return res.json({ status: "ok", ai: response.data });
  } catch (error) {
    return res.status(502).json({
      status: "error",
      message: "Service IA Python indisponible. Lancez: npm run ai",
    });
  }
});

app.post("/api/auth/register", (req, res) => {
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

  return (async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedAccountType = accountType || "collecteur";
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (normalizedAccountType === "centre_de_collecte" && collectionCenter) {
        const isValidPassword = await existingUser.comparePassword(password);
        if (!isValidPassword) {
          return res.status(409).json({ message: "Un compte existe deja avec cet email" });
        }

        try {
          await upsertCenterProfileForUser(existingUser, existingUser.passwordHash, collectionCenter);
        } catch (error) {
          return res.status(error.statusCode || 400).json({
            message: error.message || "Impossible de lier la fiche centre",
          });
        }

        const tokens = await issueTokensForUser(existingUser);
        setRefreshTokenCookie(res, tokens.refreshToken);

        return res.status(200).json({
          message: "Fiche centre liee au compte existant",
          token: tokens.accessToken,
          user: sanitizeUser(existingUser),
        });
      }

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
      try {
        await upsertCenterProfileForUser(user, passwordHash, collectionCenter || {});
      } catch (error) {
        await User.deleteOne({ _id: user._id });
        return res.status(error.statusCode || 400).json({
          message: error.message || "Impossible de créer la fiche centre",
        });
      }
    }

    const tokens = await issueTokensForUser(user);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.status(201).json({
      message: "Inscription reussie",
      token: tokens.accessToken,
      user: sanitizeUser(user),
    });
  })().catch((error) => {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email et mot de passe requis" });
  }

  return (async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const tokens = await issueTokensForUser(user);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.json({
      message: "Connexion reussie",
      token: tokens.accessToken,
      user: sanitizeUser(user),
    });
  })().catch((error) => {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  });
});

app.post("/api/auth/refresh", (req, res) => {
  return (async () => {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token manquant" });
    }

    let payload;

    try {
      payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (error) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Refresh token invalide" });
    }

    if (payload.type !== "refresh" || !payload.sub || !payload.jti) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Refresh token invalide" });
    }

    const user = await User.findById(payload.sub);

    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Utilisateur introuvable" });
    }

    const tokenIdHash = hashTokenId(payload.jti);
    const storedToken = (user.refreshTokens || []).find(
      (item) => item.tokenIdHash === tokenIdHash
    );

    if (!storedToken || storedToken.revokedAt || new Date(storedToken.expiresAt) <= new Date()) {
      revokeRefreshTokenByHash(user, tokenIdHash);
      await user.save();
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "Session invalide" });
    }

    const tokens = await issueTokensForUser(user, tokenIdHash);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.json({
      message: "Session rafraichie",
      token: tokens.accessToken,
      user: sanitizeUser(user),
    });
  })().catch((error) => {
    clearRefreshTokenCookie(res);
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  });
});

app.post("/api/auth/logout", (req, res) => {
  return (async () => {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      try {
        const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        const user = await User.findById(payload.sub);

        if (user && payload.jti) {
          const tokenIdHash = hashTokenId(payload.jti);
          revokeRefreshTokenByHash(user, tokenIdHash);
          await user.save();
        }
      } catch (error) {
        // Logout should still clear the cookie even if the refresh token is expired.
      }
    }

    clearRefreshTokenCookie(res);
    return res.status(204).send();
  })().catch((error) => {
    clearRefreshTokenCookie(res);
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  });
});

app.post("/api/auth/logout-all", authMiddleware, (req, res) => {
  return (async () => {
    req.user.refreshTokens = [];
    await req.user.save();
    clearRefreshTokenCookie(res);
    return res.status(204).send();
  })().catch((error) => {
    clearRefreshTokenCookie(res);
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(String(req.query.limit || "50"), 10) || 50, 100);
    const result = await PointsService.getLeaderboard(limit);
    return res.json({ leaderboard: result.leaderboard });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

app.get("/api/centers/nearby", (req, res) => CenterController.getNearby(req, res));

app.get("/api/anged-recycling-centers", (req, res) =>
  CenterController.getAngedCenters(req, res)
);

// Get all recycling centers with filters
app.get("/api/centers", async (req, res) => {
  try {
    const { city, material, includeUnverified = "true", limit = "100" } = req.query;
    const filter = includeUnverified !== "false" ? {} : { isVerified: true };

    if (city) {
      filter.city = { $regex: city, $options: "i" };
    }

    if (material && material !== "recyclable") {
      const materialAliases = {
        recyclage_specialise: "electronic",
        plastique: "plastic",
        verre: "glass",
        papier_carton: "paper",
        metal: "metal",
        electronique: "electronic",
        organique: "organic",
      };
      const normalizedMaterial = materialAliases[String(material).trim().toLowerCase()] || material;
      filter.materialsAccepted = { $in: [normalizedMaterial] };
    }

    console.log("Fetching centers with filter:", filter);

    // limit=0 => pas de limitation (peut être lourd si beaucoup de centres)
    const parsedLimit = Number.parseInt(String(limit), 10);
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 100;
    const query = RecyclingCenter.find(filter)
      .select(
        "centerName managerName city address district openingHours phone email materialsAccepted description latitude longitude rating totalReviews capacityPerDayKg centerType registrationNumber externalSource externalSourceId"
      )
      .lean();

    if (safeLimit !== 0) {
      query.limit(Math.max(1, Math.min(safeLimit, 5000))); // borne raisonnable
    }

    const centers = await query;

    console.log(`Found ${centers.length} centers`);

    const centerEmails = centers
      .map((center) => String(center.email || "").trim().toLowerCase())
      .filter(Boolean);
    const linkedCenterUsers = await User.find({
      email: { $in: centerEmails },
      accountType: "centre_de_collecte",
    })
      .select("_id email")
      .lean();
    const centerUserByEmail = new Map(
      linkedCenterUsers.map((user) => [String(user.email || "").trim().toLowerCase(), user._id.toString()])
    );

    const formattedCenters = centers.map((center) => ({
      _id: center._id,
      id: center._id.toString(),
      centerName: center.centerName,
      managerName: center.managerName,
      city: center.city,
      address: center.address,
      district: center.district,
      openingHours: center.openingHours,
      phone: center.phone,
      materialsAccepted: center.materialsAccepted,
      description: center.description,
      latitude: center.latitude,
      longitude: center.longitude,
      rating: center.rating,
      totalReviews: center.totalReviews,
      capacityPerDayKg: center.capacityPerDayKg,
      centerType: center.centerType,
      email: center.email,
      externalSource: center.externalSource || "",
      externalSourceId: center.externalSourceId || "",
      canReceiveMeetings: centerUserByEmail.has(String(center.email || "").trim().toLowerCase()),
    }));

    res.json({ centers: formattedCenters, count: formattedCenters.length });
  } catch (error) {
    console.error("Error fetching centers:", error.message);
    res.status(500).json({ error: "Failed to fetch centers", message: error.message });
  }
});

// Get recycling centers from OpenStreetMap Nominatim API (Tunisia)
app.get("/api/osm-recycling-centers", async (req, res) => {
  const { city = "", limit = "2500" } = req.query;
  const cityValue = String(city || "").trim();

  try {
    const parsedLimit = Number.parseInt(String(limit), 10);
    const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 5000) : 2500;

    // Try different search terms to find more recycling centers
    const searchTerms = cityValue
      ? [cityValue, `${cityValue} recycling`, `${cityValue} déchets`, `${cityValue} tri`]
      : ["Tunisia", "recycling", "déchets", "tri", "waste", "collecte"];

    const allCenters = [];
    const seenIds = new Set();

    // Try each search term sequentially
    for (const term of searchTerms) {
      if (allCenters.length >= safeLimit) break;

      try {
        const response = await axios.get("https://nominatim.openstreetmap.org/search", {
          params: {
            q: term,
            format: "json",
            limit: Math.ceil((safeLimit - allCenters.length) / 2),
            countrycodes: "tn",
          },
          headers: {
            "User-Agent": "EcoScan-App/1.0",
          },
          timeout: 10000,
        });

        (response.data || []).forEach((el) => {
          const id = el.place_id || el.osm_id;
          if (seenIds.has(id)) return;
          seenIds.add(id);

          const lat = Number(el.lat);
          const lon = Number(el.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

          allCenters.push({
            id: `nominatim_${id}`,
            centerName: el.display_name?.split(",")[0] || "Centre de recyclage",
            latitude: lat,
            longitude: lon,
            materialsAccepted: [],
            address: el.display_name || "N/A",
            city: el.address?.city || el.address?.town || cityValue || "Tunisia",
            phone: "",
            openingHours: "N/A",
            centerType: "public",
            description: "",
            source: "OpenStreetMap Nominatim",
          });
        });
      } catch (err) {
        console.log(`Search term "${term}" failed:`, err.message);
      }
    }

    const centers = allCenters.slice(0, safeLimit);

    res.json({
      centers,
      count: centers.length,
      source: "openstreetmap",
      country: "Tunisia",
      city: cityValue || null,
    });
  } catch (error) {
    console.error("Error fetching from Nominatim API:", error.message);
    // Return empty array when API fails
    res.json({
      centers: [],
      count: 0,
      source: "openstreetmap",
      country: "Tunisia",
      city: cityValue || null,
      error: "OSM API unavailable",
    });
  }
});

// Seed test data (for development)
app.post("/api/seed-test-data", async (req, res) => {
  try {
    const testCenters = [
      {
        firstName: "Mamadou",
        lastName: "Diallo",
        email: "center1@ecoscan.com",
        passwordHash: "$2a$12$r9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ee5D/Z.Ua7CKA6T2",
        role: "center_manager",
        centerName: "Centre de Collecte Dakar Nord",
        managerName: "Mamadou Diallo",
        registrationNumber: "REG001",
        centerType: "public",
        materialsAccepted: ["plastic", "glass", "paper"],
        city: "Dakar",
        address: "123 Rue de la Paix, Dakar",
        district: "Plateau",
        openingHours: "8:00 AM - 6:00 PM",
        closingDays: ["Sunday"],
        phone: "+221 33 123 4567",
        capacityPerDayKg: 5000,
        currentCapacityKg: 2000,
        description: "Centre de collecte moderne avec équipements de tri",
        latitude: 14.7167,
        longitude: -17.4674,
        isVerified: true,
        rating: 4.5,
        totalReviews: 12,
      },
      {
        firstName: "Fatima",
        lastName: "Ba",
        email: "center2@ecoscan.com",
        passwordHash: "$2a$12$r9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ee5D/Z.Ua7CKA6T2",
        role: "center_manager",
        centerName: "Centre Écologique Maristes",
        managerName: "Fatima Ba",
        registrationNumber: "REG002",
        centerType: "non_profit",
        materialsAccepted: ["glass", "metal", "electronic"],
        city: "Dakar",
        address: "45 Avenue Cheikh Anta Diop, Dakar",
        district: "Fann",
        openingHours: "9:00 AM - 5:00 PM",
        closingDays: ["Sunday"],
        phone: "+221 33 987 6543",
        capacityPerDayKg: 3000,
        currentCapacityKg: 1000,
        description: "ONG spécialisée en recyclage et sensibilisation",
        latitude: 14.72,
        longitude: -17.465,
        isVerified: true,
        rating: 4.8,
        totalReviews: 25,
      },
      {
        firstName: "Ibrahima",
        lastName: "Sarr",
        email: "center3@ecoscan.com",
        passwordHash: "$2a$12$r9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ee5D/Z.Ua7CKA6T2",
        role: "center_manager",
        centerName: "Recycling Point Ouakam",
        managerName: "Ibrahima Sarr",
        registrationNumber: "REG003",
        centerType: "private",
        materialsAccepted: ["plastic", "paper", "organic"],
        city: "Dakar",
        address: "789 Bd de la République, Ouakam",
        district: "Ouakam",
        openingHours: "7:00 AM - 8:00 PM",
        closingDays: [],
        phone: "+221 33 555 8910",
        capacityPerDayKg: 8000,
        currentCapacityKg: 4500,
        description: "Centre commercial avec section recyclage complète",
        latitude: 14.66,
        longitude: -17.51,
        isVerified: true,
        rating: 4.2,
        totalReviews: 18,
      },
    ];

    await RecyclingCenter.deleteMany({});
    await RecyclingCenter.insertMany(testCenters);

    res.json({
      message: "Test data seeded successfully",
      count: testCenters.length,
    });
  } catch (error) {
    console.error("Error seeding data:", error.message);
    res.status(500).json({ error: "Failed to seed data", message: error.message });
  }
});

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API EcoScan disponible sur http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Connexion MongoDB impossible:", error.message);
    process.exit(1);
  });
