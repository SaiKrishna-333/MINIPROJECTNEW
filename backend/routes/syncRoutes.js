const express = require('express');
const router = express.Router();
const SyncController = require('../controllers/syncController');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limiting for sync endpoints
const syncRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Limit each IP to 30 sync requests per 5 minutes
  message: {
    success: false,
    message: 'Too many sync requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit offline uploads to 10 per minute
  message: {
    success: false,
    message: 'Upload rate limit exceeded'
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     SyncOperation:
 *       type: object
 *       required:
 *         - type
 *         - data
 *         - timestamp
 *         - operationId
 *       properties:
 *         type:
 *           type: string
 *           enum: [notification_read, payment_initiation, profile_update, loan_application]
 *           description: Type of offline operation
 *         data:
 *           type: object
 *           description: Operation-specific data payload
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When the operation was performed offline
 *         operationId:
 *           type: string
 *           description: Unique identifier for the operation
 *         metadata:
 *           type: object
 *           description: Additional operation metadata
 * 
 *     OfflineUpload:
 *       type: object
 *       required:
 *         - userId
 *         - operations
 *         - clientTimestamp
 *       properties:
 *         userId:
 *           type: string
 *           description: MongoDB ObjectId of the user
 *         operations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SyncOperation'
 *         clientTimestamp:
 *           type: string
 *           format: date-time
 *           description: Client-side timestamp when upload was initiated
 *         deviceId:
 *           type: string
 *           description: Unique device identifier
 * 
 *     ConflictResolution:
 *       type: object
 *       required:
 *         - conflictId
 *         - resolution
 *         - userId
 *       properties:
 *         conflictId:
 *           type: string
 *           description: Unique conflict identifier
 *         resolution:
 *           type: string
 *           enum: [client_wins, server_wins, merge]
 *           description: How to resolve the conflict
 *         userId:
 *           type: string
 *           description: MongoDB ObjectId of the user
 *         mergedData:
 *           type: object
 *           description: Merged data for merge resolution
 */

/**
 * @swagger
 * /api/sync/data:
 *   get:
 *     summary: Get latest data for synchronization
 *     tags: [Sync]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to sync data for
 *       - in: query
 *         name: lastSyncTimestamp
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Timestamp of last successful sync
 *       - in: query
 *         name: dataTypes
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [transactions, notifications, profile, loans]
 *         style: form
 *         explode: false
 *         description: Types of data to sync
 *     responses:
 *       200:
 *         description: Sync data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     syncTimestamp:
 *                       type: string
 *                       format: date-time
 *                     lastSyncTimestamp:
 *                       type: string
 *                       format: date-time
 *                     syncData:
 *                       type: object
 *                       properties:
 *                         transactions:
 *                           type: object
 *                         notifications:
 *                           type: object
 *                         profile:
 *                           type: object
 *                         loans:
 *                           type: object
 *                     pendingSyncOperations:
 *                       type: array
 *       400:
 *         description: User ID is required
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get('/data',
  syncRateLimit,
  SyncController.getSyncData
);

/**
 * @swagger
 * /api/sync/upload:
 *   post:
 *     summary: Upload offline queued operations for processing
 *     tags: [Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OfflineUpload'
 *     responses:
 *       200:
 *         description: Offline operations processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     syncId:
 *                       type: string
 *                     results:
 *                       type: object
 *                       properties:
 *                         processed:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *                         conflicts:
 *                           type: integer
 *                         operations:
 *                           type: array
 *                     serverTimestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/upload',
  uploadRateLimit,
  SyncController.validateUpload,
  SyncController.uploadOfflineOperations
);

/**
 * @swagger
 * /api/sync/resolve-conflict:
 *   post:
 *     summary: Handle conflict resolution for sync operations
 *     tags: [Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConflictResolution'
 *     responses:
 *       200:
 *         description: Conflict resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     conflictId:
 *                       type: string
 *                     resolution:
 *                       type: string
 *                     resolvedData:
 *                       type: object
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error or invalid resolution type
 *       404:
 *         description: Conflict not found
 *       500:
 *         description: Internal server error
 */
router.post('/resolve-conflict',
  syncRateLimit,
  SyncController.validateConflictResolution,
  SyncController.resolveConflict
);

/**
 * @swagger
 * /api/sync/status/{userId}:
 *   get:
 *     summary: Get sync status and statistics
 *     tags: [Sync]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Sync status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     lastSyncTimestamp:
 *                       type: string
 *                       format: date-time
 *                     pendingOperationsCount:
 *                       type: integer
 *                     pendingOperations:
 *                       type: array
 *                     unresolvedConflictsCount:
 *                       type: integer
 *                     conflicts:
 *                       type: array
 *                     statistics:
 *                       type: object
 *                     serverTimestamp:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Internal server error
 */
router.get('/status/:userId', SyncController.getSyncStatus);

/**
 * @swagger
 * /api/sync/full-sync:
 *   post:
 *     summary: Force full synchronization
 *     tags: [Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID
 *               deviceId:
 *                 type: string
 *                 description: Device ID for tracking
 *     responses:
 *       200:
 *         description: Full synchronization initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     syncId:
 *                       type: string
 *                     syncData:
 *                       type: object
 *                     instructions:
 *                       type: object
 *                       properties:
 *                         clearLocalData:
 *                           type: boolean
 *                         rebuildCache:
 *                           type: boolean
 *                         updateLastSync:
 *                           type: string
 *                           format: date-time
 *                     serverTimestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: User ID is required
 *       500:
 *         description: Internal server error
 */
router.post('/full-sync',
  syncRateLimit,
  [
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    body('deviceId').optional().notEmpty().withMessage('Device ID cannot be empty')
  ],
  SyncController.forceFullSync
);

/**
 * @swagger
 * /api/sync/health:
 *   get:
 *     summary: Health check for sync service
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Sync service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     services:
 *                       type: object
 *                     statistics:
 *                       type: object
 *       503:
 *         description: Sync service is unhealthy
 */
router.get('/health', SyncController.getSyncHealth);

// WebSocket connection info endpoint
/**
 * @swagger
 * /api/sync/websocket-info:
 *   get:
 *     summary: Get WebSocket connection information for real-time sync
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: WebSocket connection info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     websocketUrl:
 *                       type: string
 *                     protocols:
 *                       type: array
 *                       items:
 *                         type: string
 *                     events:
 *                       type: array
 *                       items:
 *                         type: string
 *                     authentication:
 *                       type: object
 */
router.get('/websocket-info', (req, res) => {
  const websocketInfo = {
    websocketUrl: process.env.WEBSOCKET_URL || `ws://localhost:${process.env.PORT || 3000}/ws`,
    protocols: ['ruralconnect-sync-v1'],
    events: [
      'sync.data_updated',
      'sync.conflict_detected',
      'notification.new',
      'payment.status_changed',
      'transaction.confirmed'
    ],
    authentication: {
      required: true,
      method: 'jwt',
      header: 'Authorization'
    },
    heartbeat: {
      interval: 30000, // 30 seconds
      message: 'ping'
    }
  };

  res.status(200).json({
    success: true,
    data: websocketInfo
  });
});

// Sync queue status endpoint
/**
 * @swagger
 * /api/sync/queue-status:
 *   get:
 *     summary: Get sync queue status and processing information
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Sync queue status
 */
router.get('/queue-status', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      queueSize: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      averageProcessingTime: 0,
      lastProcessed: null
    }
  });
});

module.exports = router;
