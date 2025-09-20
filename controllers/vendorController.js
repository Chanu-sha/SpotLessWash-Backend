import bcrypt from "bcryptjs";
import Vendor from "../models/Vendor.js";
import { createToken } from "../middlewares/jwtHelper.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
});

// Middleware for handling vendor photo uploads
export const uploadVendorPhotos = upload.fields([
  { name: 'livePhoto', maxCount: 1 },
  { name: 'aadhaarPhoto', maxCount: 1 }
]);

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: `vendor-photos/${folder}`,
        public_id: filename,
        resource_type: 'image',
        format: 'jpg',
        transformation: [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
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
        message: "Both live photo and Aadhaar card photo are required" 
      });
    }

    // Parse services if it's a string
    let parsedServices = [];
    if (services) {
      try {
        parsedServices = typeof services === 'string' ? JSON.parse(services) : services;
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
          'live', 
          `live_${phoneLastFour}_${timestamp}`
        ),
        uploadToCloudinary(
          req.files.aadhaarPhoto[0].buffer, 
          'aadhaar', 
          `aadhaar_${phoneLastFour}_${timestamp}`
        )
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
          aadhaar: aadhaarUpload.public_id
        }
      });

      res.status(201).json({ 
        message: "Registration request sent with documents, waiting for approval" 
      });

    } catch (uploadError) {
      console.error("Cloudinary Upload Error:", uploadError);
      return res.status(500).json({ message: "Error uploading photos. Please try again." });
    }

  } catch (err) {
    console.error("Register Error:", err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: "File size too large. Maximum 2MB allowed." });
    }
    
    res.status(500).json({ message: "Error registering vendor" });
  }
};

// Login (unchanged)
export const loginVendor = async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await Vendor.findOne({ phone });
    if (!user || !user.approved || user.rejected)
      return res.status(403).json({ message: "Not approved or rejected" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = createToken({ uid: user._id, role: "vendor" });
    res.json({ 
      message: "Login successful", 
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
      }
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
      return res.status(400).json({ message: "New password must be different from current password" });
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

// Update Store Image (replace by index)
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
      price: Number(price),
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
    user.services[serviceIndex].price = Number(price);

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

// Get All Services (for public viewing)
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

// Get Pending Vendors (with photo URLs)
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
    await Vendor.findByIdAndUpdate(req.params.id, {
      approved: true,
      rejected: false,
    });
    res.json({ message: "Approved successfully" });
  } catch {
    res.status(500).json({ message: "Error approving" });
  }
};

// Reject Vendor with Cloudinary cleanup
export const rejectVendor = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`)
    return res.status(403).json({ message: "Unauthorized" });

  try {
    const vendor = await Vendor.findById(req.params.id);
    
    // Delete photos from Cloudinary when rejecting
    if (vendor && vendor.cloudinaryIds) {
      await Promise.all([
        deleteFromCloudinary(vendor.cloudinaryIds.live),
        deleteFromCloudinary(vendor.cloudinaryIds.aadhaar)
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