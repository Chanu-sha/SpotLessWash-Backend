import express from "express";
import { connectDB } from "./db.js";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import deliveryBoyRoutes from "./routes/deliveryBoyRoutes.js";
import adminRoutes from "./routes/admin.js";
import dhobiRoutes from "./routes/dhobiRoutes.js";
import paymentsRoutes from './routes/paymentsRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: "https://spotlesswash-frontend.onrender.com",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Connect to MongoDB
connectDB();


// Routes
app.use("/api/user", userRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/deliveryboy", deliveryBoyRoutes);
app.use("/api/dhobi", dhobiRoutes);
app.use("/api/admin", adminRoutes);
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/payments', paymentsRoutes);
app.use('/api/subscription', subscriptionRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
