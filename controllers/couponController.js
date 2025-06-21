const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Get all coupons with role-based filtering
const getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10, league, isPremium, result } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    let where = {
      isActive: true
    };

    // Filter by premium status
    if (isPremium !== undefined && isPremium !== '') {
      where.isPremium = isPremium === 'true';
    }

    // Filter by result status
    if (result && result !== '') {
      where.resultStatus = result;
    }

    // Premium content filtering based on user role
    if (!req.user || req.user.role === 'NORMAL') {
      // For non-authenticated or normal users, hide premium content details
      // but still show them with locked overlay
    }

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true
          }
        },
        couponPredictions: {
          include: {
            prediction: {
              include: {
                homeTeam: {
                  select: { id: true, name: true }
                },
                awayTeam: {
                  select: { id: true, name: true }
                },
                league: {
                  select: { id: true, name: true, country: true }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: parseInt(offset),
      take: parseInt(limit)
    });

    // Get total count for pagination
    const totalCount = await prisma.coupon.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Filter premium content for non-premium users
    const filteredCoupons = coupons.map(coupon => {
      if (coupon.isPremium && (!req.user || req.user.role === 'NORMAL')) {
        return {
          ...coupon,
          description: null, // Hide description
          couponPredictions: coupon.couponPredictions.map(cp => ({
            ...cp,
            prediction: {
              ...cp.prediction,
              analysis: null // Hide analysis
            }
          }))
        };
      }
      return coupon;
    });

    res.json({
      success: true,
      data: filteredCoupons,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Kuponlar yüklenirken hata oluştu'
    });
  }
};

// Get single coupon by ID
const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.coupon.findFirst({
      where: {
        id: parseInt(id),
        isActive: true
      },
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true
          }
        },
        couponPredictions: {
          include: {
            prediction: {
              include: {
                homeTeam: {
                  select: { id: true, name: true }
                },
                awayTeam: {
                  select: { id: true, name: true }
                },
                league: {
                  select: { id: true, name: true, country: true }
                }
              }
            }
          }
        }
      }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı'
      });
    }

    // Check premium access
    if (coupon.isPremium && (!req.user || req.user.role === 'NORMAL')) {
      return res.status(403).json({
        success: false,
        message: 'Bu kupon premium içerikdir. Premium üyelik gereklidir.',
        isPremiumRequired: true
      });
    }

    res.json({
      success: true,
      data: coupon
    });

  } catch (error) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon yüklenirken hata oluştu'
    });
  }
};

// Create new coupon (Admin only)
const createCoupon = async (req, res) => {
  try {
    const { title, description, predictionIds, isPremium = false } = req.body;
    const adminId = req.user.id;

    // Validation
    if (!title || !predictionIds || !Array.isArray(predictionIds) || predictionIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Kupon başlığı ve en az 2 tahmin gereklidir'
      });
    }

    if (predictionIds.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Bir kuponda en fazla 10 tahmin olabilir'
      });
    }

    // Verify all predictions exist and are active
    const predictions = await prisma.prediction.findMany({
      where: {
        id: { in: predictionIds.map(id => parseInt(id)) },
        isActive: true
      }
    });

    if (predictions.length !== predictionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz tahmin ID\'leri bulundu'
      });
    }

    // Calculate total odds
    const totalOdds = predictions.reduce((total, prediction) => {
      return total * prediction.odds;
    }, 1);

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        adminId,
        title,
        description,
        totalOdds: Math.round(totalOdds * 100) / 100, // Round to 2 decimal places
        isPremium,
        couponPredictions: {
          create: predictionIds.map(predictionId => ({
            predictionId: parseInt(predictionId)
          }))
        }
      },
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true
          }
        },
        couponPredictions: {
          include: {
            prediction: {
              include: {
                homeTeam: {
                  select: { id: true, name: true }
                },
                awayTeam: {
                  select: { id: true, name: true }
                },
                league: {
                  select: { id: true, name: true, country: true }
                }
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Kupon başarıyla oluşturuldu',
      data: coupon
    });

  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon oluşturulurken hata oluştu'
    });
  }
};

