const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Tüm ligleri getir
const getLeagues = async (req, res) => {
  try {
    const leagues = await prisma.league.findMany({
      include: {
        teams: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            teams: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: leagues
    });
  } catch (error) {
    console.error('Get leagues error:', error);
    res.status(500).json({
      success: false,
      message: 'Ligler getirilirken hata oluştu'
    });
  }
};

// Tek lig getir
const getLeague = async (req, res) => {
  try {
    const { id } = req.params;
    
    const league = await prisma.league.findUnique({
      where: { id: parseInt(id) },
      include: {
        teams: {
          select: {
            id: true,
            name: true
          },
          orderBy: {
            name: 'asc'
          }
        },
        _count: {
          select: {
            teams: true
          }
        }
      }
    });

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'Lig bulunamadı'
      });
    }

    res.json({
      success: true,
      data: league
    });
  } catch (error) {
    console.error('Get league error:', error);
    res.status(500).json({
      success: false,
      message: 'Lig getirilirken hata oluştu'
    });
  }
};

// Yeni lig oluştur
const createLeague = async (req, res) => {
  try {
    const { name, country } = req.body;

    // Validasyon
    if (!name || !country) {
      return res.status(400).json({
        success: false,
        message: 'Lig adı ve ülke zorunludur'
      });
    }

    // Aynı isimde lig var mı kontrol et
    const existingLeague = await prisma.league.findFirst({
      where: { name: name }
    });

    if (existingLeague) {
      return res.status(400).json({
        success: false,
        message: 'Bu lig adı zaten kullanılıyor'
      });
    }

    const league = await prisma.league.create({
      data: {
        name,
        country
      }
    });

    res.status(201).json({
      success: true,
      message: 'Lig başarıyla oluşturuldu',
      data: league
    });
  } catch (error) {
    console.error('Create league error:', error);
    res.status(500).json({
      success: false,
      message: 'Lig oluşturulurken hata oluştu'
    });
  }
};

// Lig güncelle
const updateLeague = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, country } = req.body;

    // Lig var mı kontrol et
    const existingLeague = await prisma.league.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingLeague) {
      return res.status(404).json({
        success: false,
        message: 'Lig bulunamadı'
      });
    }

    // Validasyon
    if (!name || !country) {
      return res.status(400).json({
        success: false,
        message: 'Lig adı ve ülke zorunludur'
      });
    }

    // Başka lig aynı adı kullanıyor mu kontrol et
    const duplicateLeague = await prisma.league.findFirst({
      where: {
        AND: [
          { id: { not: parseInt(id) } },
          { name: name }
        ]
      }
    });

    if (duplicateLeague) {
      return res.status(400).json({
        success: false,
        message: 'Bu lig adı başka bir lig tarafından kullanılıyor'
      });
    }

    const league = await prisma.league.update({
      where: { id: parseInt(id) },
      data: {
        name,
        country
      }
    });

    res.json({
      success: true,
      message: 'Lig başarıyla güncellendi',
      data: league
    });
  } catch (error) {
    console.error('Update league error:', error);
    res.status(500).json({
      success: false,
      message: 'Lig güncellenirken hata oluştu'
    });
  }
};

// Lig sil
const deleteLeague = async (req, res) => {
  try {
    const { id } = req.params;

    // Lig var mı kontrol et
    const existingLeague = await prisma.league.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            teams: true
          }
        }
      }
    });

    if (!existingLeague) {
      return res.status(404).json({
        success: false,
        message: 'Lig bulunamadı'
      });
    }

    // Lig'de takım var mı kontrol et
    if (existingLeague._count.teams > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bu ligde takımlar bulunuyor. Önce takımları silin veya başka lige taşıyın'
      });
    }

    await prisma.league.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Lig başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete league error:', error);
    res.status(500).json({
      success: false,
      message: 'Lig silinirken hata oluştu'
    });
  }
};

module.exports = {
  getLeagues,
  getLeague,
  createLeague,
  updateLeague,
  deleteLeague
}; 