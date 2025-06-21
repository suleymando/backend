const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamsByLeague
} = require('../controllers/teamController');

// Tüm takımları getir (herkese açık, lig ve arama filtreleri destekler)
router.get('/', getTeams);

// Belirli lig'in takımlarını getir (herkese açık)
router.get('/league/:leagueId', getTeamsByLeague);

// Tek takım getir (herkese açık)
router.get('/:id', getTeam);

// Yeni takım oluştur (sadece admin)
router.post('/', authenticate, requireAdmin, createTeam);

// Takım güncelle (sadece admin)
router.put('/:id', authenticate, requireAdmin, updateTeam);

// Takım sil (sadece admin)
router.delete('/:id', authenticate, requireAdmin, deleteTeam);

module.exports = router; 