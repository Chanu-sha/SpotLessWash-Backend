import express from 'express';
import {
  placeOrder,
  getUserOrders,
  trackOrder,
  getAllOrders,         // ✅ NEW
  updateOrderStatus     // ✅ NEW
} from '../controllers/orderController.js';

const router = express.Router();

import { verifyFirebaseToken } from '../middlewares/authMiddleware.js';

router.post('/place', verifyFirebaseToken, placeOrder);
router.get('/my-orders', verifyFirebaseToken, getUserOrders);
router.get('/track/:orderId', verifyFirebaseToken, trackOrder);

// ✅ NEW public delivery-boy-related routes:
router.get('/all', getAllOrders);
router.patch('/:orderId/status', updateOrderStatus);

export default router;
