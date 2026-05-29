const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const mongoose = require("mongoose");
const { forumCanReply } = require("../utils/helpers");

class ForumController {
  // Get all posts
  static async getPosts(req, res) {
    try {
      const posts = await Post.find({ status: { $in: ["published", "hidden"] } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const authorIds = [...new Set(posts.map((p) => p.authorId.toString()))];
      const authors = await User.find({ _id: { $in: authorIds } })
        .select("firstName lastName email accountType")
        .lean();
      const authorById = new Map(authors.map((u) => [u._id.toString(), u]));

      const formatted = posts.map((p) => ({
        id: p._id.toString(),
        authorId: p.authorId.toString(),
        title: p.title,
        content: p.content,
        tags: p.tags || [],
        status: p.status,
        images: Array.isArray(p.images) ? p.images : [],
        author: authorById.get(p.authorId.toString())
          ? {
              id: p.authorId.toString(),
              firstName: authorById.get(p.authorId.toString()).firstName,
              lastName: authorById.get(p.authorId.toString()).lastName,
              accountType: authorById.get(p.authorId.toString()).accountType || null,
            }
          : null,
        excerpt:
          typeof p.content === "string"
            ? p.content.replace(/\s+/g, " ").trim().slice(0, 240)
            : "",
        previewImage: Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : "",
        createdAt: p.createdAt,
      }));

      return res.json({ posts: formatted });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Create post
  static async createPost(req, res) {
    try {
      const body = req.body || {};
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();
      const tagsRaw = body.tags;

      if (!title || !content) {
        return res.status(400).json({ message: "Titre et message requis" });
      }

      const tags =
        typeof tagsRaw === "string" && tagsRaw.trim()
          ? tagsRaw
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10)
          : [];

      const files = Array.isArray(req.files) ? req.files : [];
      const images = files.map((f) => ({
        url: `/uploads/${f.filename}`,
        filename: f.filename,
        originalName: f.originalname || "",
        mimeType: f.mimetype || "",
        size: f.size || 0,
      }));

      const post = await Post.create({
        authorId: req.user._id,
        title,
        content,
        tags,
        images,
        status: "published",
      });

      return res.status(201).json({ postId: post._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Get post with comments
  static async getPost(req, res) {
    try {
      const post = await Post.findById(req.params.id).lean();
      if (!post) return res.status(404).json({ message: "Post introuvable" });

      const author = await User.findById(post.authorId)
        .select("firstName lastName accountType")
        .lean();
      const comments = await Comment.find({ postId: post._id })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();

      const commentAuthorIds = [...new Set(comments.map((c) => c.authorId.toString()))];
      const commentAuthors = await User.find({ _id: { $in: commentAuthorIds } })
        .select("firstName lastName accountType")
        .lean();
      const commentAuthorById = new Map(commentAuthors.map((u) => [u._id.toString(), u]));

      return res.json({
        post: {
          id: post._id.toString(),
          authorId: post.authorId.toString(),
          title: post.title,
          content: post.content,
          tags: post.tags || [],
          status: post.status,
          images: Array.isArray(post.images) ? post.images : [],
          author: author
            ? {
                id: post.authorId.toString(),
                firstName: author.firstName,
                lastName: author.lastName,
                accountType: author.accountType || null,
              }
            : null,
          createdAt: post.createdAt,
        },
        comments: comments.map((c) => ({
          id: c._id.toString(),
          authorId: c.authorId.toString(),
          content: c.content,
          status: c.status,
          parentCommentId: c.parentCommentId ? c.parentCommentId.toString() : null,
          createdAt: c.createdAt,
          author: commentAuthorById.get(c.authorId.toString())
            ? {
                id: c.authorId.toString(),
                firstName: commentAuthorById.get(c.authorId.toString()).firstName,
                lastName: commentAuthorById.get(c.authorId.toString()).lastName,
                accountType: commentAuthorById.get(c.authorId.toString()).accountType || null,
              }
            : null,
        })),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Create comment
  static async createComment(req, res) {
    try {
      const content = String(req.body?.content || "").trim();
      if (!content) return res.status(400).json({ message: "Commentaire requis" });

      if (!forumCanReply(req.user)) {
        return res.status(403).json({
          message: "Réponse forum réservée aux comptes collecteur ou centre de collecte.",
        });
      }

      const post = await Post.findById(req.params.id).select("_id").lean();
      if (!post) return res.status(404).json({ message: "Post introuvable" });

      const parentRaw = req.body?.parentCommentId;
      let parentCommentId = null;

      if (parentRaw) {
        if (!mongoose.Types.ObjectId.isValid(String(parentRaw))) {
          return res.status(400).json({ message: "Identifiant de commentaire parent invalide" });
        }

        const parentDoc = await Comment.findOne({
          _id: parentRaw,
          postId: post._id,
          status: "published",
        }).lean();

        if (!parentDoc) {
          return res.status(400).json({ message: "Commentaire parent introuvable" });
        }

        parentCommentId = parentDoc._id;
      }

      const comment = await Comment.create({
        postId: post._id,
        authorId: req.user._id,
        parentCommentId,
        content,
        status: "published",
      });

      return res.status(201).json({ commentId: comment._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Update post
  static async updatePost(req, res) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ message: "Post introuvable" });

      if (post.authorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Vous ne pouvez éditer que vos propres posts" });
      }

      const title = String(req.body?.title || "").trim();
      const content = String(req.body?.content || "").trim();
      const tagsRaw = req.body?.tags;

      if (!title || !content) {
        return res.status(400).json({ message: "Titre et contenu requis" });
      }

      const tags =
        typeof tagsRaw === "string" && tagsRaw.trim()
          ? tagsRaw
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10)
          : Array.isArray(tagsRaw)
          ? tagsRaw.slice(0, 10)
          : [];

      post.title = title;
      post.content = content;
      post.tags = tags;
      await post.save();

      return res.json({ message: "Post modifié", postId: post._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Delete post
  static async deletePost(req, res) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Post introuvable" });
      }

      if (post.authorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Vous ne pouvez supprimer que vos propres posts" });
      }

      await Comment.deleteMany({ postId: post._id });
      await Post.deleteOne({ _id: post._id });

      return res.json({ message: "Post supprimé" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Update comment
  static async updateComment(req, res) {
    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) return res.status(404).json({ message: "Commentaire introuvable" });

      if (comment.authorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Vous ne pouvez éditer que vos propres commentaires" });
      }

      const content = String(req.body?.content || "").trim();
      if (!content) {
        return res.status(400).json({ message: "Contenu requis" });
      }

      comment.content = content;
      await comment.save();

      return res.json({ message: "Commentaire modifié", commentId: comment._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  // Delete comment
  static async deleteComment(req, res) {
    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) return res.status(404).json({ message: "Commentaire introuvable" });

      if (comment.authorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Vous ne pouvez supprimer que vos propres commentaires" });
      }

      const idsToDelete = [comment._id];
      const queue = [comment._id];

      while (queue.length > 0) {
        const currentId = queue.shift();
        const children = await Comment.find({ parentCommentId: currentId }).select("_id").lean();
        for (const child of children) {
          idsToDelete.push(child._id);
          queue.push(child._id);
        }
      }

      await Comment.deleteMany({ _id: { $in: idsToDelete } });

      return res.json({ message: "Commentaire supprimé" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }
}

module.exports = ForumController;
