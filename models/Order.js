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
  mobile: { type: String, required: true },
  address: { type: String, required: true },
  otp: { type: String },
  pickupDelivery: { type: Number, required: true },
  status: {
    type: String,
    enum: [
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
    ],
    default: "Scheduled",
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryBoy",
    default: null,
  },
  assignedDhobi: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Dhobi",
    default: null,
  },

  date: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
