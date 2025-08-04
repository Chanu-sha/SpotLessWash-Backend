import bcrypt from "bcryptjs";
import Dhobi from "../models/Dhobi.js";
import { createToken } from "../middlewares/jwtHelper.js";

// Register
export const registerDhobi = async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const existing = await Dhobi.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already used" });

    const hashed = await bcrypt.hash(password, 10);
    await Dhobi.create({ name, email, phone, password: hashed });
    res.status(201).json({ message: "Registration request sent" });
  } catch {
    res.status(500).json({ message: "Error registering" });
  }
};

// Login
export const loginDhobi = async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await Dhobi.findOne({ phone });
    if (!user || !user.approved || user.rejected)
      return res.status(403).json({ message: "Not approved or rejected" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = createToken({ uid: user._id, role: "dhobi" });
    res.json({ message: "Login successful", token });
  } catch {
    res.status(500).json({ message: "Login error" });
  }
};

// Get Profile
export const getDhobiProfile = async (req, res) => {
  try {
    const user = await Dhobi.findById(req.user.uid);
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// Update Profile
export const updateDhobiProfile = async (req, res) => {
  try {
    const updated = await Dhobi.findByIdAndUpdate(req.user.uid, req.body, {
      new: true,
    });
    res.json({ message: "Profile updated", user: updated });
  } catch {
    res.status(500).json({ message: "Error updating profile" });
  }
};

export const getAllDhobis = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const users = await Dhobi.find();
    res.json(users);
  } catch {
    res.status(500).json({ message: "Error fetching users" });
  }
};

export const getPendingDhobis = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const pending = await Dhobi.find({ approved: false, rejected: false });
    res.json(pending);
  } catch {
    res.status(500).json({ message: "Error fetching" });
  }
};

export const getRejectedDhobis = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const rejected = await Dhobi.find({ rejected: true });
    res.json(rejected);
  } catch {
    res.status(500).json({ message: "Error fetching rejected users" });
  }
};

export const approveDhobi = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    await Dhobi.findByIdAndUpdate(req.params.id, {
      approved: true,
      rejected: false,
    });
    res.json({ message: "Approved successfully" });
  } catch {
    res.status(500).json({ message: "Error approving" });
  }
};

export const rejectDhobi = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    await Dhobi.findByIdAndUpdate(req.params.id, {
      rejected: true,
      approved: false,
    });
    res.json({ message: "Rejected successfully" });
  } catch {
    res.status(500).json({ message: "Error rejecting" });
  }
};
