// routes/subscriptionRoutes.js
import express from "express";
import {
  createSubscriptionOrder,
  confirmSubscription,
  checkSubscription, 
} from "../controllers/subscriptionController.js";
import { verifyFirebaseToken } from "../middlewares/authMiddleware.js";


const router = express.Router();

router.post("/create-subscription-order", verifyFirebaseToken, createSubscriptionOrder);
router.post("/confirm-subscription", verifyFirebaseToken, confirmSubscription);
router.get("/subscription/check", verifyFirebaseToken, checkSubscription); // Add this route

export default router;