const Post = require('../models/Post');
const { improveContentWithAI } = require('../config/ai');

// @desc    Improve content using AI and save as a new draft under the same user
// @route   POST /ai/improve/:postId
// @access  Private
const improvePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'Original post not found.',
      });
    }

    // Check ownership or admin
    const authorId = originalPost.createdBy?._id ? originalPost.createdBy._id.toString() : originalPost.createdBy?.toString();
    const isOwner = authorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only improve your own drafts or posts.',
      });
    }

    // Generate improved content via AI
    const aiResult = await improveContentWithAI({
      title: originalPost.title,
      description: originalPost.description,
      content: originalPost.content,
      category: originalPost.category,
    });

    // Create a new draft under the same user, preserving the original post
    const newDraft = await Post.create({
      title: aiResult.improvedTitle,
      description: aiResult.improvedDescription,
      content: aiResult.improvedContent,
      image: originalPost.image,
      category: originalPost.category,
      status: 'draft',
      createdBy: req.user._id,
    });

    const populatedDraft = await Post.findById(newDraft._id).populate('createdBy', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Post content improved by AI and saved as a new draft while preserving the original.',
      data: {
        originalPost: {
          id: originalPost._id,
          title: originalPost.title,
          status: originalPost.status,
        },
        newDraft: populatedDraft,
        aiMeta: {
          provider: aiResult.provider,
          summary: aiResult.improvementSummary,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  improvePost,
};
