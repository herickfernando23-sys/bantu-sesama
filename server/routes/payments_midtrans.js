const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const optionalAuth = require('../middleware/optionalAuth');
const { sequelize } = require('../models');
const { Donation, Campaign, User } = sequelize.models;

// Initialize Midtrans Snap Client
const snap = new midtransClient.Snap({
  isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-xxxxxx',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-xxxxxx'
});

const isDemoPaymentMode = String(process.env.PAYMENT_DEMO || '').toLowerCase() === 'true';

/**
 * POST /api/payments/create-intent
 * Create Midtrans transaction for donation
 */
router.post('/create-intent', optionalAuth, async (req, res) => {
  try {
    console.log('[Midtrans] create-intent payload:', req.body);
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

    // Basic validation
    if (!donorName || !donorName.trim()) {
      return res.status(400).json({ error: 'Nama donor harus diisi' });
    }
    if (!donorEmail || !donorEmail.trim()) {
      return res.status(400).json({ error: 'Email donor harus diisi' });
    }
    if (!amount || Number(amount) < 10000) {
      return res.status(400).json({ error: 'Nominal donasi minimal Rp 10.000' });
    }

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID harus disertakan' });
    }

    // Validate campaign exists
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    console.log('[Midtrans] create-intent campaign:', { id: campaign.id, title: campaign.title });

    // Create donation record first
    const donation = await Donation.create({
      campaignId,
      userId: req.user?.id || null,
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

    // Build item details and ensure Midtrans constraints:
    // - item name should be <= 50 chars
    // - gross_amount must equal sum(price * quantity)
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

    // Sum check (defensive)
    const sumItems = itemDetails.reduce((s, it) => s + (Number(it.price) * Number(it.quantity)), 0);
    if (sumItems !== transactionDetails.gross_amount) {
      // Fix by setting gross_amount to sumItems (Midtrans requires they match)
      transactionDetails.gross_amount = sumItems;
    }

    // Payment method specific configuration
    let enabledPayments = [];
    let paymentConfig = {};

    switch (paymentMethod) {
      case 'bank_transfer':
        enabledPayments = ['bank_transfer'];
        paymentConfig = {
          bank_transfer: {
            bank_list: ['bca', 'bni', 'bri', 'mandiri']
          }
        };
        break;
      case 'virtual_account':
        // Use explicit VA payment codes so Snap shows bank VA options
        enabledPayments = ['bca_va', 'bni_va', 'bri_va', 'permata_va', 'mandiri_bill'];
        paymentConfig = {};
        break;
      case 'card':
        enabledPayments = ['credit_card'];
        paymentConfig = {};
        break;
      case 'ewallet':
        // E-wallet options (OVO and Dana removed)
        enabledPayments = ['gopay', 'shopeepay'];
        paymentConfig = {};
        break;
      default:
        // Default payment set - removed OVO
        enabledPayments = ['bank_transfer', 'gopay', 'linkaja', 'credit_card'];
        paymentConfig = {};
    }

    const parameter = {
      transaction_details: transactionDetails,
      customer_details: customerDetails,
      item_details: itemDetails,
      enabled_payments: enabledPayments,
      payment: paymentConfig,
      custom_field1: `Donor: ${isAnonymous ? 'Anonymous' : donorName}`,
      custom_field2: `Campaign ID: ${campaignId}`
    };

    // Remove undefined/empty fields
    Object.keys(parameter).forEach(key => {
      if (parameter[key] === undefined || (typeof parameter[key] === 'object' && Object.keys(parameter[key]).length === 0)) {
        delete parameter[key];
      }
    });

    console.log('[Midtrans] Creating transaction with:', {
      paymentMethod,
      enabledPayments,
      paymentConfigKeys: Object.keys(paymentConfig)
    });

    // Create Midtrans transaction
    const transaction = await snap.createTransaction(parameter);
    const transactionToken = transaction.token;

    // Store Midtrans transaction ID
    donation.midtransTransactionId = transaction.transactions[0]?.id || transaction.id;
    await donation.save();

    res.json({
      transactionToken,
      transactionId: donation.midtransTransactionId,
      donationId: donation.id,
      orderId: `ORDER-${donation.id}`,
      amount,
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
    const { transactionId, donationId, orderId } = req.body;

    if (!donationId) {
      return res.status(400).json({ error: 'Donation ID required' });
    }

    const donation = await Donation.findByPk(donationId);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    if (isDemoPaymentMode) {
      // Demo mode: mark as succeeded
      donation.paymentStatus = 'succeeded';
      await donation.save();

      // Update campaign collected amount
      const campaign = await Campaign.findByPk(donation.campaignId);
      campaign.collected = (campaign.collected || 0) + Number(donation.amount);
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
      try {
        const transaction = await snap.transaction.status(donation.midtransTransactionId);
        
        // Update donation status berdasarkan Midtrans response
        if (transaction.transaction_status === 'settlement' || transaction.transaction_status === 'capture') {
          donation.paymentStatus = 'succeeded';
          
          // Update campaign collected amount
          const campaign = await Campaign.findByPk(donation.campaignId);
          campaign.collected = (campaign.collected || 0) + Number(donation.amount);
          await campaign.save();
        } else if (transaction.transaction_status === 'pending') {
          donation.paymentStatus = 'processing';
        } else if (transaction.transaction_status === 'deny' || transaction.transaction_status === 'failed') {
          donation.paymentStatus = 'failed';
        }

        await donation.save();

        return res.json({
          success: donation.paymentStatus === 'succeeded',
          paymentStatus: donation.paymentStatus,
          transactionStatus: transaction.transaction_status,
          orderId
        });
      } catch (error) {
        console.error('Midtrans verification error:', error);
        return res.status(500).json({
          error: 'Failed to verify payment'
        });
      }
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
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      donation.paymentStatus = 'succeeded';

      // Update campaign collected amount
      const campaign = await Campaign.findByPk(donation.campaignId);
      campaign.collected = (campaign.collected || 0) + Number(donation.amount);
      await campaign.save();

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

module.exports = router;

/**
 * POST /api/payments/cancel
 * Cancel a pending donation (calls Midtrans cancel if possible and updates DB)
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

    if (!donation.midtransTransactionId) {
      // Nothing to cancel on Midtrans; mark failed
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
      return res.status(500).json({ error: 'Failed to cancel transaction' });
    }

  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel payment' });
  }
});
