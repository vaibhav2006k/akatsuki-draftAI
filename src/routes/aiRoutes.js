const express = require('express');
const router = express.Router();
const { improvePost } = require('../controllers/aiController');
const { verifyToken } = require('../middlewares/auth');

// Improve content with AI (Private)
router.post('/improve/:postId', verifyToken, improvePost);

module.exports = router;
