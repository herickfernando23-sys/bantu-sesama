const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { Donation, Campaign, User } = require('../models');
const recurringService = require('../services/recurringPaymentService');

/**
 * POST /api/recurring/setup
 * Setup a new recurring donation
 * Body: { campaignId, amount, recurringType (monthly/yearly), donorName, donorEmail, paymentMethod, message }
 */
router.post('/setup', optionalAuth, async (req, res) => {
  try {
    const {
      campaignId,
      amount,
      recurringType = 'monthly',
      donorName,
      donorEmail,
      paymentMethod = 'bank_transfer',
      isAnonymous = false,
      message = ''
    } = req.body;

    // Validation
    if (!['monthly', 'yearly'].includes(recurringType)) {
      return res.status(400).json({ error: 'recurringType harus monthly atau yearly' });
    }

    if (!amount || Number(amount) < 50000) {
      return res.status(400).json({ error: 'Nominal donasi rutin minimal Rp 50.000' });
    }

    if (!donorName || !donorName.trim()) {
      return res.status(400).json({ error: 'Nama donor harus diisi' });
    }

    if (!donorEmail || !donorEmail.trim()) {
      return res.status(400).json({ error: 'Email donor harus diisi' });
    }

    // Validate campaign exists
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get or create user if not logged in
    let userId = req.user?.id || null;
    if (!userId) {
      let donorUser = await User.findOne({ where: { email: donorEmail } });
      if (!donorUser) {
        donorUser = await User.create({
          name: donorName || 'Donor',
          email: donorEmail,
          password: `donor_${Date.now()}`
        });
      }
      userId = donorUser.id;
    }

    // Create recurring donation record
    const recurringDonation = await Donation.create({
      campaignId,
      userId,
      amount: Number(amount),
      currency: 'IDR',
      paymentStatus: 'pending',
      paymentMethod,
      recurringType, // monthly atau yearly
      donorName: isAnonymous ? 'Anonymous' : donorName,
      donorEmail,
      isAnonymous,
      message,
      processedAt: new Date() // Initial charge immediately
    });

    console.log(`[Recurring] Setup recurring donation ${recurringDonation.id} for campaign ${campaignId}`);

    // Generate initial transaction token untuk first charge
    const numericAmount = Math.round(Number(amount));
    const transactionDetails = {
      order_id: `RECURRING-INIT-${recurringDonation.id}`,
      gross_amount: numericAmount
    };

    const customerDetails = {
      first_name: isAnonymous ? 'Anonymous' : donorName.split(' ')[0],
      last_name: isAnonymous ? 'Donor' : (donorName.split(' ').slice(1).join(' ') || ''),
      email: donorEmail,
      phone: '08111111111'
    };

    const itemName = `Donasi Rutin ${recurringType} - ${campaign.title}`.slice(0, 50);
    const itemDetails = [
      {
        id: `recurring_${campaignId}`,
        price: numericAmount,
        quantity: 1,
        name: itemName
      }
    ];

    const parameter = {
      transaction_details: transactionDetails,
      customer_details: customerDetails,
      item_details: itemDetails,
      enabled_payments: ['bank_transfer', 'gopay', 'shopeepay', 'credit_card'],
      custom_field1: `Recurring ${recurringType} - ${isAnonymous ? 'Anonymous' : donorName}`,
      custom_field2: `Campaign: ${campaign.title}`
    };

    Object.keys(parameter).forEach(key => parameter[key] === undefined && delete parameter[key]);

    try {
      const midtransClient = require('midtrans-client');
      const snap = new midtransClient.Snap({
        isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true',
        serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-xxxxxx',
        clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-xxxxxx'
      });

      const transaction = await snap.createTransaction(parameter);
      const transactionToken = transaction.token;

      if (!transactionToken) {
        return res.status(500).json({ error: 'Gagal mendapatkan token pembayaran dari Midtrans' });
      }

      // Store transaction details
      recurringDonation.midtransTransactionId = `RECURRING-INIT-${recurringDonation.id}`;
      recurringDonation.midtransTransactionToken = transactionToken;
      await recurringDonation.save();

      res.json({
        success: true,
        recurringDonationId: recurringDonation.id,
        transactionToken,
        orderId: `RECURRING-INIT-${recurringDonation.id}`,
        amount: numericAmount,
        recurringType,
        campaignTitle: campaign.title,
        message: `Pengaturan donasi rutin ${recurringType} berhasil. Silakan lakukan pembayaran untuk charge pertama.`
      });

    } catch (midtransErr) {
      console.error('[Recurring] Midtrans error:', midtransErr);
      recurringDonation.paymentStatus = 'failed';
      recurringDonation.failureReason = midtransErr.message;
      await recurringDonation.save();
      
      return res.status(500).json({ error: 'Gagal membuat transaksi Midtrans: ' + midtransErr.message });
    }

  } catch (error) {
    console.error('[Recurring] Setup error:', error);
    res.status(500).json({ error: error.message || 'Failed to setup recurring donation' });
  }
});

/**
 * GET /api/recurring/list
 * Get user's recurring donations
 * Requires auth
 */
