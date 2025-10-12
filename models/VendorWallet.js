import mongoose from "mongoose";

const vendorWalletSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    unique: true
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  todaysEarnings: {
    type: Number,
    default: 0
  },
  withdrawableBalance: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  completedOrders: {
    type: Number,
    default: 0
  },
  lastEarningDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to add earnings from completed order
vendorWalletSchema.methods.addEarningsFromOrder = function(vendorEarnings) {
  const today = new Date();
  const lastEarningDate = new Date(this.lastEarningDate);
  
  // Check if it's a new day
  if (today.toDateString() !== lastEarningDate.toDateString()) {
    // Move today's earnings to withdrawable balance
    this.withdrawableBalance += this.todaysEarnings;
    this.todaysEarnings = 0;
  }
  
  // vendorEarnings calculated in controller (per-piece calculation)
  this.todaysEarnings += vendorEarnings;
  this.totalEarnings += vendorEarnings;
  this.completedOrders += 1;
  this.lastEarningDate = today;
  
  return this.save();
};

// Method to reset daily earnings (called by cron job)
vendorWalletSchema.methods.resetDailyEarnings = function() {
  this.withdrawableBalance += this.todaysEarnings;
  this.todaysEarnings = 0;
  return this.save();
};

export default mongoose.model("VendorWallet", vendorWalletSchema);