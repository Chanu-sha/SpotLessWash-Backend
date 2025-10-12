import express from "express";
import {
  registerDeliveryBoy,
  loginDeliveryBoy,
  getAllUsers,
  getPendingRequests,
  getRejectedUsers,
  approveDeliveryBoy,
  rejectDeliveryBoy,
  getDeliveryBoyProfile,
  updateDeliveryBoyProfile,
  resetDeliveryBoyPassword,
  uploadPhotos,
  incrementPickupCount,
  incrementDeliveryCount,
  getDeliveryBoyStats,
  getWalletDetails,
  createWithdrawalRequest,
  getWithdrawalHistory,
  getAllWithdrawalRequests,
  updateWithdrawalStatus,
  getCODWalletDetails,
  createCODSubmissionOrder,
  verifyCODSubmissionPayment,
  getCODCollectionHistory,
  getAllCODSubmissions,
} from "../controllers/deliveryBoyController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

// ==========================================
// REGISTRATION & AUTHENTICATION ROUTES
// ==========================================
router.post("/register", uploadPhotos, registerDeliveryBoy);
router.post("/login", loginDeliveryBoy);

// ==========================================
// ADMIN MANAGEMENT ROUTES
// ==========================================
router.get("/all", getAllUsers);
router.get("/pending", getPendingRequests);
router.get("/rejected", getRejectedUsers);
router.post("/approve/:id", approveDeliveryBoy);
router.post("/reject/:id", rejectDeliveryBoy);

// ==========================================
// PROFILE ROUTES (Protected)
// ==========================================
router.get("/profile", verifyToken, getDeliveryBoyProfile);
router.put("/profile", verifyToken, updateDeliveryBoyProfile);
router.put("/reset-password", verifyToken, resetDeliveryBoyPassword);

// ==========================================
// ORDER COMPLETION TRACKING ROUTES
// ==========================================
router.post("/increment-pickup-count", verifyToken, incrementPickupCount);
router.post("/increment-delivery-count", verifyToken, incrementDeliveryCount);
router.get("/stats", verifyToken, getDeliveryBoyStats);

// ==========================================
// EARNINGS WALLET ROUTES (Existing - 25₹ per order)
// ==========================================
router.get("/wallet", verifyToken, getWalletDetails);
router.post("/withdrawal-request", verifyToken, createWithdrawalRequest);
router.get("/withdrawal-history", verifyToken, getWithdrawalHistory);

// Admin withdrawal management
router.get("/admin/withdrawals", getAllWithdrawalRequests);
router.put("/admin/withdrawals/:withdrawalId", updateWithdrawalStatus);

// ==========================================
//  COD WALLET ROUTES (NEW - Razorpay Integration)
// ==========================================
// Get COD wallet details (pending, submitted, penalties)
router.get("/cod-wallet", verifyToken, getCODWalletDetails);

// Create Razorpay order for COD submission
router.post("/cod-wallet/create-order", verifyToken, createCODSubmissionOrder);

// Verify Razorpay payment and submit COD collection
router.post("/cod-wallet/verify-payment", verifyToken, verifyCODSubmissionPayment);

// Get COD collection history
router.get("/cod-wallet/history", verifyToken, getCODCollectionHistory);

// Admin: View all COD submissions
router.get("/admin/cod-submissions", getAllCODSubmissions);

export default router;