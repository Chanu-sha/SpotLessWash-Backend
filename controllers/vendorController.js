import bcrypt from "bcryptjs";
import Vendor from "../models/Vendor.js";
import { createToken } from "../middlewares/jwtHelper.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import VendorWallet from "../models/VendorWallet.js";
import VendorWithdrawalRequest from "../models/VendorWithdrawalRequest.js";
import Order from "../models/Order.js";

import dotenv from "dotenv";
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
});

// Middleware for handling vendor photo uploads
export const uploadVendorPhotos = upload.fields([
  { name: "livePhoto", maxCount: 1 },
  { name: "aadhaarPhoto", maxCount: 1 },
]);

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `vendor-photos/${folder}`,
          public_id: filename,
          resource_type: "image",
          format: "jpg",
          transformation: [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto:good" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
};

// UPDATED: Helper function to calculate vendor earnings based on basePrice per piece
const calculateVendorEarnings = async (order, vendorId) => {
  if (!order || !order.services || order.services.length === 0) {
    return 0;
  }

  // Get vendor to access basePrice for each service
  const vendor = await Vendor.findById(vendorId).select("services");
  if (!vendor) {
    return 0;
  }

  let totalEarnings = 0;
  order.services.forEach((orderService) => {
    // Find matching service in vendor's catalog to get basePrice
    const vendorService = vendor.services.find(
      (vs) => vs.name === orderService.name
    );

    if (vendorService) {
      // Vendor earns: basePrice × quantity
      const serviceEarning = vendorService.basePrice * orderService.quantity;
      totalEarnings += serviceEarning;
    }
  });

  return Math.floor(totalEarnings);
};

// Register Vendor with Cloudinary photo upload
export const registerVendor = async (req, res) => {
  const { name, email, phone, password, services } = req.body;

  try {
    // Check email or phone duplication
    const existing = await Vendor.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ message: "Email or phone already used" });
    }

    // Validate required photos
    if (!req.files || !req.files.livePhoto || !req.files.aadhaarPhoto) {
      return res.status(400).json({
        message: "Both live photo and Aadhaar card photo are required",
      });
    }

    // Parse services if it's a string
    let parsedServices = [];
    if (services) {
      try {
        const rawServices =
          typeof services === "string" ? JSON.parse(services) : services;
        parsedServices = rawServices.map((service) => ({
          name: service.name,
          description: service.description,
          basePrice: Number(service.price), // Store vendor's price as basePrice
        }));
      } catch (error) {
        return res.status(400).json({ message: "Invalid services data" });
      }
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Upload photos to Cloudinary
    const timestamp = Date.now();
    const phoneLastFour = phone.slice(-4);

    try {
      const [liveUpload, aadhaarUpload] = await Promise.all([
        uploadToCloudinary(
          req.files.livePhoto[0].buffer,
          "live",
          `live_${phoneLastFour}_${timestamp}`
        ),
        uploadToCloudinary(
          req.files.aadhaarPhoto[0].buffer,
          "aadhaar",
          `aadhaar_${phoneLastFour}_${timestamp}`
        ),
      ]);

      const newVendor = await Vendor.create({
        name,
        email,
        phone,
        password: hashed,
        services: parsedServices,
        approved: false,
        rejected: false,
        livePhoto: liveUpload.secure_url,
        aadhaarPhoto: aadhaarUpload.secure_url,
        cloudinaryIds: {
          live: liveUpload.public_id,
          aadhaar: aadhaarUpload.public_id,
        },
      });

      res.status(201).json({
        message:
          "Registration request sent with documents, waiting for approval",
      });
    } catch (uploadError) {
      console.error("Cloudinary Upload Error:", uploadError);
      return res
        .status(500)
        .json({ message: "Error uploading photos. Please try again." });
    }
  } catch (err) {
    console.error("Register Error:", err);

    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "File size too large. Maximum 2MB allowed." });
    }

    res.status(500).json({ message: "Error registering vendor" });
  }
};

// Login
export const loginVendor = async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await Vendor.findOne({ phone });
    if (!user || !user.approved || user.rejected)
      return res.status(403).json({ message: "Not approved or rejected" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // Create wallet if doesn't exist
    let wallet = await VendorWallet.findOne({ vendorId: user._id });
    if (!wallet) {
      wallet = await VendorWallet.create({ vendorId: user._id });
    }

    const token = createToken({ uid: user._id, role: "vendor" });
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
      },
    });
  } catch {
    res.status(500).json({ message: "Login error" });
  }
};

