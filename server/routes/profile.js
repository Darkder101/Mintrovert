// server/routes/profile.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};
// Initialize multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max file size
});
// Fields for file upload
const uploadFields = [
  { name: 'profileImage', maxCount: 1 },
  { name: 'collegeIdImage', maxCount: 1 }
];
// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  // In a real app, you would check for a valid token or session
  // For now, we'll just check if a phoneNumber exists in the request
  if (req.body.phoneNumber) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
};
// Profile submission route
router.post('/submit', isAuthenticated, upload.fields(uploadFields), async (req, res) => {
  try {
    const { name, username, password, bio, gender, purpose, phoneNumber } = req.body;
    
    // Validate required fields
    if (!name || !username || !password || !gender || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Get file paths if uploaded
    const profileImagePath = req.files.profileImage ? req.files.profileImage[0].path : null;
    const collegeIdImagePath = req.files.collegeIdImage ? req.files.collegeIdImage[0].path : null;
    
    if (!collegeIdImagePath) {
      return res.status(400).json({
        success: false,
        message: 'College ID image is required'
      });
    }

    // In a real app, you would save this data to a database
    // For this example, we'll just return success with the data received
    
    // Create user profile object
    const userProfile = {
      name,
      username,
      phoneNumber,
      gender,
      purpose,
      bio: bio || '',
      profileImage: profileImagePath ? profileImagePath.replace(/\\/g, '/') : null,
      collegeIdImage: collegeIdImagePath.replace(/\\/g, '/'),
      createdAt: new Date()
    };
    
    // Password should be hashed before storing in a real application
    // userProfile.hashedPassword = await bcrypt.hash(password, 10);
    
    // Here you would normally save userProfile to your database
    // const savedProfile = await UserProfile.create(userProfile);
    
    res.status(201).json({
      success: true,
      message: 'Profile submitted successfully',
      data: userProfile
    });
    
  } catch (error) {
    console.error('Profile submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit profile',
      error: error.message
    });
  }
});

// Get user profile route
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // In a real app, you would fetch the profile from your database
    // const userProfile = await UserProfile.findOne({ username });
    
    // Simulating a database lookup failure
    const userProfile = null;
    
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: userProfile
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: error.message
    });
  }
});

// Update user profile route
router.put('/update', isAuthenticated, upload.fields(uploadFields), async (req, res) => {
  try {
    const { name, username, bio, gender, purpose, phoneNumber } = req.body;
    
    // In a real app, you would fetch the existing profile first
    // const existingProfile = await UserProfile.findOne({ phoneNumber });
    
    // Simulating a database lookup failure
    const existingProfile = null;
    
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }
    
    // Update profile fields
    const updatedProfile = {
      name: name || existingProfile.name,
      username: username || existingProfile.username,
      gender: gender || existingProfile.gender,
      purpose: purpose || existingProfile.purpose,
      bio: bio || existingProfile.bio,
    };
    
    // Update image paths if new images were uploaded
    if (req.files.profileImage) {
      // Delete old image if it exists
      if (existingProfile.profileImage) {
        const oldImagePath = path.join(__dirname, '..', existingProfile.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updatedProfile.profileImage = req.files.profileImage[0].path.replace(/\\/g, '/');
    }
    
    if (req.files.collegeIdImage) {
      // Delete old image if it exists
      if (existingProfile.collegeIdImage) {
        const oldImagePath = path.join(__dirname, '..', existingProfile.collegeIdImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updatedProfile.collegeIdImage = req.files.collegeIdImage[0].path.replace(/\\/g, '/');
    }
    
    // In a real app, you would update the profile in your database
    // const savedProfile = await UserProfile.findOneAndUpdate(
    //   { phoneNumber },
    //   updatedProfile,
    //   { new: true }
    // );
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Delete user profile route
router.delete('/delete', isAuthenticated, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // In a real app, you would fetch the profile before deleting
    // const existingProfile = await UserProfile.findOne({ phoneNumber });
    
    // Simulating a database lookup
    const existingProfile = {
      profileImage: 'uploads/profileImage-123456789.jpg',
      collegeIdImage: 'uploads/collegeIdImage-987654321.jpg'
    };
    
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }
    
    // Delete associated images
    if (existingProfile.profileImage) {
      const profileImagePath = path.join(__dirname, '..', existingProfile.profileImage);
      if (fs.existsSync(profileImagePath)) {
        fs.unlinkSync(profileImagePath);
      }
    }
    
    if (existingProfile.collegeIdImage) {
      const collegeIdImagePath = path.join(__dirname, '..', existingProfile.collegeIdImage);
      if (fs.existsSync(collegeIdImagePath)) {
        fs.unlinkSync(collegeIdImagePath);
      }
    }
    
    // In a real app, you would delete the profile from your database
    // await UserProfile.findOneAndDelete({ phoneNumber });
    
    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully'
    });
    
  } catch (error) {
    console.error('Profile deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile',
      error: error.message
    });
  }
});

module.exports = router;