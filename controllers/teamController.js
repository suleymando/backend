const { PrismaClient } = require('../generated/prisma');
const prisma = new PrismaClient();

// Tüm takımları getir
const getTeams = async (req, res) => {
  try {
    const { leagueId, search } = req.query;
    
    let whereClause = { isActive: true }; // Sadece aktif takımları getir
    
    // Lig filtrelemesi
    if (leagueId) {
      whereClause.leagueId = parseInt(leagueId);
    }
    
    // Arama filtrelemesi
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const teams = await prisma.team.findMany({
      where: whereClause,
      include: {
        league: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            homePredictions: true,
            awayPredictions: true
          }
        }
      },
      orderBy: [
        { league: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Takımlar getirilirken hata oluştu'
    });
  }
};

// Tek takım getir
const getTeam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const team = await prisma.team.findFirst({
      where: { 
        id: parseInt(id),
        isActive: true
      },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            country: true
          }
        },
        _count: {
          select: {
            homePredictions: true,
            awayPredictions: true
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      success: false,
      message: 'Takım getirilirken hata oluştu'
    });
  }
};

// Yeni takım oluştur
const createTeam = async (req, res) => {
  try {
    const { name, shortName, leagueId } = req.body;

    // Validasyon
    if (!name || !leagueId) {
      return res.status(400).json({
        success: false,
        message: 'Takım adı ve lig zorunludur'
      });
    }

    // Lig var mı kontrol et
    const league = await prisma.league.findUnique({
      where: { id: parseInt(leagueId) }
    });

    if (!league) {
      return res.status(400).json({
        success: false,
        message: 'Belirtilen lig bulunamadı'
      });
    }

    // Aynı ligde aynı isimde takım var mı kontrol et
    const existingTeam = await prisma.team.findFirst({
      where: {
        leagueId: parseInt(leagueId),
        name: name,
        isActive: true
      }
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'Bu ligde aynı takım adı zaten kullanılıyor'
      });
    }

    // Aynı kısa ad var mı kontrol et (eğer kısa ad girilmişse)
    if (shortName) {
      const existingShortName = await prisma.team.findFirst({
        where: {
          shortName: shortName,
          isActive: true
        }
      });

      if (existingShortName) {
        return res.status(400).json({
          success: false,
          message: 'Bu kısa ad zaten kullanılıyor'
        });
      }
    }

    const team = await prisma.team.create({
      data: {
        name,
        shortName: shortName || null,
        leagueId: parseInt(leagueId)
      },
      include: {
        league: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Takım başarıyla oluşturuldu',
      data: team
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Takım oluşturulurken hata oluştu'
    });
  }
};

// Takım güncelle
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, shortName, leagueId } = req.body;

    // Takım var mı kontrol et
    const existingTeam = await prisma.team.findFirst({
      where: { 
        id: parseInt(id),
        isActive: true
      }
    });

    if (!existingTeam) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    // Validasyon
    if (!name || !leagueId) {
      return res.status(400).json({
        success: false,
        message: 'Takım adı ve lig zorunludur'
      });
    }

    // Lig var mı kontrol et
    const league = await prisma.league.findUnique({
      where: { id: parseInt(leagueId) }
    });

    if (!league) {
      return res.status(400).json({
        success: false,
        message: 'Belirtilen lig bulunamadı'
      });
    }

    // Başka takım aynı adı kullanıyor mu kontrol et (aynı ligde)
    const duplicateTeam = await prisma.team.findFirst({
      where: {
        AND: [
          { id: { not: parseInt(id) } },
          { leagueId: parseInt(leagueId) },
          { name: name },
          { isActive: true }
        ]
      }
    });

    if (duplicateTeam) {
      return res.status(400).json({
        success: false,
        message: 'Bu ligde aynı takım adı başka bir takım tarafından kullanılıyor'
      });
    }

    // Başka takım aynı kısa adı kullanıyor mu kontrol et (eğer kısa ad girilmişse)
    if (shortName) {
      const duplicateShortName = await prisma.team.findFirst({
        where: {
          AND: [
            { id: { not: parseInt(id) } },
            { shortName: shortName },
            { isActive: true }
          ]
        }
      });

      if (duplicateShortName) {
        return res.status(400).json({
          success: false,
          message: 'Bu kısa ad başka bir takım tarafından kullanılıyor'
        });
      }
    }

    const team = await prisma.team.update({
      where: { id: parseInt(id) },
      data: {
        name,
        shortName: shortName || null,
        leagueId: parseInt(leagueId)
      },
      include: {
        league: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Takım başarıyla güncellendi',
      data: team
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Takım güncellenirken hata oluştu'
    });
  }
};

// Takım sil
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    // Takım var mı kontrol et
    const existingTeam = await prisma.team.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTeam) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    // Soft delete - takımı deaktive et
    await prisma.team.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Takım başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Takım silinirken hata oluştu'
    });
  }
};

// Lig'e göre takımları getir
const getTeamsByLeague = async (req, res) => {
  try {
    const { leagueId } = req.params;
    
    // Lig var mı kontrol et
    const league = await prisma.league.findUnique({
      where: { id: parseInt(leagueId) }
    });

    if (!league) {
      return res.status(404).json({
        success: false,
        message: 'Lig bulunamadı'
      });
    }

    const teams = await prisma.team.findMany({
      where: { 
        leagueId: parseInt(leagueId),
        isActive: true
      },
      select: {
        id: true,
        name: true,
        shortName: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: teams,
      league: {
        id: league.id,
        name: league.name
      }
    });
  } catch (error) {
    console.error('Get teams by league error:', error);
    res.status(500).json({
      success: false,
      message: 'Takımlar getirilirken hata oluştu'
    });
  }
};

module.exports = {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamsByLeague
}; 