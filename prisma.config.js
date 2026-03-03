module.exports = {
    datasource: {
        url: process.env.DATABASE_URL || "postgresql://postgres:25815609@localhost:5432/consultancy_system?schema=public",
    },
};
