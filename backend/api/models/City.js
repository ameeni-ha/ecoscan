const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    governorate: {
      type: String,
      required: true,
      trim: true,
    },
    postalCode: {
      type: String,
      default: "",
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.City || mongoose.model("City", citySchema);
