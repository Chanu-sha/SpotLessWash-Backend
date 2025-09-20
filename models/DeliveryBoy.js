import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // unique index is enough
  email: { type: String, required: true },
  password: { type: String, required: true },
  approved: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false },
  photo: String,
  address: String,

  livePhoto: { type: String, required: true },
  aadhaarPhoto: { type: String, required: true },
  licensePhoto: { type: String, required: true },

  cloudinaryIds: {
    live: String,
    aadhaar: String,
    license: String
  },

  claimedOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  completedDeliveries: { type: Number, default: 0 },
  completedPickups: { type: Number, default: 0 },

  registrationDate: { type: Date, default: Date.now },
  approvalDate: { type: Date },
  rejectionDate: { type: Date },
  rejectionReason: String,
}, {
  timestamps: true
});

// Keep only this index
deliveryBoySchema.index({ approved: 1, rejected: 1 });

deliveryBoySchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();

  if (update.approved === true) {
    update.approvalDate = new Date();
    update.rejectionDate = undefined;
    update.rejectionReason = undefined;
  }

  if (update.rejected === true) {
    update.rejectionDate = new Date();
    update.approvalDate = undefined;
  }

  next();
});

export default mongoose.model("DeliveryBoy", deliveryBoySchema);
