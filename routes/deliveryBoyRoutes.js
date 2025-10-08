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
} from "../controllers/deliveryBoyController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

// Existing routes (keep as is)
router.post("/register", uploadPhotos, registerDeliveryBoy);
router.post("/login", loginDeliveryBoy);

// Admin routes (keep as is)
router.get("/all", getAllUsers);
router.get("/pending", getPendingRequests);
router.get("/rejected", getRejectedUsers);
router.post("/approve/:id", approveDeliveryBoy);
router.post("/reject/:id", rejectDeliveryBoy);

// Protected routes (keep as is)
router.get("/profile", verifyToken, getDeliveryBoyProfile);
router.put("/profile", verifyToken, updateDeliveryBoyProfile);
router.put("/reset-password", verifyToken, resetDeliveryBoyPassword);

// Count increment routes (keep as is)
router.post("/increment-pickup-count", verifyToken, incrementPickupCount);
router.post("/increment-delivery-count", verifyToken, incrementDeliveryCount);
router.get("/stats", verifyToken, getDeliveryBoyStats);

// NEW WALLET ROUTES - ADD THESE
router.get("/wallet", verifyToken, getWalletDetails);
router.post("/withdrawal-request", verifyToken, createWithdrawalRequest);
router.get("/withdrawal-history", verifyToken, getWithdrawalHistory);

// Admin withdrawal management routes
router.get("/admin/withdrawals", getAllWithdrawalRequests);
router.put("/admin/withdrawals/:withdrawalId", updateWithdrawalStatus);

export default router;