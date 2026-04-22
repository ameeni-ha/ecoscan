const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 6000,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["published", "hidden"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Post || mongoose.model("Post", postSchema);

