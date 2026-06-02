const express = require('express');
const router = express.Router();
const { User } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.route('/register')
  .post(async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({ 
          message: 'Nama, email, dan password diperlukan',
          missing: [!name && 'name', !email && 'email', !password && 'password'].filter(Boolean)
        });
      }

      // Check if email already exists
      const exists = await User.findOne({ where: { email } });
      if (exists) {
        return res.status(400).json({ message: 'Email sudah terdaftar' });
      }

      // Create user
      const user = await User.create({ name, email, password });
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'change_me');
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
      console.error('Register error:', err.message);
      res.status(500).json({ error: err.message });
    }
  })
  .all((req, res) => {
    res.status(405).json({
      error: 'Method not allowed',
      method: req.method,
      path: req.originalUrl,
      message: 'Gunakan POST /api/auth/register untuk registrasi.'
    });
  });

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'change_me');
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email'],
      order: [['createdAt', 'ASC']]
    });

    res.json(users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
