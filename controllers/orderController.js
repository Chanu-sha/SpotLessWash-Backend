import dotenv from 'dotenv';
import Order from "../models/Order.js";
import Vendor from "../models/Vendor.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

// Initialize Razorpay (YouTube style)
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Generate 4-digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Create Razorpay Order (YouTube style implementation)
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`
    };

    razorpayInstance.orders.create(options, (err, order) => {
      if (!err) {
        console.log("Razorpay order created:", order.id);
        
        res.status(200).json({
          success: true,
          msg: 'Order Created',
          order_id: order.id,
          amount: amountInPaise,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
          product_name: "Laundry Services",
          description: req.body.description || "Laundry service payment"
        });
      } else {
        console.error("Razorpay order creation error:", err);
        res.status(400).json({
          success: false,
          msg: 'Something went wrong!',
          error: err.message
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

// Verify Razorpay Payment (Enhanced with YouTube style)
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters",
      });
    }

    // Generate signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    // Verify signature
    if (razorpay_signature === expectedSign) {
      console.log("Payment verified successfully:", razorpay_payment_id);
      
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

// Place Order (Same as before, no changes needed)
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

    // Validation
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

    // Validate online payment
    if (paymentMethod === 'online' && (!paymentId || paymentStatus !== 'completed')) {
      return res.status(400).json({ 
        message: "Invalid payment details for online payment" 
      });
    }

    let totalPrice = services.reduce(
      (sum, s) => sum + (s.price || 0) * (s.quantity || 1),
      0
    );

    // Add delivery charges
    totalPrice += 50;

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
      totalPrice,
      otp,
      status: "Scheduled",
      assignedDhobi,
      paymentMethod,
      paymentId: paymentId || null,
      paymentStatus: paymentStatus || "pending",
    });

    await order.save();

    console.log(`Order placed successfully: ${order._id}, Payment: ${paymentMethod}`);

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error("Order Error:", error);
    res.status(500).json({ 
      message: "Server error",
      error: error.message 
    });
  }
};

// All other functions remain exactly the same
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

export const verifyOtpAndCompleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

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

    order.status = "Picked Up";
    await order.save();

    res.json({ message: "Order marked as completed", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

export const verifyOtpForFinalDelivery = async (req, res) => {
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

    order.status = "Delivered";
    await order.save();

    res.json({ message: "Order delivered successfully", order });
  } catch (error) {
    console.error("Final delivery OTP error:", error);
    res
      .status(500)
      .json({ message: "Failed to verify OTP for final delivery" });
  }
};

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