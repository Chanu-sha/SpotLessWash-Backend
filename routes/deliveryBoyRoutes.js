import express from "express";
import {
  registerDeliveryBoy,
  loginDeliveryBoy,
  getAllUsers,
  getPendingRequests,
  getRejectedUsers,
  approveDeliveryBoy,
  rejectDeliveryBoy,
} from "../controllers/deliveryBoyController.js";

const router = express.Router();

router.post("/register", registerDeliveryBoy);
router.post("/login", loginDeliveryBoy);
router.get("/all", getAllUsers);
router.get("/pending", getPendingRequests);
router.get("/rejected", getRejectedUsers); 
router.post("/approve/:id", approveDeliveryBoy);
router.post("/reject/:id", rejectDeliveryBoy);

export default router;
