const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create site settings
    const siteSettings = await prisma.siteSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        monthlyPrice: 29.99,
        yearlyPrice: 299.99,
        monthlyDays: 30,
        yearlyDays: 365,
        bankName: 'Ziraat Bankası',
        ibanNumber: 'TR00 0000 0000 0000 0000 0000 00',
        accountName: 'Tahminci.info Ltd.',
        branchName: 'Merkez'
      }
    });

    console.log('✅ Site settings created');

    // Create default leagues
    const leagues = [
      { name: 'Premier League', country: 'İngiltere' },
      { name: 'La Liga', country: 'İspanya' },
      { name: 'Serie A', country: 'İtalya' },
      { name: 'Bundesliga', country: 'Almanya' },
      { name: 'Ligue 1', country: 'Fransa' },
      { name: 'Süper Lig', country: 'Türkiye' }
    ];

    for (const league of leagues) {
      await prisma.league.upsert({
        where: { name: league.name },
        update: {},
        create: league
      });
    }

    console.log('✅ Default leagues created');

    // Create sample teams for Premier League
    const premierLeague = await prisma.league.findFirst({
      where: { name: 'Premier League' }
    });

    if (premierLeague) {
      const teams = [
        'Manchester United',
        'Arsenal',
        'Chelsea',
        'Liverpool',
        'Manchester City',
        'Tottenham'
      ];

      for (const teamName of teams) {
        await prisma.team.upsert({
          where: { name: teamName },
          update: {},
          create: {
            name: teamName,
            leagueId: premierLeague.id
          }
        });
      }

      console.log('✅ Sample teams created');
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@tahminci.info' },
      update: {},
      create: {
        email: 'admin@tahminci.info',
        password: hashedPassword,
        role: 'ADMIN',
        adminUsername: 'admin'
      }
    });

    console.log('✅ Admin user created');
    console.log('📧 Admin Email: admin@tahminci.info');
    console.log('🔑 Admin Password: admin123');

    // Create sample normal user
    const normalPassword = await bcrypt.hash('user123', 12);
    
    const normalUser = await prisma.user.upsert({
      where: { email: 'user@test.com' },
      update: {},
      create: {
        email: 'user@test.com',
        password: normalPassword,
        role: 'NORMAL'
      }
    });

    console.log('✅ Sample users created');
    console.log('🌱 Database seeding completed successfully!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 