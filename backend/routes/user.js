const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

router.get('/profile', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({
    success: true,
    data: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      walletAddress: user.walletAddress,
      kycVerified: user.kycVerified,
      faceVerified: user.faceVerified,
    },
  });
});

router.put('/profile', authenticateToken, async (req, res) => {
  const updates = req.body;
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  Object.assign(user, updates);
  await user.save();
  res.json({
    success: true,
    data: user,
  });
});

router.get('/kyc', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({
    success: true,
    data: { verified: user.kycVerified },
  });
});

module.exports = router;
