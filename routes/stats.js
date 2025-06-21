const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getAdminStats,
  getGeneralStats,
  getWeeklyPerformance,
  getAllAdmins
} = require('../controllers/statsController');

// Public routes (no auth required)
// None for stats - all require authentication

// User routes (authenticated)
router.get('/my-stats', authenticate, getAdminStats); // Get own admin stats

// Admin routes
router.get('/general', authenticate, getGeneralStats);
router.get('/admin/:adminId', authenticate, requireAdmin, getAdminStats);
router.get('/weekly', authenticate, requireAdmin, getWeeklyPerformance);
router.get('/admins', authenticate, requireAdmin, getAllAdmins);

module.exports = router; 