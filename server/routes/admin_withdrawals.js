const express = require('express');
const router = express.Router();
const { Campaign } = require('../models');

// Approve a withdrawal and apply it to the campaign
// POST /api/admin/withdrawals/:id/approve
// Body: { campaignId: number, amount: number, note?: string }
router.post('/:id/approve', async (req, res) => {
  try {
    const { campaignId, amount, note } = req.body || {};

    if (!campaignId || !Number.isFinite(Number(amount))) {
      return res.status(400).json({ error: 'campaignId and amount are required' });
    }

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const numericAmount = Number(amount);
    const currentCollected = Number(campaign.collected || 0);
    const nextCollected = Math.max(0, currentCollected - numericAmount);

    // Append to disbursementHistory JSON array
    const existing = Array.isArray(campaign.disbursementHistory) ? campaign.disbursementHistory : [];
    const nextEntry = {
      date: new Date().toISOString(),
      amount: numericAmount,
      purpose: (note || 'Pencairan dana').toString()
    };
    const nextHistory = [...existing, nextEntry];

    campaign.collected = nextCollected;
    campaign.disbursementHistory = nextHistory;

    await campaign.save();

    return res.json({ success: true, campaign: campaign.toJSON() });
  } catch (err) {
    console.error('Error approving withdrawal:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

module.exports = router;
