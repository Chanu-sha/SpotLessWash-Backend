import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
});

const vendorSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, required: true, unique: true },
  email: String,
  password: String,
  approved: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false },
  photo: String,
  address: String,
  services: [serviceSchema],
  storeImages: {
    type: [String], 
    validate: {
      validator: (arr) => arr.length <= 3,
      message: "You can only upload up to 3 store images",
    },
    default: [],
  },
});

export default mongoose.model("Vendor", vendorSchema);
