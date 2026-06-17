const User = require("../models/User");
const Scan = require("../models/Scan");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const RecyclingCenter = require("../models/RecyclingCenter");
const MeetingRequest = require("../models/MeetingRequest");
const { MATERIAL_DATABASE, ALLOWED_MATERIALS } = require("../utils/constants");
const { sanitizeUser } = require("../utils/helpers");
const PointsService = require("../utils/PointsService");
const NotificationService = require("../utils/NotificationService");

const CENTER_MATERIAL_TAGS = ["plastic", "paper", "glass", "metal", "electronic", "textile", "organic", "mixed"];

const ensureAdmin = (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Accès administrateur requis" });
    return false;
  }
  return true;
};

const formatUserName = (user) =>
  user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";

class AdminController {
  static async stats(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const [
        totalUsers,
        totalCenters,
        totalPosts,
        hiddenPosts,
        totalComments,
        totalScans,
        totalMeetings,
        pointsResult,
      ] = await Promise.all([
        User.countDocuments(),
        RecyclingCenter.countDocuments(),
        Post.countDocuments(),
        Post.countDocuments({ status: "hidden" }),
        Comment.countDocuments(),
        Scan.countDocuments(),
        MeetingRequest.countDocuments(),
        User.aggregate([{ $group: { _id: null, total: { $sum: "$points" } } }]),
      ]);

      return res.json({
        stats: {
          totalUsers,
          totalCenters,
          totalPosts,
          hiddenPosts,
          totalComments,
          totalScans,
          totalMeetings,
          totalPoints: pointsResult[0]?.total || 0,
        },
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async users(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const users = await User.find().sort({ createdAt: -1 }).limit(500).lean();
      return res.json({ users: users.map((user) => sanitizeUser(user)) });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updateUser(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const { firstName, lastName, phone, address, role, accountType } = req.body || {};
      const updates = {};

      if (firstName !== undefined) updates.firstName = String(firstName).trim();
      if (lastName !== undefined) updates.lastName = String(lastName).trim();
      if (phone !== undefined) updates.phone = String(phone).trim();
      if (address !== undefined) updates.address = String(address).trim();
      if (role !== undefined) {
        if (!["client", "moderator", "admin"].includes(role)) {
          return res.status(400).json({ message: "Rôle invalide" });
        }
        updates.role = role;
      }
      if (accountType !== undefined) {
        if (!["collecteur", "centre_de_collecte"].includes(accountType)) {
          return res.status(400).json({ message: "Type de compte invalide" });
        }
        updates.accountType = accountType;
      }

      const user = await User.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async deleteUser(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      if (req.params.id === req.user._id.toString()) {
        return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
      }

      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
      if (user.role === "admin") {
        return res.status(400).json({ message: "Vous ne pouvez pas supprimer un administrateur" });
      }

      const scanCount = await Scan.countDocuments({ userId: user._id });
      if (scanCount > 0) {
        return res.status(400).json({
          message: `Impossible de supprimer cet utilisateur : il possède ${scanCount} scan${scanCount > 1 ? "s" : ""}. Supprimez d'abord ses scans depuis l'administration.`,
          scanCount,
        });
      }

      const meetingDeleteResult = await MeetingRequest.deleteMany({ requesterId: user._id });
      await Promise.all([
        Post.deleteMany({ authorId: user._id }),
        Comment.deleteMany({ authorId: user._id }),
      ]);
      await User.deleteOne({ _id: user._id });

      return res.json({
        message:
          meetingDeleteResult.deletedCount > 0
            ? `Utilisateur supprimé. ${meetingDeleteResult.deletedCount} demande${meetingDeleteResult.deletedCount > 1 ? "s" : ""} de rendez-vous supprimée${meetingDeleteResult.deletedCount > 1 ? "s" : ""} des centres.`
            : "Utilisateur supprimé",
        deletedMeetings: meetingDeleteResult.deletedCount || 0,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async scans(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const scans = await Scan.find().sort({ createdAt: -1 }).limit(500).lean();
      const userIds = [...new Set(scans.map((scan) => scan.userId.toString()))];
      const users = await User.find({ _id: { $in: userIds } })
        .select("firstName lastName email accountType")
        .lean();
      const userById = new Map(users.map((user) => [user._id.toString(), user]));

      return res.json({
        scans: scans.map((scan) => {
          const scanUser = userById.get(scan.userId.toString());
          return {
            id: scan._id.toString(),
            label: scan.label,
            material: scan.material,
            sortingClass: scan.sortingClass || "",
            recyclable: scan.recyclable,
            points: scan.points,
            photoUrl: scan.photoUrl,
            detectedObject: scan.detectedObject,
            confidence: scan.confidence,
            detectionStatus: scan.detectionStatus,
            detectionReason: scan.detectionReason,
            createdAt: scan.createdAt,
            user: scanUser
              ? {
                  id: scanUser._id.toString(),
                  name: formatUserName(scanUser),
                  email: scanUser.email,
                  accountType: scanUser.accountType,
                }
              : null,
          };
        }),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updateScan(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const material = String(req.body?.material || "").trim();
      if (!ALLOWED_MATERIALS.includes(material)) {
        return res.status(400).json({ message: "Matériau invalide" });
      }

      const scan = await Scan.findById(req.params.id);
      if (!scan) return res.status(404).json({ message: "Scan introuvable" });

      const oldPoints = scan.points || 0;
      const materialData = MATERIAL_DATABASE[material] || MATERIAL_DATABASE.autre;
      const nextRecyclable = material !== "autre" && materialData.recyclable;
      const nextPoints = nextRecyclable ? materialData.points : 0;

      if (req.body?.label !== undefined) {
        scan.label = String(req.body.label).trim().slice(0, 140) || scan.label;
      }
      scan.material = material;
      scan.recyclable = nextRecyclable;
      scan.points = nextPoints;
      scan.instructions = materialData.instructions;
      if (req.body?.sortingClass !== undefined) {
        const sortingClass = String(req.body.sortingClass || "").trim();
        if (!["", "recyclable", "non_recyclable", "recyclage_specialise"].includes(sortingClass)) {
          return res.status(400).json({ message: "Classe de tri invalide" });
        }
        scan.sortingClass = sortingClass;
      }
      if (req.body?.detectionReason !== undefined) {
        scan.detectionReason = String(req.body.detectionReason || "").trim().slice(0, 500);
      }
      scan.detectionStatus = "admin_corrected";
      if (!scan.detectionReason) {
        scan.detectionReason = "Matière corrigée par un administrateur.";
      }
      await scan.save();

      const delta = nextPoints - oldPoints;
      if (delta !== 0) {
        await PointsService.applyPointsDelta(scan.userId, delta);
      }

      return res.json({ message: "Scan modifié", scanId: scan._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async deleteScan(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const scan = await Scan.findById(req.params.id);
      if (!scan) return res.status(404).json({ message: "Scan introuvable" });

      if (scan.points > 0) {
        await PointsService.applyPointsDelta(scan.userId, -scan.points);
      }
      await Scan.deleteOne({ _id: scan._id });
      return res.json({ message: "Scan supprimé" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async posts(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const posts = await Post.find().sort({ createdAt: -1 }).limit(500).lean();
      const postIds = posts.map((post) => post._id);
      const comments = await Comment.find({ postId: { $in: postIds } })
        .sort({ createdAt: -1 })
        .limit(2000)
        .lean();
      const authorIds = [
        ...new Set([
          ...posts.map((post) => post.authorId.toString()),
          ...comments.map((comment) => comment.authorId.toString()),
        ]),
      ];
      const [authors, counts] = await Promise.all([
        User.find({ _id: { $in: authorIds } }).select("firstName lastName email").lean(),
        Comment.aggregate([
          { $match: { postId: { $in: postIds } } },
          { $group: { _id: "$postId", count: { $sum: 1 } } },
        ]),
      ]);
      const authorById = new Map(authors.map((user) => [user._id.toString(), user]));
      const countByPostId = new Map(counts.map((item) => [item._id.toString(), item.count]));
      const commentsByPostId = new Map();

      comments.forEach((comment) => {
        const postId = comment.postId.toString();
        const author = authorById.get(comment.authorId.toString());
        const formatted = {
          id: comment._id.toString(),
          content: comment.content,
          status: comment.status,
          parentCommentId: comment.parentCommentId ? comment.parentCommentId.toString() : null,
          createdAt: comment.createdAt,
          author: author
            ? {
                id: author._id.toString(),
                name: formatUserName(author),
                email: author.email,
              }
            : null,
        };

        commentsByPostId.set(postId, [...(commentsByPostId.get(postId) || []), formatted]);
      });

      return res.json({
        posts: posts.map((post) => {
          const author = authorById.get(post.authorId.toString());
          const postId = post._id.toString();
          return {
            id: postId,
            title: post.title,
            content: post.content,
            tags: post.tags || [],
            status: post.status,
            createdAt: post.createdAt,
            commentCount: countByPostId.get(postId) || 0,
            comments: commentsByPostId.get(postId) || [],
            author: author
              ? {
                  id: author._id.toString(),
                  name: formatUserName(author),
                  email: author.email,
                }
              : null,
          };
        }),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updateCommentStatus(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const status = String(req.body?.status || "").trim();
      if (!["published", "hidden"].includes(status)) {
        return res.status(400).json({ message: "Statut invalide" });
      }
      const comment = await Comment.findByIdAndUpdate(req.params.commentId, { status }, { new: true });
      if (!comment) return res.status(404).json({ message: "Commentaire introuvable" });
      return res.json({ message: "Statut modifié", comment: { id: comment._id.toString(), status } });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updateComment(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const content = String(req.body?.content || "").trim();
      if (!content) return res.status(400).json({ message: "Contenu requis" });

      const comment = await Comment.findByIdAndUpdate(
        req.params.commentId,
        { content },
        { new: true, runValidators: true }
      );
      if (!comment) return res.status(404).json({ message: "Commentaire introuvable" });
      return res.json({ message: "Commentaire modifié", commentId: comment._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async centers(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const centers = await RecyclingCenter.find().sort({ createdAt: -1 }).limit(500).lean();
      return res.json({
        centers: centers.map((center) => ({
          id: center._id.toString(),
          name: center.centerName || center.name || "Centre",
          centerName: center.centerName || center.name || "Centre",
          manager: center.managerName || "",
          managerName: center.managerName || "",
          city: center.city || "",
          address: center.address || "",
          phone: center.phone || "",
          email: center.email || "",
          openingHours: center.openingHours || "",
          capacityPerDayKg: center.capacityPerDayKg || 0,
          materials: center.materialsAccepted || [],
          verified: Boolean(center.isVerified),
          rating: center.rating || 0,
        })),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updateCenter(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const updates = {};
      const {
        centerName,
        managerName,
        city,
        address,
        phone,
        openingHours,
        materialsAccepted,
        capacityPerDayKg,
        isVerified,
      } = req.body || {};

      if (centerName !== undefined) updates.centerName = String(centerName).trim();
      if (managerName !== undefined) updates.managerName = String(managerName).trim();
      if (city !== undefined) updates.city = String(city).trim();
      if (address !== undefined) updates.address = String(address).trim();
      if (phone !== undefined) updates.phone = String(phone).trim();
      if (openingHours !== undefined) updates.openingHours = String(openingHours).trim();
      if (capacityPerDayKg !== undefined) updates.capacityPerDayKg = Number(capacityPerDayKg) || 0;
      if (isVerified !== undefined) updates.isVerified = Boolean(isVerified);
      if (materialsAccepted !== undefined) {
        if (!Array.isArray(materialsAccepted)) {
          return res.status(400).json({ message: "Matériaux invalides" });
        }

        const nextMaterials = [...new Set(materialsAccepted.map((item) => String(item).trim()).filter(Boolean))];
        const invalidMaterials = nextMaterials.filter((item) => !CENTER_MATERIAL_TAGS.includes(item));
        if (invalidMaterials.length > 0) {
          return res.status(400).json({ message: `Matériaux invalides : ${invalidMaterials.join(", ")}` });
        }
        updates.materialsAccepted = nextMaterials;
      }

      const center = await RecyclingCenter.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      if (!center) return res.status(404).json({ message: "Centre introuvable" });
      return res.json({ message: "Centre modifié", centerId: center._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async deleteCenter(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const center = await RecyclingCenter.findByIdAndDelete(req.params.id);
      if (!center) return res.status(404).json({ message: "Centre introuvable" });
      return res.json({ message: "Centre supprimé" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async meetings(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const meetings = await MeetingRequest.find()
        .sort({ createdAt: -1 })
        .limit(500)
        .populate("requesterId", "firstName lastName email")
        .populate("centerUserId", "centerName city email")
        .lean();

      return res.json({
        meetings: meetings.map((meeting) => ({
          id: meeting._id.toString(),
          status: meeting.status,
          material: meeting.material,
          preferredDate: meeting.preferredDate,
          createdAt: meeting.createdAt,
          message: meeting.message,
          rejectionReason: meeting.rejectionReason || "",
          notes: meeting.notes || "",
          requester: meeting.requesterId
            ? {
                id: meeting.requesterId._id.toString(),
                name: formatUserName(meeting.requesterId),
                email: meeting.requesterId.email,
              }
            : null,
          center: meeting.centerUserId
            ? {
                id: meeting.centerUserId._id.toString(),
                name: meeting.centerUserId.centerName,
                city: meeting.centerUserId.city,
                email: meeting.centerUserId.email,
              }
            : null,
        })),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updateMeeting(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const meeting = await MeetingRequest.findById(req.params.id);
      if (!meeting) return res.status(404).json({ message: "Rendez-vous introuvable" });

      const { status, material, message, preferredDate, rejectionReason, notes } = req.body || {};

      if (status !== undefined) {
        if (!["pending", "accepted", "rejected", "cancelled"].includes(status)) {
          return res.status(400).json({ message: "Statut de rendez-vous invalide" });
        }
        meeting.status = status;
      }
      if (material !== undefined) meeting.material = String(material || "").trim();
      if (message !== undefined) meeting.message = String(message || "").trim().slice(0, 2000);
      if (rejectionReason !== undefined) {
        meeting.rejectionReason = String(rejectionReason || "").trim().slice(0, 500);
      }
      if (notes !== undefined) meeting.notes = String(notes || "").trim();
      if (preferredDate !== undefined) {
        meeting.preferredDate = preferredDate ? new Date(preferredDate) : null;
        if (meeting.preferredDate && Number.isNaN(meeting.preferredDate.getTime())) {
          return res.status(400).json({ message: "Date souhaitée invalide" });
        }
      }

      await meeting.save();
      return res.json({ message: "Rendez-vous modifié", meetingId: meeting._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async deleteMeeting(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const reason = String(req.body?.reason || "").trim().slice(0, 500);
      const meeting = await MeetingRequest.findById(req.params.id).populate("centerUserId", "centerName");

      if (!meeting) return res.status(404).json({ message: "Rendez-vous introuvable" });
      if (meeting.status !== "pending") {
        return res.status(400).json({
          message: "Seules les demandes en cours de traitement peuvent être supprimées.",
        });
      }

      await NotificationService.notifyMeetingDeletedByAdmin(
        meeting.requesterId,
        meeting.centerUserId?.centerName || "ce centre",
        reason
      );
      await MeetingRequest.deleteOne({ _id: meeting._id });

      return res.json({ message: "Rendez-vous supprimé et collecteur notifié" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updatePostStatus(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const status = String(req.body?.status || "").trim();
      if (!["published", "hidden"].includes(status)) {
        return res.status(400).json({ message: "Statut invalide" });
      }
      const post = await Post.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (!post) return res.status(404).json({ message: "Post introuvable" });
      return res.json({ message: "Statut modifié", post: { id: post._id.toString(), status } });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async updatePost(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const title = String(req.body?.title || "").trim();
      const content = String(req.body?.content || "").trim();
      if (!title || !content) {
        return res.status(400).json({ message: "Titre et contenu requis" });
      }
      const tagsRaw = req.body?.tags;
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.slice(0, 10)
        : typeof tagsRaw === "string"
        ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10)
        : [];

      const post = await Post.findByIdAndUpdate(
        req.params.id,
        { title, content, tags },
        { new: true, runValidators: true }
      );
      if (!post) return res.status(404).json({ message: "Post introuvable" });
      return res.json({ message: "Post modifié", postId: post._id.toString() });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async deletePost(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ message: "Post introuvable" });

      await Comment.deleteMany({ postId: post._id });
      await Post.deleteOne({ _id: post._id });
      return res.json({ message: "Post supprimé" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }

  static async deleteComment(req, res) {
    if (!ensureAdmin(req, res)) return;

    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) return res.status(404).json({ message: "Commentaire introuvable" });

      await Comment.deleteMany({
        $or: [{ _id: comment._id }, { parentCommentId: comment._id }],
      });
      return res.json({ message: "Commentaire supprimé" });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  }
}

module.exports = AdminController;
