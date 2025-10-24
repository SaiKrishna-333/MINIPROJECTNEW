const EventEmitter = require('eventemitter3');

/**
 * EventBus - Central event management system for RuralConnect P2P platform
 * Enables decoupled communication between different modules
 * Handles payment events, notification triggers, and blockchain updates
 */
class EventBusManager extends EventEmitter {
  constructor() {
    super();
    
    this.eventHistory = new Map(); // Store recent events for debugging
    this.eventStats = new Map(); // Track event frequency
    this.maxHistorySize = 1000; // Limit history size to prevent memory leaks
    
    // Initialize event handlers
    this.setupDefaultHandlers();
    
    console.log('EventBus initialized with default handlers');
  }

  /**
   * Setup default event handlers for core system events
   * @private
   */
  setupDefaultHandlers() {
    // Transaction Events
    this.on('transaction.created', this.handleTransactionCreated.bind(this));
    this.on('transaction.confirmed', this.handleTransactionConfirmed.bind(this));
    this.on('transaction.failed', this.handleTransactionFailed.bind(this));
    
    // Payment Events
    this.on('payment.initiated', this.handlePaymentInitiated.bind(this));
    this.on('payment.successful', this.handlePaymentSuccessful.bind(this));
    this.on('payment.failed', this.handlePaymentFailed.bind(this));
    
    // Loan Events
    this.on('loan.created', this.handleLoanCreated.bind(this));
    this.on('loan.approved', this.handleLoanApproved.bind(this));
    this.on('loan.rejected', this.handleLoanRejected.bind(this));
    this.on('loan.repayment_due', this.handleRepaymentDue.bind(this));
    this.on('loan.completed', this.handleLoanCompleted.bind(this));
    
    // Document Events
    this.on('document.uploaded', this.handleDocumentUploaded.bind(this));
    this.on('document.verified', this.handleDocumentVerified.bind(this));
    this.on('document.rejected', this.handleDocumentRejected.bind(this));
    
    // Notification Events
    this.on('notification.created', this.handleNotificationCreated.bind(this));
    this.on('notification.sent', this.handleNotificationSent.bind(this));
    this.on('notification.delivered', this.handleNotificationDelivered.bind(this));
    this.on('notification.failed', this.handleNotificationFailed.bind(this));
    
    // Blockchain Events
    this.on('blockchain.transaction_confirmed', this.handleBlockchainConfirmation.bind(this));
    this.on('blockchain.transaction_failed', this.handleBlockchainFailure.bind(this));
    
    // User Events
    this.on('user.registered', this.handleUserRegistered.bind(this));
    this.on('user.kyc_completed', this.handleKYCCompleted.bind(this));
    this.on('user.login', this.handleUserLogin.bind(this));
    
    // System Events
    this.on('system.sync_requested', this.handleSyncRequested.bind(this));
    this.on('system.offline_event_queued', this.handleOfflineEventQueued.bind(this));
    this.on('system.connection_restored', this.handleConnectionRestored.bind(this));
  }

  /**
   * Emit an event with metadata and tracking
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event data payload
   * @param {Object} options - Additional options
   * @returns {boolean} Success status
   */
  emitEvent(eventName, data = {}, options = {}) {
    try {
      const eventId = this.generateEventId();
      const timestamp = new Date();
      
      // Create enhanced event data
      const enhancedData = {
        ...data,
        _metadata: {
          eventId,
          timestamp,
          source: options.source || 'system',
          priority: options.priority || 'medium',
          retryable: options.retryable !== false,
          correlationId: options.correlationId || this.generateCorrelationId(),
          userId: options.userId,
          sessionId: options.sessionId
        }
      };

      // Store in history
      this.addToHistory(eventName, enhancedData);
      
      // Update statistics
      this.updateStats(eventName);
      
      // Emit the event
      const success = super.emit(eventName, enhancedData);
      
      // Log the event
      this.logEvent(eventName, enhancedData, success);
      
      return success;
      
    } catch (error) {
      console.error(`Error emitting event ${eventName}:`, error);
      return false;
    }
  }

