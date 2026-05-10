const { Sequelize } = require('sequelize');

const databaseUrl = 'postgres://postgres:password@localhost:5432/microcrowd';
const sequelize = new Sequelize(databaseUrl, { logging: false });

(async () => {
  try {
    console.log('\n📊 DATABASE CHECK - Donation ID 328');
    console.log('=====================================\n');
    
    const result = await sequelize.query(
      `SELECT id, amount, recurring_type, payment_status, donor_name, created_at 
       FROM "Donations" WHERE id = 328`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (result.length > 0) {
      const d = result[0];
      console.log('✅ Donation Found!');
      console.log('  ID:', d.id);
      console.log('  Amount: Rp', Number(d.amount).toLocaleString('id-ID'));
      console.log('  Recurring Type:', d.recurring_type);
      console.log('  Payment Status:', d.payment_status);
      console.log('  Donor Name:', d.donor_name);
      console.log('  Created At:', d.created_at);
      console.log('');
      console.log('✅ VERIFICATION:');
      console.log('  ✓ recurring_type = monthly?', d.recurring_type === 'monthly' ? '✅ YES' : '❌ NO');
      console.log('  ✓ payment_status = succeeded?', d.payment_status === 'succeeded' ? '✅ YES' : '❌ NO');
    } else {
      console.log('❌ Donation not found');
    }
    await sequelize.close();
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
