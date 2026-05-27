const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const optionalAuth = require('../middleware/optionalAuth');
const { sequelize } = require('../models');
const { Donation, Campaign, User } = sequelize.models;

// Initialize Midtrans Snap Client
const midtransServerKey = String(process.env.MIDTRANS_SERVER_KEY || '').trim();
const midtransClientKey = String(process.env.MIDTRANS_CLIENT_KEY || '').trim();
const midtransIsProduction = String(process.env.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true';

const snap = new midtransClient.Snap({
  isProduction: midtransIsProduction,
  serverKey: midtransServerKey || 'SB-Mid-server-xxxxxx',
  clientKey: midtransClientKey || 'SB-Mid-client-xxxxxx'
});

console.log('Midtrans config loaded:', {
  isProduction: midtransIsProduction,
  serverKeyPrefix: midtransServerKey.slice(0, 10),
  clientKeyPrefix: midtransClientKey.slice(0, 10)
});

const isDemoPaymentMode = String(process.env.PAYMENT_DEMO || '').toLowerCase() === 'true';

/**
 * POST /api/payments/create-intent
 * Create Midtrans transaction for donation
 */
router.post('/create-intent', optionalAuth, async (req, res) => {
  try {
    const {
      amount,
      tipAmount = 0,
      campaignId,
      recurringType = 'one-time',
      donorName,
      donorEmail,
      isAnonymous = false,
      message = '',
      paymentMethod = 'bank_transfer'
    } = req.body;

    // Validation
    if (!donorName || !donorName.trim()) {
      return res.status(400).json({ error: 'Nama donor harus diisi' });
    }
    if (!donorEmail || !donorEmail.trim()) {
      return res.status(400).json({ error: 'Email donor harus diisi' });
    }
    
    // Validate amount based on recurring type
    const minAmount = ['monthly', 'yearly'].includes(recurringType) ? 50000 : 10000;
    if (!amount || Number(amount) < minAmount) {
      return res.status(400).json({ 
        error: `Nominal donasi minimal Rp ${minAmount.toLocaleString('id-ID')} untuk donasi ${recurringType}` 
      });
    }

    // Validate recurring type
    if (!['one-time', 'monthly', 'yearly'].includes(recurringType)) {
      return res.status(400).json({ error: 'recurringType tidak valid (one-time, monthly, or yearly)' });
    }

    // Validate campaign exists
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Some existing DB schemas may still enforce NOT NULL for userId.
    // Ensure a user record exists for donor email when session user is not present.
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

    // Create donation record first
    const donation = await Donation.create({
      campaignId,
      userId,
      amount: Number(amount),
      currency: 'IDR',
      paymentStatus: 'pending',
      paymentMethod: paymentMethod,
      recurringType: recurringType,
      donorName: isAnonymous ? 'Anonymous' : donorName,
      donorEmail,
      isAnonymous,
      message
    });

    // Create tip record if provided
    let tipRecord = null;
    const numericTip = Math.round(Number(tipAmount || 0));
    if (numericTip > 0) {
      const Tip = sequelize.models.Tip;
      tipRecord = await Tip.create({
        userId,
        amount: numericTip,
        currency: 'IDR',
        paymentStatus: 'pending',
        paymentMethod: paymentMethod,
        donorName: isAnonymous ? 'Anonymous' : donorName,
        donorEmail,
        isAnonymous,
        message: 'Tips sukarela untuk operasional platform'
      });
    }

    if (isDemoPaymentMode) {
      // Demo mode untuk testing
      return res.json({
        transactionToken: `DEMO_TOKEN_${donation.id}_${Date.now()}`,
        transactionId: `demo_txn_${donation.id}`,
        donationId: donation.id,
        demoMode: true,
        orderId: `ORDER-${donation.id}`
      });
    }

    // Midtrans transaction parameters
    const numericAmount = Math.round(Number(amount));
    const numericTipAmount = Math.round(Number(tipAmount || 0));
    const transactionDetails = {
      order_id: `ORDER-${donation.id}`,
      gross_amount: numericAmount + numericTipAmount
    };

    const customerDetails = {
      first_name: isAnonymous ? 'Anonymous' : donorName.split(' ')[0],
      last_name: isAnonymous ? 'Donor' : (donorName.split(' ').slice(1).join(' ') || ''),
      email: donorEmail,
      phone: '08111111111' // Placeholder
    };

    const rawItemName = ['monthly', 'yearly'].includes(recurringType) 
      ? `Donasi Rutin ${recurringType} - ${campaign.title}`
      : `Donasi untuk ${campaign.title}`;
    const itemName = rawItemName.length > 50 ? rawItemName.slice(0, 50) : rawItemName;

    const itemDetails = [
      {
        id: `campaign_${campaignId}`,
        price: numericAmount,
        quantity: 1,
        name: itemName
      }
    ];

    if (numericTipAmount > 0) {
      itemDetails.push({
        id: `tip_platform`,
        price: numericTipAmount,
        quantity: 1,
        name: 'Tips Sukarela untuk Operasional Platform'
      });
    }

    const itemTotal = itemDetails.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    transactionDetails.gross_amount = itemTotal;

    // Payment method specific configuration
    let enabledPayments = [];
    switch (paymentMethod) {
      case 'bank_transfer':
        enabledPayments = ['bank_transfer'];
        break;
      case 'virtual_account':
        // Virtual account payments use 'bank_transfer' in Snap.
        // Snap will present supported banks (BCA, Mandiri, BNI, BRI, etc.)
        enabledPayments = ['bank_transfer'];
        break;
      case 'card':
        enabledPayments = ['credit_card'];
        break;
      case 'ewallet':
        // E-wallet options (OVO and Dana removed)
        enabledPayments = ['gopay', 'shopeepay'];
        break;
      default:
        enabledPayments = ['bank_transfer', 'gopay', 'shopeepay', 'credit_card'];
    }

    const parameter = {
      transaction_details: transactionDetails,
      customer_details: customerDetails,
      item_details: itemDetails,
      enabled_payments: enabledPayments,
      // Note: do not set vt_target_bank here; Snap will manage VA number generation
      custom_field1: `Donor: ${isAnonymous ? 'Anonymous' : donorName}`,
      custom_field2: `Campaign ID: ${campaignId}`
    };

    // Remove undefined fields
    Object.keys(parameter).forEach(key => parameter[key] === undefined && delete parameter[key]);

    // Create Midtrans transaction
    console.log('[CreateIntent-59] Calling Midtrans createTransaction with parameter:', JSON.stringify(parameter));
    let transaction;
    try {
      transaction = await snap.createTransaction(parameter);
      console.log('[CreateIntent-59] snap.createTransaction RETURNED:', JSON.stringify(transaction, null, 2));
      console.log('[CreateIntent-59] Token in response:', transaction.token ? 'YES' : 'NO');
    } catch (midtransError) {
      console.error('[CreateIntent-59] snap.createTransaction threw error:', midtransError);
      console.error('[CreateIntent-59] Error message:', midtransError.message);
      console.error('[CreateIntent-59] ApiResponse:', JSON.stringify(midtransError.ApiResponse || 'NO APIRESP', null, 2));
      throw midtransError;
    }

    const transactionToken = transaction.token;
    const orderId = `ORDER-${donation.id}`;

    if (!transactionToken) {
      console.error('[CreateIntent-59] ERROR: response.token is empty/falsy');
      throw new Error('Midtrans response invalid: no token returned');
    }

    console.log('[CreateIntent-59] SUCCESS - token:', transactionToken);

    // Store the order_id as transaction ID (Snap API doesn't return transaction.id)
    // This order_id is used for status lookups with snap.transaction.status()
    donation.midtransTransactionId = orderId;
    await donation.save();

    if (tipRecord) {
      tipRecord.midtransTransactionId = orderId;
      await tipRecord.save();
    }

    res.json({
      transactionToken,
      transactionId: donation.midtransTransactionId,
      donationId: donation.id,
      orderId,
      amount: numericAmount,
      demoMode: false
    });

  } catch (error) {
    console.error('Payment create-intent error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create payment intent'
    });
  }
});