  /**
   * Add event listener with metadata
   * @param {string} eventName - Event name to listen for
   * @param {Function} handler - Event handler function
   * @param {Object} options - Listener options
   * @returns {EventBusManager} This instance for chaining
   */
  addListener(eventName, handler, options = {}) {
    const wrappedHandler = async (data) => {
      try {
        const startTime = Date.now();
        
        // Execute the handler
        await handler(data);
        
        const executionTime = Date.now() - startTime;
        
        // Log successful execution
        if (options.logExecution !== false) {
          console.log(`Event handler for '${eventName}' executed in ${executionTime}ms`);
        }
        
      } catch (error) {
        console.error(`Error in event handler for '${eventName}':`, error);
        
        // Emit error event if handler fails
        this.emitEvent('system.handler_error', {
          originalEvent: eventName,
          error: error.message,
          handlerName: handler.name || 'anonymous'
        });
        
        // Retry if enabled
        if (options.retryOnError && data._metadata?.retryable) {
          setTimeout(() => {
            this.emitEvent(eventName, data, { retryAttempt: true });
          }, options.retryDelay || 5000);
        }
      }
    };

    return super.on(eventName, wrappedHandler);
  }

  // Default Event Handlers

  /**
   * Handle transaction creation events
   */
  async handleTransactionCreated(data) {
    console.log(`Transaction created: ${data.transactionId} for loan ${data.loanId}`);
    
    // Trigger blockchain recording if enabled
    if (data.recordOnBlockchain) {
      this.emitEvent('blockchain.record_transaction', {
        transactionId: data.transactionId,
        loanId: data.loanId,
        amount: data.amount,
        type: data.type
      });
    }
  }

  /**
   * Handle transaction confirmation events
   */
  async handleTransactionConfirmed(data) {
    console.log(`Transaction confirmed: ${data.transactionId} with hash ${data.txnHash}`);
    
    // Send notifications to both parties
    this.emitEvent('notification.send_multi', {
      recipients: [
        { userId: data.borrowerId, userType: 'borrower' },
        { userId: data.lenderId, userType: 'lender' }
      ],
      type: 'payment_successful',
      variables: {
        amount: data.amount,
        loanId: data.loanId,
        transactionId: data.transactionId
      }
    });
    
    // Update loan status if this was a repayment
    if (data.type === 'emi_payment' || data.type === 'full_repayment') {
      this.emitEvent('loan.update_repayment_status', {
        loanId: data.loanId,
        amount: data.amount,
        transactionId: data.transactionId,
        txnHash: data.txnHash
      });
    }
  }

  /**
   * Handle transaction failure events
   */
  async handleTransactionFailed(data) {
    console.log(`Transaction failed: ${data.transactionId} - ${data.failureReason}`);
    
    // Send failure notifications
    this.emitEvent('notification.send', {
      userId: data.borrowerId,
      type: 'payment_failed',
      variables: {
        amount: data.amount || 'N/A',
        loanId: data.loanId,
        transactionId: data.transactionId,
        reason: data.failureReason
      }
    });
  }

  /**
   * Handle payment initiation events
   */
  async handlePaymentInitiated(data) {
    console.log(`Payment initiated: ${data.orderId} for ₹${data.amount}`);
    
    // Create transaction record
    this.emitEvent('transaction.create', {
      loanId: data.loanId,
      borrowerId: data.borrowerId,
      lenderId: data.lenderId,
      amount: data.amount,
      type: data.paymentType || 'emi_payment',
      razorpayOrderId: data.orderId,
      status: 'pending'
    });
  }

  /**
   * Handle successful payment events
   */
  async handlePaymentSuccessful(data) {
    console.log(`Payment successful: ${data.paymentId} for order ${data.orderId}`);
    
    // Confirm transaction
    this.emitEvent('transaction.confirm', {
      transactionId: data.transactionId,
      razorpayPaymentId: data.paymentId,
      amount: data.amount
    });
  }

  /**
   * Handle failed payment events
   */
  async handlePaymentFailed(data) {
    console.log(`Payment failed: ${data.orderId} - ${data.error}`);
    
    // Mark transaction as failed
    this.emitEvent('transaction.fail', {
      transactionId: data.transactionId,
      failureReason: data.error
    });
  }

