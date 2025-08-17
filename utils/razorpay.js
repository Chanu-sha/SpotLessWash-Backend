import Razorpay from 'razorpay';
import dotenv from "dotenv";

dotenv.config();

export const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const PLANS = {
  monthly: { amount: 49900, days: 31 },  
  annual:  { amount: 499900, days: 365 },
};
