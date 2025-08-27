import bcrypt from "bcryptjs";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { createToken } from "../middlewares/jwtHelper.js";

// Register Delivery Boy
export const registerDeliveryBoy = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    // check email or phone duplication
    const existing = await DeliveryBoy.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ message: "Email or phone already used" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newBoy = await DeliveryBoy.create({
      name,
      email,
      phone,
      password: hashedPassword,
      approved: false, 
      rejected: false,
    });

    res
      .status(201)
      .json({ message: "Registration request sent, waiting for approval" });
  } catch (err) {
    console.error(" Register Error:", err);
    res.status(500).json({ message: "Error registering user" });
  }
};

// Login Delivery Boy
export const loginDeliveryBoy = async (req, res) => {
  const { phone, password } = req.body;

  try {
    const boy = await DeliveryBoy.findOne({ phone });
    if (!boy) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!boy.approved || boy.rejected) {
      return res.status(403).json({ message: "Not approved or rejected" });
    }

    // Compare plain password with stored hash
    const match = await bcrypt.compare(password, boy.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = createToken({ uid: boy._id, role: "delivery" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: boy._id,
        name: boy.name,
        phone: boy.phone,
        email: boy.email,
      },
    });
  } catch (err) {
    console.error(" Login Error:", err);
    res.status(500).json({ message: "Login error" });
  }
};

// Get profile
export const getDeliveryBoyProfile = async (req, res) => {
  try {
    const user = await DeliveryBoy.findById(req.user.uid);
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// Update profile
export const updateDeliveryBoyProfile = async (req, res) => {
  try {
    const updated = await DeliveryBoy.findByIdAndUpdate(
      req.user.uid,
      req.body,
      {
        new: true,
      }
    );
    res.json({ message: "Profile updated", user: updated });
  } catch {
    res.status(500).json({ message: "Error updating profile" });
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
    const pending = await DeliveryBoy.find({
      approved: false,
      rejected: false,
    });
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
    await DeliveryBoy.findByIdAndUpdate(req.params.id, {
      approved: true,
      rejected: false,
    });
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
    await DeliveryBoy.findByIdAndUpdate(req.params.id, {
      rejected: true,
      approved: false,
    });
    res.json({ message: "Rejected successfully" });
  } catch {
    res.status(500).json({ message: "Error rejecting" });
  }
};

// Reset Password
export const resetDeliveryBoyPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Get the delivery boy from database
    const boy = await DeliveryBoy.findById(req.user.uid);
    if (!boy) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, boy.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, boy.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await DeliveryBoy.findByIdAndUpdate(req.user.uid, {
      password: hashedNewPassword
    });

    res.json({ message: "Password updated successfully" });

  } catch (err) {
    console.error("❌ Password Reset Error:", err);
    res.status(500).json({ message: "Error updating password" });
  }
};
