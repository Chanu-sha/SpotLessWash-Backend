// routes/deliveryBoyRoutes.js
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
  claimOrder,
  getMyDeals,
} from "../controllers/deliveryBoyController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

router.post("/register", registerDeliveryBoy);
router.post("/login", loginDeliveryBoy);
router.get("/all", getAllUsers);
router.get("/pending", getPendingRequests);
router.get("/rejected", getRejectedUsers);
router.post("/approve/:id", approveDeliveryBoy);
router.post("/reject/:id", rejectDeliveryBoy);

// ✅ Profile routes
router.get("/profile", verifyToken, getDeliveryBoyProfile);
router.put("/profile", verifyToken, updateDeliveryBoyProfile);

router.post("/claim/:orderId", verifyToken, claimOrder);
router.get("/my-deals", verifyToken, getMyDeals);

export default router;
