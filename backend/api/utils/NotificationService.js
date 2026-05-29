const Notification = require("../models/Notification");

class NotificationService {
  /**
   * Créer une notification
   */
  static async create(
    userId,
    type,
    title,
    message,
    relatedId = null,
    relatedModel = null,
    data = {}
  ) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        relatedId,
        relatedModel,
        data,
      });

      return {
        success: true,
        notification,
      };
    } catch (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Obtenir les notifications non lues d'un utilisateur
   */
  static async getUnread(userId) {
    try {
      const notifications = await Notification.find({
        userId,
        isRead: false,
      })
        .sort({ createdAt: -1 })
        .lean();

      return {
        success: true,
        count: notifications.length,
        notifications,
      };
    } catch (error) {
      throw new Error(`Failed to fetch unread notifications: ${error.message}`);
    }
  }

  /**
   * Obtenir toutes les notifications d'un utilisateur avec pagination
   */
  static async getAll(userId, limit = 20, page = 1) {
    try {
      const skip = (page - 1) * limit;

      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await Notification.countDocuments({ userId });

      return {
        success: true,
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }
  }

  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        {
          isRead: true,
          readAt: new Date(),
        },
        { new: true }
      );

      if (!notification) {
        throw new Error("Notification not found");
      }

      return {
        success: true,
        notification,
      };
    } catch (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { userId, isRead: false },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

      return {
        success: true,
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  /**
   * Supprimer une notification
   */
  static async delete(notificationId, userId) {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        userId,
      });

      if (result.deletedCount === 0) {
        throw new Error("Notification not found");
      }

      return {
        success: true,
      };
    } catch (error) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  }

  /**
   * Supprimer toutes les notifications lues d'un utilisateur
   */
  static async deleteRead(userId) {
    try {
      const result = await Notification.deleteMany({
        userId,
        isRead: true,
      });

      return {
        success: true,
        deletedCount: result.deletedCount,
      };
    } catch (error) {
      throw new Error(`Failed to delete read notifications: ${error.message}`);
    }
  }

  /**
   * Notification pour demande de rendez-vous acceptée
   */
  static async notifyMeetingAccepted(userId, centerName, meetingDate) {
    return this.create(
      userId,
      "meeting_accepted",
      "Rendez-vous accepté! ✅",
      `Votre demande pour ${centerName} a été acceptée`,
      null,
      null,
      {
        centerName,
        meetingDate,
      }
    );
  }

  /**
   * Notification pour demande de rendez-vous refusée
   */
  static async notifyMeetingRejected(userId, centerName) {
    return this.create(
      userId,
      "meeting_rejected",
      "Rendez-vous refusé",
      `Votre demande pour ${centerName} a été refusée`,
      null,
      null,
      {
        centerName,
      }
    );
  }

  /**
   * Notification pour nouvelle demande au centre
   */
  static async notifyNewMeetingRequest(centerId, userName, materialType) {
    return this.create(
      centerId,
      "meeting_request",
      "Nouvelle demande de rendez-vous 📅",
      `${userName} demande un rendez-vous pour ${materialType}`,
      null,
      null,
      {
        userName,
        material: materialType,
      }
    );
  }

  /**
   * Obtenir le nombre de notifications non lues
   */
  static async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        userId,
        isRead: false,
      });

      return {
        success: true,
        unreadCount: count,
      };
    } catch (error) {
      throw new Error(`Failed to count unread notifications: ${error.message}`);
    }
  }
}

module.exports = NotificationService;
