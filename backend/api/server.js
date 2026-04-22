require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("./models/User");
const Scan = require("./models/Scan");
const Post = require("./models/Post");
const Comment = require("./models/Comment");
const MeetingRequest = require("./models/MeetingRequest");

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

const requireRole = (...roles) => (req, res, next) => {
  const role = req.user?.role || "client";
  if (!roles.includes(role)) {
    return res.status(403).json({ message: "Acces refuse" });
  }
  return next();
};

const isModerator = (role) => ["moderator", "admin"].includes(role);

const normalizeTags = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);
  }
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
};

const computeScanResult = ({ label, material }) => {
  const normalizedMaterial = String(material || "").trim().toLowerCase();
  const safeLabel = String(label || "").trim();

  const recyclableMaterials = new Set(["plastique", "verre", "papier_carton", "metal", "electronique"]);
  const recyclable = recyclableMaterials.has(normalizedMaterial);
  const points = recyclable ? 10 : 2;

  const instructions = recyclable
    ? `Déposez "${safeLabel || "cet objet"}" dans la filière ${normalizedMaterial || "adaptée"} (rincez si nécessaire).`
    : `Vérifiez les consignes locales: "${safeLabel || "cet objet"}" peut nécessiter une collecte spécialisée.`;

  return { recyclable, points, instructions };
};

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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

