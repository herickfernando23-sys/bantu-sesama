const midtransClient = require('midtrans-client');
const { Donation, Campaign } = require('../models');

const snap = new midtransClient.Snap({
  isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-xxxxxx',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-xxxxxx'
});

/**
 * Service untuk memproses donasi rutin (recurring donations)
 * Cron job akan memanggil ini setiap hari/minggu untuk mengecek donasi yang perlu dicharge
 */

/**
 * Check dan process recurring donations yang sudah jatuh tempo
 * Logika:
 * - Ambil semua donasi dengan recurringType = monthly/yearly
 * - Check tanggal terakhir dicharge vs interval (monthly = 30 hari, yearly = 365 hari)
 * - Jika sudah jatuh tempo dan masih active, trigger charge baru
 */
async function processRecurringDonations() {
  try {
    console.log('[RecurringService] Starting recurring donation processing...');
    
    // Ambil semua recurring donations yang belum dibatalkan
    const recurringDonations = await Donation.findAll({
      where: {
        recurringType: ['monthly', 'yearly'],
        paymentStatus: ['succeeded', 'processing'] // hanya yang sudah berhasil atau sedang pending
      },
      include: [{ model: require('../models').Campaign }]
    });

    console.log(`[RecurringService] Found ${recurringDonations.length} recurring donations to check`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const donation of recurringDonations) {
      try {
        if (await shouldChargeRecurringDonation(donation)) {
          console.log(`[RecurringService] Processing donation ID ${donation.id} (${donation.recurringType})`);
          
          const result = await chargeRecurringDonation(donation);
          
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
          processedCount++;
        }
      } catch (err) {
        console.error(`[RecurringService] Error processing donation ${donation.id}:`, err.message);
        failedCount++;
      }
    }

    console.log(`[RecurringService] Processing complete: ${successCount} succeeded, ${failedCount} failed out of ${processedCount} processed`);
    
    return {
      total: recurringDonations.length,
      processed: processedCount,
      succeeded: successCount,
      failed: failedCount
    };
  } catch (err) {
    console.error('[RecurringService] Fatal error:', err);
    throw err;
  }
}

/**
 * Check apakah donasi sudah jatuh tempo untuk dicharge
 */
async function shouldChargeRecurringDonation(donation) {
  const now = new Date();
  const processedAt = donation.processedAt || donation.createdAt;
  
  let intervalMs;
  if (donation.recurringType === 'monthly') {
    intervalMs = 30 * 24 * 60 * 60 * 1000; // 30 hari
  } else if (donation.recurringType === 'yearly') {
    intervalMs = 365 * 24 * 60 * 60 * 1000; // 365 hari
  } else {
    return false;
  }

  const timeSinceLastCharge = now.getTime() - new Date(processedAt).getTime();
  
  // Charge jika sudah melewati interval (with 6 jam buffer tolerance)
  const shouldCharge = timeSinceLastCharge >= (intervalMs - 6 * 60 * 60 * 1000);
  
  console.log(`[RecurringService] Donation ${donation.id}: type=${donation.recurringType}, timeSince=${Math.floor(timeSinceLastCharge / 1000 / 60)}min, shouldCharge=${shouldCharge}`);
  
  return shouldCharge;
}

/**
 * Execute payment charge untuk recurring donation
 * Buat donation baru atau gunakan token lama untuk charge
 */
