import express from 'express';
import {
  createOrder,
  createRazorpayOrder,
  verifyPayment,
  webhook
} from '../controllers/paymentsController.js';

const router = express.Router();

// Normal JSON routes
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

// Webhook needs raw body, so mount separately with raw parser for signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  webhook
);

// Optional endpoint to create an order directly with amount
router.post('/createOnlineorder', createRazorpayOrder);

export default router;
