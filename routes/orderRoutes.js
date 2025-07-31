import express from "express";
import {
  placeOrder,
  getUserOrders,
  trackOrder,
  updateOrderStatus,
  getUnclaimedOrders,
  verifyOtpAndCompleteOrder,
} from "../controllers/orderController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

import { verifyFirebaseToken } from "../middlewares/authMiddleware.js";

router.post("/place", verifyFirebaseToken, placeOrder);
router.get("/my-orders", verifyFirebaseToken, getUserOrders);
router.get("/track/:orderId", verifyFirebaseToken, trackOrder);
router.post("/verify-otp/:orderId", verifyToken, verifyOtpAndCompleteOrder);

router.get("/unclaimed", getUnclaimedOrders);

router.patch("/:orderId/status", updateOrderStatus);

export default router;
