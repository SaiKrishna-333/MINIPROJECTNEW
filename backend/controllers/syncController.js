const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const eventBus = require('../utils/eventBus');

/**
 * SyncController - Handles offline-first synchronization operations
 * Manages data sync between client and server when connection is restored
 * Queues operations while offline and processes them when online
 */
class SyncController {

  /**
   * Get latest data for synchronization
   * GET /api/sync/data
   */
  static async getSyncData(req, res) {
    try {
      const { userId, lastSyncTimestamp, dataTypes = ['transactions', 'notifications'] } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const since = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
      const syncData = {};
      const currentTimestamp = new Date();

      // Fetch transactions if requested
      if (dataTypes.includes('transactions')) {
        const transactions = await Transaction.find({
          $or: [
            { borrowerId: userId },
            { lenderId: userId }
          ],
          updatedAt: { $gte: since }
        })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();

        syncData.transactions = {
          data: transactions,
          count: transactions.length,
          lastUpdate: transactions.length > 0 ? transactions[0].updatedAt : null
        };
      }

      // Fetch notifications if requested
      if (dataTypes.includes('notifications')) {
        const notifications = await Notification.find({
          userId,
          updatedAt: { $gte: since }
        })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();

        syncData.notifications = {
          data: notifications,
          count: notifications.length,
          lastUpdate: notifications.length > 0 ? notifications[0].updatedAt : null,
          unreadCount: await Notification.countDocuments({
            userId,
            'channels.inApp.read': false
          })
        };
      }

      // Fetch user profile updates if requested
      if (dataTypes.includes('profile')) {
        // Placeholder for user profile sync
        syncData.profile = {
          data: null, // Would fetch from User model
          lastUpdate: null
        };
      }

      // Fetch loan data if requested
      if (dataTypes.includes('loans')) {
        // Placeholder for loan sync
        syncData.loans = {
          data: [], // Would fetch from Loan model
          count: 0,
          lastUpdate: null
        };
      }

      // Check for pending sync operations
      const pendingSyncOps = await SyncController._getPendingSyncOperations(userId);

      res.status(200).json({
        success: true,
        message: 'Sync data retrieved successfully',
        data: {
          syncTimestamp: currentTimestamp,
          lastSyncTimestamp: since,
          syncData,
          pendingSyncOperations: pendingSyncOps,
          metadata: {
            serverTimestamp: currentTimestamp,
            dataTypes,
            syncId: uuidv4()
          }
        }
      });

    } catch (error) {
      console.error('Error getting sync data:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get sync data',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Upload offline queued operations for processing
   * POST /api/sync/upload
   */
  static async uploadOfflineOperations(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId, operations, clientTimestamp, deviceId } = req.body;

      if (!Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Operations array is required and must not be empty'
        });
      }

      const results = {
        processed: 0,
        failed: 0,
        conflicts: 0,
        operations: []
      };

      const syncId = uuidv4();

      // Process each offline operation
      for (const operation of operations) {
        try {
          const operationResult = await SyncController._processOfflineOperation(
            userId,
            operation,
            { syncId, deviceId, clientTimestamp }
          );
          
          if (operationResult.conflict) {
            results.conflicts++;
          } else {
            results.processed++;
          }
          
          results.operations.push({
            clientOperationId: operation.operationId,
            serverOperationId: operationResult.serverOperationId,
            success: true,
            conflict: operationResult.conflict,
            conflictResolution: operationResult.conflictResolution,
            data: operationResult.data
          });

        } catch (error) {
          results.failed++;
          results.operations.push({
            clientOperationId: operation.operationId,
            success: false,
            error: error.message
          });
        }
      }

      // Emit sync completion event
      eventBus.emitEvent('sync.upload_completed', {
        userId,
        syncId,
        deviceId,
        processed: results.processed,
        failed: results.failed,
        conflicts: results.conflicts
      }, {
        source: 'sync_controller',
        userId
      });

      res.status(200).json({
        success: true,
        message: 'Offline operations processed',
        data: {
          syncId,
          results,
          serverTimestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error uploading offline operations:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to process offline operations',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Handle conflict resolution for sync operations
   * POST /api/sync/resolve-conflict
   */
  static async resolveConflict(req, res) {
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
        conflictId, 
        resolution, // 'client_wins', 'server_wins', 'merge'
        mergedData, 
        userId 
      } = req.body;

      // Find the conflicted operation (would be stored in a conflicts collection)
      // For now, we'll simulate conflict resolution
      
      const conflict = await SyncController._getConflict(conflictId);
      
      if (!conflict) {
        return res.status(404).json({
          success: false,
          message: 'Conflict not found'
        });
      }

      let resolvedData;
      
      switch (resolution) {
        case 'client_wins':
          resolvedData = conflict.clientData;
          break;
        case 'server_wins':
          resolvedData = conflict.serverData;
          break;
        case 'merge':
          resolvedData = mergedData || SyncController._autoMergeData(conflict.clientData, conflict.serverData);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resolution type'
          });
      }

      // Apply the resolution
      await SyncController._applyConflictResolution(conflict, resolvedData, resolution);

      // Mark conflict as resolved
      await SyncController._markConflictResolved(conflictId, resolution);

      // Emit conflict resolution event
      eventBus.emitEvent('sync.conflict_resolved', {
        conflictId,
        userId,
        resolution,
        entityType: conflict.entityType,
        entityId: conflict.entityId
      });

      res.status(200).json({
        success: true,
        message: 'Conflict resolved successfully',
        data: {
          conflictId,
          resolution,
          resolvedData,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error resolving conflict:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to resolve conflict',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get sync status and statistics
   * GET /api/sync/status/:userId
   */
  static async getSyncStatus(req, res) {
    try {
      const { userId } = req.params;

      // Get last sync timestamp
      const lastSync = await SyncController._getLastSyncTimestamp(userId);
      
      // Get pending operations count
      const pendingOps = await SyncController._getPendingSyncOperations(userId);
      
      // Get unresolved conflicts
      const conflicts = await SyncController._getUnresolvedConflicts(userId);
      
      // Get sync statistics
      const syncStats = await SyncController._getSyncStatistics(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          lastSyncTimestamp: lastSync,
          pendingOperationsCount: pendingOps.length,
          pendingOperations: pendingOps,
          unresolvedConflictsCount: conflicts.length,
          conflicts,
          statistics: syncStats,
          serverTimestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error getting sync status:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get sync status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Force full synchronization
   * POST /api/sync/full-sync
   */
  static async forceFullSync(req, res) {
    try {
      const { userId, deviceId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const syncId = uuidv4();
      
      // Reset sync status for user
      await SyncController._resetUserSyncStatus(userId);
      
      // Get all user data for full sync
      const fullSyncData = await SyncController._getFullSyncData(userId);
      
      // Mark all local data for re-sync
      await SyncController._markForFullResync(userId);

      // Emit full sync initiated event
      eventBus.emitEvent('sync.full_sync_initiated', {
        userId,
        syncId,
        deviceId,
        dataSize: Object.keys(fullSyncData).reduce((size, key) => 
          size + (fullSyncData[key].data?.length || 0), 0
        )
      });

      res.status(200).json({
        success: true,
        message: 'Full synchronization initiated',
        data: {
          syncId,
          syncData: fullSyncData,
          instructions: {
            clearLocalData: true,
            rebuildCache: true,
            updateLastSync: new Date()
          },
          serverTimestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error forcing full sync:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to initiate full sync',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Health check for sync service
   * GET /api/sync/health
   */
  static async getSyncHealth(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          database: 'up',
          eventBus: 'up',
          syncQueue: 'up'
        },
        statistics: {
          activeSyncs: await SyncController._getActiveSyncCount(),
          pendingOperations: await SyncController._getTotalPendingOperations(),
          unresolvedConflicts: await SyncController._getTotalUnresolvedConflicts()
        }
      };

      // Check database connectivity
      try {
        await Transaction.findOne().limit(1);
      } catch (dbError) {
        health.services.database = 'down';
        health.status = 'degraded';
      }

      // Check event bus
      try {
        eventBus.emit('sync.health_check', { timestamp: new Date() });
      } catch (eventError) {
        health.services.eventBus = 'down';
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: health.status === 'healthy',
        data: health
      });

    } catch (error) {
      console.error('Error checking sync health:', error);
      
      res.status(503).json({
        success: false,
        message: 'Sync service unhealthy',
        data: {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date()
        }
      });
    }
  }

  // Private helper methods

  /**
   * Process a single offline operation
   * @private
   */
  static async _processOfflineOperation(userId, operation, syncContext) {
    const { type, data, timestamp, operationId } = operation;
    let result = { serverOperationId: uuidv4(), conflict: false };

    try {
      switch (type) {
        case 'notification_read':
          result.data = await SyncController._processNotificationRead(userId, data, timestamp);
          break;
        
        case 'payment_initiation':
          result.data = await SyncController._processPaymentInitiation(userId, data, timestamp);
          break;
        
        case 'profile_update':
          result.data = await SyncController._processProfileUpdate(userId, data, timestamp);
          break;
        
        case 'loan_application':
          result.data = await SyncController._processLoanApplication(userId, data, timestamp);
          break;
        
        default:
          throw new Error(`Unknown operation type: ${type}`);
      }

      // Mark operation as processed
      await SyncController._markOperationProcessed(operationId, result.serverOperationId);

    } catch (error) {
      if (error.message.includes('conflict')) {
        result.conflict = true;
        result.conflictResolution = await SyncController._createConflictRecord(
          userId, 
          operation, 
          error.serverData,
          syncContext
        );
      } else {
        throw error;
      }
    }

    return result;
  }

  /**
   * Process notification read operation
   * @private
   */
  static async _processNotificationRead(userId, data, timestamp) {
    const { notificationId, readAt } = data;
    
    const notification = await Notification.findOne({
      notificationId,
      userId
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Check for conflict (notification already read on server)
    if (notification.channels.inApp.read && notification.channels.inApp.readAt < new Date(readAt)) {
      const conflictError = new Error('Conflict detected: notification read');
      conflictError.serverData = {
        readAt: notification.channels.inApp.readAt,
        read: notification.channels.inApp.read
      };
      throw conflictError;
    }

    // Apply the read status
    await notification.markAsRead();
    
    return {
      notificationId: notification.notificationId,
      readAt: notification.channels.inApp.readAt,
      processed: true
    };
  }

  /**
   * Process payment initiation operation
   * @private
   */
  static async _processPaymentInitiation(userId, data, timestamp) {
    const { loanId, amount, clientTransactionId } = data;
    
    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      loanId,
      borrowerId: userId,
      amount,
      status: 'pending',
      createdAt: { $gte: new Date(timestamp - 60000) } // Within 1 minute
    });

    if (existingTransaction) {
      return {
        transactionId: existingTransaction.transactionId,
        status: 'already_exists'
      };
    }

    // Create new transaction
    const transaction = new Transaction({
      loanId,
      borrowerId: userId,
      lenderId: data.lenderId,
      amount,
      type: 'emi_payment',
      status: 'pending',
      metadata: {
        offlineCreated: true,
        clientTransactionId,
        syncTimestamp: timestamp
      }
    });

    await transaction.save();

    return {
      transactionId: transaction.transactionId,
      status: 'created'
    };
  }

  /**
   * Process profile update operation
   * @private
   */
  static async _processProfileUpdate(userId, data, timestamp) {
    // Placeholder for profile update processing
    return {
      userId,
      updatedFields: Object.keys(data),
      status: 'processed'
    };
  }

  /**
   * Process loan application operation
   * @private
   */
  static async _processLoanApplication(userId, data, timestamp) {
    // Placeholder for loan application processing
    return {
      userId,
      loanId: `loan_${Date.now()}`,
      status: 'submitted'
    };
  }

  /**
   * Get pending sync operations for a user
   * @private
   */
  static async _getPendingSyncOperations(userId) {
    // In a real implementation, this would query a sync operations table
    return []; // Placeholder
  }

  /**
   * Get last sync timestamp for a user
   * @private
   */
  static async _getLastSyncTimestamp(userId) {
    // In a real implementation, this would query user sync status
    return new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago as placeholder
  }

  /**
   * Get unresolved conflicts for a user
   * @private
   */
  static async _getUnresolvedConflicts(userId) {
    // In a real implementation, this would query conflicts table
    return []; // Placeholder
  }

  /**
   * Get sync statistics for a user
   * @private
   */
  static async _getSyncStatistics(userId) {
    return {
      totalSyncs: 0,
      lastSyncDuration: 0,
      averageSyncDuration: 0,
      conflictsResolved: 0
    }; // Placeholder
  }

  /**
   * Other placeholder methods
   * @private
   */
  static async _getConflict(conflictId) { return null; }
  static async _applyConflictResolution(conflict, data, resolution) { return; }
  static async _markConflictResolved(conflictId, resolution) { return; }
  static async _createConflictRecord(userId, operation, serverData, context) { return null; }
  static async _markOperationProcessed(operationId, serverOperationId) { return; }
  static async _resetUserSyncStatus(userId) { return; }
  static async _getFullSyncData(userId) { return {}; }
  static async _markForFullResync(userId) { return; }
  static async _getActiveSyncCount() { return 0; }
  static async _getTotalPendingOperations() { return 0; }
  static async _getTotalUnresolvedConflicts() { return 0; }
  
  /**
   * Auto-merge conflicting data
   * @private
   */
  static _autoMergeData(clientData, serverData) {
    // Simple merge strategy - server data takes precedence for conflicts
    return { ...clientData, ...serverData };
  }
}

// Validation middleware
SyncController.validateUpload = [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('operations').isArray({ min: 1 }).withMessage('Operations array is required'),
  body('operations.*.type').notEmpty().withMessage('Operation type is required'),
  body('operations.*.data').isObject().withMessage('Operation data is required'),
  body('operations.*.timestamp').isISO8601().withMessage('Valid timestamp is required'),
  body('operations.*.operationId').notEmpty().withMessage('Operation ID is required'),
  body('clientTimestamp').isISO8601().withMessage('Valid client timestamp is required'),
  body('deviceId').optional().notEmpty().withMessage('Device ID cannot be empty')
];

SyncController.validateConflictResolution = [
  body('conflictId').notEmpty().withMessage('Conflict ID is required'),
  body('resolution').isIn(['client_wins', 'server_wins', 'merge']).withMessage('Invalid resolution type'),
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('mergedData').optional().isObject()
];

module.exports = SyncController;
