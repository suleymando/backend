const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Extract token from request headers
const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Check if it starts with 'Bearer '
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove 'Bearer ' prefix
  }
  
  return authHeader; // Return as is if no Bearer prefix
};

// Generate admin username from email
const generateAdminUsername = (email) => {
  const emailPrefix = email.split('@')[0];
  return `@${emailPrefix}`;
};

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  generateAdminUsername
}; 