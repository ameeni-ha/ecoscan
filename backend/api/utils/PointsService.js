const User = require("../models/User");
const PointsHistory = require("../models/PointsHistory");

const clampPoints = (value) => Math.max(0, Number(value) || 0);

class PointsService {
  /**
   * Applique un delta de points sans descendre sous 0.
   */
  static async applyPointsDelta(userId, delta) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const previous = clampPoints(user.points);
    const next = clampPoints(previous + delta);
    user.points = next;
    await user.save();

    return {
      user,
      totalPoints: next,
      previousPoints: previous,
      applied: next - previous,
    };
  }
  /**
   * Ajouter des points à un utilisateur et enregistrer l'historique
   * @param {String} userId - ID de l'utilisateur
   * @param {Number} pointsToAdd - Nombre de points à ajouter
   * @param {String} reason - Raison (scan|achievement|bonus|manual_adjustment)
   * @param {Object} metadata - Données additionnelles {scanId, material, confidence, photoUrl, notes}
   * @returns {Promise<Object>} - {user, transaction}
   */
  static async addPoints(userId, pointsToAdd, reason = "scan", metadata = {}) {
    try {
      if (!userId || pointsToAdd < 0) {
        throw new Error("Invalid userId or pointsToAdd");
      }

      // 1. Créer la transaction d'historique
      const transaction = await PointsHistory.create({
        userId,
        scanId: metadata.scanId || null,
        material: metadata.material || "unknown",
        pointsEarned: pointsToAdd,
        confidence: metadata.confidence || null,
        bonus: metadata.bonus || "",
        reason,
        description: metadata.description || "",
        status: "completed",
        metadata: {
          confidence: metadata.confidence || null,
          photoUrl: metadata.photoUrl || null,
          notes: metadata.notes || "",
        },
      });

      const { user, totalPoints } = await PointsService.applyPointsDelta(userId, pointsToAdd);

      return {
        success: true,
        user,
        transaction,
        totalPoints,
        pointsAdded: pointsToAdd,
      };
    } catch (error) {
      throw new Error(`Failed to add points: ${error.message}`);
    }
  }

  /**
   * Déduire des points (pénalité, correction)
   */
  static async deductPoints(userId, pointsToDeduct, reason = "manual_adjustment", metadata = {}) {
    try {
      if (pointsToDeduct < 0) {
        throw new Error("pointsToDeduct must be positive");
      }

      const transaction = await PointsHistory.create({
        userId,
        scanId: metadata.scanId || null,
        material: metadata.material || "penalty",
        pointsEarned: -pointsToDeduct,
        confidence: null,
        bonus: metadata.bonus || "",
        reason,
        description: metadata.description || "Déduction de points",
        status: "completed",
        metadata: {
          confidence: null,
          photoUrl: null,
          notes: metadata.notes || "",
        },
      });

      const { user, totalPoints } = await PointsService.applyPointsDelta(
        userId,
        -pointsToDeduct
      );

      return {
        success: true,
        user,
        transaction,
        totalPoints,
        pointsDeducted: pointsToDeduct,
      };
    } catch (error) {
      throw new Error(`Failed to deduct points: ${error.message}`);
    }
  }

  /**
   * Obtenir l'historique des points d'un utilisateur
   */
  static async getPointsHistory(userId, limit = 50, page = 1) {
    try {
      const skip = (page - 1) * limit;

      const history = await PointsHistory.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await PointsHistory.countDocuments({ userId });

      return {
        success: true,
        history,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch points history: ${error.message}`);
    }
  }

  /**
   * Obtenir les statistiques de points
   */
  static async getPointsStats(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error("User not found");
      }

      const stats = await PointsHistory.aggregate([
        { $match: { userId: require("mongoose").Types.ObjectId(userId) } },
        {
          $group: {
            _id: "$reason",
            total: { $sum: "$pointsEarned" },
            count: { $sum: 1 },
          },
        },
      ]);

      const totalEarned = await PointsHistory.aggregate([
        { $match: { userId: require("mongoose").Types.ObjectId(userId), pointsEarned: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$pointsEarned" } } },
      ]);

      const totalDeducted = await PointsHistory.aggregate([
        { $match: { userId: require("mongoose").Types.ObjectId(userId), pointsEarned: { $lt: 0 } } },
        { $group: { _id: null, total: { $sum: "$pointsEarned" } } },
      ]);

      return {
        success: true,
        currentPoints: user.points,
        totalEarned: totalEarned[0]?.total || 0,
        totalDeducted: Math.abs(totalDeducted[0]?.total || 0),
        breakdownByReason: stats,
      };
    } catch (error) {
      throw new Error(`Failed to fetch points stats: ${error.message}`);
    }
  }

  /**
   * Leaderboard (top users par points)
   */
  static async getLeaderboard(limit = 50) {
    try {
      const Scan = require("../models/Scan");
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

      const users = await User.find({ accountType: "collecteur" })
        .select("firstName lastName email points createdAt")
        .sort({ points: -1, createdAt: 1 })
        .limit(safeLimit)
        .lean();

      const userIds = users.map((user) => user._id);
      const scanCounts = await Scan.aggregate([
        { $match: { userId: { $in: userIds }, recyclable: true } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ]);

      const scansByUser = Object.fromEntries(
        scanCounts.map((entry) => [entry._id.toString(), entry.count])
      );

      return {
        success: true,
        leaderboard: users.map((user, index) => ({
          rank: index + 1,
          points: user.points || 0,
          scans: scansByUser[user._id.toString()] || 0,
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
          },
        })),
      };
    } catch (error) {
      throw new Error(`Failed to fetch leaderboard: ${error.message}`);
    }
  }

  /**
   * Réinitialiser les points d'un utilisateur (admin only)
   */
  static async resetPoints(userId, reason = "manual_reset") {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error("User not found");
      }

      const previousPoints = clampPoints(user.points);

      // Créer une entrée d'historique pour la réinitialisation
      const transaction = await PointsHistory.create({
        userId,
        scanId: null,
        material: "reset",
        pointsEarned: -previousPoints,
        reason: "manual_adjustment",
        description: `Réinitialisation: ${previousPoints} points supprimés`,
        status: "completed",
        metadata: {
          notes: reason,
        },
      });

      // Réinitialiser les points
      const updatedUser = await User.findByIdAndUpdate(userId, { points: 0 }, { new: true });

      return {
        success: true,
        user: updatedUser,
        transaction,
        previousPoints,
        currentPoints: 0,
      };
    } catch (error) {
      throw new Error(`Failed to reset points: ${error.message}`);
    }
  }
}

module.exports = PointsService;
