const twilio = require('twilio');

/**
 * TwilioService - Handles SMS notifications via Twilio API
 * Supports both live Twilio API and mock mode for testing
 * Integrates with notification system for comprehensive messaging
 */
class TwilioService {
  constructor() {
    this.mockMode = process.env.TWILIO_MOCK_MODE === 'true' || !process.env.TWILIO_ACCOUNT_SID;
    
    if (!this.mockMode) {
      this.initializeTwilio();
    }
    
    // Mock message storage for testing
    this.mockMessages = new Map();
    this.mockDeliveryReports = new Map();
    
    // SMS templates for different notification types
    this.smsTemplates = {
      loan_approved: 'Great news! Your loan application for ₹{amount} has been approved. Loan ID: {loanId}. Check your RuralConnect app for details.',
      loan_rejected: 'Your loan application for ₹{amount} has been declined. Loan ID: {loanId}. Contact support for assistance.',
      payment_successful: 'Payment successful! ₹{amount} received for Loan {loanId}. Transaction ID: {transactionId}. Thank you!',
      payment_failed: 'Payment of ₹{amount} for Loan {loanId} failed. Please try again or contact support. Transaction ID: {transactionId}',
      repayment_due: 'Reminder: Your EMI of ₹{amount} for Loan {loanId} is due on {dueDate}. Please make payment to avoid penalties.',
      repayment_overdue: 'URGENT: Your EMI of ₹{amount} for Loan {loanId} is overdue. Please pay immediately to avoid additional charges.',
      document_verified: 'Document verification successful for Loan {loanId}. Your application is now being processed.',
      document_rejected: 'Document verification failed for Loan {loanId}. Please upload correct documents in the RuralConnect app.',
      loan_completed: 'Congratulations! You have successfully completed Loan {loanId}. Thank you for using RuralConnect.',
      welcome: 'Welcome to RuralConnect! Your account has been created successfully. Start your lending journey today.',
      kyc_reminder: 'Complete your KYC verification to unlock full RuralConnect features. Visit the app to continue.',
      security_alert: 'Security Alert: Suspicious activity detected on your RuralConnect account. Contact support immediately if this wasn\'t you.'
    };
    
    console.log(`TwilioService initialized in ${this.mockMode ? 'MOCK' : 'LIVE'} mode`);
  }

  /**
   * Initialize Twilio client
   * @private
   */
  initializeTwilio() {
    try {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (!this.fromNumber) {
        throw new Error('TWILIO_PHONE_NUMBER is required');
      }
      
      console.log('Twilio client initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Twilio:', error);
      this.mockMode = true;
      console.log('Falling back to MOCK mode');
    }
  }

