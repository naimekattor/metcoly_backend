const prisma = require('../config/database');
const catchAsync = require("../utils/catchAsync");

const getActiveServices = catchAsync(async (req, res) => {
    const services = await prisma.service.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            description: true,
            serviceType: true,
            basePrice: true,
            currency: true,
            isActive: true,
            createdAt: true,
        },
        orderBy: { name: 'asc' },
    });

    // Add virtual fields for frontend if needed
    const enhancedServices = services.map(s => ({
        ...s,
        popular: false, // Default since not in schema
        category: s.serviceType || 'General',
    }));

    res.json({
        status: 'success',
        data: { services: enhancedServices },
    });
});

module.exports = { getActiveServices };
