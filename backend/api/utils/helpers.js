const crypto = require("crypto");
const { SCAN_MATERIAL_TO_CENTER_TAGS } = require("./constants");

// Sanitize user data
const sanitizeUser = (user) => ({
  id: user._id.toString(),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  accountType: user.accountType,
  phone: user.phone,
  address: user.address,
  points: user.points || 0,
  createdAt: user.createdAt?.toISOString?.() || user.createdAt,
});

// Parse duration strings like "15m", "7d" into milliseconds
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

// Hash token ID using SHA256
const hashTokenId = (tokenId) =>
  crypto.createHash("sha256").update(tokenId).digest("hex");

// Create random token ID
const createRefreshTokenId = () => crypto.randomBytes(32).toString("hex");

// Haversine distance formula for lat/lng coordinates
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

// Check if a recycling center accepts material
const centerAcceptsScanMaterial = (center, scanMaterialKey) => {
  const mats = Array.isArray(center.materialsAccepted) ? center.materialsAccepted : [];
  const tags = SCAN_MATERIAL_TO_CENTER_TAGS[scanMaterialKey];
  if (!tags || !tags.length) return true;
  if (!mats.length || mats.includes("mixed")) return true;
  return mats.some((m) => tags.includes(m));
};

// Check if user can reply on forum (only collectors and collection centers)
const forumCanReply = (user) => {
  if (!user) return false;
  if (user.role === "admin" || user.role === "moderator") return true;
  return ["collecteur", "centre_de_collecte"].includes(user.accountType);
};

module.exports = {
  sanitizeUser,
  parseDurationMs,
  hashTokenId,
  createRefreshTokenId,
  haversineKm,
  centerAcceptsScanMaterial,
  forumCanReply,
};
