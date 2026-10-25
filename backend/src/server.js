const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const env = require('./config/env');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const reservationRoutes = require('./routes/reservations');
const reportRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const customersRoutes = require('./routes/customers');
const uploadRoutes = require('./routes/upload');
const calendarRoutes = require('./routes/calendar');
const { router: pricingRoutes } = require('./routes/pricing');
const analyticsRoutes = require('./routes/analytics');
const reviewsRoutes = require('./routes/reviews');
const exportRoutes = require('./routes/export');
const publicRoutes = require('./routes/public');

const app = express();

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
const allowedOrigins = env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ─── Existing Routes ──────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/rooms',        roomRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/users',        usersRoutes);
app.use('/api/customers',    customersRoutes);
app.use('/api/upload',       uploadRoutes);

// ─── Enterprise Routes ────────────────────────────────────────────────────────
app.use('/api/calendar',     calendarRoutes);
app.use('/api/pricing',      pricingRoutes);
app.use('/api/analytics',    analyticsRoutes);
app.use('/api/reviews',      reviewsRoutes);
app.use('/api/export',       exportRoutes);
app.use('/api/public',       publicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.', errors: [] });
});

// Global error handler
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error.';
  const errors = err.errors || [];
  res.status(status).json({
    message: status === 500 ? 'Internal server error.' : message,
    errors,
  });
});

const PORT = env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏨 Hotel Reservation API running on port ${PORT}`);
});

module.exports = app;
