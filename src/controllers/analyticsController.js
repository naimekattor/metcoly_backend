const prisma = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const { PaymentStatus, ApplicationStatus, BookingStatus } = require('../utils/constants');

const getDashboardStats = catchAsync(async (req, res) => {
  // Get current date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Run all queries in parallel
  const [
    totalUsers,
    totalConsultants,
    totalClients,
    totalApplications,
    totalBookings,
    totalRevenue,
    monthlyStats,
    applicationsByStatus,
    bookingsByStatus,
    recentActivity,
  ] = await Promise.all([
    // Total users
    prisma.user.count(),

    // Total consultants
    prisma.user.count({
      where: { role: 'CONSULTANT' },
    }),

    // Total clients
    prisma.user.count({
      where: { role: 'CLIENT' },
    }),

    // Total applications
    prisma.application.count(),

    // Total bookings
    prisma.booking.count(),

    // Total revenue
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
      },
      _sum: {
        amount: true,
      },
    }),

    // Monthly stats
    Promise.all([
      // This month's revenue
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          paidAt: {
            gte: startOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // Last month's revenue
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          paidAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // This month's applications
      prisma.application.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // This month's bookings
      prisma.booking.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
    ]),

    // Applications by status
    prisma.application.groupBy({
      by: ['status'],
      _count: true,
    }),

    // Bookings by status
    prisma.booking.groupBy({
      by: ['bookingStatus'],
      _count: true,
    }),

    // Recent activity
    prisma.activityLog.findMany({
      take: 10,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
  ]);
  const [thisMonthRevenue, lastMonthRevenue, thisMonthApplications, thisMonthBookings] = monthlyStats;

  const thisMonthRev = thisMonthRevenue._sum.amount || 0;
  const lastMonthRev = lastMonthRevenue._sum.amount || 0;

  // If last month had revenue, calculate % change. If not but this month does, it's 100% growth.
  const revenueGrowth = lastMonthRev > 0
    ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 10000) / 100
    : thisMonthRev > 0 ? 100 : 0;

  res.json({
    status: 'success',
    data: {
      overview: {
        totalUsers,
        totalConsultants,
        totalClients,
        totalApplications,
        totalBookings,
        totalRevenue: totalRevenue._sum.amount || 0,
      },
      monthly: {
        revenue: thisMonthRevenue._sum.amount || 0,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        newApplications: thisMonthApplications,
        newBookings: thisMonthBookings,
      },
      applicationsByStatus: applicationsByStatus.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {}),
      bookingsByStatus: bookingsByStatus.reduce((acc, curr) => {
        acc[curr.bookingStatus] = curr._count;
        return acc;
      }, {}),
      recentActivity,
    },
  });
});

