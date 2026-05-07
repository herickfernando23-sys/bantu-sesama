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
    if (!amount || Number(amount) < 10000) {
      return res.status(400).json({ error: 'Nominal donasi minimal Rp 10.000' });
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
    const transactionDetails = {
      order_id: `ORDER-${donation.id}`,
      gross_amount: numericAmount
    };

    const customerDetails = {
      first_name: isAnonymous ? 'Anonymous' : donorName.split(' ')[0],
      last_name: isAnonymous ? 'Donor' : (donorName.split(' ').slice(1).join(' ') || ''),
      email: donorEmail,
      phone: '08111111111' // Placeholder
    };

    const rawItemName = `Donasi untuk ${campaign.title}`;
    const itemName = rawItemName.length > 50 ? rawItemName.slice(0, 50) : rawItemName;

    const itemDetails = [
      {
        id: `campaign_${campaignId}`,
        price: numericAmount,
        quantity: 1,
        name: itemName
      }
    ];

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
        enabledPayments = ['gopay', 'shopeepay', 'ovo', 'dana'];
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
 * POST /api/payments/confirm
 * Confirm payment after transaction success
 */
router.post('/confirm', optionalAuth, async (req, res) => {
  try {
    const { transactionId, donationId, orderId, transactionStatus } = req.body;

    if (!donationId) {
      return res.status(400).json({ error: 'Donation ID required' });
    }

    const donation = await Donation.findByPk(donationId);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    const callbackStatus = String(transactionStatus || '').toLowerCase();
    const statusMeansSuccess = callbackStatus === 'settlement' || callbackStatus === 'capture' || callbackStatus === 'success';
    const statusMeansPending = callbackStatus === 'pending' || callbackStatus === 'authorize';

    if (isDemoPaymentMode) {
      // Demo mode: mark as succeeded
      donation.paymentStatus = 'succeeded';
      await donation.save();

      // Update campaign collected amount
      const campaign = await Campaign.findByPk(donation.campaignId);
      const currentCollected = Number(campaign.collected) || 0;
      const donationAmount = Number(donation.amount) || 0;
      campaign.collected = currentCollected + donationAmount;
      await campaign.save();

      return res.json({
        success: true,
        paymentStatus: 'succeeded',
        orderId,
        message: 'Demo payment simulasi berhasil'
      });
    }

    // For real Midtrans: verify transaction with server
    if (donation.midtransTransactionId) {
      const previousStatus = donation.paymentStatus;
      let transaction = null;

      try {
        transaction = await snap.transaction.status(donation.midtransTransactionId);
        console.log('[Confirm] Midtrans status response for', donation.midtransTransactionId, ':', JSON.stringify(transaction, null, 2));
      } catch (error) {
        console.error('Midtrans verification error:', error);

        if (statusMeansSuccess) {
          transaction = { transaction_status: callbackStatus || 'settlement' };
        } else if (statusMeansPending) {
          transaction = { transaction_status: 'pending' };
        } else {
          donation.paymentStatus = 'processing';
          await donation.save();

          return res.json({
            success: false,
            paymentStatus: 'processing',
            orderId,
            warning: 'Midtrans verification failed; donation set to processing. Please check webhook or try verifying later.'
          });
        }
      }

      // Update donation status berdasarkan Midtrans response
      if (statusMeansSuccess || transaction.transaction_status === 'settlement' || transaction.transaction_status === 'capture') {
        donation.paymentStatus = 'succeeded';
      } else if (statusMeansPending || transaction.transaction_status === 'pending') {
        donation.paymentStatus = 'processing';
      } else if (transaction.transaction_status === 'deny' || transaction.transaction_status === 'failed' || transaction.transaction_status === 'cancel') {
        donation.paymentStatus = 'failed';
      }

      if (donation.paymentStatus === 'succeeded' && previousStatus !== 'succeeded') {
        const campaign = await Campaign.findByPk(donation.campaignId);
        // Convert collected to number before arithmetic
        const currentCollected = Number(campaign.collected) || 0;
        const donationAmount = Number(donation.amount) || 0;
        campaign.collected = currentCollected + donationAmount;
        await campaign.save();
      }

      await donation.save();

      return res.json({
        success: donation.paymentStatus === 'succeeded',
        paymentStatus: donation.paymentStatus,
        transactionStatus: transaction.transaction_status,
        orderId
      });
    }

    return res.status(400).json({
      error: 'Transaction not found'
    });

  } catch (error) {
    console.error('Payment confirm error:', error);
    res.status(500).json({
      error: error.message || 'Failed to confirm payment'
    });
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
