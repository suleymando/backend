const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { generateToken, generateAdminUsername } = require('../utils/jwt');

// Register new user
const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Force all new registrations to be NORMAL users for security
    const role = 'NORMAL';

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Registration failed',
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate username for admin
    const adminUsername = role === 'ADMIN' ? generateAdminUsername(email) : null;

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        adminUsername
      },
      select: {
        id: true,
        email: true,
        adminUsername: true,
        role: true,
        createdAt: true
      }
    });

    // Generate token
    const token = generateToken({ userId: user.id });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register user'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { 
        email,
        isActive: true 
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
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

    // Generate token
    const token = generateToken({ userId: user.id });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to login'
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        adminUsername: true,
        role: true,
        premiumUntil: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.json({
      message: 'User retrieved successfully',
      user
    });

  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user'
    });
  }
};

// Logout (client-side token removal)
const logout = (req, res) => {
  res.json({
    message: 'Logout successful'
  });
};

module.exports = {
  register,
  login,
  getMe,
  logout
}; 