const getRevenueAnalytics = catchAsync(async (req, res) => {
  const { from, to, groupBy = 'month' } = req.query;

  const startDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const endDate = to ? new Date(to) : new Date();

  // Whitelist-safe: only allow known granularity values to prevent SQL injection
  const safeGroupBy = ['day', 'month', 'year'].includes(groupBy) ? groupBy : 'month';
  const dateFormat = safeGroupBy === 'day' ? 'YYYY-MM-DD' : safeGroupBy === 'year' ? 'YYYY' : 'YYYY-MM';

  // Get revenue by time period — granularity must be a SQL literal, not a parameter
  const revenueByPeriod = await prisma.$queryRawUnsafe(`
    SELECT 
      TO_CHAR(DATE_TRUNC('${safeGroupBy}', paid_at), '${dateFormat}') as period,
      COUNT(*)::int as transaction_count,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(AVG(amount), 0) as average_amount
    FROM payments
    WHERE status = 'PAID'
      AND paid_at >= $1
      AND paid_at <= $2
    GROUP BY DATE_TRUNC('${safeGroupBy}', paid_at)
    ORDER BY DATE_TRUNC('${safeGroupBy}', paid_at) DESC
  `, startDate, endDate);

  // Get revenue by payment type
  const revenueByType = await prisma.payment.groupBy({
    by: ['paymentType'],
    where: {
      status: PaymentStatus.PAID,
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: true,
  });

  // Get revenue by service (through applications and bookings)
  const revenueByService = await prisma.$queryRawUnsafe(`
    SELECT 
      s.name as service_name,
      COUNT(DISTINCT p.id)::int as payment_count,
      COALESCE(SUM(p.amount), 0) as total_amount
    FROM payments p
    LEFT JOIN applications a ON p.application_id = a.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    LEFT JOIN services s ON s.id = COALESCE(a.service_id, b.service_id)
    WHERE p.status = 'PAID'
      AND p.paid_at >= $1
      AND p.paid_at <= $2
    GROUP BY s.name
    ORDER BY total_amount DESC
  `, startDate, endDate);

  const totalLen = revenueByPeriod.length || 1;

  res.json({
    status: 'success',
    data: {
      dateRange: {
        from: startDate,
        to: endDate,
      },
      summary: {
        totalRevenue: revenueByPeriod.reduce((sum, item) => sum + Number(item.total_amount), 0),
        totalTransactions: revenueByPeriod.reduce((sum, item) => sum + Number(item.transaction_count), 0),
        averageTransaction: revenueByPeriod.reduce((sum, item) => sum + Number(item.average_amount), 0) / totalLen,
      },
      revenueByPeriod,
      revenueByType,
      revenueByService,
    },
  });
});

const getApplicationAnalytics = catchAsync(async (req, res) => {
  const { from, to } = req.query;

  const startDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const endDate = to ? new Date(to) : new Date();

  // Applications over time
  const applicationsOverTime = await prisma.$queryRaw`
    SELECT 
      TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
      COUNT(*) as total_applications,
      SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
    FROM applications
    WHERE created_at >= ${startDate}
      AND created_at <= ${endDate}
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
  `;

  // Average processing time
  const processingTime = await prisma.$queryRaw`
    SELECT 
      AVG(EXTRACT(EPOCH FROM (closed_at - submitted_at)) / 86400) as avg_days_to_close,
      AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 86400) as avg_days_to_approve
    FROM applications
    WHERE submitted_at IS NOT NULL
      AND (closed_at IS NOT NULL OR approved_at IS NOT NULL)
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
  `;

  // Top countries
  const topCountries = await prisma.application.groupBy({
    by: ['country'],
    where: {
      country: { not: null },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: true,
    orderBy: {
      _count: {
        country: 'desc',
      },
    },
    take: 10,
  });

  res.json({
    status: 'success',
    data: {
      dateRange: {
        from: startDate,
        to: endDate,
      },
      applicationsOverTime,
      processingTime: processingTime[0] || { avg_days_to_close: 0, avg_days_to_approve: 0 },
      topCountries,
    },
  });
});

const getConsultantPerformance = catchAsync(async (req, res) => {
  const { from, to } = req.query;

  const startDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const endDate = to ? new Date(to) : new Date();

  const consultantPerformance = await prisma.$queryRaw`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      COUNT(DISTINCT ca.application_id) as total_assigned,
      COUNT(DISTINCT CASE WHEN a.status = 'APPROVED' THEN a.id END) as approved_applications,
      COUNT(DISTINCT CASE WHEN a.status = 'REJECTED' THEN a.id END) as rejected_applications,
      COUNT(DISTINCT cn.id) as total_notes,
      AVG(CASE 
        WHEN a.closed_at IS NOT NULL AND a.submitted_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (a.closed_at - a.submitted_at)) / 86400 
        ELSE NULL 
      END) as avg_processing_days
    FROM users u
    LEFT JOIN consultant_assignments ca ON u.id = ca.consultant_id
    LEFT JOIN applications a ON ca.application_id = a.id
    LEFT JOIN consultant_notes cn ON u.id = cn.consultant_id AND cn.created_at BETWEEN ${startDate} AND ${endDate}
    WHERE u.role = 'CONSULTANT'
      AND ca.assigned_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY u.id, u.first_name, u.last_name, u.email
    ORDER BY total_assigned DESC
  `;

  res.json({
    status: 'success',
    data: {
      dateRange: {
        from: startDate,
        to: endDate,
      },
      consultants: consultantPerformance,
    },
  });
});

const getActivityLogs = catchAsync(async (req, res) => {
  const { role, actionType, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const where = {};

  if (role) {
    where.user = {
      role: role,
    };
  }

  if (actionType) {
    where.actionType = actionType;
  }

  const [logs, totalCount] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  res.json({
    status: 'success',
    results: logs.length,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: parseInt(page),
    data: {
      logs,
    },
  });
});

module.exports = {
  getDashboardStats,
  getRevenueAnalytics,
  getApplicationAnalytics,
  getConsultantPerformance,
  getActivityLogs,
};