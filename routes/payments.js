const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getAllPayments,
  getUserPayments,
  createPaymentRequest,
  uploadReceipt,
  approvePayment,
  rejectPayment,
  getSiteSettings,
  updateSiteSettings
} = require('../controllers/paymentController');

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Sadece resim dosyaları kabul edilir'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Public routes
router.get('/settings', getSiteSettings);

// User routes (authenticated)
router.get('/my-payments', authenticate, getUserPayments);
router.post('/', authenticate, createPaymentRequest);
router.post('/:id/receipt', authenticate, upload.single('receipt'), uploadReceipt);

// Admin routes
router.get('/', authenticate, requireAdmin, getAllPayments);
router.put('/:id/approve', authenticate, requireAdmin, approvePayment);
router.put('/:id/reject', authenticate, requireAdmin, rejectPayment);
router.put('/settings', authenticate, requireAdmin, updateSiteSettings);

module.exports = router; 