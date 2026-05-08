require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const User = require("./models/User");
const RecyclingCenter = require("./models/RecyclingCenter");
const Post = require("./models/Post");
const Comment = require("./models/Comment");
const Scan = require("./models/Scan");
const MeetingRequest = require("./models/MeetingRequest");

const app = express();
const PORT = process.env.PORT || 4000;

const corsOrigins = (() => {
  const raw = process.env.CLIENT_URL?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["http://localhost:3000", "http://127.0.0.1:3000"];
})();
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (!process.env.MONGO_URI && !IS_PRODUCTION) {
  console.info(
    "MongoDB: MONGO_URI non defini — utilisation de mongodb://127.0.0.1:27017/ecoscan (voir backend/api/.env.example)."
  );
}
const MONGO_URI =
  process.env.MONGO_URI ||
  (!IS_PRODUCTION ? "mongodb://127.0.0.1:27017/ecoscan" : undefined);

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || process.env.TOKEN_SECRET || "ecoscan-dev-secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "ecoscan-dev-refresh-secret";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
const REFRESH_COOKIE_NAME = "ecoscan_refresh_token";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

// Fail fast when MongoDB is down (avoid mongoose buffering timeouts)
mongoose.set("bufferCommands", false);

let mongoMemoryServer = null;

const startInMemoryMongo = async () => {
  if (mongoMemoryServer) return mongoMemoryServer.getUri();

  // Lazy require so production builds don't need it.
  // eslint-disable-next-line global-require
  const { MongoMemoryServer } = require("mongodb-memory-server");
  mongoMemoryServer = await MongoMemoryServer.create({
    instance: { dbName: "ecoscan" },
  });
  return mongoMemoryServer.getUri();
};

const connectWithTimeout = async (uri, options, timeoutMs) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("MongoDB connection timeout")), timeoutMs);
  });

  try {
    return await Promise.race([mongoose.connect(uri, options), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message:
        "Base de donnees indisponible. Verifie la connexion MongoDB puis reessaie.",
    });
  }
  return next();
};

const runOverpassQuery = async (query) => {
  const overpassBody = new URLSearchParams({ data: query }).toString();
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await axios.post(endpoint, overpassBody, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ecoscan/1.0 (recycling centers lookup)",
        },
        timeout: 30000,
      });
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Overpass request failed");
};

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  accountType: user.accountType,
  phone: user.phone,
  adresse: user.adresse,
  collectionCenter: user.collectionCenter,
  points: user.points || 0,
  createdAt: user.createdAt?.toISOString?.() || user.createdAt,
});

const ALLOWED_CENTER_TYPES = [
  "centre_prive",
  "centre_public",
  "point_depot",
  "ong_association",
];

const ALLOWED_MATERIALS = [
  "plastique",
  "verre",
  "papier_carton",
  "metal",
  "electronique",
  "organique",
];

/** Étiquettes `materialsAccepted` du modèle RecyclingCenter (plastic, glass, …) */
const SCAN_MATERIAL_TO_CENTER_TAGS = {
  plastique: ["plastic"],
  verre: ["glass"],
  papier_carton: ["paper"],
  metal: ["metal"],
  electronique: ["electronic"],
  organique: ["organic"],
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const centerAcceptsScanMaterial = (center, scanMaterialKey) => {
  const mats = Array.isArray(center.materialsAccepted) ? center.materialsAccepted : [];
  const tags = SCAN_MATERIAL_TO_CENTER_TAGS[scanMaterialKey];
  if (!tags || !tags.length) return true;
  if (!mats.length || mats.includes("mixed")) return true;
  return mats.some((m) => tags.includes(m));
};

// Material knowledge base for scan results
const MATERIAL_DATABASE = {
  plastique: {
    recyclable: true,
    points: 5,
    instructions:
      "Rincez et videz les contenants. Retirez les bouchons et les étiquettes. Mettez dans le bac de recyclage plastique.",
  },
  verre: {
    recyclable: true,
    points: 3,
    instructions:
      "Nettoyez le verre. Retirez les bouchons en métal ou plastique. Déposez dans le bac de recyclage du verre.",
  },
  papier_carton: {
    recyclable: true,
    points: 2,
    instructions:
      "Aplatissez les cartons. Enlevez le polystyrène ou les plastiques. Mettez dans le bac à papier/carton.",
  },
  metal: {
    recyclable: true,
    points: 4,
    instructions:
      "Rincez les conserves. Aplatissez-les pour économiser l'espace. Déposez dans le bac de recyclage des métaux.",
  },
  electronique: {
    recyclable: true,
    points: 10,
    instructions:
      "Ne mettez pas à la poubelle! Apportez à un centre de collecte d'appareils électroniques pour un traitement sécurisé.",
  },
  organique: {
    recyclable: true,
    points: 1,
    instructions:
      "Composez les déchets organiques dans un composteur ou mettez dans le bac de compostage.",
  },
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
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: parseDurationMs(REFRESH_TOKEN_EXPIRES_IN),
  });
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

  await user.save();

  return {
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user._id.toString(), refreshTokenId),
  };
};

