import express from "express";
import {
  placeOrder,
  getUserOrders,
  trackOrder,
  updateOrderStatus,
  getUnclaimedOrders,
  verifyOtpAndCompleteOrder,
  getAssignedOrders,
  verifyOtpAndReceiveByVendor,
  getWashingOrdersForVendor,
  getDeliveryOrders,
  verifyOtpForDeliveryPickup,
  verifyOtpForFinalDelivery,
  claimPickupOrder,
  claimDeliveryOrder,
  getMyPickupOrders,
  getMyDeliveryOrders,
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
  verifyOtpAndReceiveByVendor
);
router.get("/assigned/washing", verifyToken, getWashingOrdersForVendor);

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

router.post("/claimpickup/:orderId", verifyToken, claimPickupOrder);
router.post("/claimdlievery/:orderId", verifyToken, claimDeliveryOrder);
// My deals routes
router.get("/my-pickup-orders", verifyToken, getMyPickupOrders);
router.get("/my-delivery-orders", verifyToken, getMyDeliveryOrders);

export default router;
