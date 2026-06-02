const express = require('express');
const router = express.Router();
const { Campaign, Category, User } = require('../models');
const optionalAuth = require('../middleware/optionalAuth');

const toCleanText = (value) => String(value || '').replace(/^\s*#{1,6}\s*/gm, '').replace(/\s+/g, ' ').trim();

const isLikelySpam = (campaign) => {
  const title = toCleanText(campaign.title);
  const description = toCleanText(campaign.description || campaign.fullDescription);
  const organizer = toCleanText(campaign.organizer);
  const location = toCleanText(campaign.location);
  const goal = Number(campaign.goal || 0);

  // Hide obvious test/dummy records from admin/public listing.
  return (
    title.length < 4
    || description.length < 10
    || organizer.length < 2
    || location.length < 2
    || !Number.isFinite(goal)
    || goal < 100000
  );
};

router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.findAll({ include: [Category, User] });
    const filteredCampaigns = campaigns.filter((campaign) => campaign.status !== 'rejected' && !isLikelySpam(campaign));
    res.json(filteredCampaigns);
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    // Return empty array if database connection fails temporarily
    // This allows the frontend to show demo data instead of crashing
    res.status(200).json([]);
  }
});

router.patch('/:id/status', async (req, res) => {
  const campaignId = Number(req.params.id);
  const nextStatus = String(req.body?.status || '').trim().toLowerCase();

  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return res.status(400).json({ error: 'campaign id tidak valid' });
  }

  if (!['verified', 'pending', 'rejected'].includes(nextStatus)) {
    return res.status(400).json({ error: 'status tidak valid' });
  }

  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) {
    return res.status(404).json({ error: 'campaign not found' });
  }

  campaign.status = nextStatus;
  await campaign.save();

  res.json(campaign);
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

  const cleanTitle = toCleanText(title);
  const cleanDescription = toCleanText(description);
  const cleanFullDescription = toCleanText(fullDescription || description);
  const cleanOrganizer = toCleanText(organizer || req.user?.name || '');
  const cleanLocation = toCleanText(location);
  const cleanCategory = toCleanText(category);
  const normalizedGoal = Number(goal);
  const normalizedDaysLeft = Number(daysLeft);
  const fallbackOrganizer = toCleanText(creatorEmail || req.user?.email || 'Penggalang');
  const finalOrganizer = cleanOrganizer.length >= 2 ? cleanOrganizer : fallbackOrganizer;

  if (!cleanTitle || !cleanDescription || !Number.isFinite(normalizedGoal)) {
    return res.status(400).json({ error: 'title, description, dan goal wajib diisi' });
  }

  if (cleanTitle.length < 4) {
    return res.status(400).json({ error: 'Judul kampanye minimal 4 karakter' });
  }

  if (cleanDescription.length < 10) {
    return res.status(400).json({ error: 'Deskripsi kampanye minimal 10 karakter' });
  }

  if (normalizedGoal < 100000) {
    return res.status(400).json({ error: 'Target dana minimal Rp 100.000' });
  }

  if (cleanLocation.length < 2) {
    return res.status(400).json({ error: 'Lokasi kampanye tidak valid' });
  }

  // New submissions from public flow must always enter moderation queue.
  const safeStatus = 'pending';

  const cam = await Campaign.create({
    title: cleanTitle,
    description: cleanDescription,
    goal: normalizedGoal,
    collected: 0,
    creatorEmail: creatorEmail || req.user?.email || null,
    organizer: finalOrganizer,
    location: cleanLocation,
    category: cleanCategory,
    image: image || '',
    status: safeStatus,
    daysLeft: Number.isFinite(normalizedDaysLeft) && normalizedDaysLeft > 0 ? normalizedDaysLeft : 30,
    fullDescription: cleanFullDescription,
    UserId: req.user?.id || null
  });
  if (Array.isArray(categoryIds)) {
    const cats = await Category.findAll({ where: { id: categoryIds } });
    await cam.setCategories(cats);
  }
  res.json(cam);
});

module.exports = router;
