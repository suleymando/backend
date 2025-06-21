const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { prisma } = require('../config/database');

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    console.log('Auth middleware - token:', token ? 'present' : 'missing');
    
    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    console.log('Token decoded:', decoded);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.userId,
        isActive: true 
      },
      select: {
        id: true,
        email: true,
        adminUsername: true,
        role: true,
        premiumUntil: true,
        isActive: true
      }
    });

    console.log('User found in DB:', user);

    if (!user) {
      console.log('User not found or inactive for userId:', decoded.userId);
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not found or inactive'
      });
    }

    // Check if premium has expired
    if (user.role === 'PREMIUM' && user.premiumUntil && new Date() > user.premiumUntil) {
      // Downgrade to normal user
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          role: 'NORMAL',
          premiumUntil: null
        }
      });
      user.role = 'NORMAL';
      user.premiumUntil = null;
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      error: 'Access denied',
      message: 'Invalid token'
    });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Admin privileges required'
    });
  }
  next();
};

// Check if user is premium (admin or premium user)
const requirePremium = (req, res, next) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'PREMIUM')) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Premium membership required'
    });
  }
  next();
};

// Optional authentication (user might or might not be logged in)
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (token) {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { 
          id: decoded.userId,
          isActive: true 
        },
        select: {
          id: true,
          email: true,
          adminUsername: true,
          role: true,
          premiumUntil: true,
          isActive: true
        }
      });

      if (user) {
        // Check premium expiration
        if (user.role === 'PREMIUM' && user.premiumUntil && new Date() > user.premiumUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { 
              role: 'NORMAL',
              premiumUntil: null
            }
          });
          user.role = 'NORMAL';
          user.premiumUntil = null;
        }
        
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requirePremium,
  optionalAuth
}; 