// Get Profile
export const getVendorProfile = async (req, res) => {
  try {
    const user = await Vendor.findById(req.user.uid).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// Update Profile
export const updateVendorProfile = async (req, res) => {
  try {
    const allowedFields = ["name", "email", "phone", "address"];
    const updates = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await Vendor.findByIdAndUpdate(req.user.uid, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user, message: "Profile updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating profile" });
  }
};

// Reset Password
export const resetVendorPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await Vendor.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await Vendor.findByIdAndUpdate(req.user.uid, {
      password: hashedNewPassword,
    });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating password" });
  }
};

// Add Store Image
export const addStoreImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    const user = await Vendor.findById(req.user.uid);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.storeImages.length >= 3) {
      return res
        .status(400)
        .json({ message: "Maximum of 3 store images allowed" });
    }

    user.storeImages.push(imageUrl);
    await user.save();

    res.json({
      storeImages: user.storeImages,
      message: "Image added successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding store image" });
  }
};

// Update Store Image
export const updateStoreImage = async (req, res) => {
  try {
    const { index } = req.params;
    const { imageUrl } = req.body;

    const user = await Vendor.findById(req.user.uid);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (index < 0 || index >= user.storeImages.length) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    user.storeImages[index] = imageUrl;
    await user.save();

    res.json({
      storeImages: user.storeImages,
      message: "Image updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating store image" });
  }
};

// Delete Store Image
export const deleteStoreImage = async (req, res) => {
  try {
    const { index } = req.params;

    const user = await Vendor.findById(req.user.uid);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (index < 0 || index >= user.storeImages.length) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    user.storeImages.splice(index, 1);
    await user.save();

    res.json({
      storeImages: user.storeImages,
      message: "Image deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting store image" });
  }
};

// Add Service
export const addVendorService = async (req, res) => {
  try {
    const { name, description, price } = req.body;

    if (!name || !description || !price) {
      return res
        .status(400)
        .json({ message: "All service fields are required" });
    }

    if (isNaN(price) || price <= 0) {
      return res
        .status(400)
        .json({ message: "Price must be a valid positive number" });
    }

    const user = await Vendor.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if service with same name already exists
    const existingService = user.services.find(
      (service) => service.name.toLowerCase() === name.toLowerCase()
    );

    if (existingService) {
      return res
        .status(400)
        .json({ message: "Service with this name already exists" });
    }

    const newService = {
      name,
      description,
      basePrice: Number(price),
    };

    user.services.push(newService);
    await user.save();

    res.json({
      services: user.services,
      message: "Service added successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding service" });
  }
};

// Update Service
export const updateVendorService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, description, price } = req.body;

    if (!name || !description || !price) {
      return res
        .status(400)
        .json({ message: "All service fields are required" });
    }

    if (isNaN(price) || price <= 0) {
      return res
        .status(400)
        .json({ message: "Price must be a valid positive number" });
    }

    const user = await Vendor.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const serviceIndex = user.services.findIndex(
      (service) => service._id.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Check if another service with same name exists (excluding current service)
    const existingService = user.services.find(
      (service, index) =>
        service.name.toLowerCase() === name.toLowerCase() &&
        index !== serviceIndex
    );

    if (existingService) {
      return res
        .status(400)
        .json({ message: "Service with this name already exists" });
    }

    // Update service
    user.services[serviceIndex].name = name;
    user.services[serviceIndex].description = description;
    user.services[serviceIndex].basePrice = Number(price);

    await user.save();

    res.json({
      services: user.services,
      message: "Service updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating service" });
  }
};

// Delete Service
export const deleteVendorService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const user = await Vendor.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const serviceIndex = user.services.findIndex(
      (service) => service._id.toString() === serviceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Remove service
    user.services.splice(serviceIndex, 1);
    await user.save();

    res.json({
      services: user.services,
      message: "Service deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting service" });
  }
};

// Get All Services
export const getVendorServices = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const user = await Vendor.findById(vendorId).select("name services");
    if (!user) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.json({
      vendorName: user.name,
      services: user.services,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching services" });
  }
};

// Admin Functions
export const getAllVendors = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const users = await Vendor.find();
    res.json(users);
  } catch {
    res.status(500).json({ message: "Error fetching users" });
  }
};

