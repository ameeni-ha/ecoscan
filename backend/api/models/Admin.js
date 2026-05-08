const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
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
      default: "admin",
      trim: true,
    },
    permissions: {
      type: [String],
      default: ["view_users", "view_posts", "view_comments"],
      enum: [
        "view_users",
        "edit_users",
        "delete_users",
        "view_posts",
        "edit_posts",
        "delete_posts",
        "view_comments",
        "delete_comments",
        "view_reports",
        "manage_admins",
      ],
    },
    adminLevel: {
      type: String,
      enum: ["junior", "senior", "super_admin"],
      default: "junior",
    },
    approvalDate: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

adminSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

adminSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

adminSchema.methods.hasPermission = function hasPermission(permission) {
  return this.permissions.includes(permission);
};

adminSchema.methods.approveUser = function approveUser(userId, status) {
  // Implementation: approve/reject user accounts
  return { userId, status: status, approvedBy: this._id, timestamp: new Date() };
};

adminSchema.methods.removeContent = function removeContent(contentId, contentType) {
  // Implementation: remove posts, comments, or other content
  return {
    contentId,
    contentType,
    removedBy: this._id,
    timestamp: new Date(),
  };
};

adminSchema.methods.generateReport = function generateReport(reportType, dateRange) {
  // Implementation: generate admin reports (users, posts, scans, etc.)
  return {
    reportType,
    dateRange,
    generatedBy: this._id,
    generatedAt: new Date(),
  };
};

module.exports = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
