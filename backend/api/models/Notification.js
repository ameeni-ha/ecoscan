const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "meeting_request",
        "meeting_accepted",
        "meeting_rejected",
        "meeting_cancelled",
        "new_center",
        "system",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    relatedModel: {
      type: String,
      enum: ["MeetingRequest", "RecyclingCenter", "Post", "Scan", null],
      default: null,
    },
    data: {
      centerName: String,
      userName: String,
      meetingDate: Date,
      material: String,
      status: String,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      index: true,
    },
  },
  { timestamps: true }
);

// Index composé pour requêtes efficaces
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

// TTL Index - supprime automatiquement après expiresAt
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
