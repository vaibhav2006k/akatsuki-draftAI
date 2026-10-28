require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start the HTTP server
connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`[Server] Akatsuki's Draft Backend running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
      });
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
  });

module.exports = app;
