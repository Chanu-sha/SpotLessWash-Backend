import bcrypt from "bcryptjs";
import DeliveryBoy from "../models/DeliveryBoy.js";

// Register
export const registerDeliveryBoy = async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const existing = await DeliveryBoy.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already used" });

    const hashed = await bcrypt.hash(password, 10);
    const newBoy = await DeliveryBoy.create({
      name,
      email,
      phone,
      password: hashed,
    });
    res.status(201).json({ message: "Registration request sent" });
  } catch (err) {
    res.status(500).json({ message: "Error registering" });
  }
};

// Login
export const loginDeliveryBoy = async (req, res) => {
  const { phone, password } = req.body;
  try {
    const boy = await DeliveryBoy.findOne({ phone });
    if (!boy || !boy.approved || boy.rejected) {
      return res.status(403).json({ message: "Not approved or rejected" });
    }

    const match = await bcrypt.compare(password, boy.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    res.json({ message: "Login successful", boy });
  } catch (err) {
    res.status(500).json({ message: "Login error" });
  }
};

// Get All Users
export const getAllUsers = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  try {
    const users = await DeliveryBoy.find();
    res.json(users);
  } catch {
    res.status(500).json({ message: "Error fetching users" });
  }
};

// Get Pending Requests
export const getPendingRequests = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const pending = await DeliveryBoy.find({ approved: false, rejected: false });
    res.json(pending);
  } catch {
    res.status(500).json({ message: "Error fetching" });
  }
};

// Get Rejected Users
export const getRejectedUsers = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const rejected = await DeliveryBoy.find({ rejected: true });
    res.json(rejected);
  } catch {
    res.status(500).json({ message: "Error fetching rejected users" });
  }
};

// Approve
export const approveDeliveryBoy = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    await DeliveryBoy.findByIdAndUpdate(req.params.id, { approved: true, rejected: false });
    res.json({ message: "Approved successfully" });
  } catch {
    res.status(500).json({ message: "Error approving" });
  }
};

// Reject
export const rejectDeliveryBoy = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    await DeliveryBoy.findByIdAndUpdate(req.params.id, { rejected: true, approved: false });
    res.json({ message: "Rejected successfully" });
  } catch {
    res.status(500).json({ message: "Error rejecting" });
  }
};
