import Subscription from '../models/Subscription.js';

// GET /api/subscription/status?userId=...
export const getStatus = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const sub = await Subscription.findOne({ userId, status: 'paid' })
      .sort({ expiry: -1 })
      .lean();

    if (!sub) return res.json({ isSubscribed: false, remainingDays: 0 });

    const today = new Date();
    const diff = new Date(sub.expiry).getTime() - today.getTime();
    const remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

    res.json({
      isSubscribed: remainingDays > 0,
      remainingDays,
      plan: sub.plan,
      expiry: sub.expiry,
    });
  } catch (e) {
    console.error('getStatus error', e);
    res.status(500).json({ error: 'Failed to get status' });
  }
};
