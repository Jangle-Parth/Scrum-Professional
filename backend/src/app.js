// backend/src/app.js - UPDATED with auth middleware

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth'); // ADD THIS

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const taskRoutes = require('./routes/tasks');
const jobRoutes = require('./routes/jobs');
const analyticsRoutes = require('./routes/analytics');

// Import cron jobs
require('./utils/cronJobs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes - UPDATED with auth middleware
app.use('/api/auth', authRoutes); // No auth needed for login
app.use('/api/admin', auth, adminRoutes); // Auth required
app.use('/api/user', auth, userRoutes); // Auth required  
app.use('/api/tasks', auth, taskRoutes); // Auth required
app.use('/api/jobs', auth, jobRoutes); // Auth required
app.use('/api/analytics', auth, analyticsRoutes); // Auth required

// Health check - no auth needed
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

module.exports = app;