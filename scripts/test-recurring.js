#!/usr/bin/env node

/**
 * Quick Testing Script untuk Recurring Donations
 * 
 * Usage:
 *   node scripts/test-recurring.js setup
 *   node scripts/test-recurring.js list <JWT_TOKEN>
 *   node scripts/test-recurring.js details <DONATION_ID> <JWT_TOKEN>
 *   node scripts/test-recurring.js process <ADMIN_KEY>
 *   node scripts/test-recurring.js cancel <DONATION_ID> <JWT_TOKEN>
 */

const baseURL = process.env.API_URL || 'http://localhost:4000';

const args = process.argv.slice(2);
const command = args[0];

async function request(method, path, body = null, headers = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };

  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(`${baseURL}${path}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (err) {
    console.error('❌ Fetch Error:', err.message);
    process.exit(1);
  }
}

async function testSetup() {
  console.log('\n🔧 TEST: Setup Recurring Donation\n');

  const payload = {
    campaignId: 1,
    amount: 100000,
    recurringType: 'monthly',
    donorName: 'Test Donor',
    donorEmail: 'testdonor@example.com',
    paymentMethod: 'bank_transfer',
    message: 'Test recurring monthly donation'
  };

  console.log('📤 Request:');
  console.log('  POST /api/recurring/setup');
  console.log('  Payload:', JSON.stringify(payload, null, 2));

  const { status, data } = await request('POST', '/api/recurring/setup', payload);

  console.log('\n📥 Response:');
  console.log('  Status:', status);
  console.log(JSON.stringify(data, null, 2));

  if (data.recurringDonationId) {
    console.log('\n✅ SUCCESS!');
    console.log('📌 Save These Details:');
    console.log(`   Recurring Donation ID: ${data.recurringDonationId}`);
    console.log(`   Order ID: ${data.orderId}`);
    console.log(`   Amount: Rp ${data.amount.toLocaleString('id-ID')}`);
    console.log(`   Recurring Type: ${data.recurringType}`);
  } else {
    console.log('\n❌ FAILED!');
  }
}

async function testList(token) {
  if (!token) {
    console.error('❌ ERROR: JWT token required');
    console.log('Usage: node test-recurring.js list <JWT_TOKEN>');
    process.exit(1);
  }

  console.log('\n🔧 TEST: List User Recurring Donations\n');

  console.log('📤 Request:');
  console.log('  GET /api/recurring/list');
  console.log(`  Headers: Authorization: Bearer ${token.slice(0, 20)}...`);

  const { status, data } = await request('GET', '/api/recurring/list', null, {
    'Authorization': `Bearer ${token}`
  });

  console.log('\n📥 Response:');
  console.log('  Status:', status);

  if (data.recurringDonations && data.recurringDonations.length > 0) {
    console.log(`\n✅ Found ${data.recurringDonations.length} recurring donation(s):\n`);
    
    data.recurringDonations.forEach((d, i) => {
      console.log(`  ${i + 1}. ID: ${d.id}`);
      console.log(`     Campaign: ${d.campaignTitle}`);
      console.log(`     Amount: Rp ${d.amount.toLocaleString('id-ID')}`);
      console.log(`     Type: ${d.recurringType}`);
      console.log(`     Status: ${d.paymentStatus}`);
      console.log(`     Next Charge: ${new Date(d.nextChargeEstimate).toLocaleDateString('id-ID')}`);
      console.log('');
    });

    console.log('📊 Summary:');
    console.log(`   Total Monthly: Rp ${data.totalMonthly.toLocaleString('id-ID')}`);
    console.log(`   Total Yearly: Rp ${data.totalYearly.toLocaleString('id-ID')}`);
  } else {
    console.log('\n❌ No recurring donations found');
  }
}

async function testDetails(donationId, token) {
  if (!donationId || !token) {
    console.error('❌ ERROR: Donation ID and JWT token required');
    console.log('Usage: node test-recurring.js details <DONATION_ID> <JWT_TOKEN>');
    process.exit(1);
  }

  console.log('\n🔧 TEST: Get Recurring Donation Details & Charge History\n');

  console.log('📤 Request:');
  console.log(`  GET /api/recurring/details/${donationId}`);

  const { status, data } = await request('GET', `/api/recurring/details/${donationId}`, null, {
    'Authorization': `Bearer ${token}`
  });

  console.log('\n📥 Response:');
  console.log('  Status:', status);

  if (data.donation) {
    console.log('\n✅ Recurring Donation Details:');
    console.log('');
    console.log(`  ID: ${data.donation.id}`);
    console.log(`  Campaign: ${data.donation.campaignTitle}`);
    console.log(`  Amount: Rp ${data.donation.amount.toLocaleString('id-ID')}`);
    console.log(`  Type: ${data.donation.recurringType}`);
    console.log(`  Status: ${data.donation.paymentStatus}`);
    console.log(`  Method: ${data.donation.paymentMethod}`);
    console.log(`  Donor: ${data.donation.donorName} (${data.donation.donorEmail})`);
    console.log(`  Created: ${new Date(data.donation.createdAt).toLocaleDateString('id-ID')}`);
    console.log(`  Last Charge: ${new Date(data.donation.processedAt).toLocaleDateString('id-ID')}`);
    console.log(`  Next Charge: ${new Date(data.donation.nextChargeEstimate).toLocaleDateString('id-ID')}`);

    if (data.chargeHistory && data.chargeHistory.length > 0) {
      console.log('\n📜 Charge History:');
      console.log('');
      data.chargeHistory.forEach((charge, i) => {
        console.log(`  ${i + 1}. Charge ID: ${charge.id}`);
        console.log(`     Amount: Rp ${charge.amount.toLocaleString('id-ID')}`);
        console.log(`     Status: ${charge.status}`);
        console.log(`     Date: ${new Date(charge.chargedAt).toLocaleString('id-ID')}`);
        console.log('');
      });
    } else {
      console.log('\n📜 Charge History: None yet');
    }
  } else {
    console.log('\n❌ Failed to get details:', data.error);
  }
}

async function testProcess(adminKey) {
  if (!adminKey) {
    console.error('❌ ERROR: Admin key required');
    console.log('Usage: node test-recurring.js process <ADMIN_KEY>');
    process.exit(1);
  }

  console.log('\n🔧 TEST: Trigger Recurring Donation Processing\n');

  console.log('📤 Request:');
  console.log('  POST /api/recurring/process-now');
  console.log(`  Headers: x-admin-key: ${adminKey.slice(0, 10)}...`);

  const { status, data } = await request('POST', '/api/recurring/process-now', null, {
    'x-admin-key': adminKey
  });

  console.log('\n📥 Response:');
  console.log('  Status:', status);

  if (data.success) {
    console.log('\n✅ Processing Triggered Successfully!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   Total Recurring: ${data.result.total}`);
    console.log(`   Processed: ${data.result.processed}`);
    console.log(`   Succeeded: ${data.result.succeeded}`);
    console.log(`   Failed: ${data.result.failed}`);
    console.log('');
    console.log('💡 Note: If processed=0, it means no donations are due for charging yet.');
    console.log('   (Monthly donations need 30+ days since last charge)');
  } else {
    console.log('\n❌ Failed:', data.error);
  }
}