// Get Pending Vendors
export const getPendingVendors = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const pending = await Vendor.find({ approved: false, rejected: false });
    res.json(pending);
  } catch {
    res.status(500).json({ message: "Error fetching pending vendors" });
  }
};

// Get Rejected Vendors
export const getRejectedVendors = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const rejected = await Vendor.find({ rejected: true });
    res.json(rejected);
  } catch {
    res.status(500).json({ message: "Error fetching rejected users" });
  }
};

// Approve Vendor
export const approveVendor = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, {
      approved: true,
      rejected: false,
    });

    // Create wallet when approved
    if (vendor) {
      const existingWallet = await VendorWallet.findOne({
        vendorId: req.params.id,
      });
      if (!existingWallet) {
        await VendorWallet.create({ vendorId: req.params.id });
      }
    }

    res.json({ message: "Approved successfully" });
  } catch {
    res.status(500).json({ message: "Error approving" });
  }
};

// Reject Vendor
export const rejectVendor = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const vendor = await Vendor.findById(req.params.id);

    // Delete photos from Cloudinary when rejecting
    if (vendor && vendor.cloudinaryIds) {
      await Promise.all([
        deleteFromCloudinary(vendor.cloudinaryIds.live),
        deleteFromCloudinary(vendor.cloudinaryIds.aadhaar),
      ]);
    }

    await Vendor.findByIdAndUpdate(req.params.id, {
      rejected: true,
      approved: false,
    });

    res.json({ message: "Rejected successfully" });
  } catch {
    res.status(500).json({ message: "Error rejecting" });
  }
};

// Get Approved Vendors
export const getApprovedVendors = async (req, res) => {
  try {
    const approved = await Vendor.find({ approved: true, rejected: false });
    res.json(approved);
  } catch {
    res.status(500).json({ message: "Error fetching approved vendors" });
  }
};

