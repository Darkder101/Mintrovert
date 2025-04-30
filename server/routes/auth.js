// server/routes/auth.js
const express = require('express');
const router = express.Router();

// Temporary storage for demo purposes
const otpStore = {};
const users = [
  { username: 'user1', password: 'password1' },
  { username: 'user2', password: 'password2' }
];

// Generate a random 4-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Route to send OTP
router.post('/send-otp', (req, res) => {
  const { phoneNumber } = req.body;
  
  // Validate phone number
  if (!phoneNumber || !/^\+91\d{10}$/.test(phoneNumber)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid phone number'
    });
  }
  
  // Generate OTP
  const otp = generateOTP();
  
  // Store OTP (in memory for now)
  otpStore[phoneNumber] = otp;
  
  // Log OTP for development purposes
  console.log(`OTP for ${phoneNumber}: ${otp}`);
  
  // In production, integrate with SMS gateway like Fast2SMS here
  // For now, just return success
  return res.json({
    success: true,
    message: 'OTP sent successfully'
  });
});

// Route to verify OTP
router.post('/verify-otp', (req, res) => {
  const { phoneNumber, otp } = req.body;
  
  // Validate inputs
  if (!phoneNumber || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Phone number and OTP are required'
    });
  }
  
  // Check if OTP matches
  if (otpStore[phoneNumber] === otp) {
    // Clear OTP after successful verification
    delete otpStore[phoneNumber];
    
    return res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP'
    });
  }
});

// Route for user login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Validate inputs
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }
  
  // Check if credentials match
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // Send OTP for 2-factor authentication
    const phoneNumber = '+911234567890'; // In real app, get from user profile
    const otp = generateOTP();
    otpStore[phoneNumber] = otp;
    
    console.log(`OTP for ${phoneNumber}: ${otp}`);
    
    return res.json({
      success: true,
      message: 'Login successful, OTP sent for verification',
      phoneNumber
    });
  } else {
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }
});

module.exports = router;