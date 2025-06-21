const { prisma } = require('../config/database');

// Get all predictions with role-based filtering
const getAllPredictions = async (req, res) => {
  try {
    const { page = 1, limit = 10, league, isPremium, resultStatus } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const where = { isActive: true };
    
    if (league) {
      where.leagueId = parseInt(league);
    }
    
    if (isPremium !== undefined) {
      where.isPremium = isPremium === 'true';
    }
    
    if (resultStatus) {
      where.resultStatus = resultStatus;
    }

    // If user is not premium/admin, hide premium predictions
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'PREMIUM') {
      where.isPremium = false;
    }

    // Get predictions with pagination
    const [predictions, totalCount] = await Promise.all([
      prisma.prediction.findMany({
        where,
        include: {
          admin: {
            select: {
              id: true,
              adminUsername: true,
              email: true
            }
          },
          homeTeam: {
            select: {
              id: true,
              name: true
            }
          },
          awayTeam: {
            select: {
              id: true,
              name: true
            }
          },
          league: {
            select: {
              id: true,
              name: true,
              country: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(offset),
        take: parseInt(limit)
      }),
      prisma.prediction.count({ where })
    ]);

    res.json({
      success: true,
      data: predictions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: offset + predictions.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get predictions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Tahminler alınırken hata oluştu' 
    });
  }
};

// Get single prediction
const getPredictionById = async (req, res) => {
  try {
    const { id } = req.params;

    const prediction = await prisma.prediction.findFirst({
      where: { 
        id: parseInt(id),
        isActive: true
      },
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true,
            email: true
          }
        },
        homeTeam: {
          select: {
            id: true,
            name: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true
          }
        },
        league: {
          select: {
            id: true,
            name: true,
            country: true
          }
        }
      }
    });

    if (!prediction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tahmin bulunamadı' 
      });
    }

    // Check premium access
    if (prediction.isPremium && req.user && req.user.role !== 'ADMIN' && req.user.role !== 'PREMIUM') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu tahmin premium üyeler içindir' 
      });
    }

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Get prediction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Tahmin alınırken hata oluştu' 
    });
  }
};

// Create new prediction (Admin only)
const createPrediction = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    const {
      homeTeamId,
      awayTeamId,
      leagueId,
      matchDate,
      predictionType,
      predictionText,
      odds,
      confidence,
      analysis,
      isPremium = false
    } = req.body;

    // Validation
    if (!homeTeamId || !awayTeamId || !leagueId || !matchDate || !predictionType || !odds || confidence === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gerekli alanlar eksik' 
      });
    }

    if (confidence < 0 || confidence > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Güven seviyesi 0-100 arasında olmalı' 
      });
    }

    if (odds <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Oran 0\'dan büyük olmalı' 
      });
    }

    // Check if teams exist and are different
    if (homeTeamId === awayTeamId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ev sahibi ve deplasman takımı farklı olmalı' 
      });
    }

    // Verify teams and league exist
    const [homeTeam, awayTeam, league] = await Promise.all([
      prisma.team.findUnique({ where: { id: parseInt(homeTeamId) } }),
      prisma.team.findUnique({ where: { id: parseInt(awayTeamId) } }),
      prisma.league.findUnique({ where: { id: parseInt(leagueId) } })
    ]);

    if (!homeTeam || !awayTeam || !league) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz takım veya lig seçimi' 
      });
    }

    // Create prediction
    const prediction = await prisma.prediction.create({
      data: {
        adminId: req.user.id,
        homeTeamId: parseInt(homeTeamId),
        awayTeamId: parseInt(awayTeamId),
        leagueId: parseInt(leagueId),
        matchDate: new Date(matchDate),
        predictionType,
        predictionText,
        odds: parseFloat(odds),
        confidence: parseInt(confidence),
        analysis,
        isPremium: Boolean(isPremium)
      },
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true,
            email: true
          }
        },
        homeTeam: {
          select: {
            id: true,
            name: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true
          }
        },
        league: {
          select: {
            id: true,
            name: true,
            country: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Tahmin başarıyla oluşturuldu',
      data: prediction
    });
  } catch (error) {
    console.error('Create prediction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Tahmin oluşturulurken hata oluştu' 
    });
  }
};

