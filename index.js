import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./db.js";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import deliveryBoyRoutes from "./routes/deliveryBoyRoutes.js";
import adminRoutes from "./routes/admin.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import { startDailyEarningsReset, manualEarningsReset } from "./utils/cronJobs.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB().then(() => {
  startDailyEarningsReset();
});

// Routes
app.use("/api/user", userRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/deliveryboy", deliveryBoyRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_, res) => res.json({ ok: true }));

// ADD MANUAL RESET ENDPOINT FOR TESTING
app.post('/api/admin/reset-earnings', async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  
  try {
    const result = await manualEarningsReset();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});