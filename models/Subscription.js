import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    plan: { type: String, enum: ['monthly', 'annual'], required: true },
    amount: { type: Number, required: true }, // in paise
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
    },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String },
    receipt: { type: String },
    start: { type: Date },
    expiry: { type: Date },
    raw: { type: Object },
  },
  { timestamps: true }
);

export default mongoose.model('Subscription', subscriptionSchema);