app.patch("/api/users/me", authMiddleware, (req, res) => {
  const { firstName, lastName, phone, adresse, password } = req.body || {};

  return (async () => {
    if (firstName !== undefined) req.user.firstName = String(firstName).trim();
    if (lastName !== undefined) req.user.lastName = String(lastName).trim();
    if (phone !== undefined) req.user.phone = String(phone).trim();
    if (adresse !== undefined) req.user.adresse = String(adresse).trim();

    if (password) {
      req.user.passwordHash = await User.hashPassword(String(password));
      req.user.refreshTokens = [];
    }

    await req.user.save();
    return res.json({ user: sanitizeUser(req.user) });
  })().catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/centers", (req, res) => {
  const { city, material } = req.query || {};
  const filter = { accountType: "centre_de_collecte" };

  if (city) {
    filter["collectionCenter.city"] = new RegExp(String(city).trim(), "i");
  }

  if (material && ALLOWED_MATERIALS.includes(String(material).trim().toLowerCase())) {
    filter["collectionCenter.materialsAccepted"] = String(material).trim().toLowerCase();
  }

  return User.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .then((users) =>
      res.json({
        centers: users.map((user) => ({
          id: user._id.toString(),
          centerName: user.collectionCenter?.centerName || "",
          managerName: user.collectionCenter?.managerName || "",
          centerType: user.collectionCenter?.centerType || "",
          materialsAccepted: user.collectionCenter?.materialsAccepted || [],
          city: user.collectionCenter?.city || "",
          district: user.collectionCenter?.district || "",
          openingHours: user.collectionCenter?.openingHours || "",
          capacityPerDayKg: user.collectionCenter?.capacityPerDayKg ?? null,
          description: user.collectionCenter?.description || "",
          phone: user.phone || "",
        })),
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.post("/api/scans", authMiddleware, (req, res) => {
  const { label, material, photoUrl } = req.body || {};

  if (!label || !material) {
    return res.status(400).json({ message: "label et material sont requis" });
  }

  const normalizedMaterial = String(material).trim().toLowerCase();
  if (!ALLOWED_MATERIALS.includes(normalizedMaterial)) {
    return res.status(400).json({ message: "Material invalide" });
  }

  const result = computeScanResult({ label, material: normalizedMaterial });

  return Scan.create({
    userId: req.user._id,
    label: String(label).trim(),
    material: normalizedMaterial,
    recyclable: result.recyclable,
    instructions: result.instructions,
    points: result.points,
    photoUrl: photoUrl ? String(photoUrl).trim() : "",
  })
    .then((scan) =>
      res.status(201).json({
        scan: {
          id: scan._id.toString(),
          label: scan.label,
          material: scan.material,
          recyclable: scan.recyclable,
          instructions: scan.instructions,
          points: scan.points,
          photoUrl: scan.photoUrl,
          createdAt: scan.createdAt?.toISOString?.() || scan.createdAt,
        },
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/scans/my", authMiddleware, (req, res) => {
  return Scan.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .then((scans) =>
      res.json({
        scans: scans.map((scan) => ({
          id: scan._id.toString(),
          label: scan.label,
          material: scan.material,
          recyclable: scan.recyclable,
          instructions: scan.instructions,
          points: scan.points,
          photoUrl: scan.photoUrl,
          createdAt: scan.createdAt?.toISOString?.() || scan.createdAt,
        })),
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/scans/:id", authMiddleware, (req, res) => {
  return Scan.findById(req.params.id)
    .then((scan) => {
      if (!scan) return res.status(404).json({ message: "Scan introuvable" });
      const isOwner = scan.userId.toString() === req.user._id.toString();
      if (!isOwner && req.user.role !== "admin") {
        return res.status(403).json({ message: "Acces refuse" });
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
          createdAt: scan.createdAt?.toISOString?.() || scan.createdAt,
        },
      });
    })
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/leaderboard", (req, res) => {
  return Scan.aggregate([
    { $group: { _id: "$userId", points: { $sum: "$points" }, scans: { $sum: 1 } } },
    { $sort: { points: -1, scans: -1 } },
    { $limit: 20 },
  ])
    .then(async (rows) => {
      const userIds = rows.map((row) => row._id);
      const users = await User.find({ _id: { $in: userIds } });
      const byId = new Map(users.map((u) => [u._id.toString(), u]));
      return res.json({
        leaderboard: rows.map((row, index) => {
          const user = byId.get(row._id.toString());
          return {
            rank: index + 1,
            user: user ? sanitizeUser(user) : { id: row._id.toString(), firstName: "Utilisateur", lastName: "" },
            points: row.points,
            scans: row.scans,
          };
        }),
      });
    })
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/forum/posts", authMiddleware, (req, res) => {
  const role = req.user?.role || "client";
  const { search, tag } = req.query || {};

  const filter = {};
  if (!isModerator(role)) {
    filter.status = "published";
  }
  if (tag) {
    filter.tags = String(tag).trim().toLowerCase();
  }
  if (search) {
    const rx = new RegExp(String(search).trim(), "i");
    filter.$or = [{ title: rx }, { content: rx }];
  }

  return Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("authorId", "firstName lastName email role accountType phone adresse collectionCenter createdAt")
    .then((posts) =>
      res.json({
        posts: posts.map((post) => ({
          id: post._id.toString(),
          title: post.title,
          content: post.content,
          tags: post.tags || [],
          status: post.status,
          author: post.authorId ? sanitizeUser(post.authorId) : null,
          createdAt: post.createdAt?.toISOString?.() || post.createdAt,
          updatedAt: post.updatedAt?.toISOString?.() || post.updatedAt,
        })),
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.post("/api/forum/posts", authMiddleware, (req, res) => {
  const { title, content, tags } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ message: "title et content sont requis" });
  }

  return Post.create({
    authorId: req.user._id,
    title: String(title).trim(),
    content: String(content).trim(),
    tags: normalizeTags(tags),
  })
    .then((post) =>
      res.status(201).json({
        post: {
          id: post._id.toString(),
          title: post.title,
          content: post.content,
          tags: post.tags || [],
          status: post.status,
          createdAt: post.createdAt?.toISOString?.() || post.createdAt,
        },
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/forum/posts/:id", authMiddleware, (req, res) => {
  const role = req.user?.role || "client";

  return Post.findById(req.params.id)
    .populate("authorId", "firstName lastName email role accountType phone adresse collectionCenter createdAt")
    .then(async (post) => {
      if (!post) return res.status(404).json({ message: "Post introuvable" });
      if (post.status !== "published" && !isModerator(role)) {
        return res.status(403).json({ message: "Acces refuse" });
      }

      const commentFilter = { postId: post._id };
      if (!isModerator(role)) commentFilter.status = "published";

      const comments = await Comment.find(commentFilter)
        .sort({ createdAt: 1 })
        .limit(200)
        .populate("authorId", "firstName lastName email role accountType phone adresse collectionCenter createdAt");

      return res.json({
        post: {
          id: post._id.toString(),
          title: post.title,
          content: post.content,
          tags: post.tags || [],
          status: post.status,
          author: post.authorId ? sanitizeUser(post.authorId) : null,
          createdAt: post.createdAt?.toISOString?.() || post.createdAt,
          updatedAt: post.updatedAt?.toISOString?.() || post.updatedAt,
        },
        comments: comments.map((comment) => ({
          id: comment._id.toString(),
          content: comment.content,
          status: comment.status,
          author: comment.authorId ? sanitizeUser(comment.authorId) : null,
          createdAt: comment.createdAt?.toISOString?.() || comment.createdAt,
        })),
      });
    })
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.post("/api/forum/posts/:id/comments", authMiddleware, (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ message: "content est requis" });

  return Post.findById(req.params.id)
    .then((post) => {
      if (!post) return res.status(404).json({ message: "Post introuvable" });
      return Comment.create({
        postId: post._id,
        authorId: req.user._id,
        content: String(content).trim(),
      });
    })
    .then((comment) =>
      res.status(201).json({
        comment: {
          id: comment._id.toString(),
          content: comment.content,
          status: comment.status,
          createdAt: comment.createdAt?.toISOString?.() || comment.createdAt,
        },
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.patch("/api/forum/posts/:id/moderate", authMiddleware, requireRole("moderator", "admin"), (req, res) => {
  const { status } = req.body || {};
  if (!["published", "hidden"].includes(status)) {
    return res.status(400).json({ message: "status invalide" });
  }

  return Post.findByIdAndUpdate(req.params.id, { status }, { new: true })
    .then((post) => {
      if (!post) return res.status(404).json({ message: "Post introuvable" });
      return res.json({ post: { id: post._id.toString(), status: post.status } });
    })
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.patch(
  "/api/forum/comments/:id/moderate",
  authMiddleware,
  requireRole("moderator", "admin"),
  (req, res) => {
    const { status } = req.body || {};
    if (!["published", "hidden"].includes(status)) {
      return res.status(400).json({ message: "status invalide" });
    }

    return Comment.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .then((comment) => {
        if (!comment) return res.status(404).json({ message: "Commentaire introuvable" });
        return res.json({ comment: { id: comment._id.toString(), status: comment.status } });
      })
      .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
  }
);

app.post("/api/meetings", authMiddleware, (req, res) => {
  const { centerUserId, preferredDate, message } = req.body || {};
  if (!centerUserId) return res.status(400).json({ message: "centerUserId est requis" });

  return User.findById(centerUserId)
    .then((center) => {
      if (!center || center.accountType !== "centre_de_collecte") {
        return res.status(400).json({ message: "Centre de collecte invalide" });
      }
      const parsedDate = preferredDate ? new Date(preferredDate) : null;
      if (parsedDate && Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "preferredDate invalide" });
      }
      return MeetingRequest.create({
        requesterId: req.user._id,
        centerUserId: center._id,
        preferredDate: parsedDate,
        message: message ? String(message).trim() : "",
      });
    })
    .then((meeting) =>
      res.status(201).json({
        meeting: {
          id: meeting._id.toString(),
          centerUserId: meeting.centerUserId.toString(),
          preferredDate: meeting.preferredDate ? meeting.preferredDate.toISOString() : null,
          message: meeting.message,
          status: meeting.status,
          createdAt: meeting.createdAt?.toISOString?.() || meeting.createdAt,
        },
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/meetings/my", authMiddleware, (req, res) => {
  return MeetingRequest.find({ requesterId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .then((meetings) =>
      res.json({
        meetings: meetings.map((meeting) => ({
          id: meeting._id.toString(),
          centerUserId: meeting.centerUserId.toString(),
          preferredDate: meeting.preferredDate ? meeting.preferredDate.toISOString() : null,
          message: meeting.message,
          status: meeting.status,
          createdAt: meeting.createdAt?.toISOString?.() || meeting.createdAt,
        })),
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/meetings/inbox", authMiddleware, (req, res) => {
  const isCenter = req.user.accountType === "centre_de_collecte";
  if (!isCenter && req.user.role !== "admin") {
    return res.status(403).json({ message: "Acces refuse" });
  }

  const filter = isCenter ? { centerUserId: req.user._id } : {};

  return MeetingRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("requesterId", "firstName lastName email role accountType phone adresse collectionCenter createdAt")
    .then((meetings) =>
      res.json({
        meetings: meetings.map((meeting) => ({
          id: meeting._id.toString(),
          requester: meeting.requesterId ? sanitizeUser(meeting.requesterId) : null,
          centerUserId: meeting.centerUserId.toString(),
          preferredDate: meeting.preferredDate ? meeting.preferredDate.toISOString() : null,
          message: meeting.message,
          status: meeting.status,
          createdAt: meeting.createdAt?.toISOString?.() || meeting.createdAt,
        })),
      })
    )
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.get("/api/admin/users", authMiddleware, requireRole("admin"), (req, res) => {
  return User.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .then((users) => res.json({ users: users.map(sanitizeUser) }))
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
});

app.patch("/api/admin/users/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const { role } = req.body || {};
  if (!role || !["client", "moderator", "admin"].includes(String(role))) {
    return res.status(400).json({ message: "role invalide" });
  }
  return User.findByIdAndUpdate(req.params.id, { role: String(role) }, { new: true })
    .then((user) => {
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
      return res.json({ user: sanitizeUser(user) });
    })
    .catch((error) => res.status(500).json({ message: error.message || "Erreur serveur" }));
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
