// routes/userRoutes.js
import express from 'express';
import { verifyFirebaseToken } from '../middlewares/authMiddleware.js';
import {
  createOrUpdateUser,
  getProfile,
  updateProfile,
} from '../controllers/userController.js';

const router = express.Router();

router.post('/login', verifyFirebaseToken, createOrUpdateUser);
router.get('/profile', verifyFirebaseToken, getProfile);
router.put('/profile', verifyFirebaseToken, updateProfile);

export default router;
