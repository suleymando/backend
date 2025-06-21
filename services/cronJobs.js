const cron = require('node-cron');
const premiumService = require('./premiumService');

// Initialize all cron jobs
const initializeCronJobs = () => {
  console.log('⏰ Cron joblar başlatılıyor...');

  // Check expired premium users every day at 00:00
  cron.schedule('0 0 * * *', async () => {
    console.log('🌅 Günlük premium kontrol başlatılıyor...');
    try {
      const result = await premiumService.checkExpiredPremiumUsers();
      console.log(`✅ Günlük kontrol tamamlandı: ${result.expiredCount} kullanıcı güncellendi`);
    } catch (error) {
      console.error('❌ Günlük premium kontrol hatası:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Istanbul"
  });

  // Check premium stats every hour (for monitoring)
  cron.schedule('0 * * * *', async () => {
    try {
      const stats = await premiumService.getPremiumStats();
      console.log(`📊 Saatlik İstatistik - Aktif Premium: ${stats.activePremiumUsers}, Süresi Yaklaşan: ${stats.expiringSoonUsers}`);
    } catch (error) {
      console.error('❌ Saatlik istatistik hatası:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Istanbul"
  });

  // Check users expiring in 7 days (every day at 09:00)
  cron.schedule('0 9 * * *', async () => {
    console.log('⚠️ 7 gün içinde süresi dolacak kullanıcılar kontrol ediliyor...');
    try {
      const expiringUsers = await premiumService.getUsersExpiringSoon(7);
      if (expiringUsers.length > 0) {
        console.log(`⚠️ ${expiringUsers.length} kullanıcının premium üyeliği 7 gün içinde sona erecek:`);
        expiringUsers.forEach(user => {
          const daysLeft = Math.ceil((new Date(user.premiumUntil) - new Date()) / (1000 * 60 * 60 * 24));
          console.log(`   - ${user.email}: ${daysLeft} gün kaldı`);
        });
      } else {
        console.log('✅ 7 gün içinde süresi dolacak premium üye yok');
      }
    } catch (error) {
      console.error('❌ 7 günlük kontrol hatası:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Istanbul"
  });

  // Check users expiring in 1 day (every day at 10:00)
  cron.schedule('0 10 * * *', async () => {
    console.log('🚨 1 gün içinde süresi dolacak kullanıcılar kontrol ediliyor...');
    try {
      const expiringUsers = await premiumService.getUsersExpiringSoon(1);
      if (expiringUsers.length > 0) {
        console.log(`🚨 ${expiringUsers.length} kullanıcının premium üyeliği 1 gün içinde sona erecek:`);
        expiringUsers.forEach(user => {
          const hoursLeft = Math.ceil((new Date(user.premiumUntil) - new Date()) / (1000 * 60 * 60));
          console.log(`   - ${user.email}: ${hoursLeft} saat kaldı`);
        });
      } else {
        console.log('✅ 1 gün içinde süresi dolacak premium üye yok');
      }
    } catch (error) {
      console.error('❌ 1 günlük kontrol hatası:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Istanbul"
  });

  // Weekly stats report (every Sunday at 08:00)
  cron.schedule('0 8 * * 0', async () => {
    console.log('📈 Haftalık rapor oluşturuluyor...');
    try {
      const stats = await premiumService.getPremiumStats();
      console.log('📊 HAFTALİK RAPOR:');
      console.log(`   💎 Aktif Premium Üyeler: ${stats.activePremiumUsers}`);
      console.log(`   ⏰ Süresi Yaklaşan Üyeler: ${stats.expiringSoonUsers}`);
      console.log(`   ❌ Süresi Dolmuş Üyeler: ${stats.expiredPremiumUsers}`);
      console.log(`   💳 Toplam Ödeme: ${stats.totalPayments}`);
      console.log(`   ✅ Onaylanan Ödeme: ${stats.approvedPayments}`);
      console.log(`   ⏳ Bekleyen Ödeme: ${stats.pendingPayments}`);
      console.log(`   💰 Toplam Gelir: ${stats.totalRevenue.toFixed(2)} TL`);
    } catch (error) {
      console.error('❌ Haftalık rapor hatası:', error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Istanbul"
  });

  console.log('✅ Tüm cron joblar başarıyla başlatıldı!');
  console.log('📅 Zamanlamalar:');
  console.log('   - Günlük premium kontrol: Her gün 00:00');
  console.log('   - Saatlik istatistik: Her saat başı');
  console.log('   - 7 gün uyarısı: Her gün 09:00');
  console.log('   - 1 gün uyarısı: Her gün 10:00');
  console.log('   - Haftalık rapor: Pazar 08:00');
};

// Manual trigger functions for testing
const manualTriggers = {
  checkExpired: async () => {
    console.log('🔧 Manuel premium kontrol tetikleniyor...');
    return await premiumService.checkExpiredPremiumUsers();
  },
  
  getStats: async () => {
    console.log('🔧 Manuel istatistik getiriliyor...');
    return await premiumService.getPremiumStats();
  },
  
  checkExpiring: async (days = 7) => {
    console.log(`🔧 Manuel ${days} günlük kontrol tetikleniyor...`);
    return await premiumService.getUsersExpiringSoon(days);
  }
};

module.exports = {
  initializeCronJobs,
  manualTriggers
}; 