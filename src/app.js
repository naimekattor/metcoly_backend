const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const AppError = require('./utils/AppError');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();


const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Metcoly API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js', './src/docs/*.js'], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Immigration Platform API Docs'
}));

// JSON endpoint for OpenAPI spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
// ==================== GLOBAL MIDDLEWARE ====================
app.get('/favicon.ico', (req, res) => res.status(204).end());
// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  max: 100, // 100 requests per IP
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    const convertValues = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return obj.toString();
      // Handle Prisma/pg Date objects that serialize as {}
      if (obj instanceof Date) return obj.toISOString();
      // Handle pg-specific date types that have a toISOString or toString method
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        // Check if it's a date-like object (has toISOString but isn't a plain object)
        if (typeof obj.toISOString === 'function') return obj.toISOString();
        const converted = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            converted[key] = convertValues(obj[key]);
          }
        }
        return converted;
      }
      if (Array.isArray(obj)) return obj.map(convertValues);
      return obj;
    };
    return originalJson.call(this, convertValues(data));
  };
  next();
});


// ==================== ROUTES ====================
app.use('/api', routes);

// ==================== ERROR HANDLING ====================

// Handle 404 errors
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  // Log error
  console.error('❌ Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id,
    body: req.body,
  });
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // Production: don't leak error details
    res.status(err.statusCode).json({
      status: err.status,
      message: err.isOperational ? err.message : 'Something went wrong!',
    });
  }
});

module.exports = app;