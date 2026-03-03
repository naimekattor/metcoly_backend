const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env' });

const app = require('./src/app');
const prisma = require('./src/config/database');

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  console.log(err.stack);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

// Test database connection
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', err => {
      console.log('UNHANDLED REJECTION! 💥 Shutting down...');
      console.log(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
      server.close(() => {
        console.log('💥 Process terminated!');
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();