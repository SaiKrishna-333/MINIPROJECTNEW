const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Notification Schema for RuralConnect P2P Lending Platform
 * Manages all notifications including SMS, Email, Push notifications, and WebSocket events
 */
const notificationSchema = new mongoose.Schema({
  // Notification Identifiers
  notificationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Recipient Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User'
  },
  
  userType: {
    type: String,
    required: true,
    enum: ['borrower', 'lender', 'admin']
  },
  
  // Notification Content
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  type: {
    type: String,
    required: true,
    enum: [
      'loan_approved',
      'loan_rejected',
      'payment_successful',
      'payment_failed',
      'payment_confirmed',
      'repayment_due',
      'repayment_overdue',
      'document_verified',
      'document_rejected',
      'loan_completed',
      'system_maintenance',
      'security_alert',
      'welcome',
      'kyc_reminder'
    ]
  },
  
  priority: {
    type: String,
    default: 'medium',
    enum: ['low', 'medium', 'high', 'urgent']
  },
  
  // Related Entity Information
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['loan', 'transaction', 'user', 'document', 'system']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true
    }
  },
  
  // Delivery Channels and Status
  channels: {
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      phoneNumber: String,
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
        default: 'pending'
      },
      sentAt: Date,
      deliveredAt: Date,
      failureReason: String,
      twilioMessageSid: String,
      cost: Number
    },
    
    email: {
      enabled: {
        type: Boolean,
        default: false
      },
      emailAddress: String,
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
        default: 'pending'
      },
      sentAt: Date,
      deliveredAt: Date,
      failureReason: String,
      emailProvider: String
    },
    
    push: {
      enabled: {
        type: Boolean,
        default: false
      },
      fcmToken: String,
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
        default: 'pending'
      },
      sentAt: Date,
      deliveredAt: Date,
      failureReason: String,
      firebaseMessageId: String
    },
    
    websocket: {
      enabled: {
        type: Boolean,
        default: false
      },
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
        default: 'pending'
      },
      sentAt: Date,
      deliveredAt: Date,
      socketId: String
    },
    
    inApp: {
      enabled: {
        type: Boolean,
        default: true
      },
      read: {
        type: Boolean,
        default: false
      },
      readAt: Date
    }
  },
  
  // Scheduling and Delivery
  scheduledFor: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  deliveredAt: {
    type: Date,
    sparse: true
  },
  
  // Template and Personalization
  template: {
    templateId: String,
    variables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  
  // Actions and Interactions
  actions: [{
    actionId: String,
    label: String,
    url: String,
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT'],
      default: 'GET'
    }
  }],
  
  // Tracking and Analytics
  interactions: [{
    action: {
      type: String,
      enum: ['opened', 'clicked', 'dismissed', 'action_taken']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }],
  
  // Retry Logic
  retryCount: {
    type: Number,
    default: 0,
    max: 3
  },
  
  maxRetries: {
    type: Number,
    default: 3
  },
  
  nextRetryAt: {
    type: Date,
    sparse: true
  },
  
  // Offline and Sync Support
  offlineQueued: {
    type: Boolean,
    default: false
  },
  
  syncStatus: {
    type: String,
    default: 'synced',
    enum: ['synced', 'pending_sync', 'conflict']
  },
  
  // Metadata
  metadata: {
    deviceInfo: {
      userAgent: String,
      platform: String,
      appVersion: String
    },
    location: {
      lat: Number,
      lng: Number,
      address: String
    },
    campaign: String,
    source: String
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for performance optimization
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ scheduledFor: 1, 'channels.sms.status': 1 });
notificationSchema.index({ scheduledFor: 1, 'channels.email.status': 1 });
notificationSchema.index({ scheduledFor: 1, 'channels.push.status': 1 });
notificationSchema.index({ 'relatedEntity.entityId': 1, 'relatedEntity.entityType': 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ priority: 1, scheduledFor: 1 });

// Virtual for overall delivery status
notificationSchema.virtual('overallStatus').get(function() {
  const channels = this.channels;
  const statuses = [];
  
  if (channels.sms.enabled) statuses.push(channels.sms.status);
  if (channels.email.enabled) statuses.push(channels.email.status);
  if (channels.push.enabled) statuses.push(channels.push.status);
  if (channels.websocket.enabled) statuses.push(channels.websocket.status);
  
  if (statuses.length === 0) return 'no_channels';
  if (statuses.every(s => s === 'delivered')) return 'delivered';
  if (statuses.some(s => s === 'delivered')) return 'partially_delivered';
  if (statuses.some(s => s === 'sent')) return 'sent';
  if (statuses.some(s => s === 'pending')) return 'pending';
  return 'failed';
});