async function chargeRecurringDonation(donation) {
  try {
    // Validasi campaign masih aktif
    const campaign = await Campaign.findByPk(donation.campaignId);
    if (!campaign) {
      console.error(`[RecurringService] Campaign ${donation.campaignId} not found`);
      return { success: false, error: 'Campaign not found' };
    }

    // Untuk recurring charge, buat donation record baru
    // (tracking setiap charge sebagai transaksi terpisah)
    const newDonation = await Donation.create({
      campaignId: donation.campaignId,
      userId: donation.userId,
      amount: donation.amount,
      currency: donation.currency,
      paymentStatus: 'processing',
      paymentMethod: donation.paymentMethod,
      recurringType: 'one-time', // Charge individual ini dianggap one-time, recurring adalah parent
      donorName: donation.donorName,
      donorEmail: donation.donorEmail,
      isAnonymous: donation.isAnonymous,
      message: `Recurring ${donation.recurringType} donation (Charge #${Math.floor(Date.now() / 1000)})`,
      parentRecurringDonationId: donation.id // Link ke parent recurring donation
    });

    console.log(`[RecurringService] Created new charge donation ${newDonation.id} for recurring ${donation.id}`);

    // Trigger Midtrans transaction untuk charge baru
    const chargeResult = await createRecurringTransaction(newDonation, campaign);
    
    if (chargeResult.success) {
      // Update parent donation processedAt
      donation.processedAt = new Date();
      await donation.save();
      
      console.log(`[RecurringService] Charge successful for donation ${donation.id}`);
      return { success: true, newDonationId: newDonation.id, transactionToken: chargeResult.token };
    } else {
      // Mark charge donation sebagai failed
      newDonation.paymentStatus = 'failed';
      newDonation.failureReason = chargeResult.error || 'Unknown error';
      await newDonation.save();
      
      console.error(`[RecurringService] Charge failed for donation ${donation.id}:`, chargeResult.error);
      return { success: false, error: chargeResult.error };
    }
  } catch (err) {
    console.error(`[RecurringService] Error in chargeRecurringDonation:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create Midtrans transaction untuk charge recurring
 */
async function createRecurringTransaction(donation, campaign) {
  try {
    const numericAmount = Math.round(Number(donation.amount));
    const transactionDetails = {
      order_id: `RECURRING-${donation.id}-${Date.now()}`,
      gross_amount: numericAmount
    };

    const customerDetails = {
      first_name: donation.donorName.split(' ')[0] || 'Donor',
      last_name: donation.donorName.split(' ').slice(1).join(' ') || '',
      email: donation.donorEmail,
      phone: '08111111111'
    };

    const itemName = `Donasi Rutin untuk ${campaign.title}`.slice(0, 50);
    const itemDetails = [
      {
        id: `recurring_${donation.campaignId}`,
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
      custom_field1: `Recurring Charge - Donor: ${donation.donorName}`,
      custom_field2: `Campaign ID: ${donation.campaignId}`,
      custom_field3: `Parent Recurring ID: ${donation.parentRecurringDonationId || 'N/A'}`
    };

    Object.keys(parameter).forEach(key => parameter[key] === undefined && delete parameter[key]);

    console.log(`[RecurringService] Creating Midtrans transaction for recurring charge:`, parameter.transaction_details);
    
    const transaction = await snap.createTransaction(parameter);
    
    if (transaction.token) {
      donation.midtransTransactionId = `RECURRING-${donation.id}-${Date.now()}`;
      await donation.save();
      
      return { success: true, token: transaction.token, transactionId: donation.midtransTransactionId };
    } else {
      return { success: false, error: 'No token in Midtrans response' };
    }
  } catch (err) {
    console.error('[RecurringService] Midtrans transaction creation error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all recurring donations for a user
 */
async function getUserRecurringDonations(userId) {
  try {
    return await Donation.findAll({
      where: {
        userId: userId,
        recurringType: ['monthly', 'yearly']
      },
      include: [{ model: Campaign, attributes: ['id', 'title', 'collected', 'goal'] }],
      order: [['createdAt', 'DESC']]
    });
  } catch (err) {
    console.error('[RecurringService] Error fetching user recurring donations:', err);
    throw err;
  }
}

/**
 * Cancel a recurring donation
 */
async function cancelRecurringDonation(donationId, userId) {
  try {
    const donation = await Donation.findByPk(donationId);
    
    if (!donation) {
      return { success: false, error: 'Donation not found' };
    }

    if (donation.userId !== userId) {
      return { success: false, error: 'Unauthorized - not your donation' };
    }

    if (!['monthly', 'yearly'].includes(donation.recurringType)) {
      return { success: false, error: 'Not a recurring donation' };
    }

    // Mark as cancelled
    donation.recurringType = 'one-time'; // atau bisa tambah status cancelled
    donation.paymentStatus = 'failed'; // atau tambah enum cancelled
    await donation.save();

    console.log(`[RecurringService] Recurring donation ${donationId} cancelled for user ${userId}`);
    
    return { success: true, message: 'Recurring donation cancelled successfully' };
  } catch (err) {
    console.error('[RecurringService] Error cancelling recurring donation:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update recurring donation amount/frequency (future feature)
 */
async function updateRecurringDonation(donationId, userId, updates) {
  try {
    const donation = await Donation.findByPk(donationId);
    
    if (!donation) {
      return { success: false, error: 'Donation not found' };
    }

    if (donation.userId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (updates.amount) {
      donation.amount = Number(updates.amount);
    }
    if (updates.recurringType && ['monthly', 'yearly'].includes(updates.recurringType)) {
      donation.recurringType = updates.recurringType;
    }

    await donation.save();
    
    return { success: true, donation };
  } catch (err) {
    console.error('[RecurringService] Error updating recurring donation:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  processRecurringDonations,
  chargeRecurringDonation,
  getUserRecurringDonations,
  cancelRecurringDonation,
  updateRecurringDonation
};
