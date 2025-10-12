import mongoose from "mongoose";

// ===============================
// Collection Sub-Schema
// ===============================
const collectionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerMobile: {
    type: String,
    required: true,
  },
  serviceName: {
    type: String,
    default: "N/A",
  },
  quantity: {
    type: Number,
    default: 1,
  },
  collectedAt: {
    type: Date,
    default: Date.now,
  },
  submitted: {
    type: Boolean,
    default: false,
  },
  submittedAt: {
    type: Date,
    default: null,
  },
});

// ===============================
// COD Wallet Main Schema
// ===============================
const codWalletSchema = new mongoose.Schema(
  {
    deliveryBoyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
      unique: true, 
    },
    totalCollected: {
      type: Number,
      default: 0,
    },
    pendingSubmission: {
      type: Number,
      default: 0,
    },
    totalSubmitted: {
      type: Number,
      default: 0,
    },
    totalPenalty: {
      type: Number,
      default: 0,
    },
    lastSubmissionDate: {
      type: Date,
      default: null,
    },
    collections: [collectionSchema],
  },
  {
    timestamps: true,
  }
);

// ===============================
// METHODS
// ===============================

//  Calculate Penalties
codWalletSchema.methods.calculatePenalties = async function () {
  if (this.pendingSubmission === 0 || this.collections.length === 0) {
    this.totalPenalty = 0;
    return 0;
  }

  // Find oldest unsubmitted collection
  const oldestUnsubmitted = this.collections
    .filter((c) => !c.submitted)
    .sort((a, b) => new Date(a.collectedAt) - new Date(b.collectedAt))[0];

  if (!oldestUnsubmitted) {
    this.totalPenalty = 0;
    return 0;
  }

  const today = new Date();
  const collectionDate = new Date(oldestUnsubmitted.collectedAt);
  const daysDiff = Math.floor((today - collectionDate) / (1000 * 60 * 60 * 24));

  // Calculate penalty: ₹150 per day after collection
  this.totalPenalty = daysDiff > 0 ? daysDiff * 150 : 0;

  await this.save();
  return this.totalPenalty;
};

// Add New Collection
codWalletSchema.methods.addCollection = async function (collectionData) {
  const { orderId, amount, orderDetails } = collectionData;

  // Check if already collected
  const exists = this.collections.find(
    (c) => c.orderId.toString() === orderId.toString()
  );

  if (exists) {
    throw new Error("COD already collected for this order");
  }

  // Add new collection
  this.collections.push({
    orderId,
    amount,
    customerName: orderDetails.userName,
    customerMobile: orderDetails.userMobile,
    serviceName: orderDetails.serviceName || "N/A",
    quantity: orderDetails.quantity || 1,
    collectedAt: new Date(),
    submitted: false,
  });

  // Update totals
  this.totalCollected += amount;
  this.pendingSubmission += amount;

  await this.save();
  return this;
};

//  Submit All Pending Collections
codWalletSchema.methods.submitAllPending = async function () {
  if (this.pendingSubmission === 0) {
    throw new Error("No pending collections to submit");
  }

  const submittedAmount = this.pendingSubmission;

  // Mark all unsubmitted as submitted
  this.collections.forEach((collection) => {
    if (!collection.submitted) {
      collection.submitted = true;
      collection.submittedAt = new Date();
    }
  });

  // Update totals
  this.totalSubmitted += submittedAmount;
  this.pendingSubmission = 0;
  this.totalPenalty = 0;
  this.lastSubmissionDate = new Date();

  await this.save();
  return submittedAmount;
};

// ===============================
// Indexes (optimized, no duplicates)
// ===============================
codWalletSchema.index({ "collections.submitted": 1 });
codWalletSchema.index({ "collections.collectedAt": 1 });

// ===============================
// Model Export
// ===============================
const CODWallet = mongoose.model("CODWallet", codWalletSchema);

export default CODWallet;
