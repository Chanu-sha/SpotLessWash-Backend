import Order from "../models/Order.js";

// 🔽 Place New Order
export const placeOrder = async (req, res) => {
  try {
    const { serviceId, name, quantity, price, notes, pickupDelivery } =
      req.body;

    const newOrder = new Order({
      userId: req.user.uid,
      serviceId,
      name,
      quantity,
      price,
      notes,
      pickupDelivery,
      status: "Scheduled",
    });

    await newOrder.save();
    res.status(201).json({ message: "Order placed", order: newOrder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🔽 Get All Orders for Logged-in User
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.uid }).sort({
      date: -1,
    });

    const current = orders.filter((order) =>
      ["Scheduled", "In Progress", "Ready for Pickup"].includes(order.status)
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
//  Get All Orders (for delivery boys)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json({ orders });
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
      "Delivered",
      "Completed",
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
