import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  deliveryBoyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryBoy',
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
  lastEarningDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to add earnings
walletSchema.methods.addEarnings = function(amount) {
  const today = new Date();
  const lastEarningDate = new Date(this.lastEarningDate);
  
  // Check if it's a new day
  if (today.toDateString() !== lastEarningDate.toDateString()) {
    // Move today's earnings to withdrawable balance
    this.withdrawableBalance += this.todaysEarnings;
    this.todaysEarnings = 0;
  }
  
  this.todaysEarnings += amount;
  this.totalEarnings += amount;
  this.lastEarningDate = today;
  
  return this.save();
};

// Method to reset daily earnings (called by cron job)
walletSchema.methods.resetDailyEarnings = function() {
  this.withdrawableBalance += this.todaysEarnings;
  this.todaysEarnings = 0;
  return this.save();
};

export default mongoose.model("DelieveryWallet", walletSchema);