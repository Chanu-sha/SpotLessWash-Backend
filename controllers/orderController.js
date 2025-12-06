import dotenv from "dotenv";
import Order from "../models/Order.js";
import Vendor from "../models/Vendor.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import CODWallet from "../models/CODWallet.js";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * INTERNAL: Delivery charge calculator
 * Rules:
 *  - First order => FREE (0)
 *  - Subtotal ≥ 399 => FREE (0)
 *  - Otherwise => 50
 */
async function calculateDeliveryCharge(userId, subtotal) {
  if (subtotal >= 399) return 0;
  const previousOrders = await Order.countDocuments({ userId });
  if (previousOrders === 0) return 0;
  return 50;
}

/**
 * PUBLIC: Delivery charge quote (auth required)
 * GET /order/delivery-charge?subtotal=<number>
 * Resp: { success, subtotal, deliveryCharge, total, reason }
 *   reason: "FIRST_ORDER" | "THRESHOLD" | "NONE"
 */
export const getDeliveryChargeQuote = async (req, res) => {
  try {
    const raw = req.query.subtotal;
    const subtotal = Number(raw || 0);
    if (isNaN(subtotal) || subtotal < 0) {
      return res.status(400).json({ message: "Invalid subtotal" });
    }

    const userId = req.user.uid;
    const deliveryCharge = await calculateDeliveryCharge(userId, subtotal);

    res.json({
      success: true,
      subtotal,
      deliveryCharge,
      total: subtotal + deliveryCharge,
      reason:
        deliveryCharge === 0
          ? subtotal >= 399
            ? "THRESHOLD"
            : "FIRST_ORDER"
          : "NONE",
    });
  } catch (error) {
    console.error("Delivery charge quote error:", error);
    res.status(500).json({ message: "Failed to get delivery charge quote" });
  }
};

