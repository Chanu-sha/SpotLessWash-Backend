import bcrypt from "bcryptjs";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { createToken } from "../middlewares/jwtHelper.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import Wallet from "../models/DelieveryWallet.js";
import WithdrawalRequest from "../models/DelieveryWithdrawalRequest.js";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";
import CODWallet from "../models/CODWallet.js";

dotenv.config();

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage 
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
});

// Middleware for handling multiple file uploads
export const uploadPhotos = upload.fields([
  { name: "livePhoto", maxCount: 1 },
  { name: "aadhaarPhoto", maxCount: 1 },
  { name: "licensePhoto", maxCount: 1 },
]);

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `delivery-photos/${folder}`,
          public_id: filename,
          resource_type: "image",
          format: "jpg",
          transformation: [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto:good" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });
};

// Register Delivery Boy with Cloudinary photo upload
export const registerDeliveryBoy = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    // Check email or phone duplication
    const existing = await DeliveryBoy.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ message: "Email or phone already used" });
    }

    // Validate required photos
    if (
      !req.files ||
      !req.files.livePhoto ||
      !req.files.aadhaarPhoto ||
      !req.files.licensePhoto
    ) {
      return res.status(400).json({
        message:
          "All photos are required: live photo, Aadhaar card, and driving license",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upload photos to Cloudinary
    const timestamp = Date.now();
    const phoneLastFour = phone.slice(-4);

    try {
      const [liveUpload, aadhaarUpload, licenseUpload] = await Promise.all([
        uploadToCloudinary(
          req.files.livePhoto[0].buffer,
          "live",
          `live_${phoneLastFour}_${timestamp}`
        ),
        uploadToCloudinary(
          req.files.aadhaarPhoto[0].buffer,
          "aadhaar",
          `aadhaar_${phoneLastFour}_${timestamp}`
        ),
        uploadToCloudinary(
          req.files.licensePhoto[0].buffer,
          "license",
          `license_${phoneLastFour}_${timestamp}`
        ),
      ]);

      const newBoy = await DeliveryBoy.create({
        name,
        email,
        phone,
        password: hashedPassword,
        approved: false,
        rejected: false,
        livePhoto: liveUpload.secure_url,
        aadhaarPhoto: aadhaarUpload.secure_url,
        licensePhoto: licenseUpload.secure_url,
        cloudinaryIds: {
          live: liveUpload.public_id,
          aadhaar: aadhaarUpload.public_id,
          license: licenseUpload.public_id,
        },
      });

      res.status(201).json({
        message:
          "Registration request sent with documents, waiting for approval",
      });
    } catch (uploadError) {
      console.error("Cloudinary Upload Error:", uploadError);
      return res
        .status(500)
        .json({ message: "Error uploading photos. Please try again." });
    }
  } catch (err) {
    console.error("Register Error:", err);

    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "File size too large. Maximum 2MB allowed." });
    }

    res.status(500).json({ message: "Error registering user" });
  }
};

// Login Delivery Boy (unchanged)
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
    console.error("Login Error:", err);
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

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
};

// Get wallet details
export const getWalletDetails = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ deliveryBoyId: req.user.uid });
    if (!wallet) {
      wallet = await Wallet.create({ deliveryBoyId: req.user.uid });
    }

    // Check if it's a new day and reset earnings
    const today = new Date();
    const lastEarningDate = new Date(wallet.lastEarningDate);

    if (today.toDateString() !== lastEarningDate.toDateString()) {
      await wallet.resetDailyEarnings();
    }

    res.json({
      totalEarnings: wallet.totalEarnings,
      todaysEarnings: wallet.todaysEarnings,
      withdrawableBalance: wallet.withdrawableBalance,
      totalWithdrawn: wallet.totalWithdrawn,
      lastEarningDate: wallet.lastEarningDate,
    });
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    res.status(500).json({ message: "Failed to fetch wallet details" });
  }
};

// Reject with Cloudinary cleanup
export const rejectDeliveryBoy = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const deliveryBoy = await DeliveryBoy.findById(req.params.id);

    // Delete photos from Cloudinary when rejecting
    if (deliveryBoy && deliveryBoy.cloudinaryIds) {
      await Promise.all([
        deleteFromCloudinary(deliveryBoy.cloudinaryIds.live),
        deleteFromCloudinary(deliveryBoy.cloudinaryIds.aadhaar),
        deleteFromCloudinary(deliveryBoy.cloudinaryIds.license),
      ]);
    }

    await DeliveryBoy.findByIdAndUpdate(req.params.id, {
      rejected: true,
      approved: false,
    });

    res.json({ message: "Rejected successfully" });
  } catch {
    res.status(500).json({ message: "Error rejecting" });
  }
};