const connectToDatabase = async () => {
  if (!MONGO_URI) {
    console.warn("MONGO_URI manquante: demarrage sans base de donnees");
    return;
  }

  const connectOptions = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  };

  try {
    await connectWithTimeout(MONGO_URI, connectOptions, 7000);
  } catch (error) {
    const fallbackUri = process.env.LOCAL_MONGO_URI;

    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    if (fallbackUri) {
      console.error(
        `Connexion MongoDB impossible (${error.message}). Tentative locale: ${fallbackUri}`
      );
      try {
        await connectWithTimeout(fallbackUri, connectOptions, 5000);
        return;
      } catch (localError) {
        if (process.env.ENABLE_IN_MEMORY_MONGO === "false") {
          throw localError;
        }

        console.error(
          `Connexion MongoDB locale impossible (${localError.message}). Demarrage Mongo in-memory...`
        );
      }
    } else {
      console.error(
        `Connexion MongoDB impossible (${error.message}). Demarrage Mongo in-memory...`
      );
    }

    const inMemoryUri = await startInMemoryMongo();
    await connectWithTimeout(inMemoryUri, connectOptions, 7000);
    console.log("MongoDB in-memory demarree pour le developpement.");
  }
};

const authMiddleware = async (req, res, next) => {
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

const corsOriginOption =
  corsOrigins.length === 0
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : corsOrigins.length === 1
      ? corsOrigins[0]
      : corsOrigins;

const corsDevelopmentOptions =
  !IS_PRODUCTION && !process.env.CLIENT_URL?.trim()
    ? { origin: true, credentials: true }
    : { origin: corsOriginOption, credentials: true };

app.use(cors(corsDevelopmentOptions));
app.use(cookieParser());
// Utiliser un body parser qui accepte JSON et multipart
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const safeExt = ext && ext.length <= 10 ? ext : "";
      cb(null, `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB each
    files: 6,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Type de fichier non supporté (images uniquement)."));
    }
    return cb(null, true);
  },
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Update authenticated user profile
app.patch("/api/users/me", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, phone, adresse, password } = req.body || {};
    const updates = {};

    if (firstName !== undefined) updates.firstName = String(firstName).trim();
    if (lastName !== undefined) updates.lastName = String(lastName).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (adresse !== undefined) updates.adresse = String(adresse).trim();

    if (updates.firstName !== undefined && !updates.firstName) {
      return res.status(400).json({ message: "Prénom invalide" });
    }
    if (updates.lastName !== undefined && !updates.lastName) {
      return res.status(400).json({ message: "Nom invalide" });
    }

    if (password) {
      const nextPassword = String(password);
      if (nextPassword.length < 6) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères" });
      }
      updates.passwordHash = await User.hashPassword(nextPassword);
      // invalidate refresh tokens when password changes
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
});

// Forum: list posts
app.get("/api/forum/posts", authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({ status: { $in: ["published", "hidden"] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const authorIds = [...new Set(posts.map((p) => p.authorId.toString()))];
    const authors = await User.find({ _id: { $in: authorIds } })
      .select("firstName lastName email accountType")
      .lean();
    const authorById = new Map(authors.map((u) => [u._id.toString(), u]));

    const formatted = posts.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      content: p.content,
      tags: p.tags || [],
      status: p.status,
      images: Array.isArray(p.images) ? p.images : [],
      author: authorById.get(p.authorId.toString())
        ? {
            firstName: authorById.get(p.authorId.toString()).firstName,
            lastName: authorById.get(p.authorId.toString()).lastName,
            accountType: authorById.get(p.authorId.toString()).accountType || null,
          }
        : null,
      excerpt:
        typeof p.content === "string"
          ? p.content.replace(/\s+/g, " ").trim().slice(0, 240)
          : "",
      previewImage: Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : "",
      createdAt: p.createdAt,
    }));

    return res.json({ posts: formatted });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

// Forum: create post (supports multiple photos: photos[])
app.post("/api/forum/posts", authMiddleware, upload.array("photos", 6), async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const tagsRaw = body.tags;

    if (!title || !content) {
      return res.status(400).json({ message: "Titre et message requis" });
    }

    const tags =
      typeof tagsRaw === "string" && tagsRaw.trim()
        ? tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 10)
        : [];

    const files = Array.isArray(req.files) ? req.files : [];
    const images = files.map((f) => ({
      url: `/uploads/${f.filename}`,
      filename: f.filename,
      originalName: f.originalname || "",
      mimeType: f.mimetype || "",
      size: f.size || 0,
    }));

    const post = await Post.create({
      authorId: req.user._id,
      title,
      content,
      tags,
      images,
      status: "published",
    });

    return res.status(201).json({ postId: post._id.toString() });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

// Forum: get post details + comments
app.get("/api/forum/posts/:id", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ message: "Post introuvable" });

    const author = await User.findById(post.authorId)
      .select("firstName lastName accountType")
      .lean();
    const comments = await Comment.find({ postId: post._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const commentAuthorIds = [...new Set(comments.map((c) => c.authorId.toString()))];
    const commentAuthors = await User.find({ _id: { $in: commentAuthorIds } })
      .select("firstName lastName accountType")
      .lean();
    const commentAuthorById = new Map(commentAuthors.map((u) => [u._id.toString(), u]));

    return res.json({
      post: {
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        tags: post.tags || [],
        status: post.status,
        images: Array.isArray(post.images) ? post.images : [],
        author: author
          ? {
              firstName: author.firstName,
              lastName: author.lastName,
              accountType: author.accountType || null,
            }
          : null,
        createdAt: post.createdAt,
      },
      comments: comments.map((c) => ({
        id: c._id.toString(),
        content: c.content,
        status: c.status,
        parentCommentId: c.parentCommentId ? c.parentCommentId.toString() : null,
        createdAt: c.createdAt,
        author: commentAuthorById.get(c.authorId.toString())
          ? {
              firstName: commentAuthorById.get(c.authorId.toString()).firstName,
              lastName: commentAuthorById.get(c.authorId.toString()).lastName,
              accountType: commentAuthorById.get(c.authorId.toString()).accountType || null,
            }
          : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

const forumCanReply = (user) => {
  if (!user) return false;
  if (user.role === "admin" || user.role === "moderator") return true;
  return ["collecteur", "centre_de_collecte"].includes(user.accountType);
};

/** Collecteurs, centres de collecte (et admins / modérateurs) peuvent commenter ou répondre. */
app.post("/api/forum/posts/:id/comments", authMiddleware, async (req, res) => {
  try {
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ message: "Commentaire requis" });

    if (!forumCanReply(req.user)) {
      return res.status(403).json({
        message: "Réponse forum réservée aux comptes collecteur ou centre de collecte.",
      });
    }

    const post = await Post.findById(req.params.id).select("_id").lean();
    if (!post) return res.status(404).json({ message: "Post introuvable" });

    const parentRaw = req.body?.parentCommentId;
    let parentCommentId = null;

    if (parentRaw) {
      if (!mongoose.Types.ObjectId.isValid(String(parentRaw))) {
        return res.status(400).json({ message: "Identifiant de commentaire parent invalide" });
      }

      const parentDoc = await Comment.findOne({
        _id: parentRaw,
        postId: post._id,
        status: "published",
      }).lean();

      if (!parentDoc) {
        return res.status(400).json({ message: "Commentaire parent introuvable" });
      }

      if (parentDoc.parentCommentId) {
        return res.status(400).json({
          message: "Une seule mise en niveau est autorisée (réponse au commentaire principal uniquement)",
        });
      }

      parentCommentId = parentDoc._id;
    }

    const comment = await Comment.create({
      postId: post._id,
      authorId: req.user._id,
      parentCommentId,
      content,
      status: "published",
    });

    return res.status(201).json({ commentId: comment._id.toString() });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

app.post("/api/auth/register", requireDatabase, (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    accountType,
    phone,
    adresse,
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
      return res.status(409).json({ message: "Un compte existe deja avec cet email" });
    }

    const normalizedCollectionCenter =
      normalizedAccountType === "centre_de_collecte"
        ? {
            centerName: collectionCenter?.centerName?.trim() || "",
            managerName: collectionCenter?.managerName?.trim() || "",
            registrationNumber: collectionCenter?.registrationNumber?.trim() || "",
            centerType: collectionCenter?.centerType?.trim() || "",
            materialsAccepted: Array.isArray(collectionCenter?.materialsAccepted)
              ? collectionCenter.materialsAccepted
                  .map((item) => String(item).trim())
                  .filter((item) => ALLOWED_MATERIALS.includes(item))
                  .filter(Boolean)
              : [],
            city: collectionCenter?.city?.trim() || "",
            openingHours: collectionCenter?.openingHours?.trim() || "",
            district: collectionCenter?.district?.trim() || "",
            capacityPerDayKg:
              collectionCenter?.capacityPerDayKg !== undefined &&
              collectionCenter?.capacityPerDayKg !== null &&
              collectionCenter?.capacityPerDayKg !== ""
                ? Number(collectionCenter.capacityPerDayKg)
                : null,
            description: collectionCenter?.description?.trim() || "",
          }
        : {
            centerName: "",
            managerName: "",
            registrationNumber: "",
            centerType: "",
            materialsAccepted: [],
            city: "",
            openingHours: "",
            district: "",
            capacityPerDayKg: null,
            description: "",
          };

    if (
      normalizedCollectionCenter.capacityPerDayKg !== null &&
      Number.isNaN(normalizedCollectionCenter.capacityPerDayKg)
    ) {
      return res.status(400).json({
        message: "La capacite journaliere doit etre un nombre valide",
      });
    }

    if (
      normalizedAccountType === "centre_de_collecte" &&
      (!normalizedCollectionCenter.centerName ||
        !normalizedCollectionCenter.managerName ||
        !normalizedCollectionCenter.city ||
        normalizedCollectionCenter.materialsAccepted.length === 0)
    ) {
      return res.status(400).json({
        message: "Merci de remplir les informations du centre de collecte",
      });
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
      adresse: adresse || "",
      collectionCenter: normalizedCollectionCenter,
    });

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

app.post("/api/auth/login", requireDatabase, (req, res) => {
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

app.post("/api/auth/refresh", requireDatabase, (req, res) => {
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

app.post("/api/auth/logout", requireDatabase, (req, res) => {
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

// Get all recycling centers with filters
app.get("/api/centers", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message:
          "Base de donnees indisponible. Utilise la source OpenStreetMap ou verifie la connexion MongoDB.",
      });
    }

    const { city, material, includeUnverified = "true" } = req.query;
    const filter = includeUnverified !== "false" ? {} : { isVerified: true };

    if (city) {
      filter.city = { $regex: city, $options: "i" };
    }

    if (material) {
      filter.materialsAccepted = { $in: [material] };
    }

    console.log("Fetching centers with filter:", filter);

    const centers = await RecyclingCenter.find(filter)
      .select(
        "centerName managerName city address district openingHours phone materialsAccepted description latitude longitude rating totalReviews capacityPerDayKg centerType registrationNumber"
      )
      .limit(100)
      .lean();

    console.log(`Found ${centers.length} centers`);

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
    }));

    res.json({ centers: formattedCenters, count: formattedCenters.length });
  } catch (error) {
    console.error("Error fetching centers:", error.message);
    res.status(500).json({ error: "Failed to fetch centers", message: error.message });
  }
});

// Centres géolocalisés triés par distance (docs Mongo avec latitude/longitude)
app.get("/api/centers/nearby", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Base de donnees indisponible pour les centres a proximite.",
      });
    }

    const lat = Number.parseFloat(req.query.lat);
    const lng = Number.parseFloat(req.query.lng);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "8", 10) || 8, 1), 25);
    const materialRaw = typeof req.query.material === "string" ? req.query.material.trim() : "";

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ message: "Parametres lat et lng obligatoires (nombres decimaux)." });
    }

    const centers = await RecyclingCenter.find({
      latitude: { $nin: [null], $exists: true },
      longitude: { $nin: [null], $exists: true },
    })
      .select(
        "_id centerName managerName city address district openingHours phone materialsAccepted description latitude longitude rating totalReviews registrationNumber centerType",
      )
      .limit(400)
      .lean();

    const materialKey =
      ALLOWED_MATERIALS.includes(materialRaw) ? materialRaw : "";

    const withDist = centers
      .map((center) => {
        const plat = typeof center.latitude === "number" ? center.latitude : null;
        const plng = typeof center.longitude === "number" ? center.longitude : null;
        if (plat == null || plng == null) return null;
        if (!centerAcceptsScanMaterial(center, materialKey)) return null;

        const distanceKm = haversineKm(lat, lng, plat, plng);
        const idStr = center._id.toString();
        return {
          id: idStr,
          centerName: center.centerName,
          managerName: center.managerName,
          city: center.city,
          address: center.address,
          district: center.district,
          openingHours: center.openingHours,
          phone: center.phone,
          materialsAccepted: center.materialsAccepted,
          description: center.description,
          latitude: plat,
          longitude: plng,
          rating: center.rating,
          totalReviews: center.totalReviews,
          registrationNumber: center.registrationNumber,
          centerType: center.centerType,
          distanceKm: Number(distanceKm.toFixed(2)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return res.json({ centers: withDist });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

app.post("/api/meetings", authMiddleware, requireDatabase, async (req, res) => {
  try {
    const centerUserId = req.body?.centerUserId ? String(req.body.centerUserId).trim() : "";
    const preferredDateRaw = req.body?.preferredDate;
    const message = String(req.body?.message || "").trim().slice(0, 2000);

    if (!centerUserId) {
      return res.status(400).json({ message: "Centre obligatoire" });
    }

    const centerDoc = await RecyclingCenter.findById(centerUserId).select("_id").lean();
    if (!centerDoc) {
      return res.status(404).json({ message: "Centre inconnu ou sans fiche recycleur" });
    }

    let preferredDate = null;
    if (preferredDateRaw) {
      const d = new Date(preferredDateRaw);
      preferredDate = Number.isNaN(d.getTime()) ? null : d;
    }

    const mr = await MeetingRequest.create({
      requesterId: req.user._id,
      centerUserId: centerDoc._id,
      preferredDate,
      message,
      status: "pending",
    });

    return res.status(201).json({ meetingId: mr._id.toString() });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

app.get("/api/meetings/my", authMiddleware, requireDatabase, async (req, res) => {
  try {
    const rows = await MeetingRequest.find({ requesterId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("centerUserId", "centerName city phone address district")
      .lean();

    const meetings = rows.map((m) => ({
      id: m._id.toString(),
      status: m.status,
      message: m.message,
      preferredDate: m.preferredDate,
      createdAt: m.createdAt,
      center: m.centerUserId
        ? {
            id: m.centerUserId._id.toString(),
            centerName: m.centerUserId.centerName,
            city: m.centerUserId.city,
            phone: m.centerUserId.phone,
            address: m.centerUserId.address,
            district: m.centerUserId.district,
          }
        : null,
    }));

    return res.json({ meetings });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

app.get("/api/meetings/inbox", authMiddleware, requireDatabase, async (req, res) => {
  try {
    let rows;

    if (req.user.role === "admin") {
      rows = await MeetingRequest.find({})
        .sort({ createdAt: -1 })
        .limit(200)
        .populate("requesterId", "firstName lastName email")
        .lean();
    } else {
      const myCenterIds = [];
      const rcByEmail = await RecyclingCenter.findOne({
        email: String(req.user.email || "").trim().toLowerCase(),
      })
        .select("_id")
        .lean();
      if (rcByEmail) myCenterIds.push(rcByEmail._id.toString());

      const reg = req.user.collectionCenter?.registrationNumber;
      if (typeof reg === "string" && reg.trim()) {
        const rcByAlt = await RecyclingCenter.findOne({
          registrationNumber: reg.trim(),
        })
          .select("_id")
          .lean();
        if (rcByAlt && !myCenterIds.includes(rcByAlt._id.toString())) {
          myCenterIds.push(rcByAlt._id.toString());
        }
      }

      const oids = myCenterIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (!oids.length) {
        return res.json({ meetings: [] });
      }

      rows = await MeetingRequest.find({ centerUserId: { $in: oids } })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("requesterId", "firstName lastName email")
        .lean();
    }

    const meetings = rows.map((m) => ({
      id: m._id.toString(),
      status: m.status,
      message: m.message,
      preferredDate: m.preferredDate,
      createdAt: m.createdAt,
      requester: m.requesterId
        ? {
            id: m.requesterId._id.toString(),
            firstName: m.requesterId.firstName,
            lastName: m.requesterId.lastName,
            email: m.requesterId.email,
          }
        : null,
    }));

    return res.json({ meetings });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

// Get recycling centers from OpenStreetMap Overpass API (Tunisia)
app.get("/api/osm-recycling-centers", async (req, res) => {
  try {
    const { country = "Tunisia", limit = 100 } = req.query;

    const areaSelector =
      String(country).trim().toLowerCase() === "tunisia"
        ? 'area["ISO3166-1"="TN"][admin_level=2]'
        : `area["name"="${country}"]`;

    const overpassQuery = `
      [out:json];
      ${areaSelector}->.searchArea;
      (
        node["amenity"="recycling"](area.searchArea);
        way["amenity"="recycling"](area.searchArea);
        relation["amenity"="recycling"](area.searchArea);
      );
      out center;
    `;
    const response = await runOverpassQuery(overpassQuery);

    const rawElements = Array.isArray(response?.data?.elements) ? response.data.elements : [];

    const centers = rawElements
      .map((el) => {
        const latitude = el.lat ?? el.center?.lat ?? null;
        const longitude = el.lon ?? el.center?.lon ?? null;

        if (latitude === null || longitude === null) return null;

        return {
          id: `osm_${el.id}`,
          centerName: el.tags?.name || `Recycling Center ${el.id}`,
          latitude,
          longitude,
          materialsAccepted: el.tags?.recycling_type
            ? String(el.tags.recycling_type)
                .split(";")
                .map((m) => m.trim())
                .filter(Boolean)
            : [],
          address: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "N/A",
          city: el.tags?.["addr:city"] || country,
          phone: el.tags?.phone || "",
          openingHours: el.tags?.opening_hours || "N/A",
          centerType: "public",
          description: el.tags?.description || "",
          source: "OpenStreetMap Overpass API",
        };
      })
      .filter(Boolean)
      .slice(0, Number.parseInt(limit, 10) || 100);

    res.json({
      centers,
      count: centers.length,
      source: "openstreetmap",
      country,
    });
  } catch (error) {
    console.error("Error fetching from Overpass API:", error.message);
    res.status(500).json({
      error: "Failed to fetch from Overpass API",
      message: error.message,
    });
  }
});

// Route: Get recycling centers in Tunisia (simple format)
// This is an alias that matches the lightweight response shape often used by frontends.
app.get("/api/recycling-centers", async (req, res) => {
  try {
    const { country = "Tunisia" } = req.query;

    const areaSelector =
      String(country).trim().toLowerCase() === "tunisia"
        ? 'area["ISO3166-1"="TN"][admin_level=2]'
        : `area["name"="${country}"]`;

    const overpassQuery = `
      [out:json];
      ${areaSelector}->.searchArea;
      (
        node["amenity"="recycling"](area.searchArea);
        way["amenity"="recycling"](area.searchArea);
        relation["amenity"="recycling"](area.searchArea);
      );
      out center;
    `;
    const response = await runOverpassQuery(overpassQuery);

    const rawElements = Array.isArray(response?.data?.elements) ? response.data.elements : [];

    const centers = rawElements
      .map((el) => {
        const latitude = el.lat ?? el.center?.lat ?? null;
        const longitude = el.lon ?? el.center?.lon ?? null;
        if (latitude === null || longitude === null) return null;

        return {
          id: el.id,
          name: el.tags?.name || "Recycling Center",
          latitude,
          longitude,
          materials: el.tags?.recycling_type || "unknown",
          address: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "N/A",
        };
      })
      .filter(Boolean);

    res.json(centers);
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ message: "Error fetching data" });
  }
});

const scanPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const safeExt = ext && ext.length <= 10 ? ext : "";
      cb(null, `scan_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mimeOk = /^image\/(jpeg|jpg|png|webp|gif|pjpeg|x-png)$/i.test(
      String(file.mimetype || ""),
    );
    const extOk = /\.(jpe?g|png|gif|webp)$/i.test(file.originalname || "");
    if (mimeOk || extOk) cb(null, true);
    else cb(new Error("Photo: formats acceptes JPG, PNG, WebP ou GIF."));
  },
}).single("photo");

