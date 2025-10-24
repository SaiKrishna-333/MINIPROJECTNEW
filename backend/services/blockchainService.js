const { Web3 } = require('web3');
const { v4: uuidv4 } = require('uuid');

/**
 * BlockchainService - Handles all blockchain interactions for RuralConnect P2P platform
 * Supports Polygon Mumbai testnet and local blockchain for development
 * Manages smart contract interactions for loan lifecycle and payments
 */
class BlockchainService {
  constructor() {
    this.networkConfig = {
      polygon_mumbai: {
        rpcUrl: process.env.POLYGON_MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com/',
        chainId: 80001,
        name: 'Polygon Mumbai Testnet',
        currency: 'MATIC',
        blockExplorer: 'https://mumbai.polygonscan.com'
      },
      polygon_mainnet: {
        rpcUrl: process.env.POLYGON_MAINNET_RPC_URL || 'https://polygon-rpc.com/',
        chainId: 137,
        name: 'Polygon Mainnet',
        currency: 'MATIC',
        blockExplorer: 'https://polygonscan.com'
      },
      local: {
        rpcUrl: 'http://127.0.0.1:8545',
        chainId: 1337,
        name: 'Local Blockchain',
        currency: 'ETH',
        blockExplorer: null
      }
    };

    this.currentNetwork = process.env.BLOCKCHAIN_NETWORK || 'polygon_mumbai';
    this.mockMode = process.env.BLOCKCHAIN_MOCK_MODE === 'true';
    
    if (!this.mockMode) {
      this.initializeWeb3();
    } else {
      this.mockTransactions = new Map();
      console.log('BlockchainService initialized in MOCK mode');
    }

    // Smart contract ABIs (simplified for demo)
    this.contractABIs = {
      loanContract: [
        {
          "inputs": [
            {"type": "uint256", "name": "loanId"},
            {"type": "address", "name": "borrower"},
            {"type": "address", "name": "lender"},
            {"type": "uint256", "name": "amount"},
            {"type": "uint256", "name": "interestRate"},
            {"type": "uint256", "name": "duration"}
          ],
          "name": "createLoan",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {"type": "uint256", "name": "loanId"},
            {"type": "uint256", "name": "amount"}
          ],
          "name": "makeRepayment",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [{"type": "uint256", "name": "loanId"}],
          "name": "approveLoan",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [{"type": "uint256", "name": "loanId"}],
          "name": "getLoanDetails",
          "outputs": [
            {"type": "address", "name": "borrower"},
            {"type": "address", "name": "lender"},
            {"type": "uint256", "name": "amount"},
            {"type": "uint256", "name": "repaidAmount"},
            {"type": "uint256", "name": "interestRate"},
            {"type": "bool", "name": "isActive"},
            {"type": "bool", "name": "isApproved"}
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      documentContract: [
        {
          "inputs": [
            {"type": "string", "name": "documentHash"},
            {"type": "address", "name": "owner"},
            {"type": "string", "name": "documentType"}
          ],
          "name": "storeDocument",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [{"type": "string", "name": "documentHash"}],
          "name": "verifyDocument",
          "outputs": [{"type": "bool", "name": ""}],
          "stateMutability": "view",
          "type": "function"
        }
      ]
    };

    // Contract addresses (set via environment variables)
    this.contractAddresses = {
      loanContract: process.env.LOAN_CONTRACT_ADDRESS,
      documentContract: process.env.DOCUMENT_CONTRACT_ADDRESS
    };
  }

  /**
   * Initialize Web3 connection
   * @private
   */
  initializeWeb3() {
    try {
      const networkInfo = this.networkConfig[this.currentNetwork];
      this.web3 = new Web3(networkInfo.rpcUrl);
      
      // Set up account from private key if provided
      if (process.env.BLOCKCHAIN_PRIVATE_KEY) {
        const account = this.web3.eth.accounts.privateKeyToAccount(process.env.BLOCKCHAIN_PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(account);
        this.defaultAccount = account.address;
      }

      console.log(`BlockchainService connected to ${networkInfo.name}`);
    } catch (error) {
      console.error('Failed to initialize Web3:', error);
      this.mockMode = true;
      console.log('Falling back to MOCK mode');
    }
  }

  /**
   * Create a new loan on blockchain
   * @param {Object} loanData - Loan details
   * @returns {Promise<Object>} Transaction result
   */
  async createLoan(loanData) {
    try {
      const { loanId, borrowerAddress, lenderAddress, amount, interestRate, duration } = loanData;

      if (this.mockMode) {
        return this._createMockTransaction('createLoan', loanData);
      }

      if (!this.contractAddresses.loanContract) {
        throw new Error('Loan contract address not configured');
      }

      const contract = new this.web3.eth.Contract(
        this.contractABIs.loanContract, 
        this.contractAddresses.loanContract
      );

      const gasEstimate = await contract.methods
        .createLoan(loanId, borrowerAddress, lenderAddress, amount, interestRate, duration)
        .estimateGas({ from: this.defaultAccount });

      const tx = await contract.methods
        .createLoan(loanId, borrowerAddress, lenderAddress, amount, interestRate, duration)
        .send({
          from: this.defaultAccount,
          gas: Math.floor(gasEstimate * 1.2), // 20% buffer
          gasPrice: await this.web3.eth.getGasPrice()
        });

      return {
        success: true,
        txHash: tx.transactionHash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        contractAddress: this.contractAddresses.loanContract,
        network: this.currentNetwork,
        operation: 'createLoan',
        loanId
      };

    } catch (error) {
      console.error('Error creating loan on blockchain:', error);
      throw new Error(`Blockchain loan creation failed: ${error.message}`);
    }
  }

  /**
   * Approve a loan on blockchain
   * @param {string|number} loanId - Loan ID
   * @param {string} lenderAddress - Lender's address
   * @returns {Promise<Object>} Transaction result
   */
  async approveLoan(loanId, lenderAddress) {
    try {
      if (this.mockMode) {
        return this._createMockTransaction('approveLoan', { loanId, lenderAddress });
      }

      const contract = new this.web3.eth.Contract(
        this.contractABIs.loanContract, 
        this.contractAddresses.loanContract
      );

      const tx = await contract.methods
        .approveLoan(loanId)
        .send({
          from: lenderAddress || this.defaultAccount,
          gas: 100000
        });

      return {
        success: true,
        txHash: tx.transactionHash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        operation: 'approveLoan',
        loanId
      };

    } catch (error) {
      console.error('Error approving loan on blockchain:', error);
      throw new Error(`Blockchain loan approval failed: ${error.message}`);
    }
  }

  /**
   * Process loan repayment on blockchain
   * @param {Object} repaymentData - Repayment details
   * @returns {Promise<Object>} Transaction result
   */
  async processRepayment(repaymentData) {
    try {
      const { loanId, amount, borrowerAddress, paymentId } = repaymentData;

      if (this.mockMode) {
        return this._createMockTransaction('makeRepayment', repaymentData);
      }

      const contract = new this.web3.eth.Contract(
        this.contractABIs.loanContract, 
        this.contractAddresses.loanContract
      );

      // Convert amount to Wei (assuming amount is in ETH/MATIC)
      const amountInWei = this.web3.utils.toWei(amount.toString(), 'ether');

      const tx = await contract.methods
        .makeRepayment(loanId, amountInWei)
        .send({
          from: borrowerAddress || this.defaultAccount,
          value: amountInWei,
          gas: 150000
        });

      return {
        success: true,
        txHash: tx.transactionHash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        operation: 'makeRepayment',
        loanId,
        amount: amount,
        paymentId
      };

    } catch (error) {
      console.error('Error processing repayment on blockchain:', error);
      throw new Error(`Blockchain repayment failed: ${error.message}`);
    }
  }

  /**
   * Store document hash on blockchain
   * @param {Object} documentData - Document details
   * @returns {Promise<Object>} Transaction result
   */
  async storeDocumentHash(documentData) {
    try {
      const { documentHash, ownerAddress, documentType } = documentData;

      if (this.mockMode) {
        return this._createMockTransaction('storeDocument', documentData);
      }

      if (!this.contractAddresses.documentContract) {
        throw new Error('Document contract address not configured');
      }

      const contract = new this.web3.eth.Contract(
        this.contractABIs.documentContract, 
        this.contractAddresses.documentContract
      );

      const tx = await contract.methods
        .storeDocument(documentHash, ownerAddress, documentType)
        .send({
          from: this.defaultAccount,
          gas: 100000
        });

      return {
        success: true,
        txHash: tx.transactionHash,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        operation: 'storeDocument',
        documentHash,
        documentType
      };

    } catch (error) {
      console.error('Error storing document on blockchain:', error);
      throw new Error(`Blockchain document storage failed: ${error.message}`);
    }
  }

  /**
   * Get loan details from blockchain
   * @param {string|number} loanId - Loan ID
   * @returns {Promise<Object>} Loan details
   */
  async getLoanDetails(loanId) {
    try {
      if (this.mockMode) {
        return this._getMockLoanDetails(loanId);
      }

      const contract = new this.web3.eth.Contract(
        this.contractABIs.loanContract, 
        this.contractAddresses.loanContract
      );

      const result = await contract.methods.getLoanDetails(loanId).call();

      return {
        borrower: result[0],
        lender: result[1],
        amount: this.web3.utils.fromWei(result[2], 'ether'),
        repaidAmount: this.web3.utils.fromWei(result[3], 'ether'),
        interestRate: parseInt(result[4]),
        isActive: result[5],
        isApproved: result[6],
        loanId
      };

    } catch (error) {
      console.error('Error fetching loan details from blockchain:', error);
      throw new Error(`Failed to fetch loan details: ${error.message}`);
    }
  }

  /**
   * Verify document hash on blockchain
   * @param {string} documentHash - Document hash to verify
   * @returns {Promise<boolean>} Verification result
   */
  async verifyDocumentHash(documentHash) {
    try {
      if (this.mockMode) {
        return Math.random() > 0.1; // 90% success rate in mock mode
      }

      const contract = new this.web3.eth.Contract(
        this.contractABIs.documentContract, 
        this.contractAddresses.documentContract
      );

      const isVerified = await contract.methods.verifyDocument(documentHash).call();
      return isVerified;

    } catch (error) {
      console.error('Error verifying document on blockchain:', error);
      return false;
    }
  }

  /**
   * Get transaction receipt
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction receipt
   */
  async getTransactionReceipt(txHash) {
    try {
      if (this.mockMode) {
        const mockTx = this.mockTransactions.get(txHash);
        return mockTx || null;
      }

      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      return receipt;

    } catch (error) {
      console.error('Error fetching transaction receipt:', error);
      return null;
    }
  }

  /**
   * Get current gas price
   * @returns {Promise<string>} Gas price in Wei
   */
  async getGasPrice() {
    try {
      if (this.mockMode) {
        return '20000000000'; // 20 Gwei
      }

      return await this.web3.eth.getGasPrice();
    } catch (error) {
      console.error('Error fetching gas price:', error);
      return '20000000000'; // Fallback to 20 Gwei
    }
  }

  /**
   * Get network info
   * @returns {Object} Network information
   */
  getNetworkInfo() {
    return {
      ...this.networkConfig[this.currentNetwork],
      mockMode: this.mockMode,
      currentNetwork: this.currentNetwork,
      defaultAccount: this.defaultAccount
    };
  }

  // Private mock methods

  /**
   * Create mock blockchain transaction
   * @private
   */
  _createMockTransaction(operation, data) {
    const txHash = `0x${uuidv4().replace(/-/g, '')}`;
    const mockTx = {
      success: true,
      txHash,
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      gasUsed: Math.floor(Math.random() * 50000) + 21000,
      operation,
      data,
      timestamp: Date.now(),
      network: 'mock',
      status: 'success'
    };

    this.mockTransactions.set(txHash, mockTx);
    
    // Simulate blockchain delay
    setTimeout(() => {
      console.log(`Mock blockchain transaction confirmed: ${txHash}`);
    }, 2000);

    return mockTx;
  }

  /**
   * Get mock loan details
   * @private
   */
  _getMockLoanDetails(loanId) {
    return {
      borrower: `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`,
      lender: `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`,
      amount: Math.floor(Math.random() * 100000) + 10000,
      repaidAmount: Math.floor(Math.random() * 50000),
      interestRate: Math.floor(Math.random() * 20) + 5,
      isActive: true,
      isApproved: Math.random() > 0.3,
      loanId
    };
  }

  /**
   * Generate test wallet address
   * @returns {string} Test wallet address
   */
  generateTestAddress() {
    if (!this.mockMode && this.web3) {
      return this.web3.eth.accounts.create().address;
    }
    return `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`;
  }
}

module.exports = new BlockchainService();
