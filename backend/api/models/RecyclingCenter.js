const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const recyclingCenterSchema = new mongoose.Schema(
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
      default: "center_manager",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    centerName: {
      type: String,
      required: true,
      trim: true,
    },
    managerName: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    centerType: {
      type: String,
      enum: ["public", "private", "non_profit"],
      required: true,
    },
    materialsAccepted: {
      type: [String],
      default: [],
      enum: [
        "plastic",
        "paper",
        "glass",
        "metal",
        "electronic",
        "textile",
        "organic",
        "mixed",
      ],
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    openingHours: {
      type: String,
      default: "9:00 AM - 6:00 PM",
      trim: true,
    },
    closingDays: {
      type: [String],
      default: ["Sunday"],
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    capacityPerDayKg: {
      type: Number,
      default: 1000,
      min: 0,
    },
    currentCapacityKg: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

recyclingCenterSchema.methods.comparePassword = function comparePassword(
  password
) {
  return bcrypt.compare(password, this.passwordHash);
};

recyclingCenterSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

recyclingCenterSchema.methods.getAvailableCapacity = function getAvailableCapacity() {
  return this.capacityPerDayKg - this.currentCapacityKg;
};

recyclingCenterSchema.methods.updateOperatingHours = function updateOperatingHours(
  hours
) {
  this.openingHours = hours;
  return this.save();
};

recyclingCenterSchema.methods.getMaterialsList = function getMaterialsList() {
  return this.materialsAccepted;
};

recyclingCenterSchema.methods.canAcceptMaterial = function canAcceptMaterial(
  material
) {
  return this.materialsAccepted.includes(material);
};

recyclingCenterSchema.methods.updateCurrentCapacity = function updateCurrentCapacity(
  weight
) {
  this.currentCapacityKg += weight;
  if (this.currentCapacityKg > this.capacityPerDayKg) {
    this.currentCapacityKg = this.capacityPerDayKg;
  }
  return this.save();
};

recyclingCenterSchema.methods.addReview = function addReview(rating) {
  const newRating =
    (this.rating * this.totalReviews + rating) / (this.totalReviews + 1);
  this.rating = newRating;
  this.totalReviews += 1;
  return this.save();
};

module.exports =
  mongoose.models.RecyclingCenter ||
  mongoose.model("RecyclingCenter", recyclingCenterSchema);