// Update prediction (Admin only)
const updatePrediction = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    const { id } = req.params;
    const {
      homeTeamId,
      awayTeamId,
      leagueId,
      matchDate,
      predictionType,
      predictionText,
      odds,
      confidence,
      analysis,
      isPremium
    } = req.body;

    // Check if prediction exists and belongs to admin
    const existingPrediction = await prisma.prediction.findFirst({
      where: { 
        id: parseInt(id),
        adminId: req.user.id,
        isActive: true
      }
    });

    if (!existingPrediction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tahmin bulunamadı veya yetkiniz yok' 
      });
    }

    // Validation
    if (confidence !== undefined && (confidence < 0 || confidence > 100)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Güven seviyesi 0-100 arasında olmalı' 
      });
    }

    if (odds !== undefined && odds <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Oran 0\'dan büyük olmalı' 
      });
    }

    // Build update data
    const updateData = {};
    if (homeTeamId) updateData.homeTeamId = parseInt(homeTeamId);
    if (awayTeamId) updateData.awayTeamId = parseInt(awayTeamId);
    if (leagueId) updateData.leagueId = parseInt(leagueId);
    if (matchDate) updateData.matchDate = new Date(matchDate);
    if (predictionType) updateData.predictionType = predictionType;
    if (predictionText !== undefined) updateData.predictionText = predictionText;
    if (odds) updateData.odds = parseFloat(odds);
    if (confidence !== undefined) updateData.confidence = parseInt(confidence);
    if (analysis !== undefined) updateData.analysis = analysis;
    if (isPremium !== undefined) updateData.isPremium = Boolean(isPremium);

    // Update prediction
    const updatedPrediction = await prisma.prediction.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true,
            email: true
          }
        },
        homeTeam: {
          select: {
            id: true,
            name: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true
          }
        },
        league: {
          select: {
            id: true,
            name: true,
            country: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Tahmin başarıyla güncellendi',
      data: updatedPrediction
    });
  } catch (error) {
    console.error('Update prediction error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Tahmin bulunamadı' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Tahmin güncellenirken hata oluştu' 
    });
  }
};

// Update prediction result (Admin only)
const updatePredictionResult = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    const { id } = req.params;
    const { resultStatus } = req.body;

    // Validation
    if (!['PENDING', 'WON', 'LOST'].includes(resultStatus)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz sonuç durumu' 
      });
    }

    // Update prediction result
    const updatedPrediction = await prisma.prediction.update({
      where: { id: parseInt(id) },
      data: { resultStatus },
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true,
            email: true
          }
        },
        homeTeam: {
          select: {
            id: true,
            name: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true
          }
        },
        league: {
          select: {
            id: true,
            name: true,
            country: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Tahmin sonucu başarıyla güncellendi',
      data: updatedPrediction
    });
  } catch (error) {
    console.error('Update prediction result error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Tahmin bulunamadı' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Tahmin sonucu güncellenirken hata oluştu' 
    });
  }
};

// Delete prediction (Admin only)
const deletePrediction = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    const { id } = req.params;

    // Check if prediction exists and belongs to admin
    const existingPrediction = await prisma.prediction.findFirst({
      where: { 
        id: parseInt(id),
        adminId: req.user.id,
        isActive: true
      }
    });

    if (!existingPrediction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tahmin bulunamadı veya yetkiniz yok' 
      });
    }

    // Soft delete (set isActive to false)
    await prisma.prediction.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Tahmin başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete prediction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Tahmin silinirken hata oluştu' 
    });
  }
};

// Get predictions history with advanced filtering
const getPredictionsHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      league, 
      isPremium, 
      resultStatus,
      adminId,
      startDate,
      endDate,
      search
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build where clause
    const where = { isActive: true };
    
    if (league) {
      where.leagueId = parseInt(league);
    }
    
    if (isPremium !== undefined) {
      where.isPremium = isPremium === 'true';
    }
    
    if (resultStatus && resultStatus !== 'ALL') {
      where.resultStatus = resultStatus;
    }
    
    if (adminId) {
      where.adminId = parseInt(adminId);
    }
    
    // Date range filtering
    if (startDate || endDate) {
      where.matchDate = {};
      if (startDate) {
        where.matchDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.matchDate.lte = new Date(endDate);
      }
    }
    
    // Search in team names or prediction text
    if (search) {
      where.OR = [
        {
          predictionText: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          homeTeam: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          awayTeam: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ];
    }

    // If user is not premium/admin, hide premium predictions
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'PREMIUM') {
      where.isPremium = false;
    }

    // Get predictions with pagination
    const [predictions, totalCount] = await Promise.all([
      prisma.prediction.findMany({
        where,
        include: {
          admin: {
            select: {
              id: true,
              adminUsername: true,
              email: true
            }
          },
          homeTeam: {
            select: {
              id: true,
              name: true
            }
          },
          awayTeam: {
            select: {
              id: true,
              name: true
            }
          },
          league: {
            select: {
              id: true,
              name: true,
              country: true
            }
          }
        },
        orderBy: { matchDate: 'desc' },
        skip: parseInt(offset),
        take: parseInt(limit)
      }),
      prisma.prediction.count({ where })
    ]);

    // Calculate statistics for this filtered set
    const stats = await prisma.prediction.aggregate({
      where,
      _count: {
        id: true
      }
    });

    // Get win/loss stats
    const winStats = await prisma.prediction.groupBy({
      by: ['resultStatus'],
      where,
      _count: {
        id: true
      }
    });

    const statsMap = winStats.reduce((acc, stat) => {
      acc[stat.resultStatus] = stat._count.id;
      return acc;
    }, {});

    const totalPredictions = stats._count.id;
    const wonPredictions = statsMap.WON || 0;
    const lostPredictions = statsMap.LOST || 0;
    const pendingPredictions = statsMap.PENDING || 0;
    
    const successRate = totalPredictions > 0 ? ((wonPredictions / (wonPredictions + lostPredictions)) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: predictions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: offset + predictions.length < totalCount,
        hasPrev: page > 1
      },
      statistics: {
        total: totalPredictions,
        won: wonPredictions,
        lost: lostPredictions,
        pending: pendingPredictions,
        successRate: parseFloat(successRate)
      }
    });
  } catch (error) {
    console.error('Get predictions history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Tahmin geçmişi alınırken hata oluştu' 
    });
  }
};