  /**
   * Handle loan creation events
   */
  async handleLoanCreated(data) {
    console.log(`Loan created: ${data.loanId} by borrower ${data.borrowerId}`);
    
    // Send notification to borrower
    this.emitEvent('notification.send', {
      userId: data.borrowerId,
      type: 'loan_application_submitted',
      variables: {
        loanId: data.loanId,
        amount: data.amount
      }
    });
  }

  /**
   * Handle loan approval events
   */
  async handleLoanApproved(data) {
    console.log(`Loan approved: ${data.loanId} by lender ${data.lenderId}`);
    
    // Send notifications
    this.emitEvent('notification.send_multi', {
      recipients: [
        { userId: data.borrowerId, userType: 'borrower' },
        { userId: data.lenderId, userType: 'lender' }
      ],
      type: 'loan_approved',
      variables: {
        loanId: data.loanId,
        amount: data.amount
      }
    });
    
    // Create blockchain loan record
    this.emitEvent('blockchain.create_loan', {
      loanId: data.loanId,
      borrowerAddress: data.borrowerAddress,
      lenderAddress: data.lenderAddress,
      amount: data.amount,
      interestRate: data.interestRate,
      duration: data.duration
    });
  }

  /**
   * Handle loan rejection events
   */
  async handleLoanRejected(data) {
    console.log(`Loan rejected: ${data.loanId}`);
    
    this.emitEvent('notification.send', {
      userId: data.borrowerId,
      type: 'loan_rejected',
      variables: {
        loanId: data.loanId,
        amount: data.amount,
        reason: data.rejectionReason
      }
    });
  }

  /**
   * Handle repayment due reminders
   */
  async handleRepaymentDue(data) {
    console.log(`Repayment due reminder: ${data.loanId} - ₹${data.amount}`);
    
    this.emitEvent('notification.send', {
      userId: data.borrowerId,
      type: 'repayment_due',
      variables: {
        loanId: data.loanId,
        amount: data.amount,
        dueDate: data.dueDate
      },
      scheduledFor: new Date(data.reminderDate)
    });
  }

  /**
   * Handle loan completion events
   */
  async handleLoanCompleted(data) {
    console.log(`Loan completed: ${data.loanId}`);
    
    // Send completion notifications
    this.emitEvent('notification.send_multi', {
      recipients: [
        { userId: data.borrowerId, userType: 'borrower' },
        { userId: data.lenderId, userType: 'lender' }
      ],
      type: 'loan_completed',
      variables: {
        loanId: data.loanId,
        totalAmount: data.totalAmount
      }
    });
  }

  /**
   * Handle document upload events
   */
  async handleDocumentUploaded(data) {
    console.log(`Document uploaded: ${data.documentId} by user ${data.userId}`);
    
    // Store document hash on blockchain
    this.emitEvent('blockchain.store_document', {
      documentHash: data.documentHash,
      ownerAddress: data.userAddress,
      documentType: data.documentType
    });
  }

  /**
   * Handle document verification events
   */
  async handleDocumentVerified(data) {
    console.log(`Document verified: ${data.documentId}`);
    
    this.emitEvent('notification.send', {
      userId: data.userId,
      type: 'document_verified',
      variables: {
        documentType: data.documentType,
        loanId: data.loanId
      }
    });
  }

  /**
   * Handle document rejection events
   */
  async handleDocumentRejected(data) {
    console.log(`Document rejected: ${data.documentId} - ${data.rejectionReason}`);
    
    this.emitEvent('notification.send', {
      userId: data.userId,
      type: 'document_rejected',
      variables: {
        documentType: data.documentType,
        loanId: data.loanId,
        reason: data.rejectionReason
      }
    });
  }

  /**
   * Handle notification creation
   */
  async handleNotificationCreated(data) {
    console.log(`Notification created: ${data.notificationId} for user ${data.userId}`);
  }

  /**
   * Handle notification sent events
   */
  async handleNotificationSent(data) {
    console.log(`Notification sent: ${data.notificationId} via ${data.channel}`);
  }

  /**
   * Handle notification delivery confirmation
   */
  async handleNotificationDelivered(data) {
    console.log(`Notification delivered: ${data.notificationId} to ${data.recipient}`);
  }

