const mongoose = require("mongoose");

const meetingRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** Identifiant document `RecyclingCenter` (liste /centres) */
    centerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecyclingCenter",
      required: true,
      index: true,
    },
    preferredDate: {
      type: Date,
      default: null,
    },
    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    material: {
      type: String,
      default: "",
      trim: true,
    },
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scan",
      default: null,
    },
    scanIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Scan",
      default: [],
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    meetingConfirmedDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.MeetingRequest || mongoose.model("MeetingRequest", meetingRequestSchema);

