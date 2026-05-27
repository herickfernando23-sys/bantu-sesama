const express = require('express');
const router = express.Router();
const optionalAuth = require('../middleware/optionalAuth');
const { sequelize } = require('../models');
const { Tip } = sequelize.models;

// Create tip (public) - tip is a platform-level contribution
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { amount, donorName, donorEmail, isAnonymous = false, message = '', paymentMethod, midtransTransactionId } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

    let userId = req.user?.id || null;

    const tip = await Tip.create({
      userId,
      amount: Number(amount),
      donorName: isAnonymous ? 'Anonymous' : donorName,
      donorEmail,
      isAnonymous,
      message,
      paymentMethod: paymentMethod || null,
      midtransTransactionId: midtransTransactionId || null,
      paymentStatus: 'pending'
    });

    res.json({ success: true, tipId: tip.id });
  } catch (err) {
    console.error('Create tip error', err);
    res.status(500).json({ error: err.message || 'Failed to create tip' });
  }
});

// List tips (admin)
// Public: list tips (for admin UI in demo)
router.get('/', async (req, res) => {
  try {
    const tips = await Tip.findAll({ order: [['createdAt', 'DESC']] });
    res.json(tips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const tipId = Number(req.params.id);
    if (!Number.isSafeInteger(tipId) || tipId <= 0) {
      return res.status(400).json({ error: 'Invalid tip id' });
    }

    const tip = await Tip.findByPk(tipId);
    if (!tip) return res.status(404).json({ error: 'Not found' });

    await tip.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete tip error', err);
    res.status(500).json({ error: err.message || 'Gagal menghapus tip' });
  }
});

module.exports = router;
