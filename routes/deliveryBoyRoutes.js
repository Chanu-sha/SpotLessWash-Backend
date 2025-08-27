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

router.get("/profile", verifyToken, getDeliveryBoyProfile);
router.put("/profile", verifyToken, updateDeliveryBoyProfile);
router.put("/reset-password", verifyToken, resetDeliveryBoyPassword);


export default router;
