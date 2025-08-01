import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  notes: { type: String },
  otp: { type: String },
  pickupDelivery: { type: Number, required: true },
  status: {
    type: String,
    enum: [
      "Scheduled",
      "In Progress",
      "Ready for Pickup",
      "Picked Up",
      "Delivered",
      "Completed",
      "Cancelled",
    ],
    default: "Scheduled",
  },
  claimedBy: { type: String, default: null },
  date: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
