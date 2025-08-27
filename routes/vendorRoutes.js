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
} from "../controllers/vendorController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

router.post("/register", registerVendor);
router.post("/login", loginVendor);

router.get("/all", getAllVendors);
router.get("/pending", getPendingVendors);
router.get("/rejected", getRejectedVendors);
router.get("/approved", getApprovedVendors);
router.post("/approve/:id", approveVendor);
router.post("/reject/:id", rejectVendor);

router.get("/profile", verifyToken, getVendorProfile);
router.put("/profile", verifyToken, updateVendorProfile);

// Service management routes
router.put("/reset-password", verifyToken, resetVendorPassword);
router.post("/services", verifyToken, addVendorService);
router.put("/services/:serviceId", verifyToken, updateVendorService);
router.delete("/services/:serviceId", verifyToken, deleteVendorService);
router.get("/services/:vendorId", getVendorServices);

// Store images routes
router.post("/store-images", verifyToken, addStoreImage);
router.put("/store-images/:index", verifyToken, updateStoreImage);
router.delete("/store-images/:index", verifyToken, deleteStoreImage);

export default router;
