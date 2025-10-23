const express = require('express');
const router = express.Router();

// Mock analytics data
router.get('/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalLoans: 150000,
      activeBorrowers: 48,
      repaymentRate: 96.5,
      pendingReviews: 12,
    },
  });
});

router.get('/loans', (req, res) => {
  res.json({
    success: true,
    data: {
      totalDisbursed: 500000,
      averageLoanSize: 25000,
      defaultRate: 3.5,
    },
  });
});

module.exports = router;
