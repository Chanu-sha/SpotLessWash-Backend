import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
});

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userMobile: { type: String, required: true },
  userAddress: { type: String, required: true },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
  },
  vendorName: { type: String, required: true },
  vendorAddress: { type: String, required: true, default: "Not Provided" },
  services: { type: [serviceSchema], default: [] },
  totalPrice: { type: Number, required: true },
  otp: { type: String, required: true },
  status: { type: String, default: "Scheduled" },
  assignedDhobi: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
  },
  pickupClaimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryBoy",
    default: null,
  },
  deliveryClaimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryBoy",
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Order", orderSchema);
