const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Loan = require('../models/Loan');
const User = require('../models/User');
const axios = require('axios');
const { enhancedMatching, Borrower, Lender } = require('../utils/matching');
const { LoanFSM } = require('../utils/loanFSM');

const payuKey = process.env.PAYU_KEY;
const payuSalt = process.env.PAYU_SALT;
const payuMerchantId = process.env.PAYU_MERCHANT_ID;

// Create loan
router.post('/create', authenticateToken, async (req, res) => {
  const { amount, duration, interestRate, purpose } = req.body;
  const userId = req.user.id;

  if (!amount || !duration || !interestRate || !purpose) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  const newLoan = new Loan({
    borrowerId: userId,
    amount,
    duration,
    interestRate,
    purpose,
  });

  await newLoan.save();
  res.json({
    success: true,
    data: newLoan,
  });
});

// Get all loans
router.get('/', async (req, res) => {
  const { status, borrowerId } = req.query;
  let query = {};

  if (status) query.status = status;
  if (borrowerId) query.borrowerId = borrowerId;

  const loans = await Loan.find(query).populate('borrowerId', 'fullName email');
  res.json({
    success: true,
    data: loans,
  });
});

// Get loan by ID
router.get('/:id', async (req, res) => {
  const loan = await Loan.findById(req.params.id).populate('borrowerId', 'fullName email');
  if (!loan) {
    return res.status(404).json({ success: false, error: 'Loan not found' });
  }

  res.json({
    success: true,
    data: loan,
  });
});

// Get loans by borrower ID
router.get('/borrower/:borrowerId', async (req, res) => {
  const borrowerLoans = await Loan.find({ borrowerId: req.params.borrowerId }).populate('borrowerId', 'fullName email');
  res.json({
    success: true,
    data: borrowerLoans,
  });
});

// Disburse loan (PayU payment)
router.post('/:id/disburse', authenticateToken, async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan || loan.status !== 'Pending') {
    return res.status(400).json({ success: false, error: 'Invalid loan' });
  }

  const hash = require('crypto').createHash('sha512').update(`${payuKey}|${loan._id}|${loan.amount}|Loan Disbursement|Borrower|borrower@example.com|||||||||||${payuSalt}`).digest('hex');

  const response = await axios.post('https://test.payu.in/_payment', {
    key: payuKey,
    txnid: loan._id,
    amount: loan.amount,
    productinfo: 'Loan Disbursement',
    firstname: 'Borrower',
    email: 'borrower@example.com',
    phone: '9999999999',
    hash,
    surl: 'http://localhost:8080/success',
    furl: 'http://localhost:8080/failure',
  });

  loan.paymentStatus = 'Disbursed';
  loan.status = 'Active';
  await loan.save();

  res.json({ success: true, paymentUrl: response.data });
});

// Repay loan (PayU payment)
router.post('/:id/repay-payment', authenticateToken, async (req, res) => {
  const { amount } = req.body;
  const loan = await Loan.findById(req.params.id);

  if (!loan || loan.status !== 'Active') {
    return res.status(400).json({ success: false, error: 'Loan not active' });
  }

  const hash = require('crypto').createHash('sha512').update(`${payuKey}|${loan._id}_repay|${amount}|Loan Repayment|Borrower|borrower@example.com|||||||||||${payuSalt}`).digest('hex');

  const response = await axios.post('https://test.payu.in/_payment', {
    key: payuKey,
    txnid: `${loan._id}_repay`,
    amount,
    productinfo: 'Loan Repayment',
    firstname: 'Borrower',
    email: 'borrower@example.com',
    phone: '9999999999',
    hash,
    surl: 'http://localhost:8080/success',
    furl: 'http://localhost:8080/failure',
  });

  loan.repaidAmount += amount;
  const totalOwed = loan.amount + (loan.amount * loan.interestRate / 100);
  if (loan.repaidAmount >= totalOwed) {
    loan.status = 'Completed';
    loan.paymentStatus = 'Repaid';
  }

  await loan.save();
  res.json({ success: true, paymentUrl: response.data });
});

// Repay loan (existing)
router.post('/:id/repay', authenticateToken, async (req, res) => {
  const { amount } = req.body;
  const loan = await Loan.findById(req.params.id);

  if (!loan) {
    return res.status(404).json({ success: false, error: 'Loan not found' });
  }

  loan.repaidAmount += amount;

  const totalOwed = loan.amount + (loan.amount * loan.interestRate / 100);
  if (loan.repaidAmount >= totalOwed) {
    loan.status = 'Completed';
  }

  await loan.save();
  res.json({
    success: true,
    data: loan,
  });
});

module.exports = router;
