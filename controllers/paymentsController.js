import crypto from "crypto";
import { rzp, PLANS } from "../utils/razorpay.js";
import Subscription from "../models/Subscription.js";
import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: amount * 100, 
      currency: "INR",
      receipt: "order_rcptid_" + Date.now(),
    };

    const order = await instance.orders.create(options);
    res.json({ orderId: order.id, amount: order.amount });
  } catch (err) {
    console.error("createRazorpayOrder error:", err);
    res
      .status(500)
      .json({ error: "Failed to create Razorpay order", details: err.message });
  }
};

// ==============================
// POST /api/payments/create-order
// body: { plan: 'monthly'|'annual', userId: string }
// ==============================
export const createOrder = async (req, res) => {
  try {
    const { plan, userId } = req.body;
    if (!plan || !userId || !PLANS[plan]) {
      return res.status(400).json({ error: "Invalid plan or userId" });
    }

    const { amount } = PLANS[plan];

    // ✅ fix: Razorpay receipt max 40 chars
    const shortUserId = userId.slice(0, 8);
    const receipt = `rcpt_${shortUserId}_${Date.now().toString().slice(-6)}`;

    const order = await rzp.orders.create({
      amount,
      currency: "INR",
      receipt,
    });

    await Subscription.create({
      userId,
      plan,
      amount,
      orderId: order.id,
      receipt,
      status: "created",
      raw: order,
    });

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount,
      currency: "INR",
    });
  } catch (e) {
    console.error("createOrder error", e);
    res.status(500).json({ error: "Failed to create order" });
  }
};

// ==============================
// POST /api/payments/verify
// body: { orderId, paymentId, signature, userId }
// ==============================
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, userId } = req.body;
    if (!orderId || !paymentId || !signature || !userId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const hmac = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (hmac !== signature) {
      await Subscription.findOneAndUpdate(
        { orderId },
        { status: "failed", raw: { reason: "signature_mismatch", signature } }
      );
      return res.status(400).json({ error: "Signature mismatch" });
    }

    const sub = await Subscription.findOne({ orderId, userId });
    if (!sub)
      return res.status(404).json({ error: "Subscription record not found" });

    const days = PLANS[sub.plan].days;
    const start = new Date();
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + days);

    sub.status = "paid";
    sub.paymentId = paymentId;
    sub.start = start;
    sub.expiry = expiry;
    await sub.save();

    res.json({ success: true, plan: sub.plan, start, expiry });
  } catch (e) {
    console.error("verifyPayment error", e);
    res.status(500).json({ error: "Verification failed" });
  }
};

// ==============================
// POST /api/payments/webhook
// Razorpay Webhook (payment.captured)
// ==============================
export const webhook = async (req, res) => {
  try {
    const razorpaySignature = req.headers["x-razorpay-signature"];
    const bodyBuf = req.body; // raw buffer (make sure middleware is set correctly)

    const expected = crypto
      .createHmac("sha256", process.env.WEBHOOK_SECRET)
      .update(bodyBuf)
      .digest("hex");

    if (expected !== razorpaySignature) {
      return res.status(400).send("Invalid webhook signature");
    }

    const payload = JSON.parse(bodyBuf.toString());
    if (payload.event === "payment.captured") {
      const orderId = payload.payload.payment.entity.order_id;
      const paymentId = payload.payload.payment.entity.id;

      const sub = await Subscription.findOne({ orderId });
      if (sub && sub.status !== "paid") {
        const days = PLANS[sub.plan].days;
        const start = new Date();
        const expiry = new Date(start);
        expiry.setDate(expiry.getDate() + days);

        sub.status = "paid";
        sub.paymentId = paymentId;
        sub.start = start;
        sub.expiry = expiry;
        await sub.save();
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error("webhook error", e);
    res.status(500).send("Webhook handler error");
  }
};