// Create Razorpay Order
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: currency || "INR",
      receipt: receipt || `receipt_${Date.now()}`,
    };

    razorpayInstance.orders.create(options, (err, order) => {
      if (!err) {
        res.status(200).json({
          success: true,
          msg: "Order Created",
          order_id: order.id,
          amount: amountInPaise,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
          product_name: "Laundry Services",
          description: req.body.description || "Laundry service payment",
        });
      } else {
        console.error("Razorpay order creation error:", err);
        res.status(400).json({
          success: false,
          msg: "Something went wrong!",
          error: err.message,
        });
      }
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

// Verify Razorpay Payment
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters",
      });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      res.json({
        success: true,
        message: "Payment verified successfully",
        payment_id: razorpay_payment_id,
      });
    } else {
      console.error("Invalid signature for payment:", razorpay_payment_id);

      res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

// Place Order (UPDATED to use backend delivery charge)
export const placeOrder = async (req, res) => {
  try {
    const {
      userName,
      userMobile,
      userAddress,
      vendorId,
      vendorName,
      vendorAddress,
      services,
      assignedDhobi,
      paymentMethod,
      paymentId,
      paymentStatus,
    } = req.body;

    if (!/^\d{10}$/.test(userMobile)) {
      return res
        .status(400)
        .json({ message: "Please enter valid 10 digit mobile number" });
    }
    if (!userAddress || userAddress.trim() === "") {
      return res.status(400).json({ message: "Please enter valid address" });
    }

    if (!paymentMethod || !["online", "cod"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    if (
      paymentMethod === "online" &&
      (!paymentId || paymentStatus !== "completed")
    ) {
      return res.status(400).json({
        message: "Invalid payment details for online payment",
      });
    }

    // Subtotal from services
    const subtotal = services.reduce(
      (sum, s) => sum + (s.price || 0) * (s.quantity || 1),
      0
    );

    // Calculate delivery charge using rules
    const deliveryCharge = await calculateDeliveryCharge(req.user.uid, subtotal);

    // Total = subtotal + delivery
    const totalPrice = subtotal + deliveryCharge;

    const otp = generateOTP();

    const order = new Order({
      userId: req.user.uid,
      userName,
      userMobile,
      userAddress,
      vendorId,
      vendorName,
      vendorAddress,
      services,
      // NEW: store deliveryCharge
      deliveryCharge,
      totalPrice,
      otp,
      status: "Scheduled",
      assignedDhobi,
      paymentMethod,
      paymentId: paymentId || null,
      paymentStatus: paymentMethod === "online" ? "paid" : "pending",
    });

    await order.save();

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error("Order Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Get User Orders
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.uid }).sort({
      date: -1,
    });

    const current = orders.filter(
      (order) => !["Delivered", "Cancelled"].includes(order.status)
    );

    const past = orders.filter((order) =>
      ["Delivered", "Cancelled"].includes(order.status)
    );

    res.json({ current, past });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Track Order
export const trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.user.uid,
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Order Status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Scheduled",
      "In Progress",
      "Ready for Pickup",
      "Picked Up",
      "Washing",
      "Washed",
      "Picking Up",
      "Delievery Picked Up",
      "Delivered",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order updated", order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verify OTP and Complete Pickup Order (WITH COD CONFIRMATION)
export const verifyOtpAndCompleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp, codConfirmed } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !order.pickupClaimedBy ||
      order.pickupClaimedBy.toString() !== req.user.uid.toString()
    ) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // COD Check - Only for pickup orders with COD payment
    if (order.paymentMethod === "cod" && order.status === "Ready for Pickup") {
      if (!codConfirmed) {
        return res.status(400).json({
          message: "Please confirm COD collection",
          requiresCODConfirmation: true,
          orderDetails: {
            totalPrice: order.totalPrice,
            userName: order.userName,
            userMobile: order.userMobile,
          },
        });
      }

      // Add to COD wallet
      let codWallet = await CODWallet.findOne({ deliveryBoyId: req.user.uid });
      if (!codWallet) {
        codWallet = await CODWallet.create({ deliveryBoyId: req.user.uid });
      }

      await codWallet.addCollection({
        orderId: order._id,
        deliveryBoyId: req.user.uid,
        amount: order.totalPrice,
        orderDetails: {
          userName: order.userName,
          userMobile: order.userMobile,
          serviceName: order.services[0]?.name || "N/A",
          quantity: order.services[0]?.quantity || 1,
        },
      });

      order.paymentStatus = "collected";
    }

    order.status = "Picked Up";
    await order.save();

    res.json({
      message: "Order marked as completed",
      order,
      codCollected: order.paymentMethod === "cod",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Verify OTP and Receive by Vendor
export const verifyOtpAndReceiveByVendor = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !order.assignedDhobi ||
      order.assignedDhobi.toString() !== req.user.uid.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    order.status = "Washing";
    await order.save();

    res.json({ message: "Order marked as received", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Unclaimed Orders
export const getUnclaimedOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      claimedBy: null,
      status: { $in: ["Scheduled", "In Progress"] },
    }).sort({ date: -1 });

    res.json({ orders });
  } catch (error) {
    console.error("Error fetching unclaimed orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Assigned Orders
export const getAssignedOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.uid);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const orders = await Order.find({ assignedDhobi: vendor._id })
      .populate("pickupClaimedBy", "name phone")
      .populate("deliveryClaimedBy", "name phone")
      .populate("assignedDhobi", "name phone address")
      .sort({ createdAt: -1 });

    res.json({
      message: "Assigned orders fetched successfully",
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error fetching assigned orders:", error);
    res.status(500).json({
      message: "Failed to fetch assigned orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Washing Orders for Vendor
export const getWashingOrdersForVendor = async (req, res) => {
  try {
    const orders = await Order.find({
      assignedDhobi: req.user.uid,
      status: { $in: ["Washing", "Washed", "Picking Up"] },
    })
      .populate("assignedDhobi", "name phone address")
      .populate("pickupClaimedBy", "name phone")
      .populate("deliveryClaimedBy", "name phone");

    res.json({ orders });
  } catch (error) {
    console.error("Error fetching washing orders:", error);
    res.status(500).json({ message: "Failed to fetch washing orders" });
  }
};

// Get Delivery Orders
export const getDeliveryOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: "Washed" })
      .populate("assignedDhobi", "name address mobile")
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    console.error("Error fetching delivery orders:", error);
    res.status(500).json({ message: "Failed to fetch delivery orders" });
  }
};

// Verify OTP for Delivery Pickup from Vendor
export const verifyOtpForDeliveryPickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !order.deliveryClaimedBy ||
      order.deliveryClaimedBy.toString() !== req.user.uid.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized for this delivery order" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    order.status = "Delievery Picked Up";
    await order.save();

    res.json({ message: "Delivery pickup confirmed", order });
  } catch (error) {
    console.error("Delivery pickup OTP error:", error);
    res
      .status(500)
      .json({ message: "Failed to verify OTP for delivery pickup" });
  }
};

// Verify OTP for Final Delivery (WITH COD CONFIRMATION)
export const verifyOtpForFinalDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp, codConfirmed } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !order.deliveryClaimedBy ||
      order.deliveryClaimedBy.toString() !== req.user.uid.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized for this delivery order" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // COD Check - Only for delivery orders with COD payment that hasn't been collected yet
    if (order.paymentMethod === "cod" && order.paymentStatus !== "collected") {
      if (!codConfirmed) {
        return res.status(400).json({
          message: "Please confirm COD collection",
          requiresCODConfirmation: true,
          orderDetails: {
            totalPrice: order.totalPrice,
            userName: order.userName,
            userMobile: order.userMobile,
          },
        });
      }

      // Add to COD wallet
      let codWallet = await CODWallet.findOne({ deliveryBoyId: req.user.uid });
      if (!codWallet) {
        codWallet = await CODWallet.create({ deliveryBoyId: req.user.uid });
      }

      await codWallet.addCollection({
        orderId: order._id,
        deliveryBoyId: req.user.uid,
        amount: order.totalPrice,
        orderDetails: {
          userName: order.userName,
          userMobile: order.userMobile,
          serviceName: order.services[0]?.name || "N/A",
          quantity: order.services[0]?.quantity || 1,
        },
      });

      order.paymentStatus = "collected";
    }

    order.status = "Delivered";
    await order.save();

    res.json({
      message: "Order delivered successfully",
      order,
      codCollected: order.paymentMethod === "cod",
    });
  } catch (error) {
    console.error("Final delivery OTP error:", error);
    res
      .status(500)
      .json({ message: "Failed to verify OTP for final delivery" });
  }
};

