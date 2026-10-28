const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const app = require('../src/app');

// In-memory mock data stores
const mockUsers = [];
const mockPosts = [];

const runTests = async () => {
  console.log('====================================================');
  console.log("   Akatsuki’s Draft API Integration & Unit Tests    ");
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  };

  // Setup Model Mocking
  const originalUserCreate = User.create;
  const originalUserFindOne = User.findOne;
  const originalUserFindById = User.findById;

  const originalPostCreate = Post.create;
  const originalPostFind = Post.find;
  const originalPostFindById = Post.findById;
  const originalPostCountDocuments = Post.countDocuments;
  const originalPostFindByIdAndDelete = Post.findByIdAndDelete;

  try {
    // Mock User Model
    User.create = async function (userData) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      const userDoc = {
        _id: 'user_' + (mockUsers.length + 1),
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        role: userData.role || 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        matchPassword: async function (candidate) {
          return bcrypt.compare(candidate, this.password);
        },
        toJSON: function () {
          const copy = { ...this };
          delete copy.password;
          delete copy.matchPassword;
          delete copy.toJSON;
          return copy;
        },
      };
      mockUsers.push(userDoc);
      return userDoc;
    };

    User.findOne = function (query) {
      const execPromise = async () => {
        const found = mockUsers.find((u) => u.email === query.email);
        if (!found) return null;
        return {
          ...found,
          matchPassword: found.matchPassword,
          toJSON: found.toJSON,
        };
      };

      return {
        select: function () {
          return {
            then: (resolve, reject) => execPromise().then(resolve, reject),
          };
        },
        then: (resolve, reject) => execPromise().then(resolve, reject),
      };
    };

    User.findById = function (id) {
      const execPromise = async () => {
        const found = mockUsers.find((u) => u._id.toString() === id.toString());
        if (!found) return null;
        return {
          ...found,
          matchPassword: found.matchPassword,
          toJSON: found.toJSON,
        };
      };

      return {
        select: function () {
          return {
            then: (resolve, reject) => execPromise().then(resolve, reject),
          };
        },
        then: (resolve, reject) => execPromise().then(resolve, reject),
      };
    };

    // Mock Post Model
    Post.create = async function (postData) {
      const postDoc = {
        _id: 'post_' + (mockPosts.length + 1),
        title: postData.title,
        description: postData.description,
        content: postData.content,
        image: postData.image || '',
        category: postData.category,
        createdBy: postData.createdBy,
        status: postData.status || 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async function () {
          return this;
        },
      };
      mockPosts.push(postDoc);
      return postDoc;
    };

    Post.find = function (query = {}) {
      const execute = async () => {
        let results = [...mockPosts];
        if (query.status) {
          results = results.filter((p) => p.status === query.status);
        }
        if (query.createdBy) {
          results = results.filter((p) => p.createdBy.toString() === query.createdBy.toString());
        }
        if (query.category) {
          results = results.filter((p) =>
            new RegExp(query.category).test(p.category)
          );
        }
        return results;
      };

      const chain = {
        populate: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        then: (resolve, reject) => execute().then(resolve, reject),
      };
      return chain;
    };

    Post.findById = function (id) {
      const execute = async () => {
        const found = mockPosts.find((p) => p._id.toString() === id.toString());
        if (!found) return null;
        return {
          ...found,
          save: async function () {
            const idx = mockPosts.findIndex((p) => p._id.toString() === id.toString());
            if (idx !== -1) {
              mockPosts[idx] = { ...this };
            }
            return this;
          },
        };
      };

      const chain = {
        populate: () => chain,
        then: (resolve, reject) => execute().then(resolve, reject),
      };
      return chain;
    };

    Post.countDocuments = async function (query = {}) {
      let results = [...mockPosts];
      if (query.status) {
        results = results.filter((p) => p.status === query.status);
      }
      return results.length;
    };

    Post.findByIdAndDelete = async function (id) {
      const idx = mockPosts.findIndex((p) => p._id.toString() === id.toString());
      if (idx !== -1) {
        return mockPosts.splice(idx, 1)[0];
      }
      return null;
    };

    // ----------------------------------------------------
    // 1. Health Check
    // ----------------------------------------------------
    console.log('[1] Testing System & Root Route');
    const health = await request(app).get('/');
    assert(health.status === 200 && health.body.success === true, 'GET / returns API overview & endpoints');

    // ----------------------------------------------------
    // 2. Authentication
    // ----------------------------------------------------
    console.log('\n[2] Testing Authentication Endpoints');

    // Register User
    const regUser = await request(app)
      .post('/auth/register')
      .send({
        name: 'Itachi Uchiha',
        email: 'itachi@akatsuki.dev',
        password: 'CrowIllusion2026',
        role: 'user',
      });
    assert(regUser.status === 201 && regUser.body.data.token, 'POST /auth/register creates user and returns JWT');
    const userToken = regUser.body.data.token;
    const userId = regUser.body.data.user._id;

    // Register duplicate email rejection
    const regDup = await request(app)
      .post('/auth/register')
      .send({
        name: 'Itachi Imposter',
        email: 'itachi@akatsuki.dev',
        password: 'FakePassword123',
      });
    assert(regDup.status === 400, 'POST /auth/register rejects duplicate email with 400');

    // Register Admin
    const regAdmin = await request(app)
      .post('/auth/register')
      .send({
        name: 'Pain Leader',
        email: 'leader@akatsuki.dev',
        password: 'AlmightyPush123',
        role: 'admin',
      });
    assert(regAdmin.status === 201 && regAdmin.body.data.user.role === 'admin', 'POST /auth/register creates admin with role "admin"');
    const adminToken = regAdmin.body.data.token;

    // Login with valid credentials
    const loginOk = await request(app)
      .post('/auth/login')
      .send({
        email: 'itachi@akatsuki.dev',
        password: 'CrowIllusion2026',
      });
    assert(loginOk.status === 200 && loginOk.body.data.token, 'POST /auth/login returns token for valid credentials');

    // Login with invalid credentials
    const loginFail = await request(app)
      .post('/auth/login')
      .send({
        email: 'itachi@akatsuki.dev',
        password: 'WrongPassword',
      });
    assert(loginFail.status === 401, 'POST /auth/login rejects wrong password with 401');

    // GET /auth/me with Bearer token
    const getMeOk = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    assert(getMeOk.status === 200 && getMeOk.body.data.user.email === 'itachi@akatsuki.dev', 'GET /auth/me returns current user details');

    // GET /auth/me without token
    const getMeNoAuth = await request(app).get('/auth/me');
    assert(getMeNoAuth.status === 401, 'GET /auth/me denies unauthenticated access with 401');

    // ----------------------------------------------------
    // 3. User — Post Management
    // ----------------------------------------------------
    console.log('\n[3] Testing User Post Management');

    // Create Draft Post
    const createDraftRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Reflections on Peace and Sacrifice',
        description: 'Personal notes on village harmony',
        content: 'True peace cannot exist without understanding the perspective of others.',
        category: 'Philosophy',
        status: 'draft',
      });
    assert(createDraftRes.status === 201 && createDraftRes.body.data.post.status === 'draft', 'POST /posts creates post with status "draft"');
    const draftId = createDraftRes.body.data.post._id;

    // Create Pending Post
    const createPendingRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Sharingan Dynamics and Optical Phenomena',
        description: 'Comprehensive study of ocular jutsu',
        content: 'The ocular pathways trigger emotional resonances deep within the cerebral cortex.',
        category: 'Science',
        status: 'pending',
      });
    assert(createPendingRes.status === 201 && createPendingRes.body.data.post.status === 'pending', 'POST /posts creates post with status "pending"');
    const pendingId = createPendingRes.body.data.post._id;

    // View My Posts
    const myPostsRes = await request(app)
      .get('/posts/my-posts')
      .set('Authorization', `Bearer ${userToken}`);
    assert(myPostsRes.status === 200 && myPostsRes.body.count === 2, 'GET /posts/my-posts returns all authored posts & drafts');

    // View public posts (only approved posts should be returned)
    const publicPostsInit = await request(app).get('/posts');
    assert(publicPostsInit.status === 200 && publicPostsInit.body.count === 0, 'GET /posts does NOT expose drafts or pending posts to the public');

    // View post by ID
    const getDraftById = await request(app)
      .get(`/posts/${draftId}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert(getDraftById.status === 200 && getDraftById.body.data.post._id === draftId, 'GET /posts/:id allows owner to view own draft');

    // ----------------------------------------------------
    // 4. Admin — Post Approval
    // ----------------------------------------------------
    console.log('\n[4] Testing Admin Post Approval Workflow');

    // Admin view pending posts
    const pendingList = await request(app)
      .get('/admin/posts/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(pendingList.status === 200 && pendingList.body.count === 1, 'GET /admin/posts/pending lists submitted pending posts');

    // Non-admin attempting to access pending posts
    const nonAdminPending = await request(app)
      .get('/admin/posts/pending')
      .set('Authorization', `Bearer ${userToken}`);
    assert(nonAdminPending.status === 403, 'GET /admin/posts/pending denies non-admin user with 403');

    // Admin approve post
    const approveRes = await request(app)
      .patch(`/admin/posts/approve/${pendingId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(approveRes.status === 200 && approveRes.body.data.post.status === 'approved', 'PATCH /admin/posts/approve/:id approves post');

    // Verify post is now publicly visible
    const publicPostsAfterApprove = await request(app).get('/posts');
    assert(publicPostsAfterApprove.status === 200 && publicPostsAfterApprove.body.count === 1, 'GET /posts now lists the newly approved post publicly');

    // Admin reject a post
    // Create an unapproved post first
    const badPost = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Spam or Offensive Content',
        description: 'Inappropriate material',
        content: 'Content that violates guidelines.',
        category: 'Spam',
        status: 'pending',
      });
    const badPostId = badPost.body.data.post._id;

    const rejectRes = await request(app)
      .patch(`/admin/posts/reject/${badPostId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(rejectRes.status === 200 && rejectRes.body.data.post.status === 'rejected', 'PATCH /admin/posts/reject/:id sets status to "rejected"');

    // ----------------------------------------------------
    // 5. User Update & Delete
    // ----------------------------------------------------
    console.log('\n[5] Testing User Update & Delete');

    // User updates their draft
    const updateRes = await request(app)
      .patch(`/posts/${draftId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Reflections on Peace and Sacrifice (Polished Edition)',
      });
    assert(updateRes.status === 200 && updateRes.body.data.post.title.includes('Polished Edition'), 'PATCH /posts/:id updates post attributes');

    // User cannot update another user's post
    const anotherUserToken = jwt.sign(
      { id: 'user_999' },
      process.env.JWT_SECRET || 'super_secret_jwt_key_akatsuki_draft_2026'
    );
    mockUsers.push({
      _id: 'user_999',
      name: 'Stranger',
      email: 'stranger@akatsuki.dev',
      role: 'user',
    });

    const unauthorizedUpdate = await request(app)
      .patch(`/posts/${draftId}`)
      .set('Authorization', `Bearer ${anotherUserToken}`)
      .send({ title: 'Hacked Title' });
    assert(unauthorizedUpdate.status === 403, 'PATCH /posts/:id forbids non-owners with 403');

    // User deletes rejected post
    const deleteRes = await request(app)
      .delete(`/posts/${badPostId}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert(deleteRes.status === 200, 'DELETE /posts/:id allows owner to delete post');

    // ----------------------------------------------------
    // 6. AI Integration — Content Improvement
    // ----------------------------------------------------
    console.log('\n[6] Testing AI Content Improvement Endpoint');

    const originalDraftPreImprove = await request(app)
      .get(`/posts/${draftId}`)
      .set('Authorization', `Bearer ${userToken}`);

    const aiRes = await request(app)
      .post(`/ai/improve/${draftId}`)
      .set('Authorization', `Bearer ${userToken}`);

    assert(aiRes.status === 201, 'POST /ai/improve/:postId returns 201 Created');
    assert(aiRes.body.data.newDraft._id !== draftId, 'AI-improved draft receives a NEW distinct post ID');
    assert(aiRes.body.data.newDraft.status === 'draft', 'AI-improved version is saved with status "draft"');
    assert(aiRes.body.data.newDraft.createdBy.toString() === userId.toString(), 'New draft is owned by the SAME user');

    // Verify original draft is preserved untouched
    const originalDraftPostImprove = await request(app)
      .get(`/posts/${draftId}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert(
      originalDraftPostImprove.body.data.post.title === originalDraftPreImprove.body.data.post.title &&
      originalDraftPostImprove.body.data.post.content === originalDraftPreImprove.body.data.post.content,
      'Original draft remains completely preserved and untouched'
    );

    console.log('\n====================================================');
    console.log(` Test Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Restore original methods
    User.create = originalUserCreate;
    User.findOne = originalUserFindOne;
    User.findById = originalUserFindById;
    Post.create = originalPostCreate;
    Post.find = originalPostFind;
    Post.findById = originalPostFindById;
    Post.countDocuments = originalPostCountDocuments;
    Post.findByIdAndDelete = originalPostFindByIdAndDelete;
  }
};

runTests();
