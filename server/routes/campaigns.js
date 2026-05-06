const express = require('express');
const router = express.Router();
const { Campaign, Category, User } = require('../models');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  const campaigns = await Campaign.findAll({ include: [Category, User] });
  res.json(campaigns);
});

router.post('/', auth, async (req, res) => {
  const { title, description, goal, categoryIds } = req.body;
  const cam = await Campaign.create({ title, description, goal, UserId: req.user.id });
  if (Array.isArray(categoryIds)) {
    const cats = await Category.findAll({ where: { id: categoryIds } });
    await cam.setCategories(cats);
  }
  res.json(cam);
});

module.exports = router;
