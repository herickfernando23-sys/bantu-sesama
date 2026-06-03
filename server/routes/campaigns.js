const express = require('express');
const router = express.Router();
const { Campaign, Category, User, Donation } = require('../models');
const optionalAuth = require('../middleware/optionalAuth');

const toCleanText = (value) => String(value || '').replace(/^\s*#{1,6}\s*/gm, '').replace(/\s+/g, ' ').trim();

const sanitizeFundAllocation = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      name: String(item?.name || '').trim(),
      value: Number(item?.value || 0),
      color: String(item?.color || '#10B981').trim() || '#10B981'
    }))
    .filter((item) => item.name && Number.isFinite(item.value) && item.value > 0);
};

const sanitizeDisbursementHistory = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      date: String(item?.date || '').trim(),
      amount: Number(item?.amount || 0),
      purpose: String(item?.purpose || '').trim()
    }))
    .filter((item) => item.date && Number.isFinite(item.amount) && item.amount >= 0 && item.purpose);
};

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
    const campaigns = await Campaign.findAll({
      include: [
        Category,
        User,
        {
          model: Donation,
          attributes: ['id', 'amount', 'message', 'createdAt', 'donorName', 'donorEmail', 'isAnonymous'],
          where: { paymentStatus: 'succeeded' },
          required: false
        }
      ]
    });

    const filteredCampaigns = campaigns
      .filter((campaign) => campaign.status !== 'rejected' && !isLikelySpam(campaign))
      .map((campaign) => {
        const plainCampaign = campaign.toJSON();
        const succeededDonations = Array.isArray(plainCampaign.Donations) ? plainCampaign.Donations : [];

        return {
          ...plainCampaign,
          collected: succeededDonations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0),
          donors: succeededDonations.length,
          donations: succeededDonations.map((donation) => ({
            name: donation.isAnonymous ? 'Anonymous' : donation.donorName || 'Donatur',
            amount: Number(donation.amount || 0),
            message: donation.message || '',
            timestamp: donation.createdAt ? new Date(donation.createdAt).getTime() : Date.now(),
            email: donation.donorEmail || undefined
          }))
        };
      });

    res.json(filteredCampaigns);
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get single campaign by id (including succeeded donations)
router.get('/:id', async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    if (!Number.isFinite(campaignId) || campaignId <= 0) {
      return res.status(400).json({ error: 'campaign id tidak valid' });
    }

    const campaign = await Campaign.findByPk(campaignId, {
      include: [
        Category,
        User,
        {
          model: Donation,
          attributes: ['id', 'amount', 'message', 'createdAt', 'donorName', 'donorEmail', 'isAnonymous'],
          where: { paymentStatus: 'succeeded' },
          required: false
        }
      ]
    });

    if (!campaign) return res.status(404).json({ error: 'campaign not found' });

    const plainCampaign = campaign.toJSON();
    const succeededDonations = Array.isArray(plainCampaign.Donations) ? plainCampaign.Donations : [];

    const response = {
      ...plainCampaign,
      collected: succeededDonations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0),
      donors: succeededDonations.length,
      donations: succeededDonations.map((donation) => ({
        name: donation.isAnonymous ? 'Anonymous' : donation.donorName || 'Donatur',
        amount: Number(donation.amount || 0),
        message: donation.message || '',
        timestamp: donation.createdAt ? new Date(donation.createdAt).getTime() : Date.now(),
        email: donation.donorEmail || undefined
      }))
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching campaign by id:', err);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Error updating campaign status:', err);
    res.status(500).json({ error: 'Failed to update campaign status' });
  }
});

router.patch('/:id', optionalAuth, async (req, res) => {
  try {
    const campaignId = Number(req.params.id);

    if (!Number.isFinite(campaignId) || campaignId <= 0) {
      return res.status(400).json({ error: 'campaign id tidak valid' });
    }

    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'campaign not found' });
    }

    const requesterEmail = toCleanText(req.user?.email || req.body?.creatorEmail || '');
    const ownerEmail = toCleanText(campaign.creatorEmail || '');
    if (!requesterEmail || !ownerEmail || requesterEmail.toLowerCase() !== ownerEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Anda tidak berhak mengubah kampanye ini' });
    }

    const cleanTitle = toCleanText(req.body?.title || campaign.title);
    const cleanStory = toCleanText(req.body?.fullDescription || req.body?.story || req.body?.description || campaign.fullDescription || campaign.description);
    const cleanDescription = toCleanText(req.body?.description || cleanStory || campaign.description);
    const cleanOrganizer = toCleanText(req.body?.organizer || campaign.organizer || ownerEmail || 'Penggalang');
    const cleanLocation = toCleanText(req.body?.location || campaign.location);
    const cleanCategory = toCleanText(req.body?.category || campaign.category);
    const cleanImage = String(req.body?.image || '').trim();
    const normalizedGoal = Number(req.body?.target ?? req.body?.goal ?? campaign.goal);
    const normalizedDaysLeft = Number(req.body?.daysLeft ?? campaign.daysLeft);
    const nextFundAllocation = req.body?.fundAllocation !== undefined
      ? sanitizeFundAllocation(req.body?.fundAllocation)
      : campaign.fundAllocation;
    const nextDisbursementHistory = req.body?.disbursementHistory !== undefined
      ? sanitizeDisbursementHistory(req.body?.disbursementHistory)
      : campaign.disbursementHistory;

    if (cleanTitle.length < 4) {
      return res.status(400).json({ error: 'Judul kampanye minimal 4 karakter' });
    }

    if (cleanDescription.length < 10) {
      return res.status(400).json({ error: 'Deskripsi kampanye minimal 10 karakter' });
    }

    if (!Number.isFinite(normalizedGoal) || normalizedGoal < 100000) {
      return res.status(400).json({ error: 'Target dana minimal Rp 100.000' });
    }

    if (cleanLocation.length < 2) {
      return res.status(400).json({ error: 'Lokasi kampanye tidak valid' });
    }

    if (!Number.isFinite(normalizedDaysLeft) || normalizedDaysLeft < 0) {
      return res.status(400).json({ error: 'Deadline kampanye tidak valid' });
    }

    campaign.title = cleanTitle;
    campaign.description = cleanDescription;
    campaign.fullDescription = cleanStory;
    campaign.goal = normalizedGoal;
    campaign.organizer = cleanOrganizer;
    campaign.location = cleanLocation;
    campaign.category = cleanCategory;
    campaign.image = cleanImage;
    campaign.daysLeft = normalizedDaysLeft;
    campaign.fundAllocation = nextFundAllocation;
    campaign.disbursementHistory = nextDisbursementHistory;

    await campaign.save();

    return res.json(campaign);
  } catch (err) {
    console.error('Error updating campaign:', err);
    return res.status(500).json({ error: 'Failed to update campaign' });
  }
});

router.post('/', optionalAuth, async (req, res) => {
  try {
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
      fundAllocation: sanitizeFundAllocation(req.body?.fundAllocation),
      disbursementHistory: sanitizeDisbursementHistory(req.body?.disbursementHistory),
      UserId: req.user?.id || null
    });
    if (Array.isArray(categoryIds)) {
      const cats = await Category.findAll({ where: { id: categoryIds } });
      await cam.setCategories(cats);
    }
    res.json(cam);
  } catch (err) {
    console.error('Error creating campaign:', err);
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'ID kampanye bentrok. Silakan coba lagi.' });
    }
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

module.exports = router;