  /**
   * Handle notification failures
   */
  async handleNotificationFailed(data) {
    console.log(`Notification failed: ${data.notificationId} - ${data.error}`);
    
    // Retry if appropriate
    if (data.retryable) {
      setTimeout(() => {
        this.emitEvent('notification.retry', {
          notificationId: data.notificationId,
          channel: data.channel
        });
      }, 5000);
    }
  }

  /**
   * Handle blockchain confirmation
   */
  async handleBlockchainConfirmation(data) {
    console.log(`Blockchain transaction confirmed: ${data.txnHash}`);
  }

  /**
   * Handle blockchain failures
   */
  async handleBlockchainFailure(data) {
    console.log(`Blockchain transaction failed: ${data.error}`);
  }

  /**
   * Handle user registration
   */
  async handleUserRegistered(data) {
    console.log(`User registered: ${data.userId}`);
    
    this.emitEvent('notification.send', {
      userId: data.userId,
      type: 'welcome',
      variables: {
        userName: data.userName
      }
    });
  }

  /**
   * Handle KYC completion
   */
  async handleKYCCompleted(data) {
    console.log(`KYC completed: ${data.userId}`);
    
    this.emitEvent('notification.send', {
      userId: data.userId,
      type: 'kyc_completed',
      variables: {
        userName: data.userName
      }
    });
  }

  /**
   * Handle user login
   */
  async handleUserLogin(data) {
    console.log(`User login: ${data.userId} from ${data.ipAddress}`);
  }

  /**
   * Handle sync requests
   */
  async handleSyncRequested(data) {
    console.log(`Sync requested by user: ${data.userId}`);
  }

  /**
   * Handle offline event queuing
   */
  async handleOfflineEventQueued(data) {
    console.log(`Event queued for offline sync: ${data.eventName}`);
  }

  /**
   * Handle connection restoration
   */
  async handleConnectionRestored(data) {
    console.log(`Connection restored for user: ${data.userId}`);
    
    // Trigger sync of queued events
    this.emitEvent('system.process_offline_queue', {
      userId: data.userId
    });
  }

  // Utility Methods

  /**
   * Generate unique event ID
   * @private
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID for related events
   * @private
   */
  generateCorrelationId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add event to history
   * @private
   */
  addToHistory(eventName, data) {
    const eventId = data._metadata?.eventId;
    if (eventId) {
      this.eventHistory.set(eventId, { eventName, data, timestamp: new Date() });
      
      // Cleanup old events
      if (this.eventHistory.size > this.maxHistorySize) {
        const oldestKey = this.eventHistory.keys().next().value;
        this.eventHistory.delete(oldestKey);
      }
    }
  }

  /**
   * Update event statistics
   * @private
   */
  updateStats(eventName) {
    const current = this.eventStats.get(eventName) || { count: 0, lastEmitted: null };
    this.eventStats.set(eventName, {
      count: current.count + 1,
      lastEmitted: new Date()
    });
  }

  /**
   * Log event emission
   * @private
   */
  logEvent(eventName, data, success) {
    const level = success ? 'info' : 'error';
    const message = `Event '${eventName}' ${success ? 'emitted' : 'failed'}`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EventBus:${level.toUpperCase()}] ${message}`, {
        eventId: data._metadata?.eventId,
        timestamp: data._metadata?.timestamp,
        source: data._metadata?.source
      });
    }
  }

  /**
   * Get event statistics
   * @returns {Object} Event statistics
   */
  getStats() {
    return {
      totalEvents: Array.from(this.eventStats.values()).reduce((sum, stat) => sum + stat.count, 0),
      uniqueEvents: this.eventStats.size,
      historySize: this.eventHistory.size,
      eventBreakdown: Object.fromEntries(this.eventStats)
    };
  }

  /**
   * Get recent events from history
   * @param {number} limit - Number of recent events to return
   * @returns {Array} Recent events
   */
  getRecentEvents(limit = 50) {
    const events = Array.from(this.eventHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return events;
  }

  /**
   * Clear event history and stats
   */
  clearHistory() {
    this.eventHistory.clear();
    this.eventStats.clear();
    console.log('Event history and statistics cleared');
  }
}

// Create and export singleton instance
const eventBus = new EventBusManager();

module.exports = eventBus;
