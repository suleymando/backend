const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  updateAdminUsername,
  getAllUsers,
  updateUserRole,
  updateUserPremium
} = require('../controllers/userController');

// User profile routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/admin-username', authenticate, updateAdminUsername);

// Admin user management routes
router.get('/', authenticate, requireAdmin, getAllUsers);
router.put('/:userId/role', authenticate, requireAdmin, updateUserRole);
router.put('/:userId/premium', authenticate, requireAdmin, updateUserPremium);

module.exports = router; 