import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  email: String,
  phone: String,
  address: String,
  photo: String,

  subscription: {
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
    plan: { type: String, enum: ["monthly", "annual"], default: null },
    start: { type: Date, default: null },
    expiry: { type: Date, default: null },

    dailyUsage: {
      date: { type: Date, default: null },
      services: [{ type: String }],
    },
  },
});

export default mongoose.model("User", userSchema);
