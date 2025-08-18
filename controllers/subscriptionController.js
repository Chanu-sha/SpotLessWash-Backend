import User from "../models/User.js";

export const getStatus = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const user = await User.findOne({ uid: userId }).lean();

    if (!user || !user.subscription || user.subscription.status !== "active") {
      return res.json({ isSubscribed: false, remainingDays: 0 });
    }

    const today = new Date();
    const expiry = new Date(user.subscription.expiry);

    if (expiry < today) {
      // Expired -> set inactive
      await User.updateOne(
        { uid: userId },
        { "subscription.status": "inactive" }
      );
      return res.json({ isSubscribed: false, remainingDays: 0 });
    }

    const diff = expiry.getTime() - today.getTime();
    const remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

    res.json({
      isSubscribed: true,
      remainingDays,
      plan: user.subscription.plan,
      expiry: user.subscription.expiry,
    });
  } catch (e) {
    console.error("getStatus error", e);
    res.status(500).json({ error: "Failed to get status" });
  }
};
