import express from "express";
import {
  registerVendor,
  loginVendor,
  getAllVendors,
  getPendingVendors,
  getRejectedVendors,
  approveVendor,
  rejectVendor,
  getVendorProfile,
  updateVendorProfile,
  getApprovedVendors,
  resetVendorPassword,
  addVendorService,
  updateVendorService,
  deleteVendorService,
  getVendorServices,
  addStoreImage,
  updateStoreImage,
  deleteStoreImage,
  uploadVendorPhotos,
  completeWashingOrder,
  getVendorWalletDetails,
  getVendorStats,
  getTodaysCompletedOrders,
  getPastCompletedOrders,
  createVendorWithdrawalRequest,
  getVendorWithdrawalHistory,
  getAllVendorWithdrawalRequests,
  updateVendorWithdrawalStatus,
} from "../controllers/vendorController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

// Registration route with photo upload middleware
router.post("/register", uploadVendorPhotos, registerVendor);

// Login route
router.post("/login", loginVendor);

// Admin routes (require admin authorization)
router.get("/all", getAllVendors);
router.get("/pending", getPendingVendors);
router.get("/rejected", getRejectedVendors);
router.get("/approved", getApprovedVendors);
router.post("/approve/:id", approveVendor);
router.post("/reject/:id", rejectVendor);

// Protected routes (require vendor authentication)
router.get("/profile", verifyToken, getVendorProfile);
router.put("/profile", verifyToken, updateVendorProfile);
router.put("/reset-password", verifyToken, resetVendorPassword);

// Service management routes
router.post("/services", verifyToken, addVendorService);
router.put("/services/:serviceId", verifyToken, updateVendorService);
router.delete("/services/:serviceId", verifyToken, deleteVendorService);
router.get("/services/:vendorId", getVendorServices);

// Store images routes
router.post("/store-images", verifyToken, addStoreImage);
router.put("/store-images/:index", verifyToken, updateStoreImage);
router.delete("/store-images/:index", verifyToken, deleteStoreImage);

// NEW WALLET ROUTES
router.post("/complete-order/:orderId", verifyToken, completeWashingOrder);
router.get("/wallet", verifyToken, getVendorWalletDetails);
router.get("/stats", verifyToken, getVendorStats);
router.get("/todays-orders", verifyToken, getTodaysCompletedOrders);
router.get("/past-orders", verifyToken, getPastCompletedOrders);
router.post("/withdrawal-request", verifyToken, createVendorWithdrawalRequest);
router.get("/withdrawal-history", verifyToken, getVendorWithdrawalHistory);

// Admin vendor withdrawal management routes
router.get("/admin/withdrawals", getAllVendorWithdrawalRequests);
router.put("/admin/withdrawals/:withdrawalId", updateVendorWithdrawalStatus);

export default router;