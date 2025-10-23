const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Mock wallet data
router.get('/balance', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: { balance: 50000, currency: 'INR' },
  });
});

router.get('/transactions', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, type: 'credit', amount: 10000, description: 'Loan repayment', date: '2024-10-01' },
      { id: 2, type: 'debit', amount: 25000, description: 'Loan disbursed', date: '2024-09-15' },
    ],
  });
});

module.exports = router;