router.get('/list', auth, async (req, res) => {
  try {
    const recurringDonations = await Donation.findAll({
      where: {
        userId: req.user.id,
        recurringType: ['monthly', 'yearly']
      },
      include: [
        {
          model: Campaign,
          attributes: ['id', 'title', 'collected', 'goal', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Format response
    const formatted = recurringDonations.map(d => ({
      id: d.id,
      campaignId: d.campaignId,
      campaignTitle: d.Campaign?.title,
      amount: Number(d.amount),
      recurringType: d.recurringType,
      paymentStatus: d.paymentStatus,
      paymentMethod: d.paymentMethod,
      message: d.message,
      createdAt: d.createdAt,
      processedAt: d.processedAt,
      nextChargeEstimate: getNextChargeDate(d.processedAt, d.recurringType)
    }));

    res.json({
      success: true,
      recurringDonations: formatted,
      totalMonthly: formatted.filter(d => d.recurringType === 'monthly').reduce((sum, d) => sum + d.amount, 0),
      totalYearly: formatted.filter(d => d.recurringType === 'yearly').reduce((sum, d) => sum + d.amount, 0)
    });

  } catch (error) {
    console.error('[Recurring] List error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recurring/details/:recurringDonationId
 * Get specific recurring donation details
 */
router.get('/details/:recurringDonationId', auth, async (req, res) => {
  try {
    const { recurringDonationId } = req.params;

    const donation = await Donation.findByPk(recurringDonationId, {
      include: [
        { model: Campaign, attributes: ['id', 'title', 'collected', 'goal'] },
        { 
          model: Donation, 
          as: 'ChargedDonations',
          where: { parentRecurringDonationId: recurringDonationId },
          required: false,
          attributes: ['id', 'amount', 'paymentStatus', 'createdAt']
        }
      ]
    });

    if (!donation) {
      return res.status(404).json({ error: 'Recurring donation not found' });
    }

    if (donation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      donation: {
        id: donation.id,
        campaignId: donation.campaignId,
        campaignTitle: donation.Campaign?.title,
        amount: Number(donation.amount),
        recurringType: donation.recurringType,
        paymentStatus: donation.paymentStatus,
        paymentMethod: donation.paymentMethod,
        donorName: donation.donorName,
        donorEmail: donation.donorEmail,
        isAnonymous: donation.isAnonymous,
        message: donation.message,
        createdAt: donation.createdAt,
        processedAt: donation.processedAt,
        nextChargeEstimate: getNextChargeDate(donation.processedAt, donation.recurringType)
      },
      chargeHistory: (donation.ChargedDonations || []).map(c => ({
        id: c.id,
        amount: Number(c.amount),
        status: c.paymentStatus,
        chargedAt: c.createdAt
      }))
    });

  } catch (error) {
    console.error('[Recurring] Details error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recurring/cancel/:recurringDonationId
 * Cancel a recurring donation
 */
router.post('/cancel/:recurringDonationId', auth, async (req, res) => {
  try {
    const { recurringDonationId } = req.params;

    const donation = await Donation.findByPk(recurringDonationId);

    if (!donation) {
      return res.status(404).json({ error: 'Recurring donation not found' });
    }

    if (donation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!['monthly', 'yearly'].includes(donation.recurringType)) {
      return res.status(400).json({ error: 'Not a recurring donation' });
    }

    // Cancel by marking as inactive
    donation.recurringType = 'one-time';
    donation.paymentStatus = 'refunded'; // atau buat enum baru untuk 'cancelled'
    donation.message = (donation.message || '') + ' [CANCELLED]';
    await donation.save();

    console.log(`[Recurring] Cancelled recurring donation ${recurringDonationId} for user ${req.user.id}`);

    res.json({
      success: true,
      message: `Donasi rutin dibatalkan. Charge berikutnya tidak akan dilakukan.`
    });

  } catch (error) {
    console.error('[Recurring] Cancel error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/recurring/update/:recurringDonationId
 * Update recurring donation amount or frequency
 */
router.put('/update/:recurringDonationId', auth, async (req, res) => {
  try {
    const { recurringDonationId } = req.params;
    const { amount, recurringType } = req.body;

    const donation = await Donation.findByPk(recurringDonationId);

    if (!donation) {
      return res.status(404).json({ error: 'Recurring donation not found' });
    }

    if (donation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!['monthly', 'yearly'].includes(donation.recurringType)) {
      return res.status(400).json({ error: 'Not a recurring donation' });
    }

    // Update amount if provided
    if (amount && Number(amount) >= 50000) {
      donation.amount = Number(amount);
    }

    // Update recurring type if provided
    if (recurringType && ['monthly', 'yearly'].includes(recurringType)) {
      donation.recurringType = recurringType;
    }

    await donation.save();

    console.log(`[Recurring] Updated recurring donation ${recurringDonationId}`);

    res.json({
      success: true,
      message: 'Donasi rutin berhasil diperbarui',
      donation: {
        id: donation.id,
        amount: Number(donation.amount),
        recurringType: donation.recurringType
      }
    });

  } catch (error) {
    console.error('[Recurring] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recurring/process-now (Admin only)
 * Trigger recurring donation processing immediately (for testing)
 */
router.post('/process-now', async (req, res) => {
  try {
    // Check if admin key provided (basic security)
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    if (adminKey !== process.env.ADMIN_PROCESS_KEY) {
      return res.status(403).json({ error: 'Unauthorized - invalid admin key' });
    }

    const result = await recurringService.processRecurringDonations();

    res.json({
      success: true,
      message: 'Recurring donation processing triggered',
      result
    });

  } catch (error) {
    console.error('[Recurring] Process error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to calculate next charge date
 */
function getNextChargeDate(lastProcessedAt, recurringType) {
  const lastCharge = new Date(lastProcessedAt || new Date());
  const nextCharge = new Date(lastCharge);
  
  if (recurringType === 'monthly') {
    nextCharge.setDate(nextCharge.getDate() + 30);
  } else if (recurringType === 'yearly') {
    nextCharge.setDate(nextCharge.getDate() + 365);
  }
  
  return nextCharge.toISOString();
}

module.exports = router;
