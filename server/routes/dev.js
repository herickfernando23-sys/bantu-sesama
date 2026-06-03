const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

// Dev-only route: mark a donation as succeeded immediately (useful for local/demo)
router.post('/mark-donation-succeeded', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not available in production' });
  }

  try {
    const { campaignId, amount, name, email, message } = req.body;
    if (!campaignId || !amount) {
      return res.status(400).json({ error: 'campaignId and amount required' });
    }

    const { User, Donation } = sequelize.models;

    let userId = null;
    if (email) {
      let user = await User.findOne({ where: { email } });
      if (!user) {
        user = await User.create({ name: name || 'Donor', email, password: `dev_${Date.now()}` });
      }
      userId = user.id;
    }

    const donation = await Donation.create({
      campaignId: Number(campaignId),
      userId,
      amount: Number(amount),
      currency: 'IDR',
      paymentStatus: 'succeeded',
      paymentMethod: 'dev',
      donorName: name || (email ? email.split('@')[0] : 'Donor'),
      donorEmail: email || null,
      isAnonymous: false,
      message: message || '',
      processedAt: new Date()
    });

    res.json({ success: true, donationId: donation.id });
  } catch (err) {
    console.error('[Dev] mark-donation-succeeded error:', err);
    res.status(500).json({ error: 'failed to create donation' });
  }
});

module.exports = router;
