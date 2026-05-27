const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../models');
const optionalAuth = require('../middleware/optionalAuth');
const { SponsorBanner } = sequelize.models;

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_')}`)
});

const upload = multer({ storage });

// Public: list active banners
router.get('/', async (req, res) => {
  try {
    const banners = await SponsorBanner.findAll({ where: { active: true }, order: [['createdAt', 'DESC']] });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload banner (publicly allowed for demo/admin via UI)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { title, link } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Image required' });

    const publicPath = `/uploads/${path.basename(req.file.path)}`;
    const banner = await SponsorBanner.create({ title: title || 'Sponsor', imageUrl: publicPath, link: link || null, active: true });
    res.json({ success: true, banner });
  } catch (err) {
    console.error('Upload banner error', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete banner (public for demo) — in production protect this endpoint
router.delete('/:id', async (req, res) => {
  try {
    const bannerId = Number(req.params.id);
    if (!Number.isSafeInteger(bannerId) || bannerId <= 0) {
      return res.status(400).json({ error: 'Invalid banner id' });
    }

    const banner = await SponsorBanner.findByPk(bannerId);
    if (!banner) return res.status(404).json({ error: 'Not found' });
    // remove file if exists
    if (banner.imageUrl) {
      const filePath = path.join(__dirname, '..', banner.imageUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await banner.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete banner error', err);
    res.status(500).json({ error: err.message || 'Gagal menghapus banner' });
  }
});

module.exports = router;
