import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  email: String,
  phone: String,
  address: String,
  photo: String,
});

export default mongoose.model("User", userSchema);
