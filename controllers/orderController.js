import Order from "../models/Order.js";
import Vendor from "../models/Vendor.js";
import DeliveryBoy from "../models/DeliveryBoy.js";

//  Generate 4-digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Place Order
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

    let totalPrice = services.reduce(
      (sum, s) => sum + (s.price || 0) * (s.quantity || 1),
      0
    );

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
    });

    await order.save();

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error("Order Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//  Get All Orders for Logged-in User
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.uid }).sort({
      date: -1,
    });

    // Current orders = All except Delivered & Cancelled
    const current = orders.filter(
      (order) => !["Delivered", "Cancelled"].includes(order.status)
    );

    // Past orders = only Delivered & Cancelled
    const past = orders.filter((order) =>
      ["Delivered", "Cancelled"].includes(order.status)
    );

    res.json({ current, past });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//  Get Track Order
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

//  Verify OTP and Complete Order (for pickup )
export const verifyOtpAndCompleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Check pickupClaimedBy authorization
    if (
      !order.pickupClaimedBy ||
      order.pickupClaimedBy.toString() !== req.user.uid.toString()
    ) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    if (order.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    //  Update status to Picked Up
    order.status = "Picked Up";
    await order.save();

    res.json({ message: "Order marked as completed", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify OTP and Receive Order by Vendor (for washing )
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

//  Get Unclaimed Orders (for delivery boys)
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

// getAssignedOrders (orders assigned to logged-in vendor)
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
      count: orders.length 
    });
  } catch (error) {
    console.error("Error fetching assigned orders:", error);
    res.status(500).json({ 
      message: "Failed to fetch assigned orders",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get washing orders for logged-in  (vendor)
export const getWashingOrdersForVendor = async (req, res) => {
  try {
    const orders = await Order.find({
      assignedDhobi: req.user.uid,
      status: { $in: ["Washing", "Washed"] },
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

// Get all delivery orders (for delivery boys)
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

// User verifies OTP for delivery pickup
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

//  User verifies OTP for final delivery
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

// Get all delivery orders claimed by delivery boy
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

// Claim Pickup 
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

// Get all pickup orders claimed by logged-in delivery boy
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
