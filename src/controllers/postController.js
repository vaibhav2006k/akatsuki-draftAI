const Post = require('../models/Post');

// Helper to safely read a field case-insensitively from body or query
const getVal = (sourceA, sourceB, key) => {
  const getFrom = (obj) => {
    if (!obj || typeof obj !== 'object') return undefined;
    if (obj[key] !== undefined) return obj[key];
    const match = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
    return match ? obj[match] : undefined;
  };
  return getFrom(sourceA) ?? getFrom(sourceB);
};

// @desc    Create a new post or draft
// @route   POST /posts
// @access  Private
const createPost = async (req, res, next) => {
  try {
    const title = getVal(req.body, req.query, 'title');
    const description = getVal(req.body, req.query, 'description');
    const content = getVal(req.body, req.query, 'content');
    const category = getVal(req.body, req.query, 'category');
    const image = getVal(req.body, req.query, 'image') || '';
    const status = getVal(req.body, req.query, 'status');

    const missing = [];
    if (!title) missing.push('title');
    if (!description) missing.push('description');
    if (!content) missing.push('content');
    if (!category) missing.push('category');

    if (missing.length > 0) {
      const contentType = req.headers['content-type'] || 'none';
      return res.status(400).json({
        success: false,
        message: `Missing required post field(s): ${missing.join(', ')}.`,
        debug: {
          contentTypeReceived: contentType,
          bodyReceived: req.body,
          missingFields: missing,
          fixHint: contentType.includes('multipart')
            ? "You selected 'form-data'. Please switch to 'raw' -> 'JSON' in Postman Body tab."
            : "In Postman Body tab, select 'raw', set dropdown to 'JSON', and paste your JSON.",
        },
      });
    }

    // Allowed status on creation: 'draft' or 'pending' (users can't self-approve)
    let postStatus = 'draft';
    if (status) {
      if (['draft', 'pending'].includes(status)) {
        postStatus = status;
      } else if (req.user.role === 'admin' && ['approved', 'rejected'].includes(status)) {
        postStatus = status;
      }
    }

    const post = await Post.create({
      title,
      description,
      content,
      image: image || '',
      category,
      status: postStatus,
      createdBy: req.user._id,
    });

    const populatedPost = await Post.findById(post._id).populate('createdBy', 'name email role');

    res.status(201).json({
      success: true,
      message: postStatus === 'draft' ? 'Draft created successfully.' : 'Post submitted for admin approval.',
      data: {
        post: populatedPost,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View all approved posts
// @route   GET /posts
// @access  Public
const getApprovedPosts = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;

    const query = { status: 'approved' };

    if (category) {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Post.countDocuments(query);

    const posts = await Post.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.status(200).json({
      success: true,
      count: posts.length,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      data: {
        posts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View your own posts and drafts
// @route   GET /posts/my-posts
// @access  Private
const getMyPosts = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { createdBy: req.user._id };
    if (status && ['draft', 'pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const posts = await Post.find(query)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: posts.length,
      data: {
        posts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View an approved post by ID (or own draft/pending/rejected post)
// @route   GET /posts/:id
// @access  Public (for approved) / Private (for own/admin view of unapproved)
const getPostById = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('createdBy', 'name email role');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    // If the post is approved, anyone can view it
    if (post.status === 'approved') {
      return res.status(200).json({
        success: true,
        data: {
          post,
        },
      });
    }

    // If not approved, verify if requester is creator or admin
    if (req.user) {
      const authorId = post.createdBy?._id ? post.createdBy._id.toString() : post.createdBy?.toString();
      const isOwner = authorId === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (isOwner || isAdmin) {
        return res.status(200).json({
          success: true,
          data: {
            post,
          },
        });
      }
    }

    // Otherwise forbidden
    return res.status(403).json({
      success: false,
      message: 'This post is awaiting approval or is not publicly visible.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update your own post
// @route   PATCH /posts/:id
// @access  Private
const updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    // Ensure user owns post or is admin
    const authorId = post.createdBy?._id ? post.createdBy._id.toString() : post.createdBy?.toString();
    const isOwner = authorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only update your own posts.',
      });
    }

    const { title, description, content, image, category, status } = req.body || {};

    if (title !== undefined) post.title = title;
    if (description !== undefined) post.description = description;
    if (content !== undefined) post.content = content;
    if (image !== undefined) post.image = image;
    if (category !== undefined) post.category = category;

    // Normal user can only switch status between 'draft' and 'pending'
    if (status !== undefined) {
      if (isAdmin) {
        if (['draft', 'pending', 'approved', 'rejected'].includes(status)) {
          post.status = status;
        }
      } else {
        if (['draft', 'pending'].includes(status)) {
          post.status = status;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Users can only set post status to "draft" or "pending".',
          });
        }
      }
    }

    const updatedPost = await post.save();
    const populated = await Post.findById(updatedPost._id).populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Post updated successfully.',
      data: {
        post: populated,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete your own post
// @route   DELETE /posts/:id
// @access  Private
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    // Check ownership or admin
    const authorId = post.createdBy?._id ? post.createdBy._id.toString() : post.createdBy?.toString();
    const isOwner = authorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only delete your own posts.',
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully.',
      data: {
        deletedPostId: req.params.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost,
  getApprovedPosts,
  getMyPosts,
  getPostById,
  updatePost,
  deletePost,
};
