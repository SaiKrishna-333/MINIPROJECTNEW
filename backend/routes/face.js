const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Face verification (mock)
router.post('/verify', authenticateToken, (req, res) => {
  const { image } = req.body;
  // Mock verification - in real app, integrate with face API
  res.json({
    success: true,
    data: { verified: true, confidence: 0.95 },
  });
});

router.get('/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: { verified: true },
  });
});

module.exports = router;
