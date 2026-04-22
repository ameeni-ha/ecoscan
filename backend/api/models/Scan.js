const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    material: {
      type: String,
      required: true,
      trim: true,
    },
    recyclable: {
      type: Boolean,
      required: true,
    },
    instructions: {
      type: String,
      default: "",
      trim: true,
      maxlength: 600,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    photoUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Scan || mongoose.model("Scan", scanSchema);

