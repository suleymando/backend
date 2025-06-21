const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Check and update expired premium users
const checkExpiredPremiumUsers = async () => {
  try {
    console.log('🔍 Premium süre kontrolü başlatılıyor...');
    
    const now = new Date();
    
    // Find users whose premium has expired
    const expiredUsers = await prisma.user.findMany({
      where: {
        role: 'PREMIUM',
        premiumUntil: {
          lt: now
        }
      }
    });

    if (expiredUsers.length === 0) {
      console.log('✅ Süresi dolan premium üye yok');
      return { expiredCount: 0, updatedUsers: [] };
    }

    console.log(`⚠️  ${expiredUsers.length} premium üyenin süresi dolmuş`);

    // Update expired users to NORMAL role
    const updatedUsers = [];
    for (const user of expiredUsers) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'NORMAL',
          updatedAt: new Date()
        }
      });
      
      updatedUsers.push(updatedUser);
      console.log(`📉 ${user.email} -> NORMAL role'e düşürüldü`);
    }

    console.log(`✅ ${updatedUsers.length} kullanıcı güncellendi`);
    
    return {
      expiredCount: expiredUsers.length,
      updatedUsers
    };

  } catch (error) {
    console.error('❌ Premium süre kontrolü hatası:', error);
    throw error;
  }
};

// Get users whose premium will expire soon
const getUsersExpiringSoon = async (daysAhead = 7) => {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    const expiringUsers = await prisma.user.findMany({
      where: {
        role: 'PREMIUM',
        premiumUntil: {
          gte: now,
          lte: futureDate
        }
      },
      select: {
        id: true,
        email: true,
        premiumUntil: true,
        adminUsername: true
      }
    });

    return expiringUsers;

  } catch (error) {
    console.error('❌ Süresi yaklaşan kullanıcılar getirilemedi:', error);
    throw error;
  }
};

// Get premium statistics
const getPremiumStats = async () => {
  try {
    const now = new Date();

    // Active premium users
    const activePremiumCount = await prisma.user.count({
      where: {
        role: 'PREMIUM',
        premiumUntil: {
          gt: now
        }
      }
    });

    // Expired premium users (still have PREMIUM role but expired date)
    const expiredPremiumCount = await prisma.user.count({
      where: {
        role: 'PREMIUM',
        premiumUntil: {
          lt: now
        }
      }
    });

    // Users expiring in next 7 days
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + 7);
    
    const expiringSoonCount = await prisma.user.count({
      where: {
        role: 'PREMIUM',
        premiumUntil: {
          gte: now,
          lte: futureDate
        }
      }
    });

    // Total payments
    const totalPayments = await prisma.payment.count();
    const approvedPayments = await prisma.payment.count({
      where: { status: 'APPROVED' }
    });
    const pendingPayments = await prisma.payment.count({
      where: { status: 'PENDING' }
    });

    // Revenue calculation (approved payments only)
    const totalRevenue = await prisma.payment.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true }
    });

    return {
      activePremiumUsers: activePremiumCount,
      expiredPremiumUsers: expiredPremiumCount,
      expiringSoonUsers: expiringSoonCount,
      totalPayments,
      approvedPayments,
      pendingPayments,
      totalRevenue: totalRevenue._sum.amount || 0
    };

  } catch (error) {
    console.error('❌ Premium istatistikleri getirilemedi:', error);
    throw error;
  }
};

// Extend premium for a user (admin function)
const extendPremium = async (userId, days) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    const now = new Date();
    const currentPremiumEnd = user.premiumUntil && user.premiumUntil > now 
      ? user.premiumUntil 
      : now;
    
    const newPremiumEnd = new Date(currentPremiumEnd);
    newPremiumEnd.setDate(newPremiumEnd.getDate() + days);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: 'PREMIUM',
        premiumUntil: newPremiumEnd,
        updatedAt: new Date()
      }
    });

    console.log(`✅ ${user.email} kullanıcısına ${days} gün premium eklendi`);
    
    return updatedUser;

  } catch (error) {
    console.error('❌ Premium uzatma hatası:', error);
    throw error;
  }
};

// Revoke premium from user (admin function)
const revokePremium = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: 'NORMAL',
        premiumUntil: null,
        updatedAt: new Date()
      }
    });

    console.log(`❌ ${user.email} kullanıcısının premium üyeliği iptal edildi`);
    
    return updatedUser;

  } catch (error) {
    console.error('❌ Premium iptal etme hatası:', error);
    throw error;
  }
};

module.exports = {
  checkExpiredPremiumUsers,
  getUsersExpiringSoon,
  getPremiumStats,
  extendPremium,
  revokePremium
}; 