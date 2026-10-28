const express = require('express');
const router = express.Router();
const {
  createPost,
  getApprovedPosts,
  getMyPosts,
  getPostById,
  updatePost,
  deletePost,
} = require('../controllers/postController');
const { verifyToken, optionalAuth } = require('../middlewares/auth');

// Create post or draft (Private)
router.post('/', verifyToken, createPost);

// View all approved posts (Public)
router.get('/', getApprovedPosts);

// View your own posts and drafts (Private) - Must be before /:id
router.get('/my-posts', verifyToken, getMyPosts);

// View an approved post by ID (Public for approved, Private for owner/admin if draft/pending)
router.get('/:id', optionalAuth, getPostById);

// Update your own post (Private)
router.patch('/:id', verifyToken, updatePost);

// Delete your own post (Private)
router.delete('/:id', verifyToken, deletePost);

module.exports = router;
