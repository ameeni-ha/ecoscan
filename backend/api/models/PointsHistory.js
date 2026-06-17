const mongoose = require("mongoose");

const pointsHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scan",
      default: null,
      index: true,
    },
    material: {
      type: String,
      required: true,
      trim: true,
    },
    pointsEarned: {
      type: Number,
      required: true,
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    bonus: {
      type: String,
      default: "",
      trim: true,
    },
    reason: {
      type: String,
      enum: ["scan", "achievement", "bonus", "manual_adjustment", "deduction"],
      default: "scan",
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "completed",
    },
    metadata: {
      confidence: {
        type: Number,
        default: null,
      },
      photoUrl: {
        type: String,
        default: null,
      },
      notes: {
        type: String,
        default: "",
      },
    },
  },
  { timestamps: true }
);

// Index composé pour requêtes efficaces
pointsHistorySchema.index({ userId: 1, createdAt: -1 });
pointsHistorySchema.index({ userId: 1, reason: 1 });
pointsHistorySchema.index({ scanId: 1 });

module.exports = mongoose.models.PointsHistory ||
  mongoose.model("PointsHistory", pointsHistorySchema);