  /**
   * Send SMS notification
   * @param {Object} smsData - SMS details
   * @param {string} smsData.to - Recipient phone number (with country code)
   * @param {string} smsData.message - SMS message body
   * @param {string} smsData.type - Notification type (optional, for template usage)
   * @param {Object} smsData.variables - Template variables (optional)
   * @param {Object} smsData.options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendSMS(smsData) {
    try {
      const { to, message, type, variables = {}, options = {} } = smsData;

      if (!to) {
        throw new Error('Recipient phone number is required');
      }

      // Validate and format phone number
      const formattedNumber = this._formatPhoneNumber(to);
      
      // Use template if type is provided and no custom message
      let finalMessage = message;
      if (!message && type && this.smsTemplates[type]) {
        finalMessage = this._processTemplate(this.smsTemplates[type], variables);
      }

      if (!finalMessage) {
        throw new Error('Message content is required');
      }

      // Validate message length (SMS limit is typically 160 characters for single SMS)
      if (finalMessage.length > 1600) { // Allow up to 10 concatenated SMS
        throw new Error('Message too long (maximum 1600 characters)');
      }

      if (this.mockMode) {
        return this._sendMockSMS(smsData, formattedNumber, finalMessage);
      }

      // Send via Twilio
      const twilioOptions = {
        body: finalMessage,
        from: this.fromNumber,
        to: formattedNumber
      };

      // Add optional parameters
      if (options.mediaUrl) {
        twilioOptions.mediaUrl = Array.isArray(options.mediaUrl) ? options.mediaUrl : [options.mediaUrl];
      }

      if (options.statusCallback) {
        twilioOptions.statusCallback = options.statusCallback;
      }

      if (options.validityPeriod) {
        twilioOptions.validityPeriod = options.validityPeriod;
      }

      const message_instance = await this.client.messages.create(twilioOptions);

      return {
        success: true,
        messageId: message_instance.sid,
        to: formattedNumber,
        from: this.fromNumber,
        body: finalMessage,
        status: message_instance.status,
        price: message_instance.price,
        priceUnit: message_instance.priceUnit,
        numSegments: message_instance.numSegments,
        direction: message_instance.direction,
        dateCreated: message_instance.dateCreated,
        provider: 'twilio',
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error sending SMS:', error);
      
      // Handle specific Twilio errors
      if (error.code === 21211) {
        throw new Error('Invalid phone number format');
      } else if (error.code === 21408) {
        throw new Error('Permission denied to send SMS to this number');
      } else if (error.code === 21614) {
        throw new Error('Invalid phone number - not a mobile number');
      }
      
      throw new Error(`SMS sending failed: ${error.message}`);
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   * @param {Object} bulkSmsData - Bulk SMS details
   * @param {string[]} bulkSmsData.recipients - Array of phone numbers
   * @param {string} bulkSmsData.message - SMS message body
   * @param {string} bulkSmsData.type - Notification type (optional)
   * @param {Object} bulkSmsData.variables - Template variables (optional)
   * @param {Object} bulkSmsData.options - Additional options
   * @returns {Promise<Object>} Bulk send results
   */
  async sendBulkSMS(bulkSmsData) {
    try {
      const { recipients, message, type, variables = {}, options = {} } = bulkSmsData;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('Recipients array is required and must not be empty');
      }

      if (recipients.length > 1000) {
        throw new Error('Maximum 1000 recipients allowed per bulk SMS');
      }

      const results = [];
      const batchSize = options.batchSize || 50; // Process in batches to avoid rate limits
      
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const batchPromises = batch.map(async (recipient) => {
          try {
            const result = await this.sendSMS({
              to: recipient,
              message,
              type,
              variables: { ...variables, phoneNumber: recipient },
              options
            });
            return { recipient, success: true, result };
          } catch (error) {
            return { 
              recipient, 
              success: false, 
              error: {
                message: error.message,
                code: error.code
              }
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches to respect rate limits
        if (i + batchSize < recipients.length) {
          await this._delay(1000); // 1 second delay
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      return {
        success: true,
        totalRecipients: recipients.length,
        successCount,
        failureCount,
        results,
        provider: 'twilio',
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      throw new Error(`Bulk SMS failed: ${error.message}`);
    }
  }

  /**
   * Get SMS delivery status
   * @param {string} messageId - Twilio message SID
   * @returns {Promise<Object>} Delivery status
   */
  async getDeliveryStatus(messageId) {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }

      if (this.mockMode) {
        return this._getMockDeliveryStatus(messageId);
      }

      const message = await this.client.messages(messageId).fetch();

      return {
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        price: message.price,
        priceUnit: message.priceUnit,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        dateSent: message.dateSent,
        provider: 'twilio'
      };

    } catch (error) {
      console.error('Error fetching delivery status:', error);
      throw new Error(`Failed to fetch delivery status: ${error.message}`);
    }
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {Promise<Object>} Validation result
   */
  async validatePhoneNumber(phoneNumber) {
    try {
      if (!phoneNumber) {
        return { valid: false, error: 'Phone number is required' };
      }

      const formattedNumber = this._formatPhoneNumber(phoneNumber);

      if (this.mockMode) {
        return {
          valid: formattedNumber.match(/^\+\d{10,15}$/) !== null,
          formattedNumber,
          provider: 'mock'
        };
      }

      // Use Twilio Lookup API to validate phone number
      const lookupClient = this.client.lookups.phoneNumbers(formattedNumber);
      const result = await lookupClient.fetch();

      return {
        valid: true,
        phoneNumber: result.phoneNumber,
        countryCode: result.countryCode,
        nationalFormat: result.nationalFormat,
        carrier: result.carrier,
        provider: 'twilio'
      };

    } catch (error) {
      if (error.status === 404) {
        return { valid: false, error: 'Invalid phone number' };
      }
      
      console.error('Error validating phone number:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get available SMS templates
   * @returns {Object} Available templates
   */
  getTemplates() {
    return { ...this.smsTemplates };
  }

  /**
   * Add or update SMS template
   * @param {string} type - Template type
   * @param {string} template - Template content with variables in {variable} format
   * @returns {boolean} Success status
   */
  addTemplate(type, template) {
    try {
      if (!type || !template) {
        throw new Error('Type and template are required');
      }

      this.smsTemplates[type] = template;
      return true;
    } catch (error) {
      console.error('Error adding template:', error);
      return false;
    }
  }

  // Private utility methods

  /**
   * Format phone number to international format
   * @private
   */
  _formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned; // Default to India
    }
    
    // Add + prefix
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Process template with variables
   * @private
   */
  _processTemplate(template, variables) {
    let processed = template;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g');
      processed = processed.replace(regex, variables[key] || '');
    });
    
    return processed;
  }

  /**
   * Add delay for rate limiting
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Private mock methods

  /**
   * Send mock SMS
   * @private
   */
  _sendMockSMS(smsData, formattedNumber, finalMessage) {
    const messageId = `SM${Date.now()}${Math.random().toString(36).substr(2, 24)}`;
    
    const mockResult = {
      success: Math.random() > 0.02, // 98% success rate
      messageId,
      to: formattedNumber,
      from: '+1234567890',
      body: finalMessage,
      status: 'queued',
      price: '-0.0075',
      priceUnit: 'USD',
      numSegments: Math.ceil(finalMessage.length / 160),
      direction: 'outbound-api',
      dateCreated: new Date(),
      provider: 'twilio_mock',
      sentAt: new Date().toISOString()
    };

    // Store mock message
    this.mockMessages.set(messageId, {
      ...smsData,
      ...mockResult,
      sentAt: new Date()
    });

    // Simulate delivery status update
    setTimeout(() => {
      this.mockDeliveryReports.set(messageId, {
        ...mockResult,
        status: Math.random() > 0.05 ? 'delivered' : 'failed',
        dateSent: new Date(),
        dateUpdated: new Date()
      });
    }, 2000);

    return mockResult;
  }

  /**
   * Get mock delivery status
   * @private
   */
  _getMockDeliveryStatus(messageId) {
    const deliveryReport = this.mockDeliveryReports.get(messageId);
    const originalMessage = this.mockMessages.get(messageId);
    
    if (!originalMessage) {
      throw new Error('Message not found');
    }

    return deliveryReport || {
      messageId,
      status: 'sent',
      ...originalMessage,
      provider: 'twilio_mock'
    };
  }

  /**
   * Generate test phone number
   * @returns {string} Test phone number
   */
  generateTestPhoneNumber() {
    const randomNum = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `+91${randomNum}`;
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      mockMode: this.mockMode,
      fromNumber: this.fromNumber,
      provider: 'twilio',
      mockMessagesCount: this.mockMessages.size,
      templatesCount: Object.keys(this.smsTemplates).length
    };
  }
}

module.exports = new TwilioService();
