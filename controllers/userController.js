const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        adminUsername: true,
        premiumUntil: true,
        createdAt: true,
        _count: {
          select: {
            predictions: true,
            coupons: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Kullanıcı bulunamadı' 
      });
    }

    // Calculate premium status
    const isPremium = user.premiumUntil && new Date(user.premiumUntil) > new Date();
    const premiumDaysLeft = isPremium ? 
      Math.ceil((new Date(user.premiumUntil) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    res.json({
      success: true,
      data: {
        ...user,
        isPremium,
        premiumDaysLeft,
        totalPredictions: user._count.predictions,
        totalCoupons: user._count.coupons
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Profil bilgileri alınırken hata oluştu' 
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validation
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'E-posta adresi gerekli' 
      });
    }

    // Check if email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçerli bir e-posta adresi girin' 
      });
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: { 
        email,
        NOT: { id: userId }
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor' 
      });
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    let updateData = { email };

    // If password change is requested
    if (currentPassword && newPassword) {
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mevcut şifre yanlış' 
        });
      }

      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({ 
          success: false, 
          message: 'Yeni şifre en az 6 karakter olmalı' 
        });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      updateData.password = hashedNewPassword;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        adminUsername: true,
        premiumUntil: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profil başarıyla güncellendi',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Profil güncellenirken hata oluştu' 
    });
  }
};

// Update admin username (only for admins)
const updateAdminUsername = async (req, res) => {
  try {
    const { adminUsername } = req.body;
    const userId = req.user.id;

    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    // Validation
    if (!adminUsername) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin kullanıcı adı gerekli' 
      });
    }

    // Username format validation (alphanumeric, underscore, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(adminUsername)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kullanıcı adı 3-20 karakter olmalı ve sadece harf, rakam ve _ içerebilir' 
      });
    }

    // Check if username is already taken
    const existingAdmin = await prisma.user.findFirst({
      where: { 
        adminUsername,
        NOT: { id: userId }
      }
    });

    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bu kullanıcı adı başka bir admin tarafından kullanılıyor' 
      });
    }

    // Update admin username
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { adminUsername },
      select: {
        id: true,
        email: true,
        role: true,
        adminUsername: true,
        premiumUntil: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      message: 'Admin kullanıcı adı başarıyla güncellendi',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update admin username error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Admin kullanıcı adı güncellenirken hata oluştu' 
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    console.log('getAllUsers called by user:', req.user);
    
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      console.log('Access denied - user role:', req.user.role);
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (role && role !== 'ALL') {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { adminUsername: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get users with pagination
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          adminUsername: true,
          premiumUntil: true,
          createdAt: true,
          _count: {
            select: {
              predictions: true,
              coupons: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(offset),
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);

    // Add premium status
    const usersWithStatus = users.map(user => ({
      ...user,
      isPremium: user.premiumUntil && new Date(user.premiumUntil) > new Date(),
      premiumDaysLeft: user.premiumUntil && new Date(user.premiumUntil) > new Date() ? 
        Math.ceil((new Date(user.premiumUntil) - new Date()) / (1000 * 60 * 60 * 24)) : 0
    }));

    res.json({
      success: true,
      data: usersWithStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: offset + users.length < totalCount
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Kullanıcılar alınırken hata oluştu' 
    });
  }
};

// Update user role (admin only)
const updateUserRole = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    const { userId } = req.params;
    const { role } = req.body;

    // Validation
    if (!['NORMAL', 'PREMIUM', 'ADMIN'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz rol' 
      });
    }

    // Can't change own role
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kendi rolünüzü değiştiremezsiniz' 
      });
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        adminUsername: true,
        premiumUntil: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      message: 'Kullanıcı rolü başarıyla güncellendi',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Kullanıcı bulunamadı' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Kullanıcı rolü güncellenirken hata oluştu' 
    });
  }
};

// Update user premium status (admin only)
const updateUserPremium = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Bu işlem için admin yetkisi gerekli' 
      });
    }

    const { userId } = req.params;
    const { premiumDays } = req.body;

    // Validation
    if (typeof premiumDays !== 'number' || premiumDays < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz premium gün sayısı' 
      });
    }

    let premiumUntil = null;
    if (premiumDays > 0) {
      premiumUntil = new Date();
      premiumUntil.setDate(premiumUntil.getDate() + premiumDays);
    }

    // Update user premium status
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { premiumUntil },
      select: {
        id: true,
        email: true,
        role: true,
        adminUsername: true,
        premiumUntil: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      message: premiumDays > 0 ? 
        `Premium üyelik ${premiumDays} gün olarak ayarlandı` : 
        'Premium üyelik iptal edildi',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user premium error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Kullanıcı bulunamadı' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Premium durum güncellenirken hata oluştu' 
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAdminUsername,
  getAllUsers,
  updateUserRole,
  updateUserPremium
}; 