/**
 * POST /api/payments/create-tip-intent
 * Create Midtrans transaction for a platform tip (standalone)
 */
router.post('/create-tip-intent', optionalAuth, async (req, res) => {
  let tip = null;
  try {
    const { amount, donorName, donorEmail, isAnonymous = false, message = '', paymentMethod = 'ewallet' } = req.body;
    console.log('[CreateTipIntent] incoming', { amount, donorName, donorEmail, isAnonymous, paymentMethod });

    if (!donorName || !donorName.trim()) return res.status(400).json({ error: 'Nama donor harus diisi' });
    if (!donorEmail || !donorEmail.trim()) return res.status(400).json({ error: 'Email donor harus diisi' });

    const numericAmount = Math.round(Number(amount || 0));
    if (!numericAmount || numericAmount < 1000) return res.status(400).json({ error: 'Jumlah tip tidak valid' });

    // Ensure user exists
    let userId = req.user?.id || null;
    if (!userId) {
      let donorUser = await User.findOne({ where: { email: donorEmail } });
      if (!donorUser) {
        donorUser = await User.create({ name: donorName || 'Donor', email: donorEmail, password: `donor_${Date.now()}` });
      }
      userId = donorUser.id;
    }

    const Tip = sequelize.models.Tip;
    tip = await Tip.create({ userId, amount: numericAmount, currency: 'IDR', paymentStatus: 'pending', paymentMethod, donorName: isAnonymous ? 'Anonymous' : donorName, donorEmail, isAnonymous, message });

    const orderId = `ORDER-TIP-${tip.id}`;
    const canUseMidtrans = !isDemoPaymentMode && midtransServerKey && midtransClientKey;

    if (!canUseMidtrans) {
      tip.midtransTransactionId = orderId;
      await tip.save();
      return res.json({ transactionToken: `DEMO_TIP_${tip.id}_${Date.now()}`, transactionId: `demo_tip_${tip.id}`, tipId: tip.id, demoMode: true, orderId });
    }

    const transactionDetails = { order_id: orderId, gross_amount: numericAmount };
    const customerDetails = { first_name: isAnonymous ? 'Anonymous' : donorName.split(' ')[0], last_name: isAnonymous ? 'Donor' : (donorName.split(' ').slice(1).join(' ') || ''), email: donorEmail, phone: '08111111111' };

    const itemDetails = [{ id: `tip_${tip.id}`, price: numericAmount, quantity: 1, name: 'Tips Sukarela untuk Operasional Platform' }];

    const enabledPayments = paymentMethod === 'ewallet' ? ['gopay', 'shopeepay'] : (paymentMethod === 'virtual_account' ? ['bank_transfer'] : ['bank_transfer', 'gopay', 'shopeepay', 'credit_card']);

    const parameter = { transaction_details: transactionDetails, customer_details: customerDetails, item_details: itemDetails, enabled_payments: enabledPayments, custom_field1: `Tip: ${isAnonymous ? 'Anonymous' : donorName}` };

    let transaction;
    try {
      transaction = await snap.createTransaction(parameter);
    } catch (err) {
      console.error('Create tip transaction error', err);
      throw err;
    }

    const transactionToken = transaction.token;
    tip.midtransTransactionId = orderId;
    await tip.save();

    res.json({ transactionToken, transactionId: tip.midtransTransactionId, tipId: tip.id, orderId, amount: numericAmount, demoMode: false });
  } catch (err) {
    console.error('create-tip-intent error', err);

    try {
      if (tip) {
        const fallbackOrderId = `ORDER-TIP-${tip.id}`;
        tip.midtransTransactionId = fallbackOrderId;
        await tip.save();
        return res.json({ transactionToken: `DEMO_TIP_${tip.id}_${Date.now()}`, transactionId: fallbackOrderId, tipId: tip.id, demoMode: true, orderId: fallbackOrderId });
      }
    } catch (fallbackErr) {
      console.error('create-tip-intent fallback failed:', fallbackErr);
    }

    res.status(500).json({ error: err.message || 'Failed to create tip intent' });
  }
});
router.post('/confirm', optionalAuth, async (req, res) => {
  try {
    const { transactionId, donationId, tipId, orderId, transactionStatus } = req.body;

    // Donation confirmation path
    if (donationId) {
      const donation = await Donation.findByPk(donationId);
      if (!donation) return res.status(404).json({ error: 'Donation not found' });

      const callbackStatus = String(transactionStatus || '').toLowerCase();
      const statusMeansSuccess = callbackStatus === 'settlement' || callbackStatus === 'capture' || callbackStatus === 'success';
      const statusMeansPending = callbackStatus === 'pending' || callbackStatus === 'authorize';

      if (isDemoPaymentMode) {
        donation.paymentStatus = 'succeeded';
        await donation.save();
        const campaign = await Campaign.findByPk(donation.campaignId);
        campaign.collected = (Number(campaign.collected) || 0) + Number(donation.amount || 0);
        await campaign.save();
        return res.json({ success: true, paymentStatus: 'succeeded', orderId, message: 'Demo payment simulasi berhasil' });
      }

      if (!donation.midtransTransactionId) return res.status(400).json({ error: 'Donation transaction not found' });

      const previousStatus = donation.paymentStatus;
      let transaction = null;
      try {
        transaction = await snap.transaction.status(donation.midtransTransactionId);
      } catch (err) {
        if (statusMeansSuccess) transaction = { transaction_status: callbackStatus || 'settlement' };
        else if (statusMeansPending) transaction = { transaction_status: 'pending' };
        else {
          donation.paymentStatus = 'processing';
          await donation.save();
          return res.json({ success: false, paymentStatus: 'processing', orderId, warning: 'Midtrans verification failed; donation set to processing.' });
        }
      }

      if (statusMeansSuccess || transaction.transaction_status === 'settlement' || transaction.transaction_status === 'capture') donation.paymentStatus = 'succeeded';
      else if (statusMeansPending || transaction.transaction_status === 'pending') donation.paymentStatus = 'processing';
      else if (['deny', 'failed', 'cancel'].includes(transaction.transaction_status)) donation.paymentStatus = 'failed';

      if (donation.paymentStatus === 'succeeded' && previousStatus !== 'succeeded') {
        const campaign = await Campaign.findByPk(donation.campaignId);
        campaign.collected = (Number(campaign.collected) || 0) + Number(donation.amount || 0);
        await campaign.save();
      }

      // Update linked Tip records (if any)
      try {
        const Tip = sequelize.models.Tip;
        if (Tip) {
          const tips = await Tip.findAll({ where: { midtransTransactionId: donation.midtransTransactionId } });
          for (const t of tips) {
            t.paymentStatus = donation.paymentStatus === 'succeeded' ? 'succeeded' : (donation.paymentStatus === 'processing' ? 'processing' : 'failed');
            await t.save();
          }
        }
      } catch (err) {
        console.error('Failed to update linked Tip records:', err);
      }

      await donation.save();
      return res.json({ success: donation.paymentStatus === 'succeeded', paymentStatus: donation.paymentStatus, transactionStatus: transaction.transaction_status, orderId });
    }

    // Tip confirmation path
    if (tipId || (orderId && String(orderId).startsWith('ORDER-TIP-'))) {
      const TipModel = sequelize.models.Tip;
      let tip = null;
      if (tipId) tip = await TipModel.findByPk(tipId);
      if (!tip && orderId) tip = await TipModel.findOne({ where: { midtransTransactionId: orderId } });
      if (!tip) return res.status(404).json({ error: 'Tip not found' });

      if (!tip.midtransTransactionId && orderId && String(orderId).startsWith('ORDER-TIP-')) {
        tip.midtransTransactionId = orderId;
        await tip.save();
      }

      if (isDemoPaymentMode) {
        tip.paymentStatus = 'succeeded';
        await tip.save();
        return res.json({ success: true, paymentStatus: 'succeeded', orderId, message: 'Demo tip simulasi berhasil' });
      }

      if (!tip.midtransTransactionId) return res.status(400).json({ error: 'Tip transaction not found' });

      const callbackStatus = String(transactionStatus || '').toLowerCase();
      const statusMeansSuccess = callbackStatus === 'settlement' || callbackStatus === 'capture' || callbackStatus === 'success';
      const statusMeansPending = callbackStatus === 'pending' || callbackStatus === 'authorize';

      let transaction = null;
      try {
        transaction = await snap.transaction.status(tip.midtransTransactionId);
      } catch (err) {
        if (statusMeansSuccess) transaction = { transaction_status: callbackStatus || 'settlement' };
        else if (statusMeansPending) transaction = { transaction_status: 'pending' };
        else {
          tip.paymentStatus = 'processing';
          await tip.save();
          return res.json({ success: false, paymentStatus: 'processing', orderId, warning: 'Midtrans verification failed; tip set to processing.' });
        }
      }

      if (statusMeansSuccess || transaction.transaction_status === 'settlement' || transaction.transaction_status === 'capture') tip.paymentStatus = 'succeeded';
      else if (statusMeansPending || transaction.transaction_status === 'pending') tip.paymentStatus = 'processing';
      else if (['deny', 'failed', 'cancel'].includes(transaction.transaction_status)) tip.paymentStatus = 'failed';

      await tip.save();
      return res.json({ success: tip.paymentStatus === 'succeeded', paymentStatus: tip.paymentStatus, transactionStatus: transaction.transaction_status, orderId });
    }

    return res.status(400).json({ error: 'No donationId or tipId provided' });

  } catch (error) {
    console.error('Payment confirm error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm payment' });
  }
});

