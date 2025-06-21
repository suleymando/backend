const { PrismaClient } = require('../generated/prisma');
const premiumService = require('../services/premiumService');
const prisma = new PrismaClient();

// Get admin statistics
const getAdminStats = async (req, res) => {
  try {
    const { adminId } = req.params;
    const targetAdminId = adminId ? parseInt(adminId) : req.user.id;

    // Verify admin exists
    const admin = await prisma.user.findUnique({
      where: { 
        id: targetAdminId,
        role: 'ADMIN'
      }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin bulunamadı'
      });
    }

    // Get prediction statistics
    const totalPredictions = await prisma.prediction.count({
      where: { 
        adminId: targetAdminId,
        isActive: true
      }
    });

    const wonPredictions = await prisma.prediction.count({
      where: { 
        adminId: targetAdminId,
        resultStatus: 'WON',
        isActive: true
      }
    });

    const lostPredictions = await prisma.prediction.count({
      where: { 
        adminId: targetAdminId,
        resultStatus: 'LOST',
        isActive: true
      }
    });

    const pendingPredictions = await prisma.prediction.count({
      where: { 
        adminId: targetAdminId,
        resultStatus: 'PENDING',
        isActive: true
      }
    });

    const premiumPredictions = await prisma.prediction.count({
      where: { 
        adminId: targetAdminId,
        isPremium: true,
        isActive: true
      }
    });

    // Get coupon statistics
    const totalCoupons = await prisma.coupon.count({
      where: { 
        adminId: targetAdminId,
        isActive: true
      }
    });

    const wonCoupons = await prisma.coupon.count({
      where: { 
        adminId: targetAdminId,
        resultStatus: 'WON',
        isActive: true
      }
    });

    const lostCoupons = await prisma.coupon.count({
      where: { 
        adminId: targetAdminId,
        resultStatus: 'LOST',
        isActive: true
      }
    });

    const pendingCoupons = await prisma.coupon.count({
      where: { 
        adminId: targetAdminId,
        resultStatus: 'PENDING',
        isActive: true
      }
    });

    const premiumCoupons = await prisma.coupon.count({
      where: { 
        adminId: targetAdminId,
        isPremium: true,
        isActive: true
      }
    });

    // Calculate success rates
    const completedPredictions = wonPredictions + lostPredictions;
    const predictionSuccessRate = completedPredictions > 0 ? (wonPredictions / completedPredictions * 100) : 0;

    const completedCoupons = wonCoupons + lostCoupons;
    const couponSuccessRate = completedCoupons > 0 ? (wonCoupons / completedCoupons * 100) : 0;

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPredictions = await prisma.prediction.count({
      where: { 
        adminId: targetAdminId,
        createdAt: { gte: thirtyDaysAgo },
        isActive: true
      }
    });

    const recentCoupons = await prisma.coupon.count({
      where: { 
        adminId: targetAdminId,
        createdAt: { gte: thirtyDaysAgo },
        isActive: true
      }
    });

    // Get average confidence
    const avgConfidence = await prisma.prediction.aggregate({
      where: { 
        adminId: targetAdminId,
        isActive: true
      },
      _avg: { confidence: true }
    });

    // Get average odds
    const avgOdds = await prisma.prediction.aggregate({
      where: { 
        adminId: targetAdminId,
        isActive: true
      },
      _avg: { odds: true }
    });

    const avgCouponOdds = await prisma.coupon.aggregate({
      where: { 
        adminId: targetAdminId,
        isActive: true
      },
      _avg: { totalOdds: true }
    });

    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          adminUsername: admin.adminUsername
        },
        predictions: {
          total: totalPredictions,
          won: wonPredictions,
          lost: lostPredictions,
          pending: pendingPredictions,
          premium: premiumPredictions,
          successRate: Math.round(predictionSuccessRate * 100) / 100,
          avgConfidence: Math.round((avgConfidence._avg.confidence || 0) * 100) / 100,
          avgOdds: Math.round((avgOdds._avg.odds || 0) * 100) / 100,
          recent30Days: recentPredictions
        },
        coupons: {
          total: totalCoupons,
          won: wonCoupons,
          lost: lostCoupons,
          pending: pendingCoupons,
          premium: premiumCoupons,
          successRate: Math.round(couponSuccessRate * 100) / 100,
          avgOdds: Math.round((avgCouponOdds._avg.totalOdds || 0) * 100) / 100,
          recent30Days: recentCoupons
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Admin istatistikleri yüklenirken hata oluştu'
    });
  }
};

