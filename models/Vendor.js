import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
}, { timestamps: true });

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, 
  email: { type: String, required: true },
  password: { type: String, required: true },
  approved: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false },
  photo: String,
  address: String,
  services: [serviceSchema],

  livePhoto: { type: String, required: true },
  aadhaarPhoto: { type: String, required: true },

  cloudinaryIds: {
    live: String,
    aadhaar: String
  },

  storeImages: {
    type: [String],
    validate: {
      validator: (arr) => arr.length <= 3,
      message: "You can only upload up to 3 store images",
    },
    default: [],
  },

  registrationDate: { type: Date, default: Date.now },
  approvalDate: { type: Date },
  rejectionDate: { type: Date },
  rejectionReason: String,
}, { timestamps: true });

// ✅ Keep only indexes that are not covered by field-level indexes
vendorSchema.index({ email: 1 });
vendorSchema.index({ approved: 1, rejected: 1 });

// Pre-save middleware
vendorSchema.pre('findOneAndUpdate', function(next) {
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

// Virtuals
vendorSchema.virtual('serviceCount').get(function() {
  return this.services.length;
});

vendorSchema.virtual('storeImageCount').get(function() {
  return this.storeImages.length;
});

export default mongoose.model("Vendor", vendorSchema);
