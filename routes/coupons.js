const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  updateCouponResult,
  deleteCoupon,
  likeCoupon,
  getCouponLikeStats
} = require('../controllers/couponController');

router.get('/', optionalAuth, getAllCoupons);
router.get('/:id/likes', optionalAuth, getCouponLikeStats);
router.post('/:id/like', authenticate, likeCoupon);
router.get('/:id', optionalAuth, getCouponById);
router.post('/', authenticate, requireAdmin, createCoupon);
router.put('/:id', authenticate, requireAdmin, updateCoupon);
router.put('/:id/result', authenticate, requireAdmin, updateCouponResult);
router.delete('/:id', authenticate, requireAdmin, deleteCoupon);

module.exports = router; 