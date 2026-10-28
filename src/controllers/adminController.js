const Post = require('../models/Post');

// @desc    View posts awaiting approval
// @route   GET /admin/posts/pending
// @access  Private (Admin only)
const getPendingPosts = async (req, res, next) => {
  try {
    const pendingPosts = await Post.find({ status: 'pending' })
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingPosts.length,
      data: {
        posts: pendingPosts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a post
// @route   PATCH /admin/posts/approve/:id
// @access  Private (Admin only)
const approvePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    post.status = 'approved';
    await post.save();

    const populatedPost = await Post.findById(post._id).populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Post approved successfully and is now publicly visible.',
      data: {
        post: populatedPost,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a post
// @route   PATCH /admin/posts/reject/:id
// @access  Private (Admin only)
const rejectPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    post.status = 'rejected';
    await post.save();

    const populatedPost = await Post.findById(post._id).populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Post rejected.',
      data: {
        post: populatedPost,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingPosts,
  approvePost,
  rejectPost,
};
