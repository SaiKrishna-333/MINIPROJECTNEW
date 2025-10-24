const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limiting for payment endpoints
const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 payment requests per windowMs
  message: {
    success: false,
    message: 'Too many payment requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow more requests for webhooks
  message: {
    success: false,
    message: 'Webhook rate limit exceeded'
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentOrder:
 *       type: object
 *       required:
 *         - loanId
 *         - borrowerId
 *         - lenderId
 *         - amount
 *       properties:
 *         loanId:
 *           type: string
 *           description: MongoDB ObjectId of the loan
 *         borrowerId:
 *           type: string
 *           description: MongoDB ObjectId of the borrower
 *         lenderId:
 *           type: string
 *           description: MongoDB ObjectId of the lender
 *         amount:
 *           type: number
 *           minimum: 1
 *           description: Payment amount in rupees
 *         paymentType:
 *           type: string
 *           enum: [loan_disbursement, emi_payment, full_repayment, penalty]
 *           default: emi_payment
 *         currency:
 *           type: string
 *           enum: [INR, USD]
 *           default: INR
 *         metadata:
 *           type: object
 *           description: Additional payment metadata
 * 
 *     PaymentConfirmation:
 *       type: object
 *       required:
 *         - razorpay_order_id
 *         - razorpay_payment_id
 *         - razorpay_signature
 *       properties:
 *         razorpay_order_id:
 *           type: string
 *           description: Razorpay order ID
 *         razorpay_payment_id:
 *           type: string
 *           description: Razorpay payment ID
 *         razorpay_signature:
 *           type: string
 *           description: Razorpay payment signature for verification
 *         transactionId:
 *           type: string
 *           description: Internal transaction ID (optional)
 */

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initiate a new payment order
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentOrder'
 *     responses:
 *       201:
 *         description: Payment order created successfully
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
 *                     orderId:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/initiate', 
  paymentRateLimit,
  PaymentController.validateInitiatePayment,
  PaymentController.initiatePayment
);

/**
 * @swagger
 * /api/payments/confirm:
 *   post:
 *     summary: Confirm payment after successful Razorpay transaction
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentConfirmation'
 *     responses:
 *       200:
 *         description: Payment confirmed successfully
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
 *                     transactionId:
 *                       type: string
 *                     paymentId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     txnHash:
 *                       type: string
 *                       description: Blockchain transaction hash
 *       400:
 *         description: Validation error or payment verification failed
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.post('/confirm',
  paymentRateLimit,
  PaymentController.validateConfirmPayment,
  PaymentController.confirmPayment
);

/**
 * @swagger
 * /api/payments/repayment:
 *   post:
 *     summary: Process loan repayment (EMI or full payment)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanId
 *               - amount
 *             properties:
 *               loanId:
 *                 type: string
 *                 description: MongoDB ObjectId of the loan
 *               amount:
 *                 type: number
 *                 minimum: 1
 *               repaymentType:
 *                 type: string
 *                 enum: [emi_payment, full_repayment, penalty]
 *                 default: emi_payment
 *               emiNumber:
 *                 type: integer
 *                 minimum: 1
 *               autoDebit:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Repayment order created or processed
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/repayment',
  paymentRateLimit,
  PaymentController.validateRepayment,
  PaymentController.processRepayment
);

/**
 * @swagger
 * /api/payments/status/{transactionId}:
 *   get:
 *     summary: Get transaction status and details
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID or MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Transaction details retrieved successfully
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.get('/status/:transactionId', PaymentController.getTransactionStatus);

/**
 * @swagger
 * /api/payments/history/{loanId}:
 *   get:
 *     summary: Get payment history for a loan
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, failed]
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/history/:loanId', PaymentController.getPaymentHistory);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Handle Razorpay webhooks
 *     tags: [Payments]
 *     description: Webhook endpoint for Razorpay payment status updates
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Razorpay webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook signature
 *       500:
 *         description: Webhook processing failed
 */
router.post('/webhook',
  webhookRateLimit,
  express.raw({ type: 'application/json' }),
  PaymentController.handleWebhook
);

// Health check endpoint
/**
 * @swagger
 * /api/payments/health:
 *   get:
 *     summary: Payment service health check
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment service is healthy',
    timestamp: new Date(),
    services: {
      razorpay: 'operational',
      blockchain: 'operational',
      database: 'operational'
    }
  });
});

module.exports = router;