/**
 * GET /api/payments/status/:orderId
 * Get payment status
 */
router.get('/status/:orderId', optionalAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Extract donationId from orderId
    const donationId = parseInt(orderId.replace('ORDER-', ''));
    const donation = await Donation.findByPk(donationId);

    if (!donation) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (!isDemoPaymentMode && donation.midtransTransactionId) {
      try {
        const transaction = await snap.transaction.status(donation.midtransTransactionId);
        return res.json({
          status: transaction.transaction_status,
          paymentStatus: donation.paymentStatus,
          amount: donation.amount,
          orderId
        });
      } catch (error) {
        console.error('Status check error:', error);
      }
    }

    res.json({
      status: donation.paymentStatus,
      amount: donation.amount,
      orderId
    });

  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

/**
 * POST /api/payments/cancel
 * Cancel a pending donation
 */
router.post('/cancel', optionalAuth, async (req, res) => {
  try {
    const { donationId } = req.body;

    if (!donationId) {
      return res.status(400).json({ error: 'Donation ID required' });
    }

    const donation = await Donation.findByPk(donationId);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    if (req.user && donation.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (donation.paymentStatus === 'succeeded') {
      return res.status(409).json({ error: 'Donation already completed and cannot be cancelled' });
    }

    if (!donation.midtransTransactionId) {
      donation.paymentStatus = 'failed';
      await donation.save();
      return res.json({ success: true, message: 'Donation marked as cancelled' });
    }

    try {
      await snap.transaction.cancel(donation.midtransTransactionId);
      donation.paymentStatus = 'failed';
      await donation.save();
      return res.json({ success: true, message: 'Transaction cancelled' });
    } catch (err) {
      console.error('Midtrans cancel error:', err);

      donation.paymentStatus = 'failed';
      await donation.save();
      return res.json({
        success: true,
        message: 'Transaction cancellation request could not reach Midtrans, but local status was updated to cancelled'
      });
    }

  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel payment' });
  }
});

/**
 * POST /api/payments/webhook
 * Midtrans webhook untuk notifikasi pembayaran
 */
router.post('/webhook', async (req, res) => {
  try {
    const notification = req.body;

    // Verify notification is from Midtrans (optional but recommended)
    // const signature = crypto.createHash('sha512')
    //   .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${MIDTRANS_SERVER_KEY}`)
    //   .digest('hex');
    // if (signature !== notification.signature_key) {
    //   return res.status(403).json({ error: 'Invalid signature' });
    // }

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;

    // Extract donationId
    const donationId = parseInt(orderId.replace('ORDER-', ''));
    const donation = await Donation.findByPk(donationId);

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    // Update donation status
    const previousStatus = donation.paymentStatus;

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      donation.paymentStatus = 'succeeded';

      // Update campaign collected amount
      if (previousStatus !== 'succeeded') {
        const campaign = await Campaign.findByPk(donation.campaignId);
        campaign.collected = (campaign.collected || 0) + Number(donation.amount);
        await campaign.save();
      }

    } else if (transactionStatus === 'pending') {
      donation.paymentStatus = 'processing';
    } else if (transactionStatus === 'deny' || transactionStatus === 'failed' || transactionStatus === 'cancel') {
      donation.paymentStatus = 'failed';
    }

    await donation.save();

    console.log(`Webhook: Payment ${orderId} status updated to ${transactionStatus}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payments/donation/:donationId
 * Get donation details
 */
router.get('/donation/:donationId', optionalAuth, async (req, res) => {
  try {
    const donation = await Donation.findByPk(req.params.donationId);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    // Verify user is owner (skip check if not authenticated)
    if (req.user && donation.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(donation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/payments/campaign/:campaignId/donations
 * Get all donations for a campaign (public)
 */
router.get('/campaign/:campaignId/donations', async (req, res) => {
  try {
    const donations = await Donation.findAll({
      where: { 
        campaignId: req.params.campaignId,
        paymentStatus: 'succeeded'
      },
      attributes: ['id', 'amount', 'donorName', 'message', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
