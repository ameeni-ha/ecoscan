const User = require("../models/User");
const PointsHistory = require("../models/PointsHistory");

class PointsService {
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
        reason,
        description: metadata.description || "",
        status: "completed",
        metadata: {
          confidence: metadata.confidence || null,
          photoUrl: metadata.photoUrl || null,
          notes: metadata.notes || "",
        },
      });

      // 2. Mettre à jour les points de l'utilisateur
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { points: pointsToAdd } },
        { new: true }
      );

      if (!user) {
        throw new Error("User not found");
      }

      return {
        success: true,
        user,
        transaction,
        totalPoints: user.points,
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
        reason,
        description: metadata.description || "Déduction de points",
        status: "completed",
        metadata: {
          confidence: null,
          photoUrl: null,
          notes: metadata.notes || "",
        },
      });

      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { points: -pointsToDeduct } },
        { new: true }
      );

      if (!user) {
        throw new Error("User not found");
      }

      return {
        success: true,
        user,
        transaction,
        totalPoints: user.points,
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
  static async getLeaderboard(limit = 10) {
    try {
      const leaderboard = await User.find()
        .select("firstName lastName email points createdAt")
        .sort({ points: -1 })
        .limit(limit)
        .lean();

      return {
        success: true,
        leaderboard: leaderboard.map((user, index) => ({
          ...user,
          rank: index + 1,
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

      const previousPoints = user.points;

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