// UPDATED: Function to be called when vendor marks order as washed
export const completeWashingOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get the order directly from database
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if this vendor owns this order (security check)
    if (order.vendorId.toString() !== req.user.uid) {
      return res
        .status(403)
        .json({ message: "Unauthorized - This order doesn't belong to you" });
    }

    // Check if order was already completed (prevent double counting)
    if (order.walletUpdated) {
      return res.status(400).json({
        message: "Order earnings already added to wallet",
      });
    }

    // Calculate vendor earnings using basePrice per piece
    const vendorEarnings = await calculateVendorEarnings(order, req.user.uid);

    // Get vendor for detailed breakdown
    const vendor = await Vendor.findById(req.user.uid).select("services");

    // Update vendor wallet with earnings AND increment order count
    let wallet = await VendorWallet.findOne({ vendorId: req.user.uid });
    if (!wallet) {
      wallet = await VendorWallet.create({ vendorId: req.user.uid });
    }

    // Update wallet fields directly
    wallet.totalEarnings += vendorEarnings;
    wallet.todaysEarnings += vendorEarnings;
    wallet.withdrawableBalance += vendorEarnings;
    wallet.completedOrders += 1; // INCREMENT ORDER COUNT
    wallet.lastEarningDate = new Date();

    // Save wallet
    await wallet.save();

    // Mark order as wallet updated to prevent double counting
    await Order.findByIdAndUpdate(orderId, {
      walletUpdated: true,
      completedAt: new Date(), 
    });

    // Create detailed service breakdown
    const servicesBreakdown = order.services.map((orderService) => {
      const vendorService = vendor.services.find(
        (vs) => vs.name === orderService.name
      );
      return {
        name: orderService.name,
        quantity: orderService.quantity,
        customerPricePerPiece: orderService.price,
        customerTotal: orderService.price * orderService.quantity,
        vendorBasePricePerPiece: vendorService ? vendorService.basePrice : 0,
        vendorTotal: vendorService
          ? Math.floor(vendorService.basePrice * orderService.quantity)
          : 0,
      };
    });

    res.json({
      message: "Order completed successfully",
      earningsAdded: vendorEarnings,
      completedOrders: wallet.completedOrders,
      orderDetails: {
        orderId: order._id,
        totalPrice: order.totalPrice,
        vendorEarnings: vendorEarnings,
        services: servicesBreakdown,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error completing washing order:", error);
    res.status(500).json({ message: "Failed to complete order" });
  }
};

// Get vendor wallet details
export const getVendorWalletDetails = async (req, res) => {
  try {
    let wallet = await VendorWallet.findOne({ vendorId: req.user.uid });
    if (!wallet) {
      wallet = await VendorWallet.create({ vendorId: req.user.uid });
    }

    // Check if it's a new day and reset earnings
    const today = new Date();
    const lastEarningDate = new Date(wallet.lastEarningDate);

    if (today.toDateString() !== lastEarningDate.toDateString()) {
      await wallet.resetDailyEarnings();
    }

    res.json({
      totalEarnings: wallet.totalEarnings,
      todaysEarnings: wallet.todaysEarnings,
      withdrawableBalance: wallet.withdrawableBalance,
      totalWithdrawn: wallet.totalWithdrawn,
      completedOrders: wallet.completedOrders,
      lastEarningDate: wallet.lastEarningDate,
    });
  } catch (error) {
    console.error("Error fetching vendor wallet details:", error);
    res.status(500).json({ message: "Failed to fetch wallet details" });
  }
};

// Get vendor stats with wallet info
export const getVendorStats = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.uid).select("name services");
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Get wallet info
    let wallet = await VendorWallet.findOne({ vendorId: req.user.uid });
    if (!wallet) {
      wallet = await VendorWallet.create({ vendorId: req.user.uid });
    }

    // Check if it's a new day and reset earnings
    const today = new Date();
    const lastEarningDate = new Date(wallet.lastEarningDate);

    if (today.toDateString() !== lastEarningDate.toDateString()) {
      await wallet.resetDailyEarnings();
    }

    res.json({
      name: vendor.name,
      serviceCount: vendor.services.length,
      completedOrders: wallet.completedOrders,
      wallet: {
        totalEarnings: wallet.totalEarnings,
        todaysEarnings: wallet.todaysEarnings,
        withdrawableBalance: wallet.withdrawableBalance,
        totalWithdrawn: wallet.totalWithdrawn,
      },
    });
  } catch (error) {
    console.error("Error fetching vendor stats:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

// UPDATED: Get today's completed orders with vendor earnings
export const getTodaysCompletedOrders = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Filter orders that were marked as washed TODAY
    const orders = await Order.find({
      vendorId: req.user.uid,
      walletUpdated: true, // Only orders where earnings were added
      completedAt: { $gte: todayStart, $lte: todayEnd },
    })
      .populate("userId", "name mobile")
      .sort({ completedAt: -1 });

    // Add vendor earnings calculation
    const ordersWithEarnings = await Promise.all(
      orders.map(async (order) => {
        const vendorEarnings = await calculateVendorEarnings(
          order,
          req.user.uid
        );

        return {
          _id: order._id,
          userName: order.userId?.name || "Customer",
          userMobile: order.userId?.mobile || "N/A",
          services: order.services,
          totalPrice: order.totalPrice,
          status: order.status,
          vendorEarnings: vendorEarnings,
          completedAt: order.completedAt,
          createdAt: order.createdAt,
        };
      })
    );

    res.json({
      todaysCompletedOrders: ordersWithEarnings,
      count: ordersWithEarnings.length,
    });
  } catch (error) {
    console.error("Error fetching today's completed orders:", error);
    res.status(500).json({ message: "Failed to fetch today's orders" });
  }
};

// UPDATED: Get past completed orders with vendor earnings
export const getPastCompletedOrders = async (req, res) => {
  try {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));

    // Fetch orders that were completed before today
    const orders = await Order.find({
      vendorId: req.user.uid,
      walletUpdated: true, 
      completedAt: { $lt: todayStart },
    })
      .populate("userId", "name mobile")
      .sort({ completedAt: -1 });

    // Add vendor earnings calculation to each order
    const ordersWithEarnings = await Promise.all(
      orders.map(async (order) => {
        const vendorEarnings = await calculateVendorEarnings(
          order,
          req.user.uid
        );

        return {
          _id: order._id,
          userName: order.userId?.name || "Customer",
          userMobile: order.userId?.mobile || "N/A",
          services: order.services,
          totalPrice: order.totalPrice,
          status: order.status,
          vendorEarnings: vendorEarnings,
          completedAt: order.completedAt,
          createdAt: order.createdAt,
        };
      })
    );

    res.json({
      pastCompletedOrders: ordersWithEarnings,
      count: ordersWithEarnings.length,
    });
  } catch (error) {
    console.error("Error fetching past completed orders:", error);
    res.status(500).json({ message: "Failed to fetch past orders" });
  }
};

