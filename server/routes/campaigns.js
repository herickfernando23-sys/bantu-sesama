const express = require('express');
const router = express.Router();
const { Campaign, Category, User } = require('../models');
const optionalAuth = require('../middleware/optionalAuth');

router.get('/', async (req, res) => {
  const campaigns = await Campaign.findAll({ include: [Category, User] });
  res.json(campaigns);
});

router.post('/', optionalAuth, async (req, res) => {
  const {
    title,
    description,
    goal,
    categoryIds,
    creatorEmail,
    organizer,
    location,
    category,
    image,
    status = 'pending',
    daysLeft = 30,
    fullDescription = ''
  } = req.body;

  if (!title || !description || !goal) {
    return res.status(400).json({ error: 'title, description, dan goal wajib diisi' });
  }

  const cam = await Campaign.create({
    title,
    description,
    goal,
    collected: 0,
    creatorEmail: creatorEmail || req.user?.email || null,
    organizer: organizer || req.user?.name || '',
    location: location || '',
    category: category || '',
    image: image || '',
    status,
    daysLeft,
    fullDescription,
    UserId: req.user?.id || null
  });
  if (Array.isArray(categoryIds)) {
    const cats = await Category.findAll({ where: { id: categoryIds } });
    await cam.setCategories(cats);
  }
  res.json(cam);
});

module.exports = router;
