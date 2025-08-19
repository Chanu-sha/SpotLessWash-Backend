import Order from "../models/Order.js";
import User from "../models/User.js";

export const placeOrder = async (req, res) => {
  try {
    const {
      serviceId,
      name,
      quantity,
      price,
      address,
      pickupDelivery,
      mobile,
      paymentMethod,
      paymentId,
    } = req.body;

    if (!address || address.trim() === "") {
      return res.status(400).json({ message: "Address is required" });
    }
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res
        .status(400)
        .json({ message: "Valid 10-digit mobile number is required" });
    }

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ message: "User not found" });

    let finalPrice = price + pickupDelivery;
    let paymentStatus = "Not Paid";
    let isFreeOrder = false;

    // ✅ Original payment status logic from first code
    if (paymentMethod === "COD") {
      paymentStatus = "Not Paid";
    } else if (paymentMethod === "ONLINE") {
      paymentStatus = "Paid";
    } else if (paymentMethod === "SUBSCRIPTION") {
      paymentStatus = "Free (Subscribed)";
    }

    // ✅ Subscription check (from second code)
    if (
      user.subscription.status === "active" &&
      user.subscription.expiry &&
      new Date(user.subscription.expiry) > new Date()
    ) {
      const today = new Date().toISOString().split("T")[0];
      const usageDate = user.subscription.dailyUsage.date
        ? user.subscription.dailyUsage.date.toISOString().split("T")[0]
        : null;

      // reset if it's a new day
      if (!usageDate || usageDate !== today) {
        user.subscription.dailyUsage.date = new Date();
        user.subscription.dailyUsage.count = 0;
      }

      // ✅ Rule: Max 2 free orders per day
      if (quantity > 1) {
        return res.status(400).json({
          message: "Subscribed users can only order 1 quantity per service.",
        });
      }

      if (user.subscription.dailyUsage.count <= 2) {
        finalPrice = 0; // free order
        isFreeOrder = true;
        paymentStatus = "Free (Subscribed)";
        user.subscription.dailyUsage.count += 1;
      }

      await user.save();
    }

    // ✅ Online payment check (from second code)
    if (paymentMethod === "ONLINE" && paymentId && finalPrice > 0) {
      paymentStatus = "Paid";
    }

    const generateOTP = () =>
      Math.floor(1000 + Math.random() * 9000).toString();

    const newOrder = new Order({
      userId: req.user.uid,
      serviceId,
      name,
      quantity,
      price: finalPrice,
      address,
      mobile,
      pickupDelivery,
      status: "Scheduled",
      otp: generateOTP(),
      paymentMethod,
      paymentStatus,
      paymentId: paymentId || null,
      isFreeOrder,
    });

    await newOrder.save();

    res.status(201).json({
      message: "Order placed successfully",
      order: newOrder,
      otp: newOrder.otp,
    });
  } catch (error) {
    console.error("❌ Order placement error:", error);
    res.status(400).json({ message: error.message || "Failed to place order" });
  }
};
// ✅ Get today's order count
export const getTodayOrderCount = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const count = await Order.countDocuments({
      userId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    res.json({ count });
  } catch (error) {
    console.error("Error fetching today's order count:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyOtpAndCompleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !order.claimedBy ||
      order.claimedBy.toString() !== req.user.uid.toString()
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

export const verifyOtpAndReceiveByDhobi = async (req, res) => {
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

// 🔽 Get All Orders for Logged-in User
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.uid }).sort({
      date: -1,
    });

    const current = orders.filter((order) =>
      [
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
      ].includes(order.status)
    );
    const past = orders.filter((order) =>
      ["Delivered", "Completed", "Cancelled"].includes(order.status)
    );

    res.json({ current, past });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔽 Get Specific Order
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

// Update Order Status (for delivery boys)
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
// 🔽 Get Unclaimed Orders (for delivery boys)
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

// controllers/orderController.js
export const getAssignedOrders = async (req, res) => {
  try {
    const orders = await Order.find({ assignedDhobi: req.user.uid }).populate(
      "claimedBy",
      "name"
    );
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assigned orders" });
  }
};

export const getWashingOrdersForDhobi = async (req, res) => {
  try {
    const orders = await Order.find({
      assignedDhobi: req.user.uid,
      status: { $in: ["Washing", "Washed"] },
    }).populate("claimedBy", "name");

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch washing orders" });
  }
};

export const getDeliveryOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      claimedBy: req.user.uid,
      status: "Washed",
    }).populate("assignedDhobi", "name address mobile");

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch delivery orders" });
  }
};

// 🔽 Delivery Boy verifies OTP before starting delivery
export const verifyOtpForDeliveryPickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !order.claimedBy ||
      order.claimedBy.toString() !== req.user.uid.toString()
    ) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    order.status = "Delievery Picked Up";
    await order.save();

    res.json({ message: "Delivery pickup confirmed", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔽 Final OTP verification by customer to mark order as Delivered
export const verifyOtpForFinalDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      !order.claimedBy ||
      order.claimedBy.toString() !== req.user.uid.toString()
    ) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // ✅ Mark order as Delivered
    order.status = "Delivered";
    await order.save();

    res.json({ message: "Order delivered successfully", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
