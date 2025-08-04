import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema({
  name: String,
  phone: { type: String, required: true, unique: true },
  email: String,
  password: String,
  approved: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false },
  photo: String,
  address: String,
  claimedOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
});

export default mongoose.model("DeliveryBoy", deliveryBoySchema);
