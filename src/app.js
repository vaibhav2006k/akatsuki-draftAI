const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Fallback: parse raw text if sent as text/plain and auto-convert to JSON
app.use(express.text({ type: ['text/plain', 'text/*', 'application/octet-stream'] }));
app.use((req, res, next) => {
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // Keep as string if invalid JSON
    }
  }
  // Ensure req.body is always at least an object
  req.body = req.body || {};
  next();
});

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check and root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    name: "Akatsuki's Draft API",
    version: '1.0.0',
    description: 'AI-Enabled Content Sharing Platform Backend',
    endpoints: {
      auth: ['POST /auth/register', 'POST /auth/login', 'GET /auth/me'],
      posts: [
        'POST /posts',
        'GET /posts',
        'GET /posts/my-posts',
        'GET /posts/:id',
        'PATCH /posts/:id',
        'DELETE /posts/:id',
      ],
      admin: [
        'GET /admin/posts/pending',
        'PATCH /admin/posts/approve/:id',
        'PATCH /admin/posts/reject/:id',
      ],
      ai: ['POST /ai/improve/:postId'],
    },
  });
});

// Mount Routes
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/admin', adminRoutes);
app.use('/ai', aiRoutes);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route Not Found`,
  });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
