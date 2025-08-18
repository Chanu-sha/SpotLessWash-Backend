import express from "express";
import {
  placeOrder,
  getUserOrders,
  trackOrder,
  updateOrderStatus,
  getUnclaimedOrders,
  verifyOtpAndCompleteOrder,
  getAssignedOrders,
  verifyOtpAndReceiveByDhobi,
  getWashingOrdersForDhobi,
  getDeliveryOrders,
  verifyOtpForDeliveryPickup,
  verifyOtpForFinalDelivery,
  getTodayOrderCount,
} from "../controllers/orderController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

import { verifyFirebaseToken } from "../middlewares/authMiddleware.js";

router.post("/place", verifyFirebaseToken, placeOrder);
router.get("/my-orders", verifyFirebaseToken, getUserOrders);
router.get("/track/:orderId", verifyFirebaseToken, trackOrder);
router.post("/verify-otp/:orderId", verifyToken, verifyOtpAndCompleteOrder);

router.get("/unclaimed", getUnclaimedOrders);
router.get("/assigned", verifyToken, getAssignedOrders);
router.post(
  "/verify-otp-dhobi/:orderId",
  verifyToken,
  verifyOtpAndReceiveByDhobi
);
router.get("/assigned/washing", verifyToken, getWashingOrdersForDhobi);

router.get("/delivery-orders", verifyToken, getDeliveryOrders);
router.post(
  "/verify-otp-delivery-pickup/:orderId",
  verifyToken,
  verifyOtpForDeliveryPickup
);
router.post(
  "/verify-otp-final-delivery/:orderId",
  verifyToken,
  verifyOtpForFinalDelivery
);

router.patch("/:orderId/status", updateOrderStatus);
// Get today's order count for a user
router.get("/todayCount",  getTodayOrderCount);

export default router;