// Get My Delivery Orders
export const getMyDeliveryOrders = async (req, res) => {
  try {
    const userId = req.user.uid;
    const orders = await Order.find({ deliveryClaimedBy: userId }).sort({
      createdAt: -1,
    });
    res.json({ orders });
  } catch (error) {
    console.error("Get My Delivery Orders Error:", error);
    res.status(500).json({ message: "Failed to fetch delivery orders" });
  }
};

// Claim Pickup Order
export const claimPickupOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = await DeliveryBoy.findById(req.user.uid);

    if (!user)
      return res.status(404).json({ message: "Delivery boy not found" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.pickupClaimedBy) {
      return res.status(400).json({ message: "Pickup already claimed" });
    }

    order.pickupClaimedBy = req.user.uid;
    order.status = "Ready for Pickup";
    await order.save();

    user.claimedOrders.push(orderId);
    await user.save();

    res.json({ message: "Pickup order claimed successfully!", order });
  } catch (error) {
    console.error("Claim pickup error:", error);
    res.status(500).json({ message: "Failed to claim pickup order" });
  }
};

// Claim Delivery Order
export const claimDeliveryOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = await DeliveryBoy.findById(req.user.uid);

    if (!user)
      return res.status(404).json({ message: "Delivery boy not found" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.deliveryClaimedBy) {
      return res.status(400).json({ message: "Delivery already claimed" });
    }

    order.deliveryClaimedBy = req.user.uid;
    order.status = "Picking Up";
    await order.save();

    user.claimedOrders.push(orderId);
    await user.save();

    res.json({ message: "Delivery order claimed successfully!", order });
  } catch (error) {
    console.error("Claim delivery error:", error);
    res.status(500).json({ message: "Failed to claim delivery order" });
  }
};

// Get My Pickup Orders
export const getMyPickupOrders = async (req, res) => {
  try {
    const userId = req.user.uid;

    const orders = await Order.find({ pickupClaimedBy: userId }).sort({
      createdAt: -1,
    });

    res.json({ orders });
  } catch (error) {
    console.error("Get My Pickup Orders Error:", error);
    res.status(500).json({ message: "Failed to fetch pickup orders" });
  }
};

// Regenerate OTP for Completed Orders (Works for both Delivery Boy & Vendor)
export const regenerateOTP = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Authorization check - Different for delivery boys and vendors
    let isAuthorized = false;
    let allowedStatus = [];

    // Check if user is delivery boy (pickup)
    if (
      order.pickupClaimedBy &&
      order.pickupClaimedBy.toString() === req.user.uid.toString()
    ) {
      isAuthorized = true;
      allowedStatus = ["Picked Up"]; // Delivery boy can regenerate after pickup
    }

    // Check if user is vendor (assigned dhobi)
    if (
      order.assignedDhobi &&
      order.assignedDhobi.toString() === req.user.uid.toString()
    ) {
      isAuthorized = true;
      allowedStatus = ["Washed", "Picking Up"]; // Vendor can regenerate for washed orders
    }

    // Check if user is delivery boy (delivery)
    if (
      order.deliveryClaimedBy &&
      order.deliveryClaimedBy.toString() === req.user.uid.toString()
    ) {
      isAuthorized = true;
      allowedStatus = ["Delievery Picked Up"];
    }

    if (!isAuthorized) {
      return res.status(403).json({
        message: "Not authorized to regenerate OTP for this order",
      });
    }

    // Check if order status allows OTP regeneration
    if (!allowedStatus.includes(order.status)) {
      return res.status(400).json({
        message: `OTP can only be regenerated for orders with status: ${allowedStatus.join(
          ", "
        )}`,
      });
    }

    // Generate new OTP
    const newOTP = generateOTP();
    order.otp = newOTP;
    await order.save();

    res.json({
      success: true,
      message: "New OTP generated successfully",
      newOtp: newOTP,
    });
  } catch (error) {
    console.error("Regenerate OTP error:", error);
    res.status(500).json({
      message: "Failed to regenerate OTP",
      error: error.message,
    });
  }
};
