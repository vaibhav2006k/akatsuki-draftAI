# Akatsuki’s Draft: AI-Enabled Content Sharing Platform (Backend)

Akatsuki's Draft is a content creation, refinement, and publishing backend built with Node.js, Express, MongoDB, JWT authentication, and AI integration.

The platform provides an end-to-end editorial pipeline:
1. **Secure Registration & Login** using JWT and bcrypt.
2. **Drafting & Post Management** for creators to write, update, and manage their content.
3. **AI-Powered Content Improvement** which enhances post titles, descriptions, and content, saving the polished version as a new draft under the same user while preserving the original draft.
4. **Editorial Admin Approval Workflow** where posts submitted for review (`pending`) are moderated by admins (`approved` or `rejected`) before becoming publicly accessible.

---

## 🏗️ Architecture & Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB via Mongoose
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **AI Integration**: Google Gemini API (`@google/genai`) with fallback heuristic enhancement
- **CORS & Logging**: `cors`, `morgan`

### Directory Structure

```
├── src/
│   ├── app.js               # Express app, middleware configuration, routes mount
│   ├── config/
│   │   ├── db.js            # MongoDB connection
│   │   └── ai.js            # Gemini AI client & fallback enhancement engine
│   ├── controllers/
│   │   ├── authController.js# Registration, login, current user (/auth/me)
│   │   ├── postController.js# User post CRUD and public feed
│   │   ├── adminController.js# Admin moderation (pending list, approve, reject)
│   │   └── aiController.js  # AI content enhancement
│   ├── middlewares/
│   │   ├── auth.js          # JWT verification & role authorization (verifyToken, requireAdmin)
│   │   └── errorHandler.js  # Centralized error handler
│   ├── models/
│   │   ├── User.js          # User schema (name, email, password, role)
│   │   └── Post.js          # Post schema (title, description, content, image, category, createdBy, status)
│   └── routes/
│       ├── authRoutes.js    # /auth
│       ├── postRoutes.js    # /posts
│       ├── adminRoutes.js   # /admin
│       └── aiRoutes.js      # /ai
├── tests/
│   └── testSuite.js         # Integration tests
├── .env.example             # Template environment variables
├── package.json
├── server.js                # Server entry point
└── README.md
```

---

## 📊 Database Schema Design

### 1. User Schema

| Field | Type | Options | Description |
| :--- | :--- | :--- | :--- |
| `name` | String | required, trim, min: 2, max: 50 | User's full name |
| `email` | String | required, unique, lowercase, regex validated | Email address for login |
| `password` | String | required, min: 6, select: false | Hashed with bcrypt |
| `role` | String | enum: `["admin", "user"]`, default: `"user"` | Authorization role |
| `createdAt` / `updatedAt` | Date | timestamps: true | Managed automatically |

### 2. Post Schema

| Field | Type | Options | Description |
| :--- | :--- | :--- | :--- |
| `title` | String | required, trim, max: 200 | Post title |
| `description`| String | required, trim, max: 500 | Short teaser / summary |
| `content` | String | required | Full post body (Markdown / HTML / text) |
| `image` | String | optional, default: `""` | Featured image URL |
| `category` | String | required, trim | Content category (e.g., Tech, Philosophy) |
| `createdBy` | ObjectId | required, ref: `'User'` | Reference to author user |
| `status` | String | enum: `["draft", "pending", "approved", "rejected"]`, default: `"draft"` | Publication lifecycle status |
| `createdAt` / `updatedAt` | Date | timestamps: true | Managed automatically |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MongoDB instance (local or MongoDB Atlas connection string)
- *(Optional)* Gemini API Key for live AI generation

### 2. Installation

