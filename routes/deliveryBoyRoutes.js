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
} from "../controllers/deliveryBoyController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

// Registration route with photo upload middleware
router.post("/register", uploadPhotos, registerDeliveryBoy);

// Login route (no changes needed)
router.post("/login", loginDeliveryBoy);

// Admin routes (require admin authorization)
router.get("/all", getAllUsers);
router.get("/pending", getPendingRequests);
router.get("/rejected", getRejectedUsers);
router.post("/approve/:id", approveDeliveryBoy);
router.post("/reject/:id", rejectDeliveryBoy);

// Protected routes (require delivery boy authentication)
router.get("/profile", verifyToken, getDeliveryBoyProfile);
router.put("/profile", verifyToken, updateDeliveryBoyProfile);
router.put("/reset-password", verifyToken, resetDeliveryBoyPassword);

export default router;