// Scans: Create a new scan (multipart: label, material, photo fichier optionnel)
app.post("/api/scans", authMiddleware, async (req, res) => {
  if (req.user.accountType === "centre_de_collecte") {
    return res.status(403).json({
      message: "Les centres de collecte ne peuvent pas utiliser la fonctionnalite Scanner.",
    });
  }

  scanPhotoUpload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        const msg =
          typeof uploadErr?.message === "string" ? uploadErr.message : "Fichier image invalide";
        return res.status(400).json({ message: msg });
      }

      const label = String(req.body?.label || "").trim();
      const material = String(req.body?.material || "").trim();

      if (!label || !material) {
        return res.status(400).json({ message: "Label et matériau requis" });
      }

      if (!ALLOWED_MATERIALS.includes(material)) {
        return res.status(400).json({ message: "Matériau invalide" });
      }

      const materialData = MATERIAL_DATABASE[material] || {
        recyclable: true,
        points: 0,
        instructions: "Informations non disponibles pour ce matériau.",
      };

      let photoUrl = "";
      if (req.file?.filename) {
        photoUrl = `/uploads/${req.file.filename}`;
      }

      const scan = await Scan.create({
        userId: req.user._id,
        label,
        material,
        recyclable: materialData.recyclable,
        instructions: materialData.instructions,
        points: materialData.points,
        photoUrl,
      });

      let userPointsAfter = typeof req.user.points === "number" ? req.user.points : 0;
      if (materialData.points > 0) {
        const updatedUser = await User.findByIdAndUpdate(
          req.user._id,
          { $inc: { points: materialData.points } },
          { new: true },
        ).lean();
        if (updatedUser && typeof updatedUser.points === "number") userPointsAfter = updatedUser.points;
      }

      return res.status(201).json({
        message: "Scan créé avec succès",
        scan: {
          id: scan._id.toString(),
          label: scan.label,
          material: scan.material,
          recyclable: scan.recyclable,
          instructions: scan.instructions,
          points: scan.points,
          photoUrl: scan.photoUrl,
          createdAt: scan.createdAt,
        },
        userPoints: userPointsAfter,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });
});

