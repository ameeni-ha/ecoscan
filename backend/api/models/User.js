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
    adresse: {
      type: String,
      default: "",
      trim: true,
    },
    collectionCenter: {
      centerName: {
        type: String,
        default: "",
        trim: true,
      },
      managerName: {
        type: String,
        default: "",
        trim: true,
      },
      registrationNumber: {
        type: String,
        default: "",
        trim: true,
      },
      centerType: {
        type: String,
        default: "",
        trim: true,
      },
      materialsAccepted: {
        type: [String],
        default: [],
      },
      city: {
        type: String,
        default: "",
        trim: true,
      },
      openingHours: {
        type: String,
        default: "",
        trim: true,
      },
      district: {
        type: String,
        default: "",
        trim: true,
      },
      capacityPerDayKg: {
        type: Number,
        default: null,
      },
      description: {
        type: String,
        default: "",
        trim: true,
      },
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