// Methods
notificationSchema.methods.markChannelAsSent = function(channel, messageId = null) {
  if (this.channels[channel]) {
    this.channels[channel].status = 'sent';
    this.channels[channel].sentAt = new Date();
    
    if (messageId) {
      if (channel === 'sms') this.channels[channel].twilioMessageSid = messageId;
      if (channel === 'push') this.channels[channel].firebaseMessageId = messageId;
    }
  }
  return this.save();
};

notificationSchema.methods.markChannelAsDelivered = function(channel) {
  if (this.channels[channel]) {
    this.channels[channel].status = 'delivered';
    this.channels[channel].deliveredAt = new Date();
  }
  return this.save();
};

notificationSchema.methods.markChannelAsFailed = function(channel, reason) {
  if (this.channels[channel]) {
    this.channels[channel].status = 'failed';
    this.channels[channel].failureReason = reason;
  }
  return this.save();
};

notificationSchema.methods.addInteraction = function(action, metadata = {}) {
  this.interactions.push({
    action,
    timestamp: new Date(),
    metadata
  });
  return this.save();
};

notificationSchema.methods.markAsRead = function() {
  this.channels.inApp.read = true;
  this.channels.inApp.readAt = new Date();
  return this.save();
};

notificationSchema.methods.scheduleRetry = function() {
  if (this.retryCount < this.maxRetries) {
    this.retryCount += 1;
    const delayMinutes = Math.pow(2, this.retryCount) * 5; // Exponential backoff
    this.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    return this.save();
  }
  return Promise.resolve(this);
};

// Statics
notificationSchema.statics.findPendingNotifications = function(channel = null) {
  const query = { scheduledFor: { $lte: new Date() } };
  
  if (channel) {
    query[`channels.${channel}.enabled`] = true;
    query[`channels.${channel}.status`] = 'pending';
  } else {
    query.$or = [
      { 'channels.sms.enabled': true, 'channels.sms.status': 'pending' },
      { 'channels.email.enabled': true, 'channels.email.status': 'pending' },
      { 'channels.push.enabled': true, 'channels.push.status': 'pending' },
      { 'channels.websocket.enabled': true, 'channels.websocket.status': 'pending' }
    ];
  }
  
  return this.find(query).sort({ priority: -1, scheduledFor: 1 });
};

notificationSchema.statics.findRetryableNotifications = function() {
  return this.find({
    nextRetryAt: { $lte: new Date() },
    retryCount: { $lt: 3 },
    $or: [
      { 'channels.sms.status': 'failed' },
      { 'channels.email.status': 'failed' },
      { 'channels.push.status': 'failed' }
    ]
  });
};

notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.type) query.where('type', options.type);
  if (options.unreadOnly) query.where('channels.inApp.read', false);
  if (options.limit) query.limit(options.limit);
  
  return query.sort({ createdAt: -1 });
};

notificationSchema.statics.getNotificationStats = function(userId = null) {
  const matchStage = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        delivered: {
          $sum: {
            $cond: [
              { $eq: ['$overallStatus', 'delivered'] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  console.log('Pre-save middleware called:', { isNew: this.isNew, hasNotificationId: !!this.notificationId });
  if (this.isNew && !this.notificationId) {
    this.notificationId = uuidv4();
    console.log('Generated notificationId:', this.notificationId);
  }

  // Auto-enable in-app notifications
  if (this.isNew) {
    this.channels.inApp.enabled = true;
  }

  next();
});

// Post-save middleware for event emission
notificationSchema.post('save', function(doc, next) {
  const eventBus = require('../utils/eventBus');
  
  if (doc.isNew) {
    eventBus.emit('notification.created', {
      notificationId: doc.notificationId,
      userId: doc.userId,
      type: doc.type,
      priority: doc.priority,
      channels: doc.channels
    });
  }
  
  // Emit specific events for channel status changes
  if (doc.isModified('channels.sms.status') && doc.channels.sms.status === 'delivered') {
    eventBus.emit('notification.sms.delivered', {
      notificationId: doc.notificationId,
      userId: doc.userId,
      twilioMessageSid: doc.channels.sms.twilioMessageSid
    });
  }
  
  if (doc.isModified('channels.push.status') && doc.channels.push.status === 'delivered') {
    eventBus.emit('notification.push.delivered', {
      notificationId: doc.notificationId,
      userId: doc.userId,
      firebaseMessageId: doc.channels.push.firebaseMessageId
    });
  }
  
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);
