import express from "express";
import {
  registerDhobi,
  loginDhobi,
  getAllDhobis,
  getPendingDhobis,
  getRejectedDhobis,
  approveDhobi,
  rejectDhobi,
  getDhobiProfile,
  updateDhobiProfile,
} from "../controllers/dhobiController.js";
import { verifyToken } from "../middlewares/jwtHelper.js";

const router = express.Router();

router.post("/register", registerDhobi);
router.post("/login", loginDhobi);

router.get("/all", getAllDhobis);
router.get("/pending", getPendingDhobis);
router.get("/rejected", getRejectedDhobis);
router.post("/approve/:id", approveDhobi);
router.post("/reject/:id", rejectDhobi);

router.get("/profile", verifyToken, getDhobiProfile);
router.put("/profile", verifyToken, updateDhobiProfile);



export default router;
