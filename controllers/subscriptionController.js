// controllers/subscriptionController.js
import Razorpay from "razorpay";
import crypto from "crypto";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import dotenv from "dotenv";
dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



// Create order for subscription
export const createSubscriptionOrder = async (req, res) => {
  try {
    const { planName, amount, duration } = req.body; // duration = days

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Razorpay order error:", error);
    res.status(500).json({ message: "Failed to create subscription order" });
  }
};

// Verify payment & activate subscription
export const confirmSubscription = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planName,
      duration,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Activate subscription
      const user = await User.findOne({ uid: req.user.uid });
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);

      const subscription = new Subscription({
        userId: user._id,
        planName,
        endDate,
        status: "active",
      });

      await subscription.save();
      return res.json({ message: "Subscription activated", subscription });
    } else {
      return res.status(400).json({ message: "Invalid signature" });
    }
  } catch (error) {
    console.error("Verify subscription error:", error);
    res.status(500).json({ message: "Subscription verification failed" });
  }
};

// Check user subscription
export const checkSubscription = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    const subscription = await Subscription.findOne({
      userId: user._id,
      status: "active",
      endDate: { $gte: new Date() },
    });

    res.json({ subscribed: !!subscription, subscription });
  } catch (error) {
    res.status(500).json({ message: "Error checking subscription" });
  }
};
