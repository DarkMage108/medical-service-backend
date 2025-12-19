import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import patientRoutes from './routes/patient.routes.js';
import diagnosisRoutes from './routes/diagnosis.routes.js';
import medicationRoutes from './routes/medication.routes.js';
import protocolRoutes from './routes/protocol.routes.js';
import treatmentRoutes from './routes/treatment.routes.js';
import doseRoutes from './routes/dose.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import purchaseRequestRoutes from './routes/purchaseRequest.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import dispenseLogRoutes from './routes/dispenseLog.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import salesRoutes from './routes/sales.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Azevedo Medical Services API',
      version: '1.0.0',
      description: 'REST API for Post-Consultation Management System',
    },
    servers: [
      {
        url: `http://localhost:${PORT}/api`,
        description: 'Development server',
      },
    ],
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
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set charset UTF-8 for all JSON responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/diagnoses', diagnosisRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/protocols', protocolRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/doses', doseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dispense-logs', dispenseLogRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/sales', salesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Docs available at http://localhost:${PORT}/api-docs`);
});

export default app;