// Update coupon (Admin only)
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, predictionIds, isPremium } = req.body;
    const adminId = req.user.id;

    // Check if coupon exists and belongs to admin
    const existingCoupon = await prisma.coupon.findFirst({
      where: {
        id: parseInt(id),
        adminId,
        isActive: true
      }
    });

    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı veya güncelleme yetkiniz yok'
      });
    }

    // Validation
    if (predictionIds && (!Array.isArray(predictionIds) || predictionIds.length < 2)) {
      return res.status(400).json({
        success: false,
        message: 'En az 2 tahmin gereklidir'
      });
    }

    let updateData = {};
    
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (isPremium !== undefined) updateData.isPremium = isPremium;

    // If predictions are being updated, recalculate total odds
    if (predictionIds) {
      // Verify all predictions exist
      const predictions = await prisma.prediction.findMany({
        where: {
          id: { in: predictionIds.map(id => parseInt(id)) },
          isActive: true
        }
      });

      if (predictions.length !== predictionIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Geçersiz tahmin ID\'leri bulundu'
        });
      }

      // Calculate new total odds
      const totalOdds = predictions.reduce((total, prediction) => {
        return total * prediction.odds;
      }, 1);

      updateData.totalOdds = Math.round(totalOdds * 100) / 100;

      // Delete existing coupon predictions
      await prisma.couponPrediction.deleteMany({
        where: { couponId: parseInt(id) }
      });

      // Create new coupon predictions
      await prisma.couponPrediction.createMany({
        data: predictionIds.map(predictionId => ({
          couponId: parseInt(id),
          predictionId: parseInt(predictionId)
        }))
      });
    }

    // Update coupon
    const updatedCoupon = await prisma.coupon.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true
          }
        },
        couponPredictions: {
          include: {
            prediction: {
              include: {
                homeTeam: {
                  select: { id: true, name: true }
                },
                awayTeam: {
                  select: { id: true, name: true }
                },
                league: {
                  select: { id: true, name: true, country: true }
                }
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Kupon başarıyla güncellendi',
      data: updatedCoupon
    });

  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon güncellenirken hata oluştu'
    });
  }
};

// Update coupon result (Admin only)
const updateCouponResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body;

    // Validation
    if (!['WON', 'LOST', 'PENDING'].includes(result)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz sonuç durumu'
      });
    }

    // Check if coupon exists
    const coupon = await prisma.coupon.findFirst({
      where: {
        id: parseInt(id),
        isActive: true
      }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı'
      });
    }

    // Update result
    const updatedCoupon = await prisma.coupon.update({
      where: { id: parseInt(id) },
      data: { 
        resultStatus: result,
        updatedAt: new Date()
      },
      include: {
        admin: {
          select: {
            id: true,
            adminUsername: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Kupon sonucu güncellendi',
      data: updatedCoupon
    });

  } catch (error) {
    console.error('Error updating coupon result:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon sonucu güncellenirken hata oluştu'
    });
  }
};

// Delete coupon (Admin only - soft delete)
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Check if coupon exists and belongs to admin
    const coupon = await prisma.coupon.findFirst({
      where: {
        id: parseInt(id),
        adminId,
        isActive: true
      }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı veya silme yetkiniz yok'
      });
    }

    // Soft delete
    await prisma.coupon.update({
      where: { id: parseInt(id) },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Kupon başarıyla silindi'
    });

  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon silinirken hata oluştu'
    });
  }
};

// Like/Dislike a coupon
const likeCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { likeType } = req.body; // 'LIKE' or 'DISLIKE'
    const userId = req.user.id;

    // Validate likeType
    if (!['LIKE', 'DISLIKE'].includes(likeType)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz beğeni türü'
      });
    }

    // Check if coupon exists
    const coupon = await prisma.coupon.findUnique({
      where: { 
        id: parseInt(couponId),
        isActive: true
      }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı'
      });
    }

    // Check if user already liked/disliked this coupon
    const existingLike = await prisma.couponLike.findUnique({
      where: {
        userId_couponId: {
          userId: userId,
          couponId: parseInt(couponId)
        }
      }
    });

    if (existingLike) {
      if (existingLike.likeType === likeType) {
        // Same action - remove like/dislike
        await prisma.couponLike.delete({
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
        await prisma.couponLike.update({
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
      await prisma.couponLike.create({
        data: {
          userId: userId,
          couponId: parseInt(couponId),
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
    console.error('Error liking coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Beğeni işlemi sırasında hata oluştu'
    });
  }
};

// Get coupon like stats
const getCouponLikeStats = async (req, res) => {
  try {
    const { couponId } = req.params;
    const userId = req.user?.id;

    // Get like counts
    const likeCount = await prisma.couponLike.count({
      where: {
        couponId: parseInt(couponId),
        likeType: 'LIKE'
      }
    });

    const dislikeCount = await prisma.couponLike.count({
      where: {
        couponId: parseInt(couponId),
        likeType: 'DISLIKE'
      }
    });

    // Get user's current like status
    let userLikeStatus = null;
    if (userId) {
      const userLike = await prisma.couponLike.findUnique({
        where: {
          userId_couponId: {
            userId: userId,
            couponId: parseInt(couponId)
          }
        }
      });
      userLikeStatus = userLike?.likeType || null;
    }

    res.json({
      success: true,
      data: {
        couponId: parseInt(couponId),
        likeCount,
        dislikeCount,
        totalCount: likeCount + dislikeCount,
        userLikeStatus
      }
    });

  } catch (error) {
    console.error('Error getting coupon like stats:', error);
    res.status(500).json({
      success: false,
      message: 'Beğeni istatistikleri alınırken hata oluştu'
    });
  }
};

module.exports = {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  updateCouponResult,
  deleteCoupon,
  likeCoupon,
  getCouponLikeStats
}; 