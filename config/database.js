const { PrismaClient } = require('../generated/prisma');

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty',
});

// Database connection test
const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('📊 Database connected successfully');
    
    // Test query
    const userCount = await prisma.user.count();
    console.log(`👥 Users in database: ${userCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Graceful shutdown
const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log('📊 Database disconnected');
  } catch (error) {
    console.error('❌ Database disconnect error:', error);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase
}; 