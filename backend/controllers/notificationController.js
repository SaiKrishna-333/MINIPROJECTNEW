const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const firebaseService = require('../services/firebaseService');
const twilioService = require('../services/twilioService');
const Notification = require('../models/Notification');
const eventBus = require('../utils/eventBus');

/**
 * NotificationController - Handles all notification operations
 * Manages SMS, push notifications, email, and in-app notifications
 * Supports offline queuing and real-time delivery status tracking
 */
class NotificationController {

  /**
   * Send notification to a single user
   * POST /api/notifications/send
   */
  static async sendNotification(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        userId,
        userType = 'borrower',
        type,
        title,
        message,
        channels = { sms: true, push: true, inApp: true },
        priority = 'medium',
        scheduledFor,
        templateVariables = {},
        metadata = {}
      } = req.body;

      // Create notification record
      const notificationData = {
        userId,
        userType,
        type,
        title,
        message,
        priority,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
        metadata: {
          ...metadata,
          source: 'api',
          createdBy: req.user?.id || 'system'
        }
      };

      // Initialize channels object
      notificationData.channels = {
        sms: { enabled: false },
        push: { enabled: false },
        email: { enabled: false },
        websocket: { enabled: false },
        inApp: { enabled: true }
      };

      // Configure channels based on user preferences and request
      if (channels.sms) {
        notificationData.channels.sms.enabled = true;
        notificationData.channels.sms.phoneNumber = req.body.phoneNumber || await NotificationController._getUserPhone(userId);
      }

      if (channels.push) {
        notificationData.channels.push.enabled = true;
        notificationData.channels.push.fcmToken = req.body.fcmToken || await NotificationController._getUserFCMToken(userId);
      }

      if (channels.email) {
        notificationData.channels.email.enabled = true;
        notificationData.channels.email.emailAddress = req.body.email || await NotificationController._getUserEmail(userId);
      }

      if (channels.websocket !== false) {
        notificationData.channels.websocket.enabled = true;
      }

      // Process template variables if using predefined templates
      if (type && !message) {
        const processedMessage = NotificationController._processMessageTemplate(type, templateVariables);
        if (processedMessage) {
          notificationData.message = processedMessage;
        }
      }

      // Set notificationId before creating the notification
      notificationData.notificationId = uuidv4();

      const notification = new Notification(notificationData);
      await notification.save();

      // Emit notification creation event
      eventBus.emitEvent('notification.created', {
        notificationId: notification.notificationId,
        userId,
        type,
        priority,
        channels: notification.channels
      }, {
        source: 'notification_controller',
        userId
      });

