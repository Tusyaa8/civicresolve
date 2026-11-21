/**
 * CivicResolve - Backend Server Entrypoint
 * An AI-Powered Civic Issue Reporting and Management Platform
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { initDb } = require('./src/db/initDb');
const complaintsRouter = require('./src/routes/complaints');
const issuesRouter = require('./src/routes/issues');
const adminRouter = require('./src/routes/admin');

// Load environment variables from .env
dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Body parsing middleware (allows compressed base64 images up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend assets (HTML, CSS, JS, Locales)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/complaints', complaintsRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/admin', adminRouter);

// Public Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.get('/track', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

app.get('/issues', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'issues.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CivicResolve', timestamp: new Date().toISOString() });
});

// Global 404 handler for unknown web routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Do not log sensitive credentials
  console.error('[Server Error]', err.message || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`CivicResolve server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Fatal Startup Error]: Could not initialize database schema.');
    process.exit(1);
  }
}

startServer();