// Create withdrawal request
export const createVendorWithdrawalRequest = async (req, res) => {
  try {
    const { amount, upiId, fullName, phoneNumber, withdrawFrom } = req.body;

    // Validate input
    if (!amount || !upiId || !fullName || !phoneNumber || !withdrawFrom) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    if (!["today", "withdrawable"].includes(withdrawFrom)) {
      return res.status(400).json({ message: "Invalid withdrawal source" });
    }

    // Get wallet
    let wallet = await VendorWallet.findOne({ vendorId: req.user.uid });
    if (!wallet) {
      wallet = await VendorWallet.create({ vendorId: req.user.uid });
    }

    // Check if it's a new day and reset earnings
    const today = new Date();
    const lastEarningDate = new Date(wallet.lastEarningDate);

    if (today.toDateString() !== lastEarningDate.toDateString()) {
      await wallet.resetDailyEarnings();
    }

    // Check available balance
    const availableBalance =
      withdrawFrom === "today"
        ? wallet.todaysEarnings
        : wallet.withdrawableBalance;

    if (amount > availableBalance) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ₹${availableBalance}`,
      });
    }

    // Create withdrawal request
    const withdrawalRequest = await VendorWithdrawalRequest.create({
      vendorId: req.user.uid,
      amount,
      upiId,
      fullName,
      phoneNumber,
    });

    // Deduct amount from wallet
    if (withdrawFrom === "today") {
      wallet.todaysEarnings -= amount;
    } else {
      wallet.withdrawableBalance -= amount;
    }

    await wallet.save();

    res.json({
      message: "Withdrawal request submitted successfully",
      withdrawalId: withdrawalRequest._id,
      remainingBalance:
        withdrawFrom === "today"
          ? wallet.todaysEarnings
          : wallet.withdrawableBalance,
    });
  } catch (error) {
    console.error("Error creating vendor withdrawal request:", error);
    res.status(500).json({ message: "Failed to create withdrawal request" });
  }
};

// Get withdrawal history
export const getVendorWithdrawalHistory = async (req, res) => {
  try {
    const withdrawals = await VendorWithdrawalRequest.find({
      vendorId: req.user.uid,
    }).sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (error) {
    console.error("Error fetching vendor withdrawal history:", error);
    res.status(500).json({ message: "Failed to fetch withdrawal history" });
  }
};

// Admin: Get all vendor withdrawal requests
export const getAllVendorWithdrawalRequests = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const withdrawals = await VendorWithdrawalRequest.find()
      .populate("vendorId", "name phone email")
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (error) {
    console.error("Error fetching vendor withdrawal requests:", error);
    res.status(500).json({ message: "Failed to fetch withdrawal requests" });
  }
};

// Admin: Update vendor withdrawal status
export const updateVendorWithdrawalStatus = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const { withdrawalId } = req.params;
    const { status, adminNote, processedBy } = req.body;

    if (!["approved", "rejected", "paid"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const withdrawal = await VendorWithdrawalRequest.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }

    // If rejecting, return money to wallet
    if (status === "rejected" && withdrawal.status === "pending") {
      const wallet = await VendorWallet.findOne({
        vendorId: withdrawal.vendorId,
      });
      if (wallet) {
        wallet.withdrawableBalance += withdrawal.amount;
        await wallet.save();
      }
    }

    // If paying, update wallet
    if (status === "paid" && withdrawal.status === "approved") {
      const wallet = await VendorWallet.findOne({
        vendorId: withdrawal.vendorId,
      });
      if (wallet) {
        wallet.totalWithdrawn += withdrawal.amount;
        await wallet.save();
      }
    }

    // Update withdrawal request
    withdrawal.status = status;
    withdrawal.adminNote = adminNote || "";
    withdrawal.processedBy = processedBy || "Admin";
    withdrawal.processedAt = new Date();

    await withdrawal.save();

    res.json({
      message: `Vendor withdrawal request ${status} successfully`,
      withdrawal,
    });
  } catch (error) {
    console.error("Error updating vendor withdrawal status:", error);
    res.status(500).json({ message: "Failed to update withdrawal status" });
  }
};