// Get general site statistics
const getGeneralStats = async (req, res) => {
  try {
    // Get premium stats from service
    const premiumStats = await premiumService.getPremiumStats();

    // Get prediction statistics
    const totalPredictions = await prisma.prediction.count({
      where: { isActive: true }
    });

    const wonPredictions = await prisma.prediction.count({
      where: { 
        resultStatus: 'WON',
        isActive: true
      }
    });

    const lostPredictions = await prisma.prediction.count({
      where: { 
        resultStatus: 'LOST',
        isActive: true
      }
    });

    const premiumPredictions = await prisma.prediction.count({
      where: { 
        isPremium: true,
        isActive: true
      }
    });

    // Get coupon statistics
    const totalCoupons = await prisma.coupon.count({
      where: { isActive: true }
    });

    const wonCoupons = await prisma.coupon.count({
      where: { 
        resultStatus: 'WON',
        isActive: true
      }
    });

    const lostCoupons = await prisma.coupon.count({
      where: { 
        resultStatus: 'LOST',
        isActive: true
      }
    });

    const premiumCoupons = await prisma.coupon.count({
      where: { 
        isPremium: true,
        isActive: true
      }
    });

    // User statistics
    const totalUsers = await prisma.user.count({
      where: { isActive: true }
    });

    const adminUsers = await prisma.user.count({
      where: { 
        role: 'ADMIN',
        isActive: true
      }
    });

    const normalUsers = await prisma.user.count({
      where: { 
        role: 'NORMAL',
        isActive: true
      }
    });

    // League and team statistics
    const totalLeagues = await prisma.league.count({
      where: { isActive: true }
    });

    const totalTeams = await prisma.team.count({
      where: { isActive: true }
    });

    // Calculate success rates
    const completedPredictions = wonPredictions + lostPredictions;
    const overallPredictionSuccessRate = completedPredictions > 0 ? (wonPredictions / completedPredictions * 100) : 0;

    const completedCoupons = wonCoupons + lostCoupons;
    const overallCouponSuccessRate = completedCoupons > 0 ? (wonCoupons / completedCoupons * 100) : 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPredictions = await prisma.prediction.count({
      where: { 
        createdAt: { gte: sevenDaysAgo },
        isActive: true
      }
    });

    const recentCoupons = await prisma.coupon.count({
      where: { 
        createdAt: { gte: sevenDaysAgo },
        isActive: true
      }
    });

    const recentUsers = await prisma.user.count({
      where: { 
        createdAt: { gte: sevenDaysAgo },
        isActive: true
      }
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          admin: adminUsers,
          normal: normalUsers,
          activePremium: premiumStats.activePremiumUsers,
          expiredPremium: premiumStats.expiredPremiumUsers,
          expiringSoon: premiumStats.expiringSoonUsers,
          recent7Days: recentUsers
        },
        predictions: {
          total: totalPredictions,
          won: wonPredictions,
          lost: lostPredictions,
          pending: totalPredictions - completedPredictions,
          premium: premiumPredictions,
          successRate: Math.round(overallPredictionSuccessRate * 100) / 100,
          recent7Days: recentPredictions
        },
        coupons: {
          total: totalCoupons,
          won: wonCoupons,
          lost: lostCoupons,
          pending: totalCoupons - completedCoupons,
          premium: premiumCoupons,
          successRate: Math.round(overallCouponSuccessRate * 100) / 100,
          recent7Days: recentCoupons
        },
        payments: {
          total: premiumStats.totalPayments,
          approved: premiumStats.approvedPayments,
          pending: premiumStats.pendingPayments,
          rejected: premiumStats.totalPayments - premiumStats.approvedPayments - premiumStats.pendingPayments,
          totalRevenue: premiumStats.totalRevenue
        },
        content: {
          leagues: totalLeagues,
          teams: totalTeams
        }
      }
    });

  } catch (error) {
    console.error('Error fetching general stats:', error);
    res.status(500).json({
      success: false,
      message: 'Genel istatistikler yüklenirken hata oluştu'
    });
  }
};

// Get weekly performance stats
const getWeeklyPerformance = async (req, res) => {
  try {
    const { adminId } = req.query;
    const targetAdminId = adminId ? parseInt(adminId) : null;

    // Get last 7 days data
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const whereClause = {
        createdAt: {
          gte: date,
          lt: nextDate
        },
        isActive: true
      };

      if (targetAdminId) {
        whereClause.adminId = targetAdminId;
      }

      const predictions = await prisma.prediction.count({ where: whereClause });
      
      const coupons = await prisma.coupon.count({ 
        where: {
          ...whereClause,
          adminId: targetAdminId || undefined
        }
      });

      days.push({
        date: date.toISOString().split('T')[0],
        predictions,
        coupons,
        total: predictions + coupons
      });
    }

    res.json({
      success: true,
      data: {
        adminId: targetAdminId,
        weeklyData: days
      }
    });

  } catch (error) {
    console.error('Error fetching weekly performance:', error);
    res.status(500).json({
      success: false,
      message: 'Haftalık performans yüklenirken hata oluştu'
    });
  }
};

// Get all admins list with basic stats
const getAllAdmins = async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { 
        role: 'ADMIN',
        isActive: true
      },
      select: {
        id: true,
        email: true,
        adminUsername: true,
        createdAt: true
      }
    });

    // Get basic stats for each admin
    const adminStats = await Promise.all(
      admins.map(async (admin) => {
        const predictionCount = await prisma.prediction.count({
          where: { 
            adminId: admin.id,
            isActive: true
          }
        });

        const couponCount = await prisma.coupon.count({
          where: { 
            adminId: admin.id,
            isActive: true
          }
        });

        const wonPredictions = await prisma.prediction.count({
          where: { 
            adminId: admin.id,
            resultStatus: 'WON',
            isActive: true
          }
        });

        const lostPredictions = await prisma.prediction.count({
          where: { 
            adminId: admin.id,
            resultStatus: 'LOST',
            isActive: true
          }
        });

        const completedPredictions = wonPredictions + lostPredictions;
        const successRate = completedPredictions > 0 ? (wonPredictions / completedPredictions * 100) : 0;

        return {
          ...admin,
          stats: {
            predictions: predictionCount,
            coupons: couponCount,
            successRate: Math.round(successRate * 100) / 100
          }
        };
      })
    );

    res.json({
      success: true,
      data: adminStats
    });

  } catch (error) {
    console.error('Error fetching admin list:', error);
    res.status(500).json({
      success: false,
      message: 'Admin listesi yüklenirken hata oluştu'
    });
  }
};

module.exports = {
  getAdminStats,
  getGeneralStats,
  getWeeklyPerformance,
  getAllAdmins
}; 