require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", 'https://checkout.razorpay.com'],
      'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      'connect-src': ["'self'", 'https://api.razorpay.com'],
    },
  },
}));
app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin tools (curl/Postman) and whitelisted frontends (incl. Vercel previews if listed)
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

if (process.env.NODE_ENV !== 'test') {
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, message: 'Too many login attempts, try later' } }));
  app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, max: 20, message: { success: false, message: 'Slow down — too many AI requests' } }));
}

app.get('/', (req, res) => res.json({ name: 'AI LMS API', docs: '/api/health' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