// Reset Password (unchanged)
export const resetDeliveryBoyPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Get the delivery boy from database
    const boy = await DeliveryBoy.findById(req.user.uid);
    if (!boy) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      boy.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, boy.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await DeliveryBoy.findByIdAndUpdate(req.user.uid, {
      password: hashedNewPassword,
    });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(" Password Reset Error:", err);
    res.status(500).json({ message: "Error updating password" });
  }
};

// Increment PickupCount count
export const incrementPickupCount = async (req, res) => {
  try {
    const deliveryBoyId = req.body.deliveryBoyId || req.user.uid;

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      deliveryBoyId,
      { $inc: { completedPickups: 1 } },
      { new: true }
    );

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found" });
    }

    // Add earnings to wallet
    let wallet = await Wallet.findOne({ deliveryBoyId });
    if (!wallet) {
      wallet = await Wallet.create({ deliveryBoyId });
    }

    await wallet.addEarnings(25); // 25 rupees per pickup

    res.json({
      message: "Pickup count updated successfully",
      completedPickups: deliveryBoy.completedPickups,
      deliveryBoyName: deliveryBoy.name,
      earningsAdded: 25,
    });
  } catch (error) {
    console.error("Error incrementing pickup count:", error);
    res.status(500).json({ message: "Failed to update pickup count" });
  }
};

// Increment delivery count
export const incrementDeliveryCount = async (req, res) => {
  try {
    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      req.user.uid,
      { $inc: { completedDeliveries: 1 } },
      { new: true }
    );

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found" });
    }

    // Add earnings to wallet
    let wallet = await Wallet.findOne({ deliveryBoyId: req.user.uid });
    if (!wallet) {
      wallet = await Wallet.create({ deliveryBoyId: req.user.uid });
    }

    await wallet.addEarnings(25); // 25 rupees per delivery

    res.json({
      message: "Delivery count updated successfully",
      completedDeliveries: deliveryBoy.completedDeliveries,
      earningsAdded: 25,
    });
  } catch (error) {
    console.error("Error incrementing delivery count:", error);
    res.status(500).json({ message: "Failed to update delivery count" });
  }
};

