const Razorpay = require('razorpay');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * RazorpayService - Handles payment processing with Razorpay integration
 * Supports both sandbox/production mode and mock mode for testing
 * Integrates with blockchain service for transaction recording
 */
class RazorpayService {
  constructor() {
    this.mockMode = process.env.RAZORPAY_MOCK_MODE === 'true' || !process.env.RAZORPAY_KEY_ID;
    
    if (!this.mockMode) {
      this.razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
    }
    
    // Mock transaction store for testing
    this.mockOrders = new Map();
    this.mockPayments = new Map();
    
    console.log(`RazorpayService initialized in ${this.mockMode ? 'MOCK' : 'LIVE'} mode`);
  }

  /**
   * Create a new payment order
   * @param {Object} orderData - Order details
   * @param {number} orderData.amount - Amount in smallest currency unit (paisa for INR)
   * @param {string} orderData.currency - Currency code (default: INR)
   * @param {string} orderData.receipt - Receipt/reference ID
   * @param {Object} orderData.notes - Additional notes/metadata
   * @returns {Promise<Object>} Order details
   */
  async createOrder(orderData) {
    try {
      const { amount, currency = 'INR', receipt, notes = {} } = orderData;
      
      // Validate input
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount specified');
      }
      
      if (!receipt) {
        throw new Error('Receipt ID is required');
      }

      if (this.mockMode) {
        return this._createMockOrder({ amount, currency, receipt, notes });
      }

      // Create real Razorpay order
      const razorpayOrder = await this.razorpayInstance.orders.create({
        amount: Math.round(amount * 100), // Convert to paisa
        currency,
        receipt,
        notes
      });

      return {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        notes: razorpayOrder.notes,
        created_at: razorpayOrder.created_at,
        provider: 'razorpay'
      };
      
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error(`Payment order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify payment signature and process payment
   * @param {Object} paymentData - Payment verification data
   * @param {string} paymentData.razorpay_order_id - Order ID
   * @param {string} paymentData.razorpay_payment_id - Payment ID
   * @param {string} paymentData.razorpay_signature - Payment signature
   * @returns {Promise<Object>} Payment verification result
   */
  async verifyPayment(paymentData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
      
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error('Missing required payment verification parameters');
      }

      if (this.mockMode) {
        return this._verifyMockPayment(paymentData);
      }

      // Verify signature
      const isValidSignature = this._verifySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValidSignature) {
        throw new Error('Invalid payment signature');
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await this.razorpayInstance.payments.fetch(razorpay_payment_id);
      
      return {
        verified: true,
        payment_id: paymentDetails.id,
        order_id: paymentDetails.order_id,
        amount: paymentDetails.amount / 100, // Convert from paisa to rupees
        currency: paymentDetails.currency,
        status: paymentDetails.status,
        method: paymentDetails.method,
        bank: paymentDetails.bank,
        wallet: paymentDetails.wallet,
        vpa: paymentDetails.vpa,
        card_id: paymentDetails.card_id,
        created_at: paymentDetails.created_at,
        fee: paymentDetails.fee / 100,
        tax: paymentDetails.tax / 100,
        provider: 'razorpay'
      };
      
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  /**
   * Process refund for a payment
   * @param {string} paymentId - Payment ID to refund
   * @param {number} amount - Refund amount (optional, defaults to full amount)
   * @param {Object} notes - Refund notes
   * @returns {Promise<Object>} Refund details
   */
  async processRefund(paymentId, amount = null, notes = {}) {
    try {
      if (!paymentId) {
        throw new Error('Payment ID is required for refund');
      }

      if (this.mockMode) {
        return this._processMockRefund(paymentId, amount, notes);
      }

      const refundData = { notes };
      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to paisa
      }

      const refund = await this.razorpayInstance.payments.refund(paymentId, refundData);
      
      return {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
        notes: refund.notes,
        created_at: refund.created_at,
        provider: 'razorpay'
      };
      
    } catch (error) {
      console.error('Error processing refund:', error);
      throw new Error(`Refund processing failed: ${error.message}`);
    }
  }

  /**
   * Get payment details by payment ID
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      if (this.mockMode) {
        return this._getMockPaymentDetails(paymentId);
      }

      const payment = await this.razorpayInstance.payments.fetch(paymentId);
      
      return {
        id: payment.id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        order_id: payment.order_id,
        created_at: payment.created_at,
        provider: 'razorpay'
      };
      
    } catch (error) {
      console.error('Error fetching payment details:', error);
      throw new Error(`Failed to fetch payment details: ${error.message}`);
    }
  }

  /**
   * Create webhook signature for verification
   * @param {string} body - Webhook body
   * @param {string} signature - Received signature
   * @returns {boolean} Verification result
   */
  verifyWebhookSignature(body, signature) {
    try {
      if (this.mockMode) {
        return true; // Always pass in mock mode
      }

      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(body, 'utf8')
        .digest('hex');

      return signature === expectedSignature;
      
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // Private methods for mock functionality

  /**
   * Create mock order for testing
   * @private
   */
  _createMockOrder({ amount, currency, receipt, notes }) {
    const orderId = `order_mock_${uuidv4().replace(/-/g, '').substring(0, 14)}`;
    const order = {
      id: orderId,
      amount: Math.round(amount * 100),
      currency,
      receipt,
      status: 'created',
      notes,
      created_at: Math.floor(Date.now() / 1000),
      provider: 'mock'
    };
    
    this.mockOrders.set(orderId, order);
    
    return {
      ...order,
      amount: order.amount / 100 // Return in rupees
    };
  }

  /**
   * Verify mock payment
   * @private
   */
  _verifyMockPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    // Check if order exists
    const order = this.mockOrders.get(razorpay_order_id);
    if (!order) {
      throw new Error('Order not found');
    }

    // Create mock payment
    const payment = {
      id: razorpay_payment_id,
      order_id: razorpay_order_id,
      amount: order.amount / 100,
      currency: order.currency,
      status: 'captured',
      method: 'upi',
      vpa: 'user@paytm',
      created_at: Math.floor(Date.now() / 1000),
      fee: (order.amount * 0.02) / 100, // 2% fee
      tax: (order.amount * 0.002) / 100, // 0.2% tax
      provider: 'mock'
    };
    
    this.mockPayments.set(razorpay_payment_id, payment);
    
    return {
      verified: true,
      ...payment
    };
  }

  /**
   * Process mock refund
   * @private
   */
  _processMockRefund(paymentId, amount, notes) {
    const payment = this.mockPayments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const refundAmount = amount || payment.amount;
    const refund = {
      id: `rfnd_mock_${uuidv4().replace(/-/g, '').substring(0, 14)}`,
      payment_id: paymentId,
      amount: refundAmount,
      currency: payment.currency,
      status: 'processed',
      notes,
      created_at: Math.floor(Date.now() / 1000),
      provider: 'mock'
    };

    return refund;
  }

  /**
   * Get mock payment details
   * @private
   */
  _getMockPaymentDetails(paymentId) {
    const payment = this.mockPayments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    return payment;
  }

  /**
   * Verify Razorpay signature
   * @private
   */
  _verifySignature(orderId, paymentId, signature) {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body, 'utf8')
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Generate test payment credentials for frontend
   * @returns {Object} Test credentials
   */
  getTestCredentials() {
    if (this.mockMode) {
      return {
        mode: 'mock',
        key_id: 'rzp_test_mock_key',
        test_payment_id: `pay_mock_${uuidv4().replace(/-/g, '').substring(0, 14)}`,
        test_signature: 'mock_signature_' + Date.now()
      };
    }

    return {
      mode: 'sandbox',
      key_id: process.env.RAZORPAY_KEY_ID
    };
  }
}

module.exports = new RazorpayService();
