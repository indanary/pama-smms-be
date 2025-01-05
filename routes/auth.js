const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');

// Register a new user (optional)
router.post('/register', authController.registerUser);

// Login
router.post('/login', authController.loginUser);

// Refresh Token (Generate a new access token)
router.post('/refresh', authController.refreshAccessToken);

// Logout
router.post('/logout', authController.logoutUser);

module.exports = router;