async function testCancel(donationId, token) {
  if (!donationId || !token) {
    console.error('❌ ERROR: Donation ID and JWT token required');
    console.log('Usage: node test-recurring.js cancel <DONATION_ID> <JWT_TOKEN>');
    process.exit(1);
  }

  console.log('\n🔧 TEST: Cancel Recurring Donation\n');

  console.log('📤 Request:');
  console.log(`  POST /api/recurring/cancel/${donationId}`);

  const { status, data } = await request('POST', `/api/recurring/cancel/${donationId}`, null, {
    'Authorization': `Bearer ${token}`
  });

  console.log('\n📥 Response:');
  console.log('  Status:', status);

  if (data.success) {
    console.log('\n✅ Cancellation Successful!');
    console.log(`   Message: ${data.message}`);
  } else {
    console.log('\n❌ Cancellation Failed!');
    console.log(`   Error: ${data.error}`);
  }
}

async function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Recurring Donations - Quick Testing Script                   ║
╚════════════════════════════════════════════════════════════════╝

Commands:

  1. Setup new recurring donation:
     $ node scripts/test-recurring.js setup

  2. List user's recurring donations:
     $ node scripts/test-recurring.js list <JWT_TOKEN>

  3. Get recurring donation details & charge history:
     $ node scripts/test-recurring.js details <DONATION_ID> <JWT_TOKEN>

  4. Trigger automatic processing:
     $ node scripts/test-recurring.js process <ADMIN_KEY>

  5. Cancel recurring donation:
     $ node scripts/test-recurring.js cancel <DONATION_ID> <JWT_TOKEN>

Examples:

  # Setup recurring
  $ node scripts/test-recurring.js setup

  # List all recurring donations (need JWT token from login)
  $ node scripts/test-recurring.js list eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

  # Check charge history for donation ID 100
  $ node scripts/test-recurring.js details 100 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

  # Trigger processing manually
  $ node scripts/test-recurring.js process your-secret-admin-key

  # Cancel recurring donation ID 100
  $ node scripts/test-recurring.js cancel 100 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Environment Variables:

  API_URL    Base URL of the API (default: http://localhost:4000)

Setup:

  1. Make sure server is running:
     $ cd server && npm start

  2. Update .env with ADMIN_PROCESS_KEY:
     ADMIN_PROCESS_KEY=your-secret-key

  3. Run this script:
     $ node scripts/test-recurring.js <command>

`);
}

// Main
(async () => {
  console.log('🚀 Recurring Donations - Quick Testing Script\n');

  switch (command) {
    case 'setup':
      await testSetup();
      break;
    case 'list':
      await testList(args[1]);
      break;
    case 'details':
      await testDetails(args[1], args[2]);
      break;
    case 'process':
      await testProcess(args[1]);
      break;
    case 'cancel':
      await testCancel(args[1], args[2]);
      break;
    case 'help':
    case '-h':
    case '--help':
      await showHelp();
      break;
    default:
      console.log('❌ Unknown command:', command);
      console.log('\nUse: node scripts/test-recurring.js help\n');
      process.exit(1);
  }
})();
