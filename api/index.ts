import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { instanceManager } from './services/instanceManager';
import instancesRouter from './routes/instances';
import mcpRouter from './routes/mcp';
import { formatLog, LogLevel } from './mcp/utils/console';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/instances', instancesRouter);
app.use('/api/mcp', mcpRouter);

app.get('/api/network-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] || [];
    for (const entry of entries) {
      if (entry && entry.family === 'IPv4' && !entry.internal) {
        res.json({ ip: entry.address });
        return;
      }
    }
  }
  res.json({ ip: null });
});

// Serve static files from frontend dist directory
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  formatLog(LogLevel.INFO, `Serving static files from ${distPath}`);
  app.use(express.static(distPath));
  
  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function start() {
  try {
    // Initialize services
    await instanceManager.initialize();
    formatLog(LogLevel.INFO, 'Instance Manager initialized');

    const server = app.listen(PORT, () => {
      formatLog(LogLevel.INFO, `Server running on port ${PORT}`);
      formatLog(LogLevel.INFO, `API available at http://localhost:${PORT}/api`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

      switch (error.code) {
        case 'EACCES':
          formatLog(LogLevel.ERROR, `${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          formatLog(LogLevel.ERROR, `${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Graceful shutdown handlers
    const shutdown = (signal: string) => {
      formatLog(LogLevel.INFO, `${signal} signal received: closing HTTP server`);
      server.close(() => {
        formatLog(LogLevel.INFO, 'HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        formatLog(LogLevel.ERROR, 'Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions - prevent process from crashing
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  // Log the error stack for debugging
  console.error(error.stack);
  // Don't exit - let the service try to recover
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
  // Don't exit - let the service try to recover
});

start();
