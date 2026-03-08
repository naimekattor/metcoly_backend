const prisma = require('../config/database');
const catchAsync = require('../utils/catchAsync');

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
        },
        orderBy: { name: 'asc' },
    });

    res.json({
        status: 'success',
        data: { services },
    });
});

module.exports = { getActiveServices };
