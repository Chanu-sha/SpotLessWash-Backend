import mongoose from "mongoose";

const dhobiSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, required: true, unique: true },
  email: String,
  password: String,
  approved: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false },
  photo: String,
  address: String,
});

export default mongoose.model("Dhobi", dhobiSchema);
