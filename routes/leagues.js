const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getLeagues,
  getLeague,
  createLeague,
  updateLeague,
  deleteLeague
} = require('../controllers/leagueController');

// Tüm ligleri getir (herkese açık)
router.get('/', getLeagues);

// Tek lig getir (herkese açık)
router.get('/:id', getLeague);

// Yeni lig oluştur (sadece admin)
router.post('/', authenticate, requireAdmin, createLeague);

// Lig güncelle (sadece admin)
router.put('/:id', authenticate, requireAdmin, updateLeague);

// Lig sil (sadece admin)
router.delete('/:id', authenticate, requireAdmin, deleteLeague);

module.exports = router; 