const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');

// Get all payments (Admin only)
const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, packageType } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    let where = {};

    if (status && status !== '') {
      where.status = status;
    }

    if (packageType && packageType !== '') {
      where.packageType = packageType;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            premiumUntil: true
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
    const totalCount = await prisma.payment.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Ödemeler yüklenirken hata oluştu'
    });
  }
};

// Get user's payments
const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;

    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Error fetching user payments:', error);
    res.status(500).json({
      success: false,
      message: 'Ödemeleriniz yüklenirken hata oluştu'
    });
  }
};

// Create new payment request
const createPaymentRequest = async (req, res) => {
  try {
    const { amount, packageType } = req.body;
    const userId = req.user.id;

    // Validation
    if (!amount || !packageType) {
      return res.status(400).json({
        success: false,
        message: 'Tutar ve paket türü gereklidir'
      });
    }

    if (!['MONTHLY', 'YEARLY'].includes(packageType)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz paket türü'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Tutar 0\'dan büyük olmalıdır'
      });
    }

    // Check if user has pending payment
    const pendingPayment = await prisma.payment.findFirst({
      where: {
        userId,
        status: 'PENDING'
      }
    });

    if (pendingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Zaten bekleyen bir ödemeniz var. Lütfen önce onu tamamlayın.'
      });
    }

    // Create payment request
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: parseFloat(amount),
        packageType,
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Ödeme talebi oluşturuldu. Lütfen dekont yükleyin.',
      data: payment
    });

  } catch (error) {
    console.error('Error creating payment request:', error);
    res.status(500).json({
      success: false,
      message: 'Ödeme talebi oluşturulurken hata oluştu'
    });
  }
};

// Upload payment receipt
const uploadReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Dekont dosyası yüklenmedi'
      });
    }

    // Check if payment exists and belongs to user
    const payment = await prisma.payment.findFirst({
      where: {
        id: parseInt(id),
        userId,
        status: 'PENDING'
      }
    });

    if (!payment) {
      // Delete uploaded file if payment not found
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Ödeme bulunamadı veya zaten işleme alınmış'
      });
    }

    // Delete old receipt if exists
    if (payment.receiptUrl) {
      const oldFilePath = path.join(__dirname, '..', payment.receiptUrl);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update payment with receipt URL
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data: {
        receiptUrl: req.file.path.replace(/\\/g, '/'), // Normalize path separators
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Dekont başarıyla yüklendi. Admin onayı bekleniyor.',
      data: updatedPayment
    });

  } catch (error) {
    console.error('Error uploading receipt:', error);
    
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Dekont yüklenirken hata oluştu'
    });
  }
};

// Approve payment (Admin only)
const approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    // Check if payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Ödeme bulunamadı'
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Bu ödeme zaten işleme alınmış'
      });
    }

    // Get site settings for premium duration
    const settings = await prisma.siteSetting.findFirst({
      where: { isActive: true }
    });

    const premiumDays = payment.packageType === 'MONTHLY' 
      ? (settings?.monthlyDays || 30) 
      : (settings?.yearlyDays || 365);

    // Calculate new premium end date
    const currentDate = new Date();
    const currentPremiumEnd = payment.user.premiumUntil && payment.user.premiumUntil > currentDate 
      ? payment.user.premiumUntil 
      : currentDate;
    
    const newPremiumEnd = new Date(currentPremiumEnd);
    newPremiumEnd.setDate(newPremiumEnd.getDate() + premiumDays);

    // Update payment and user in transaction
    const result = await prisma.$transaction([
      // Update payment status
      prisma.payment.update({
        where: { id: parseInt(id) },
        data: {
          status: 'APPROVED',
          adminNote,
          updatedAt: new Date()
        }
      }),
      // Update user premium status
      prisma.user.update({
        where: { id: payment.userId },
        data: {
          role: 'PREMIUM',
          premiumUntil: newPremiumEnd,
          updatedAt: new Date()
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Ödeme onaylandı ve premium üyelik aktifleştirildi',
      data: {
        payment: result[0],
        user: result[1]
      }
    });

  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({
      success: false,
      message: 'Ödeme onaylanırken hata oluştu'
    });
  }
};

// Reject payment (Admin only)
const rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    // Check if payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Ödeme bulunamadı'
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Bu ödeme zaten işleme alınmış'
      });
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data: {
        status: 'REJECTED',
        adminNote,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Ödeme reddedildi',
      data: updatedPayment
    });

  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({
      success: false,
      message: 'Ödeme reddedilirken hata oluştu'
    });
  }
};

// Get site settings
const getSiteSettings = async (req, res) => {
  try {
    const settings = await prisma.siteSetting.findFirst({
      where: { isActive: true }
    });

    if (!settings) {
      // Create default settings if none exist
      const defaultSettings = await prisma.siteSetting.create({
        data: {
          monthlyPrice: 50.0,
          yearlyPrice: 500.0,
          monthlyDays: 30,
          yearlyDays: 365,
          bankName: 'Türkiye İş Bankası',
          ibanNumber: 'TR64 0006 4000 0011 2345 6789 01',
          accountName: 'Tahminci.info',
          branchName: 'Merkez Şubesi'
        }
      });
      return res.json({
        success: true,
        data: defaultSettings
      });
    }

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Error fetching site settings:', error);
    res.status(500).json({
      success: false,
      message: 'Site ayarları yüklenirken hata oluştu'
    });
  }
};

// Update site settings (Admin only)
const updateSiteSettings = async (req, res) => {
  try {
    const {
      monthlyPrice,
      yearlyPrice,
      monthlyDays,
      yearlyDays,
      bankName,
      ibanNumber,
      accountName,
      branchName
    } = req.body;

    // Get existing settings
    let settings = await prisma.siteSetting.findFirst({
      where: { isActive: true }
    });

    const updateData = {};
    if (monthlyPrice !== undefined) updateData.monthlyPrice = parseFloat(monthlyPrice);
    if (yearlyPrice !== undefined) updateData.yearlyPrice = parseFloat(yearlyPrice);
    if (monthlyDays !== undefined) updateData.monthlyDays = parseInt(monthlyDays);
    if (yearlyDays !== undefined) updateData.yearlyDays = parseInt(yearlyDays);
    if (bankName !== undefined) updateData.bankName = bankName;
    if (ibanNumber !== undefined) updateData.ibanNumber = ibanNumber;
    if (accountName !== undefined) updateData.accountName = accountName;
    if (branchName !== undefined) updateData.branchName = branchName;
    
    updateData.updatedAt = new Date();

    if (settings) {
      // Update existing settings
      settings = await prisma.siteSetting.update({
        where: { id: settings.id },
        data: updateData
      });
    } else {
      // Create new settings
      settings = await prisma.siteSetting.create({
        data: {
          monthlyPrice: 50.0,
          yearlyPrice: 500.0,
          monthlyDays: 30,
          yearlyDays: 365,
          bankName: 'Türkiye İş Bankası',
          ibanNumber: 'TR64 0006 4000 0011 2345 6789 01',
          accountName: 'Tahminci.info',
          branchName: 'Merkez Şubesi',
          ...updateData
        }
      });
    }

    res.json({
      success: true,
      message: 'Site ayarları güncellendi',
      data: settings
    });

  } catch (error) {
    console.error('Error updating site settings:', error);
    res.status(500).json({
      success: false,
      message: 'Site ayarları güncellenirken hata oluştu'
    });
  }
};

module.exports = {
  getAllPayments,
  getUserPayments,
  createPaymentRequest,
  uploadReceipt,
  approvePayment,
  rejectPayment,
  getSiteSettings,
  updateSiteSettings
}; 