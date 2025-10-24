const admin = require('firebase-admin');

/**
 * FirebaseService - Handles Firebase Cloud Messaging (FCM) for push notifications
 * Supports both web and mobile push notifications with offline queuing
 * Integrates with the notification system for comprehensive messaging
 */
class FirebaseService {
  constructor() {
    this.mockMode = process.env.FIREBASE_MOCK_MODE === 'true' || !process.env.FIREBASE_PROJECT_ID;
    this.initialized = false;
    
    if (!this.mockMode) {
      this.initializeFirebase();
    }
    
    // Mock message storage for testing
    this.mockMessages = new Map();
    this.mockTokens = new Set();
    
    console.log(`FirebaseService initialized in ${this.mockMode ? 'MOCK' : 'LIVE'} mode`);
  }

  /**
   * Initialize Firebase Admin SDK
   * @private
   */
  initializeFirebase() {
    try {
      // Check if Firebase is already initialized
      if (admin.apps.length === 0) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
          : require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json');

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      }

      this.messaging = admin.messaging();
      this.initialized = true;
      console.log('Firebase Admin SDK initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      this.mockMode = true;
      console.log('Falling back to MOCK mode');
    }
  }

  /**
   * Send push notification to a single device
   * @param {Object} notificationData - Notification details
   * @param {string} notificationData.token - FCM token
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.body - Notification body
   * @param {Object} notificationData.data - Additional data payload
   * @param {Object} notificationData.options - Notification options
   * @returns {Promise<Object>} Send result
   */
  async sendToDevice(notificationData) {
    try {
      const { token, title, body, data = {}, options = {} } = notificationData;

      if (!token || !title || !body) {
        throw new Error('Token, title, and body are required');
      }

      if (this.mockMode) {
        return this._sendMockNotification(notificationData);
      }

      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      // Prepare the message
      const message = {
        token,
        notification: {
          title,
          body,
          imageUrl: options.imageUrl
        },
        data: {
          ...data,
          notificationId: data.notificationId || Date.now().toString(),
          timestamp: Date.now().toString()
        },
        android: {
          notification: {
            channelId: options.channelId || 'default',
            priority: options.priority || 'high',
            sound: options.sound || 'default',
            clickAction: options.clickAction
          },
          data
        },
        apns: {
          payload: {
            aps: {
              sound: options.sound || 'default',
              badge: options.badge || 1,
              'content-available': 1
            }
          }
        },
        webpush: {
          notification: {
            icon: options.icon || '/icons/icon-192x192.png',
            badge: options.badge || '/icons/badge-72x72.png',
            requireInteraction: options.requireInteraction || false,
            actions: options.actions || []
          },
          fcmOptions: {
            link: options.link
          }
        }
      };

      // Add time-to-live if specified
      if (options.ttl) {
        message.android.ttl = options.ttl;
        message.apns.payload.aps.expiry = Math.floor(Date.now() / 1000) + options.ttl;
      }

      const response = await this.messaging.send(message);

      return {
        success: true,
        messageId: response,
        token,
        provider: 'firebase',
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // Handle specific FCM errors
      if (error.code === 'messaging/registration-token-not-registered') {
        return {
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
          token: notificationData.token
        };
      }

      throw new Error(`Push notification failed: ${error.message}`);
    }
  }

  /**
   * Send push notifications to multiple devices
   * @param {Object} notificationData - Notification details
   * @param {string[]} notificationData.tokens - Array of FCM tokens
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.body - Notification body
   * @param {Object} notificationData.data - Additional data payload
   * @param {Object} notificationData.options - Notification options
   * @returns {Promise<Object>} Send results
   */
  async sendToMultipleDevices(notificationData) {
    try {
      const { tokens, title, body, data = {}, options = {} } = notificationData;

      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        throw new Error('Tokens array is required and must not be empty');
      }

      if (this.mockMode) {
        return this._sendMockMulticast(notificationData);
      }

      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      // Prepare multicast message
      const message = {
        tokens,
        notification: {
          title,
          body,
          imageUrl: options.imageUrl
        },
        data: {
          ...data,
          timestamp: Date.now().toString()
        },
        android: {
          notification: {
            channelId: options.channelId || 'default',
            priority: options.priority || 'high',
            sound: options.sound || 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: options.sound || 'default',
              badge: options.badge || 1
            }
          }
        },
        webpush: {
          notification: {
            icon: options.icon || '/icons/icon-192x192.png',
            requireInteraction: options.requireInteraction || false
          }
        }
      };

      const response = await this.messaging.sendMulticast(message);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses.map((resp, index) => ({
          token: tokens[index],
          success: resp.success,
          messageId: resp.messageId,
          error: resp.error ? {
            code: resp.error.code,
            message: resp.error.message
          } : null
        })),
        provider: 'firebase',
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error sending multicast notification:', error);
      throw new Error(`Multicast notification failed: ${error.message}`);
    }
  }

  /**
   * Send notification to a topic
   * @param {Object} notificationData - Notification details
   * @param {string} notificationData.topic - Topic name
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.body - Notification body
   * @param {Object} notificationData.data - Additional data payload
   * @param {Object} notificationData.options - Notification options
   * @returns {Promise<Object>} Send result
   */
  async sendToTopic(notificationData) {
    try {
      const { topic, title, body, data = {}, options = {} } = notificationData;

      if (!topic || !title || !body) {
        throw new Error('Topic, title, and body are required');
      }

      if (this.mockMode) {
        return this._sendMockTopicNotification(notificationData);
      }

      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const message = {
        topic,
        notification: {
          title,
          body
        },
        data,
        android: {
          notification: {
            channelId: options.channelId || 'default',
            priority: options.priority || 'high'
          }
        }
      };

      const response = await this.messaging.send(message);

      return {
        success: true,
        messageId: response,
        topic,
        provider: 'firebase',
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error sending topic notification:', error);
      throw new Error(`Topic notification failed: ${error.message}`);
    }
  }

  /**
   * Subscribe token to topic
   * @param {string|string[]} tokens - FCM token(s)
   * @param {string} topic - Topic name
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToTopic(tokens, topic) {
    try {
      if (!tokens || !topic) {
        throw new Error('Tokens and topic are required');
      }

      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];

      if (this.mockMode) {
        return {
          success: true,
          successCount: tokenArray.length,
          failureCount: 0,
          topic
        };
      }

      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const response = await this.messaging.subscribeToTopic(tokenArray, topic);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        topic,
        errors: response.errors
      };

    } catch (error) {
      console.error('Error subscribing to topic:', error);
      throw new Error(`Topic subscription failed: ${error.message}`);
    }
  }

  /**
   * Unsubscribe token from topic
   * @param {string|string[]} tokens - FCM token(s)
   * @param {string} topic - Topic name
   * @returns {Promise<Object>} Unsubscription result
   */
  async unsubscribeFromTopic(tokens, topic) {
    try {
      if (!tokens || !topic) {
        throw new Error('Tokens and topic are required');
      }

      const tokenArray = Array.isArray(tokens) ? tokens : [tokens];

      if (this.mockMode) {
        return {
          success: true,
          successCount: tokenArray.length,
          failureCount: 0,
          topic
        };
      }

      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const response = await this.messaging.unsubscribeFromTopic(tokenArray, topic);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        topic,
        errors: response.errors
      };

    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      throw new Error(`Topic unsubscription failed: ${error.message}`);
    }
  }

  /**
   * Validate FCM token
   * @param {string} token - FCM token to validate
   * @returns {Promise<boolean>} Validation result
   */
  async validateToken(token) {
    try {
      if (!token) {
        return false;
      }

      if (this.mockMode) {
        return this.mockTokens.has(token) || Math.random() > 0.1; // 90% success rate
      }

      if (!this.initialized) {
        return false;
      }

      // Try to send a test message (dry run)
      const testMessage = {
        token,
        notification: {
          title: 'Test',
          body: 'Test message'
        },
        dryRun: true
      };

      await this.messaging.send(testMessage);
      return true;

    } catch (error) {
      if (error.code === 'messaging/registration-token-not-registered') {
        return false;
      }
      return false;
    }
  }

  // Private mock methods

  /**
   * Send mock notification
   * @private
   */
  _sendMockNotification(notificationData) {
    const messageId = `fcm_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const mockResult = {
      success: Math.random() > 0.05, // 95% success rate
      messageId,
      token: notificationData.token,
      provider: 'firebase_mock',
      sentAt: new Date().toISOString()
    };

    this.mockMessages.set(messageId, {
      ...notificationData,
      messageId,
      sentAt: new Date()
    });

    return mockResult;
  }

  /**
   * Send mock multicast notification
   * @private
   */
  _sendMockMulticast(notificationData) {
    const responses = notificationData.tokens.map(token => ({
      token,
      success: Math.random() > 0.05,
      messageId: `fcm_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error: Math.random() < 0.05 ? {
        code: 'messaging/registration-token-not-registered',
        message: 'Requested entity was not found'
      } : null
    }));

    const successCount = responses.filter(r => r.success).length;
    
    return {
      success: true,
      successCount,
      failureCount: responses.length - successCount,
      responses,
      provider: 'firebase_mock',
      sentAt: new Date().toISOString()
    };
  }

  /**
   * Send mock topic notification
   * @private
   */
  _sendMockTopicNotification(notificationData) {
    return {
      success: true,
      messageId: `fcm_topic_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic: notificationData.topic,
      provider: 'firebase_mock',
      sentAt: new Date().toISOString()
    };
  }

  /**
   * Generate test FCM token
   * @returns {string} Test FCM token
   */
  generateTestToken() {
    const testToken = `fcm_test_${Date.now()}_${Math.random().toString(36).substr(2, 20)}`;
    if (this.mockMode) {
      this.mockTokens.add(testToken);
    }
    return testToken;
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      mockMode: this.mockMode,
      initialized: this.initialized,
      provider: 'firebase',
      mockMessagesCount: this.mockMessages.size,
      mockTokensCount: this.mockTokens.size
    };
  }
}

module.exports = new FirebaseService();