// Scans: Get scan by ID
app.get("/api/scans/:id", authMiddleware, async (req, res) => {
  try {
    const scan = await Scan.findById(req.params.id).lean();

    if (!scan) {
      return res.status(404).json({ message: "Scan introuvable" });
    }

    return res.json({
      scan: {
        id: scan._id.toString(),
        label: scan.label,
        material: scan.material,
        recyclable: scan.recyclable,
        instructions: scan.instructions,
        points: scan.points,
        photoUrl: scan.photoUrl,
        createdAt: scan.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

// Scans: Get user's scans
app.get("/api/scans/my", authMiddleware, async (req, res) => {
  try {
    const scans = await Scan.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      scans: scans.map((scan) => ({
        id: scan._id.toString(),
        label: scan.label,
        material: scan.material,
        recyclable: scan.recyclable,
        instructions: scan.instructions,
        points: scan.points,
        photoUrl: scan.photoUrl,
        createdAt: scan.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
});

// Seed test data (for development)
app.post("/api/seed-test-data", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Base de donnees indisponible. Impossible de seed en ce moment.",
      });
    }

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

app.listen(PORT, () => {
  console.log(`API EcoScan disponible sur http://localhost:${PORT}`);
});

connectToDatabase().catch((error) => {
  console.error("Connexion MongoDB impossible:", error.message);
  // Keep server running to allow non-DB routes (ex: Overpass/OpenStreetMap).
});