```bash
git clone <repo-url>
cd akatsukis-draft
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and configure:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/akatsuki_draft
JWT_SECRET=super_secret_jwt_key_akatsuki_draft_2026
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note**: If `GEMINI_API_KEY` is not provided, the server seamlessly utilizes a built-in content enhancement engine, ensuring zero downtime and fully functioning endpoints during local testing.

### 4. Running the Server

- **Production Mode**:
  ```bash
  npm start
  ```
- **Development Mode** (with file watch):
  ```bash
  npm run dev
  ```

---

## 📡 Complete API Reference

All requests expecting or sending JSON must include `Content-Type: application/json`.
Protected endpoints require `Authorization: Bearer <token>`.

### 1. Authentication

#### `POST /auth/register`
Register a new user account.
- **Access**: Public
- **Body**:
  ```json
  {
    "name": "Nagato",
    "email": "nagato@akatsuki.org",
    "password": "Password123",
    "role": "user"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "data": {
      "user": {
        "_id": "67be00...",
        "name": "Nagato",
        "email": "nagato@akatsuki.org",
        "role": "user",
        "createdAt": "2026-10-27T13:30:00.000Z"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

#### `POST /auth/login`
Log in to an existing account and obtain a JWT token.
- **Access**: Public
- **Body**:
  ```json
  {
    "email": "nagato@akatsuki.org",
    "password": "Password123"
  }
  ```
- **Response** (`200 OK`): Returns `token` and `user` object.

#### `GET /auth/me`
Retrieve currently logged-in user profile.
- **Access**: Private (Authenticated User)
- **Header**: `Authorization: Bearer <token>`
- **Response** (`200 OK`): User details without password.

---

### 2. User — Post Management

#### `POST /posts`
Create a new post as a `draft` or submit directly as `pending` for admin review.
- **Access**: Private
- **Header**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "title": "Path of Peace",
    "description": "Understanding cycles of pain and empathy",
    "content": "To understand peace, one must first recognize the interconnectedness of human experience.",
    "category": "Philosophy",
    "image": "https://example.com/peace.jpg",
    "status": "draft"
  }
  ```
  *(Status defaults to `"draft"` if omitted. Regular users can set `"draft"` or `"pending"`).*
- **Response** (`201 Created`)

#### `GET /posts`
View all approved posts (public feed).
- **Access**: Public
- **Query Parameters**:
  - `category` (optional, case-insensitive)
  - `search` (optional, searches title, description, content)
  - `page` (default: 1)
  - `limit` (default: 10)
- **Response** (`200 OK`): List of posts with `status: "approved"`.

#### `GET /posts/my-posts`
View all posts and drafts authored by the authenticated user.
- **Access**: Private
- **Header**: `Authorization: Bearer <token>`
- **Query Parameters**: `status` (optional filter: `draft`, `pending`, `approved`, `rejected`)
- **Response** (`200 OK`): Array of user's posts.

#### `GET /posts/:id`
View a post by ID.
- **Access**: Public (if post is `approved`). If post is `draft`, `pending`, or `rejected`, only the creator or an admin can view it.
- **Response** (`200 OK`): Post object.

#### `PATCH /posts/:id`
Update an existing post or draft authored by the user.
- **Access**: Private (Post author or Admin)
- **Header**: `Authorization: Bearer <token>`
- **Body**: Any modifiable fields (`title`, `description`, `content`, `image`, `category`, `status`). Regular users can set `status` to `"draft"` or `"pending"`.
- **Response** (`200 OK`): Updated post object.

#### `DELETE /posts/:id`
Delete an existing post authored by the user.
- **Access**: Private (Post author or Admin)
- **Header**: `Authorization: Bearer <token>`
- **Response** (`200 OK`)

---

### 3. Admin — Post Approval

#### `GET /admin/posts/pending`
View all posts awaiting editorial approval.
- **Access**: Private (Admin only, `role === "admin"`)
- **Header**: `Authorization: Bearer <admin-token>`
- **Response** (`200 OK`): List of pending posts with author details populated.

#### `PATCH /admin/posts/approve/:id`
Approve a submitted post, making it publicly visible on `GET /posts`.
- **Access**: Private (Admin only)
- **Header**: `Authorization: Bearer <admin-token>`
- **Response** (`200 OK`): Post with updated status `"approved"`.

#### `PATCH /admin/posts/reject/:id`
Reject a submitted post.
- **Access**: Private (Admin only)
- **Header**: `Authorization: Bearer <admin-token>`
- **Response** (`200 OK`): Post with updated status `"rejected"`.

---

### 4. AI Integration — Content Improvement

#### `POST /ai/improve/:postId`
Enhances post title, description, and content using AI (Google Gemini).
**Crucial Behavior**:
- Creates a **brand new draft** with a **new `_id`** under the same user.
- Sets status of the new post to `"draft"`.
- **Preserves the original post completely intact** with its original `_id` and status.
- **Access**: Private (Post author or Admin)
- **Header**: `Authorization: Bearer <token>`
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Post content improved by AI and saved as a new draft while preserving the original.",
    "data": {
      "originalPost": {
        "id": "67be01...",
        "title": "Path of Peace",
        "status": "draft"
      },
      "newDraft": {
        "_id": "67be02...",
        "title": "Enhanced: Path of Peace",
        "description": "Understanding cycles of pain and empathy — Refined for higher engagement, clarity, and thematic depth in Philosophy.",
        "content": "### Overview\nTo understand peace...",
        "category": "Philosophy",
        "status": "draft",
        "createdBy": { ... },
        "createdAt": "2026-10-27T13:40:00.000Z"
      },
      "aiMeta": {
        "provider": "google-gemini",
        "summary": "AI-improved phrasing, engagement, and structure."
      }
    }
  }
  ```

---

## 🧪 Testing

Run the automated integration test suite:

```bash
npm test
```

The test suite runs against in-memory MongoDB and covers:
- User & Admin registration and login
- User JWT verification (`/auth/me`)
- Post & draft creation (`POST /posts`)
- Fetching author's posts (`GET /posts/my-posts`)
- Admin moderation permissions (`/admin/posts/pending`, approve, reject)
- AI content enhancement preserving original draft (`POST /ai/improve/:postId`)
- Post update and deletion