// Like/Dislike a prediction
const likePrediction = async (req, res) => {
  try {
    const { id } = req.params;
    const { likeType } = req.body; // 'LIKE' or 'DISLIKE'
    const userId = req.user.id;

    // Validate likeType
    if (!['LIKE', 'DISLIKE'].includes(likeType)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz beğeni türü'
      });
    }

    // Check if prediction exists
    const prediction = await prisma.prediction.findUnique({
      where: { 
        id: parseInt(id),
        isActive: true
      }
    });

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Tahmin bulunamadı'
      });
    }

    // Check if user already liked/disliked this prediction
    const existingLike = await prisma.predictionLike.findUnique({
      where: {
        userId_predictionId: {
          userId: userId,
          predictionId: parseInt(id)
        }
      }
    });

    if (existingLike) {
      if (existingLike.likeType === likeType) {
        // Same action - remove like/dislike
        await prisma.predictionLike.delete({
          where: { id: existingLike.id }
        });

        return res.json({
          success: true,
          message: 'Beğeni kaldırıldı',
          action: 'removed',
          likeType: null
        });
      } else {
        // Different action - update like/dislike
        await prisma.predictionLike.update({
          where: { id: existingLike.id },
          data: { likeType: likeType }
        });

        return res.json({
          success: true,
          message: likeType === 'LIKE' ? 'Beğenildi' : 'Beğenilmedi',
          action: 'updated',
          likeType: likeType
        });
      }
    } else {
      // New like/dislike
      await prisma.predictionLike.create({
        data: {
          userId: userId,
          predictionId: parseInt(id),
          likeType: likeType
        }
      });

      return res.json({
        success: true,
        message: likeType === 'LIKE' ? 'Beğenildi' : 'Beğenilmedi',
        action: 'created',
        likeType: likeType
      });
    }

  } catch (error) {
    console.error('Error liking prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Beğeni işlemi sırasında hata oluştu'
    });
  }
};

// Get prediction like stats
const getPredictionLikeStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Get like counts
    const likeCount = await prisma.predictionLike.count({
      where: {
        predictionId: parseInt(id),
        likeType: 'LIKE'
      }
    });

    const dislikeCount = await prisma.predictionLike.count({
      where: {
        predictionId: parseInt(id),
        likeType: 'DISLIKE'
      }
    });

    // Get user's current like status
    let userLikeStatus = null;
    if (userId) {
      const userLike = await prisma.predictionLike.findUnique({
        where: {
          userId_predictionId: {
            userId: userId,
            predictionId: parseInt(id)
          }
        }
      });
      userLikeStatus = userLike?.likeType || null;
    }

    res.json({
      success: true,
      data: {
        predictionId: parseInt(id),
        likeCount,
        dislikeCount,
        totalCount: likeCount + dislikeCount,
        userLikeStatus
      }
    });

  } catch (error) {
    console.error('Error getting prediction like stats:', error);
    res.status(500).json({
      success: false,
      message: 'Beğeni istatistikleri alınırken hata oluştu'
    });
  }
};

module.exports = {
  getAllPredictions,
  getPredictionById,
  createPrediction,
  updatePrediction,
  updatePredictionResult,
  deletePrediction,
  getPredictionsHistory,
  likePrediction,
  getPredictionLikeStats
}; 