import bcrypt from "bcryptjs";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { createToken } from "../middlewares/jwtHelper.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage (temporary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file type
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

// Middleware for handling multiple file uploads
export const uploadPhotos = upload.fields([
  { name: 'livePhoto', maxCount: 1 },
  { name: 'aadhaarPhoto', maxCount: 1 },
  { name: 'licensePhoto', maxCount: 1 }
]);

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: `delivery-photos/${folder}`,
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

// Register Delivery Boy with Cloudinary photo upload
export const registerDeliveryBoy = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    // Check email or phone duplication
    const existing = await DeliveryBoy.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ message: "Email or phone already used" });
    }

    // Validate required photos
    if (!req.files || !req.files.livePhoto || !req.files.aadhaarPhoto || !req.files.licensePhoto) {
      return res.status(400).json({ 
        message: "All photos are required: live photo, Aadhaar card, and driving license" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upload photos to Cloudinary
    const timestamp = Date.now();
    const phoneLastFour = phone.slice(-4);
    
    try {
      const [liveUpload, aadhaarUpload, licenseUpload] = await Promise.all([
        uploadToCloudinary(
          req.files.livePhoto[0].buffer, 
          'live', 
          `live_${phoneLastFour}_${timestamp}`
        ),
        uploadToCloudinary(
          req.files.aadhaarPhoto[0].buffer, 
          'aadhaar', 
          `aadhaar_${phoneLastFour}_${timestamp}`
        ),
        uploadToCloudinary(
          req.files.licensePhoto[0].buffer, 
          'license', 
          `license_${phoneLastFour}_${timestamp}`
        )
      ]);

      const newBoy = await DeliveryBoy.create({
        name,
        email,
        phone,
        password: hashedPassword,
        approved: false, 
        rejected: false,
        livePhoto: liveUpload.secure_url,
        aadhaarPhoto: aadhaarUpload.secure_url,
        licensePhoto: licenseUpload.secure_url,
        cloudinaryIds: {
          live: liveUpload.public_id,
          aadhaar: aadhaarUpload.public_id,
          license: licenseUpload.public_id
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
    
    res.status(500).json({ message: "Error registering user" });
  }
};

// Login Delivery Boy (unchanged)
export const loginDeliveryBoy = async (req, res) => {
  const { phone, password } = req.body;

  try {
    const boy = await DeliveryBoy.findOne({ phone });
    if (!boy) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!boy.approved || boy.rejected) {
      return res.status(403).json({ message: "Not approved or rejected" });
    }

    // Compare plain password with stored hash
    const match = await bcrypt.compare(password, boy.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = createToken({ uid: boy._id, role: "delivery" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: boy._id,
        name: boy.name,
        phone: boy.phone,
        email: boy.email,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Login error" });
  }
};

// Get profile
export const getDeliveryBoyProfile = async (req, res) => {
  try {
    const user = await DeliveryBoy.findById(req.user.uid);
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// Update profile
export const updateDeliveryBoyProfile = async (req, res) => {
  try {
    const updated = await DeliveryBoy.findByIdAndUpdate(
      req.user.uid,
      req.body,
      {
        new: true,
      }
    );
    res.json({ message: "Profile updated", user: updated });
  } catch {
    res.status(500).json({ message: "Error updating profile" });
  }
};

// Get All Users (photos already have URLs)
export const getAllUsers = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  try {
    const users = await DeliveryBoy.find();
    res.json(users);
  } catch {
    res.status(500).json({ message: "Error fetching users" });
  }
};

// Get Pending Requests (photos already have URLs)
export const getPendingRequests = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const pending = await DeliveryBoy.find({
      approved: false,
      rejected: false,
    });
    
    res.json(pending);
  } catch {
    res.status(500).json({ message: "Error fetching" });
  }
};

// Get Rejected Users
export const getRejectedUsers = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const rejected = await DeliveryBoy.find({ rejected: true });
    res.json(rejected);
  } catch {
    res.status(500).json({ message: "Error fetching rejected users" });
  }
};

// Approve
export const approveDeliveryBoy = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    await DeliveryBoy.findByIdAndUpdate(req.params.id, {
      approved: true,
      rejected: false,
    });
    res.json({ message: "Approved successfully" });
  } catch {
    res.status(500).json({ message: "Error approving" });
  }
};

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
};

// Reject with Cloudinary cleanup
export const rejectDeliveryBoy = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const deliveryBoy = await DeliveryBoy.findById(req.params.id);
    
    // Delete photos from Cloudinary when rejecting
    if (deliveryBoy && deliveryBoy.cloudinaryIds) {
      await Promise.all([
        deleteFromCloudinary(deliveryBoy.cloudinaryIds.live),
        deleteFromCloudinary(deliveryBoy.cloudinaryIds.aadhaar),
        deleteFromCloudinary(deliveryBoy.cloudinaryIds.license)
      ]);
    }

    await DeliveryBoy.findByIdAndUpdate(req.params.id, {
      rejected: true,
      approved: false,
    });
    
    res.json({ message: "Rejected successfully" });
  } catch {
    res.status(500).json({ message: "Error rejecting" });
  }
};

// Reset Password (unchanged)
export const resetDeliveryBoyPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Get the delivery boy from database
    const boy = await DeliveryBoy.findById(req.user.uid);
    if (!boy) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, boy.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, boy.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await DeliveryBoy.findByIdAndUpdate(req.user.uid, {
      password: hashedNewPassword
    });

    res.json({ message: "Password updated successfully" });

  } catch (err) {
    console.error(" Password Reset Error:", err);
    res.status(500).json({ message: "Error updating password" });
  }
};