const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenIdHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByTokenIdHash: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "client",
      trim: true,
    },
    accountType: {
      type: String,
      enum: ["collecteur", "centre_de_collecte"],
      default: "collecteur",
      required: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    refreshTokens: {
      type: [refreshTokenSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
