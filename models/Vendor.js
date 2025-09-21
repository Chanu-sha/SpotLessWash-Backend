import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 }, // Vendor's actual price
}, { timestamps: true });

// Add virtual fields for pricing calculations
serviceSchema.virtual('appPrice').get(function() {
  // Add 15% margin for the app
  return Math.ceil(this.basePrice * 1.15);
});

serviceSchema.virtual('displayPrice').get(function() {
  // Show higher price (25% more than base) to create discount effect
  return Math.ceil(this.basePrice * 1.25);
});

serviceSchema.virtual('discountPercentage').get(function() {
  const appPrice = Math.ceil(this.basePrice * 1.15);
  const displayPrice = Math.ceil(this.basePrice * 1.25);
  return Math.round(((displayPrice - appPrice) / displayPrice) * 100);
});

// Ensure virtual fields are included in JSON output
serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

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

// Indexes
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

// Ensure virtual fields are included in JSON output
vendorSchema.set('toJSON', { virtuals: true });
vendorSchema.set('toObject', { virtuals: true });

export default mongoose.model("Vendor", vendorSchema);