      // Process immediate delivery if not scheduled for later
      if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
        await NotificationController._processNotificationDelivery(notification);
      }

      res.status(201).json({
        success: true,
        message: 'Notification created and queued for delivery',
        data: {
          notificationId: notification.notificationId,
          userId,
          type,
          status: notification.overallStatus,
          channels: notification.channels,
          scheduledFor: notification.scheduledFor,
          createdAt: notification.createdAt
        }
      });

    } catch (error) {
      console.error('Error sending notification:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Send notifications to multiple users
   * POST /api/notifications/send-bulk
   */
  static async sendBulkNotifications(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        recipients,
        type,
        title,
        message,
        channels = { sms: true, push: true, inApp: true },
        priority = 'medium',
        templateVariables = {},
        batchSize = 50
      } = req.body;

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Recipients array is required and must not be empty'
        });
      }

      const results = {
        total: recipients.length,
        successful: 0,
        failed: 0,
        notifications: []
      };

      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (recipient) => {
          try {
            const notificationData = {
              userId: recipient.userId,
              userType: recipient.userType || 'borrower',
              type,
              title,
              message,
              priority,
              channels: { ...channels },
              metadata: {
                bulkSend: true,
                batchId: `batch_${Date.now()}_${Math.floor(i / batchSize)}`,
                source: 'bulk_api'
              }
            };

            // Merge recipient-specific template variables
            const mergedVariables = { ...templateVariables, ...recipient.variables };
            
            // Process template if needed
            if (type && !message) {
              const processedMessage = NotificationController._processMessageTemplate(type, mergedVariables);
              if (processedMessage) {
                notificationData.message = processedMessage;
              }
            }

            // Configure channels with recipient-specific data
            if (channels.sms && recipient.phoneNumber) {
              notificationData.channels.sms = {
                enabled: true,
                phoneNumber: recipient.phoneNumber
              };
            }

            if (channels.push && recipient.fcmToken) {
              notificationData.channels.push = {
                enabled: true,
                fcmToken: recipient.fcmToken
              };
            }

            if (channels.email && recipient.email) {
              notificationData.channels.email = {
                enabled: true,
                emailAddress: recipient.email
              };
            }

            const notification = new Notification(notificationData);
            await notification.save();

            // Process delivery
            await NotificationController._processNotificationDelivery(notification);

            results.successful++;
            return {
              recipient: recipient.userId,
              success: true,
              notificationId: notification.notificationId
            };

          } catch (error) {
            results.failed++;
            return {
              recipient: recipient.userId,
              success: false,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.notifications.push(...batchResults);

        // Add delay between batches to prevent rate limiting
        if (i + batchSize < recipients.length) {
          await NotificationController._delay(1000);
        }
      }

      // Emit bulk notification event
      eventBus.emitEvent('notification.bulk_sent', {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        type
      });

      res.status(200).json({
        success: true,
        message: 'Bulk notifications processed',
        data: results
      });

    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send bulk notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get notification status and delivery details
   * GET /api/notifications/status/:notificationId
   */
  static async getNotificationStatus(req, res) {
    try {
      const { notificationId } = req.params;

      const notification = await Notification.findOne({
        $or: [
          { notificationId },
          { _id: notificationId }
        ]
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          notificationId: notification.notificationId,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          overallStatus: notification.overallStatus,
          channels: notification.channels,
          scheduledFor: notification.scheduledFor,
          deliveredAt: notification.deliveredAt,
          interactions: notification.interactions,
          retryCount: notification.retryCount,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt
        }
      });

    } catch (error) {
      console.error('Error getting notification status:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get notification status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get notifications for a user
   * GET /api/notifications/user/:userId
   */
  static async getUserNotifications(req, res) {
    try {
      const { userId } = req.params;
      const { 
        page = 1, 
        limit = 20, 
        type, 
        unreadOnly = false,
        priority 
      } = req.query;

      const query = { userId };
      
      if (type) query.type = type;
      if (priority) query.priority = priority;
      if (unreadOnly === 'true') query['channels.inApp.read'] = false;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };

      const notifications = await Notification.paginate(query, options);

      // Get unread count
      const unreadCount = await Notification.countDocuments({
        userId,
        'channels.inApp.read': false
      });

      res.status(200).json({
        success: true,
        data: {
          notifications: notifications.docs,
          pagination: {
            currentPage: notifications.page,
            totalPages: notifications.totalPages,
            totalNotifications: notifications.totalDocs,
            hasNextPage: notifications.hasNextPage,
            hasPrevPage: notifications.hasPrevPage
          },
          unreadCount
        }
      });

    } catch (error) {
      console.error('Error getting user notifications:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get user notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Mark notification as read
   * POST /api/notifications/mark-read/:notificationId
   */
  static async markNotificationAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.id || req.body.userId;

      const notification = await Notification.findOne({
        notificationId,
        userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await notification.markAsRead();
      await notification.addInteraction('opened', {
        timestamp: new Date(),
        source: 'api'
      });

      // Emit notification read event
      eventBus.emitEvent('notification.read', {
        notificationId: notification.notificationId,
        userId,
        readAt: notification.channels.inApp.readAt
      });

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: {
          notificationId: notification.notificationId,
          readAt: notification.channels.inApp.readAt
        }
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Process offline queued notifications
   * POST /api/notifications/process-offline-queue
   */
  static async processOfflineQueue(req, res) {
    try {
      const { userId } = req.body;

      // Find notifications that were queued while offline
      const queuedNotifications = await Notification.find({
        userId,
        offlineQueued: true,
        syncStatus: 'pending_sync'
      }).sort({ scheduledFor: 1 });

      const results = {
        processed: 0,
        failed: 0,
        notifications: []
      };

      for (const notification of queuedNotifications) {
        try {
          await NotificationController._processNotificationDelivery(notification);
          
          notification.offlineQueued = false;
          notification.syncStatus = 'synced';
          await notification.save();
          
          results.processed++;
          results.notifications.push({
            notificationId: notification.notificationId,
            success: true
          });

        } catch (error) {
          results.failed++;
          results.notifications.push({
            notificationId: notification.notificationId,
            success: false,
            error: error.message
          });
        }
      }

      // Emit sync completion event
      eventBus.emitEvent('notification.offline_queue_processed', {
        userId,
        processed: results.processed,
        failed: results.failed
      });

      res.status(200).json({
        success: true,
        message: 'Offline notification queue processed',
        data: results
      });

    } catch (error) {
      console.error('Error processing offline queue:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to process offline queue',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Retry failed notifications
   * POST /api/notifications/retry/:notificationId
   */
  static async retryNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const { channels } = req.body;

      const notification = await Notification.findOne({ notificationId });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Reset failed channels if specified
      if (channels && Array.isArray(channels)) {
        channels.forEach(channel => {
          if (notification.channels[channel] && notification.channels[channel].status === 'failed') {
            notification.channels[channel].status = 'pending';
            notification.channels[channel].failureReason = undefined;
          }
        });
      }

      await notification.save();
      await NotificationController._processNotificationDelivery(notification);

      res.status(200).json({
        success: true,
        message: 'Notification retry initiated',
        data: {
          notificationId: notification.notificationId,
          retryCount: notification.retryCount,
          status: notification.overallStatus
        }
      });

    } catch (error) {
      console.error('Error retrying notification:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retry notification',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get notification analytics and statistics
   * GET /api/notifications/analytics
   */
  static async getAnalytics(req, res) {
    try {
      const { userId, startDate, endDate, type } = req.query;

      const matchStage = {};
      
      if (userId) matchStage.userId = userId;
      if (type) matchStage.type = type;
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const analytics = await Notification.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              type: '$type',
              status: '$overallStatus'
            },
            count: { $sum: 1 },
            avgDeliveryTime: {
              $avg: {
                $subtract: ['$deliveredAt', '$scheduledFor']
              }
            }
          }
        },
        {
          $group: {
            _id: '$_id.type',
            totalNotifications: { $sum: '$count' },
            statusBreakdown: {
              $push: {
                status: '$_id.status',
                count: '$count'
              }
            },
            avgDeliveryTime: { $avg: '$avgDeliveryTime' }
          }
        }
      ]);

      // Get channel performance
      const channelStats = await Notification.aggregate([
        { $match: matchStage },
        {
          $project: {
            smsDelivered: {
              $cond: [
                { $eq: ['$channels.sms.status', 'delivered'] },
                1,
                0
              ]
            },
            pushDelivered: {
              $cond: [
                { $eq: ['$channels.push.status', 'delivered'] },
                1,
                0
              ]
            },
            emailDelivered: {
              $cond: [
                { $eq: ['$channels.email.status', 'delivered'] },
                1,
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSMS: { $sum: '$smsDelivered' },
            totalPush: { $sum: '$pushDelivered' },
            totalEmail: { $sum: '$emailDelivered' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          typeBreakdown: analytics,
          channelPerformance: channelStats[0] || {},
          summary: {
            totalNotifications: analytics.reduce((sum, item) => sum + item.totalNotifications, 0),
            uniqueTypes: analytics.length
          }
        }
      });

    } catch (error) {
      console.error('Error getting notification analytics:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get notification analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Private helper methods

  /**
   * Process notification delivery across all enabled channels
   * @private
   */
  static async _processNotificationDelivery(notification) {
    try {
      const deliveryPromises = [];

      // SMS delivery
      if (notification.channels.sms.enabled && notification.channels.sms.phoneNumber) {
        deliveryPromises.push(
          NotificationController._deliverSMS(notification)
            .catch(error => console.error('SMS delivery failed:', error))
        );
      }

      // Push notification delivery
      if (notification.channels.push.enabled && notification.channels.push.fcmToken) {
        deliveryPromises.push(
          NotificationController._deliverPushNotification(notification)
            .catch(error => console.error('Push notification delivery failed:', error))
        );
      }

      // Email delivery (placeholder - would need email service)
      if (notification.channels.email.enabled && notification.channels.email.emailAddress) {
        deliveryPromises.push(
          NotificationController._deliverEmail(notification)
            .catch(error => console.error('Email delivery failed:', error))
        );
      }

      // WebSocket delivery (real-time)
      if (notification.channels.websocket.enabled) {
        deliveryPromises.push(
          NotificationController._deliverWebSocket(notification)
            .catch(error => console.error('WebSocket delivery failed:', error))
        );
      }

      // Wait for all deliveries to complete
      await Promise.all(deliveryPromises);

      // Update overall delivery status
      if (notification.overallStatus === 'delivered') {
        notification.deliveredAt = new Date();
        await notification.save();
      }

    } catch (error) {
      console.error('Error processing notification delivery:', error);
      throw error;
    }
  }

  /**
   * Deliver SMS notification
   * @private
   */
  static async _deliverSMS(notification) {
    try {
      const smsResult = await twilioService.sendSMS({
        to: notification.channels.sms.phoneNumber,
        message: notification.message,
        type: notification.type,
        variables: notification.template?.variables
      });

      if (smsResult.success) {
        await notification.markChannelAsSent('sms', smsResult.messageId);
        
        // Simulate delivery status check (in real app, this would come from webhook)
        setTimeout(async () => {
          try {
            await notification.markChannelAsDelivered('sms');
          } catch (error) {
            console.error('Error updating SMS delivery status:', error);
          }
        }, 3000);
      } else {
        await notification.markChannelAsFailed('sms', 'SMS sending failed');
      }

    } catch (error) {
      await notification.markChannelAsFailed('sms', error.message);
      throw error;
    }
  }

  /**
   * Deliver push notification
   * @private
   */
  static async _deliverPushNotification(notification) {
    try {
      const pushResult = await firebaseService.sendToDevice({
        token: notification.channels.push.fcmToken,
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: notification.notificationId,
          type: notification.type,
          userId: notification.userId.toString()
        },
        options: {
          priority: notification.priority === 'urgent' ? 'high' : 'normal'
        }
      });

      if (pushResult.success) {
        await notification.markChannelAsSent('push', pushResult.messageId);
        
        // For push notifications, we'll mark as delivered immediately
        // In real app, delivery confirmation would come from FCM
        await notification.markChannelAsDelivered('push');
      } else {
        await notification.markChannelAsFailed('push', 'Push notification sending failed');
      }

    } catch (error) {
      await notification.markChannelAsFailed('push', error.message);
      throw error;
    }
  }

  /**
   * Deliver email notification (placeholder)
   * @private
   */
  static async _deliverEmail(notification) {
    try {
      // Placeholder for email delivery
      // In real implementation, integrate with email service like SendGrid, SES, etc.
      
      console.log(`Email would be sent to: ${notification.channels.email.emailAddress}`);
      console.log(`Subject: ${notification.title}`);
      console.log(`Body: ${notification.message}`);
      
      await notification.markChannelAsSent('email', `email_${Date.now()}`);
      await notification.markChannelAsDelivered('email');

    } catch (error) {
      await notification.markChannelAsFailed('email', error.message);
      throw error;
    }
  }

  /**
   * Deliver WebSocket notification
   * @private
   */
  static async _deliverWebSocket(notification) {
    try {
      // Emit real-time notification via event bus
      // The WebSocket server would listen to this event
      eventBus.emitEvent('notification.websocket.send', {
        userId: notification.userId,
        notificationId: notification.notificationId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        timestamp: new Date()
      });

      await notification.markChannelAsSent('websocket');
      await notification.markChannelAsDelivered('websocket');

    } catch (error) {
      await notification.markChannelAsFailed('websocket', error.message);
      throw error;
    }
  }

  /**
   * Process message template with variables
   * @private
   */
  static _processMessageTemplate(type, variables) {
    const templates = twilioService.getTemplates();
    const template = templates[type];
    
    if (!template) return null;
    
    let processed = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g');
      processed = processed.replace(regex, variables[key] || '');
    });
    
    return processed;
  }

  /**
   * Get user phone number (placeholder)
   * @private
   */
  static async _getUserPhone(userId) {
    // In real implementation, fetch from user database
    return '+919876543210'; // Mock phone number
  }

  /**
   * Get user FCM token (placeholder)
   * @private
   */
  static async _getUserFCMToken(userId) {
    // In real implementation, fetch from user preferences/devices
    return firebaseService.generateTestToken();
  }

  /**
   * Get user email (placeholder)
   * @private
   */
  static async _getUserEmail(userId) {
    // In real implementation, fetch from user database
    return 'user@ruralconnect.com';
  }

  /**
   * Add delay for rate limiting
   * @private
   */
  static _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Validation middleware
NotificationController.validateSendNotification = [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('userType').optional().isIn(['borrower', 'lender', 'admin']),
  body('type').notEmpty().withMessage('Notification type is required'),
  body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('message').optional().isLength({ min: 1, max: 500 }).withMessage('Message must be 1-500 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('scheduledFor').optional().isISO8601().withMessage('Invalid date format for scheduledFor'),
  body('channels').optional().isObject(),
  body('templateVariables').optional().isObject(),
  body('metadata').optional().isObject()
];

NotificationController.validateBulkSend = [
  body('recipients').isArray({ min: 1 }).withMessage('Recipients array is required'),
  body('recipients.*.userId').isMongoId().withMessage('Valid user ID is required for each recipient'),
  body('type').notEmpty().withMessage('Notification type is required'),
  body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('batchSize').optional().isInt({ min: 1, max: 100 }).withMessage('Batch size must be 1-100')
];

module.exports = NotificationController;