// Get delivery boy stats
export const getDeliveryBoyStats = async (req, res) => {
  try {
    const deliveryBoy = await DeliveryBoy.findById(req.user.uid).select(
      "completedPickups completedDeliveries name"
    );

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found" });
    }

    // Get wallet info
    let wallet = await Wallet.findOne({ deliveryBoyId: req.user.uid });
    if (!wallet) {
      wallet = await Wallet.create({ deliveryBoyId: req.user.uid });
    }

    // Check if it's a new day and reset earnings
    const today = new Date();
    const lastEarningDate = new Date(wallet.lastEarningDate);

    if (today.toDateString() !== lastEarningDate.toDateString()) {
      await wallet.resetDailyEarnings();
    }

    res.json({
      name: deliveryBoy.name,
      completedPickups: deliveryBoy.completedPickups,
      completedDeliveries: deliveryBoy.completedDeliveries,
      totalCompletedOrders:
        deliveryBoy.completedPickups + deliveryBoy.completedDeliveries,
      wallet: {
        totalEarnings: wallet.totalEarnings,
        todaysEarnings: wallet.todaysEarnings,
        withdrawableBalance: wallet.withdrawableBalance,
        totalWithdrawn: wallet.totalWithdrawn,
      },
    });
  } catch (error) {
    console.error("Error fetching delivery boy stats:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

// Create withdrawal request
export const createWithdrawalRequest = async (req, res) => {
  try {
    const { amount, upiId, fullName, phoneNumber, withdrawFrom } = req.body;

    // Validate input
    if (!amount || !upiId || !fullName || !phoneNumber || !withdrawFrom) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    if (!["today", "withdrawable"].includes(withdrawFrom)) {
      return res.status(400).json({ message: "Invalid withdrawal source" });
    }

    // Get wallet
    let wallet = await Wallet.findOne({ deliveryBoyId: req.user.uid });
    if (!wallet) {
      wallet = await Wallet.create({ deliveryBoyId: req.user.uid });
    }

    // Check if it's a new day and reset earnings
    const today = new Date();
    const lastEarningDate = new Date(wallet.lastEarningDate);

    if (today.toDateString() !== lastEarningDate.toDateString()) {
      await wallet.resetDailyEarnings();
    }

    // Check available balance
    const availableBalance =
      withdrawFrom === "today"
        ? wallet.todaysEarnings
        : wallet.withdrawableBalance;

    if (amount > availableBalance) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ₹${availableBalance}`,
      });
    }

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create({
      deliveryBoyId: req.user.uid,
      amount,
      upiId,
      fullName,
      phoneNumber,
    });

    // Deduct amount from wallet
    if (withdrawFrom === "today") {
      wallet.todaysEarnings -= amount;
    } else {
      wallet.withdrawableBalance -= amount;
    }

    await wallet.save();

    res.json({
      message: "Withdrawal request submitted successfully",
      withdrawalId: withdrawalRequest._id,
      remainingBalance:
        withdrawFrom === "today"
          ? wallet.todaysEarnings
          : wallet.withdrawableBalance,
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    res.status(500).json({ message: "Failed to create withdrawal request" });
  }
};

// Get withdrawal history
export const getWithdrawalHistory = async (req, res) => {
  try {
    const withdrawals = await WithdrawalRequest.find({
      deliveryBoyId: req.user.uid,
    }).sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).json({ message: "Failed to fetch withdrawal history" });
  }
};

// Admin: Get all withdrawal requests
export const getAllWithdrawalRequests = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const withdrawals = await WithdrawalRequest.find()
      .populate("deliveryBoyId", "name phone email")
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    res.status(500).json({ message: "Failed to fetch withdrawal requests" });
  }
};

// Admin: Update withdrawal status
export const updateWithdrawalStatus = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const { withdrawalId } = req.params;
    const { status, adminNote, processedBy } = req.body;

    if (!["approved", "rejected", "paid"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }

    // If rejecting, return money to wallet
    if (status === "rejected" && withdrawal.status === "pending") {
      const wallet = await Wallet.findOne({
        deliveryBoyId: withdrawal.deliveryBoyId,
      });
      if (wallet) {
        wallet.withdrawableBalance += withdrawal.amount;
        await wallet.save();
      }
    }

    // If paying, update wallet
    if (status === "paid" && withdrawal.status === "approved") {
      const wallet = await Wallet.findOne({
        deliveryBoyId: withdrawal.deliveryBoyId,
      });
      if (wallet) {
        wallet.totalWithdrawn += withdrawal.amount;
        await wallet.save();
      }
    }

    // Update withdrawal request
    withdrawal.status = status;
    withdrawal.adminNote = adminNote || "";
    withdrawal.processedBy = processedBy || "Admin";
    withdrawal.processedAt = new Date();

    await withdrawal.save();

    res.json({
      message: `Withdrawal request ${status} successfully`,
      withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(500).json({ message: "Failed to update withdrawal status" });
  }
};

// ============= COD WALLET FUNCTIONS - ADD TO END OF FILE =============

// Get COD Wallet Details
export const getCODWalletDetails = async (req, res) => {
  try {
    let codWallet = await CODWallet.findOne({
      deliveryBoyId: req.user.uid,
    });

    if (!codWallet) {
      codWallet = await CODWallet.create({ deliveryBoyId: req.user.uid });
    }

    // Calculate any new penalties
    await codWallet.calculatePenalties();

    // Separate pending and submitted collections
    const pendingCollections = codWallet.collections.filter(
      (c) => !c.submitted
    );
    const submittedCollections = codWallet.collections.filter(
      (c) => c.submitted
    );

    // Get last collection date from pending collections
    let lastCollectionDate = null;
    if (pendingCollections.length > 0) {
      const sortedPending = [...pendingCollections].sort(
        (a, b) => new Date(b.collectedAt) - new Date(a.collectedAt)
      );
      lastCollectionDate = sortedPending[0].collectedAt;
    }

    res.json({
      totalCollected: codWallet.totalCollected,
      pendingSubmission: codWallet.pendingSubmission,
      totalSubmitted: codWallet.totalSubmitted,
      penaltyAmount: codWallet.totalPenalty,
      lastCollectionDate,
      lastSubmissionDate: codWallet.lastSubmissionDate,
      pendingCollections,
      submittedCollections,
      submissionHistory: [], // Will be populated from collections
    });
  } catch (error) {
    console.error("Error fetching COD wallet:", error);
    res.status(500).json({ message: "Failed to fetch COD wallet details" });
  }
};

// Create Razorpay Order for COD Submission
export const createCODSubmissionOrder = async (req, res) => {
  try {
    const codWallet = await CODWallet.findOne({ deliveryBoyId: req.user.uid });

    if (!codWallet || codWallet.pendingSubmission === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending COD amount to submit",
      });
    }

    // Calculate penalties
    await codWallet.calculatePenalties();

    const totalAmount = codWallet.pendingSubmission;
    const amountInPaise = Math.round(totalAmount * 100);

    // Generate short receipt ID (max 40 chars for Razorpay)
    const timestamp = Date.now().toString().slice(-10); // Last 10 digits
    const uidShort = req.user.uid.toString().slice(-8); // Last 8 chars of ObjectId
    const receiptId = `COD${uidShort}${timestamp}`; // Max 21 chars

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
      notes: {
        deliveryBoyId: req.user.uid.toString(),
        type: "cod_submission",
        penaltyAmount: codWallet.totalPenalty,
      },
    };

    razorpayInstance.orders.create(options, (err, order) => {
      if (!err) {
        console.log("COD Submission Razorpay order created:", order.id);

        res.status(200).json({
          success: true,
          message: "Payment order created",
          order_id: order.id,
          amount: amountInPaise,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
          totalAmount,
          penaltyAmount: codWallet.totalPenalty,
          pendingCollectionsCount: codWallet.collections.filter(
            (c) => !c.submitted
          ).length,
        });
      } else {
        console.error("Razorpay order creation error:", err);
        res.status(400).json({
          success: false,
          message: "Failed to create payment order",
          error: err.message,
        });
      }
    });
  } catch (error) {
    console.error("Create COD submission order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

// Verify Payment and Submit COD Collection
export const verifyCODSubmissionPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters",
      });
    }

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      console.error("Invalid signature for COD submission payment");
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Payment verified, now submit COD collection
    let codWallet = await CODWallet.findOne({ deliveryBoyId: req.user.uid });

    if (!codWallet || codWallet.pendingSubmission === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending COD amount to submit",
      });
    }

    // Submit all pending collections
    const submittedAmount = await codWallet.submitAllPending();

    // Generate receipt number
    const receiptNumber = `REC${Date.now()}${Math.floor(Math.random() * 1000)}`;

    console.log("COD submission successful:", {
      deliveryBoyId: req.user.uid,
      amount: submittedAmount,
      receiptNumber,
      paymentId: razorpay_payment_id,
    });

    res.json({
      success: true,
      message: "COD collection submitted successfully",
      receiptNumber,
      submittedAmount,
      totalSubmitted: codWallet.totalSubmitted,
      payment_id: razorpay_payment_id,
    });
  } catch (error) {
    console.error("Verify COD submission payment error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification and submission failed",
      error: error.message,
    });
  }
};

// Get COD Collection History
export const getCODCollectionHistory = async (req, res) => {
  try {
    const codWallet = await CODWallet.findOne({
      deliveryBoyId: req.user.uid,
    });

    if (!codWallet) {
      return res.json({
        pendingCollections: [],
        submittedCollections: [],
      });
    }

    // Separate pending and submitted
    const pendingCollections = codWallet.collections
      .filter((c) => !c.submitted)
      .sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt));

    const submittedCollections = codWallet.collections
      .filter((c) => c.submitted)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.json({
      pendingCollections,
      submittedCollections,
    });
  } catch (error) {
    console.error("Error fetching COD history:", error);
    res.status(500).json({ message: "Failed to fetch COD collection history" });
  }
};

// Admin: Get all COD submissions
export const getAllCODSubmissions = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const codWallets = await CODWallet.find()
      .populate("deliveryBoyId", "name phone email")
      .sort({ updatedAt: -1 });

    res.json(codWallets);
  } catch (error) {
    console.error("Error fetching COD submissions:", error);
    res.status(500).json({ message: "Failed to fetch COD submissions" });
  }
};
