const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const {
  getAllPredictions,
  getPredictionById,
  createPrediction,
  updatePrediction,
  updatePredictionResult,
  deletePrediction,
  getPredictionsHistory,
  likePrediction,
  getPredictionLikeStats
} = require('../controllers/predictionController');

router.get('/', optionalAuth, getAllPredictions);
router.get('/history', optionalAuth, getPredictionsHistory);
router.get('/:id/likes', optionalAuth, getPredictionLikeStats);
router.post('/:id/like', authenticate, likePrediction);
router.get('/:id', optionalAuth, getPredictionById);
router.post('/', authenticate, requireAdmin, createPrediction);
router.put('/:id', authenticate, requireAdmin, updatePrediction);
router.put('/:id/result', authenticate, requireAdmin, updatePredictionResult);
router.delete('/:id', authenticate, requireAdmin, deletePrediction);

module.exports = router;
