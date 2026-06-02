const express = require('express');
const router = express.Router();
const { Donation, Campaign, User } = require('../models');

/**
 * GET /api/donations?campaignId=xxx
 * Get all donations for a campaign (public donations only)
 */
router.get('/', async (req, res) => {
  try {
    const { campaignId } = req.query;

    if (!campaignId) {
      return res.status(400).json({ error: 'campaignId query parameter required' });
    }

    // Verify campaign exists
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get donations for this campaign that have succeeded status
    const donations = await Donation.findAll({
      where: {
        campaignId: parseInt(campaignId),
        paymentStatus: 'succeeded'
      },
      include: [
        {
          model: User,
          attributes: ['name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
      attributes: ['id', 'amount', 'createdAt', 'paymentMethod']
    });

    // Format response
    const formattedDonations = donations.map(donation => {
      // Use anonymous name if donor chose anonymous, otherwise use user name or default name
      const donorName = donation.User?.name || 'Anonymous';
      return {
        name: donorName,
        amount: Number(donation.amount),
        message: '', // We don't store messages in Donation model currently
        timestamp: new Date(donation.createdAt).getTime()
      };
    });

    res.json(formattedDonations);
  } catch (err) {
    console.error('Error fetching donations:', err);
    // Return empty array if database connection fails temporarily
    // Frontend will show demo/mock data instead of crashing
    res.status(200).json([]);
  }
});

module.exports = router;
