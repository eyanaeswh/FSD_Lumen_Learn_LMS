# Lumen Learn — AI-Powered Learning Management System (MERN)

A full-stack LMS with student / instructor / admin roles, course & lesson management, enrollment with progress tracking, quizzes with graded results, completion certificates, category management, Cloudinary uploads and an in-lesson AI study assistant.

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, React Router, Axios (deploy: **Vercel**) |
| Backend | Node.js, Express 4, Mongoose (deploy: **Render**) |
| Database | MongoDB (local or **MongoDB Atlas**) |
| Auth | JWT (Bearer), bcrypt password hashing |
| Media | Cloudinary (course thumbnails, avatars, lesson attachments/video) |
| AI | GroqCloud chat completions API (server-side; demo fallback when no key) |
| Tests | Jest + Supertest + mongodb-memory-server, Postman collection |

## Features

- **Auth & RBAC** – register/login, JWT, `protect` + `authorize(...roles)` middleware; student and instructor self-registration, with admin signup protected by a server-configured key.
- **Student** – browse/search/filter courses, enroll, lesson player (text, YouTube/direct video, attachments), mark lessons complete, live progress %, earn and print completion certificates, take quizzes, review answers with explanations, result history, AI assistant.
- **Instructor** – create/edit/publish courses, upload thumbnails, add/edit/reorder lessons, build quizzes, **draft quiz questions with AI**, see enrolled students with progress and average scores, dashboard stats.
- **Admin** – platform stats, search/filter users, change roles, (de)activate or delete users, manage course categories and any course.
- **Security** – helmet, CORS allow-list, rate limiting (global, login, AI), ownership checks on every write, quiz answers never sent to students, lesson content gated behind enrollment.

## Project structure

```
lms/
├── backend/
│   ├── config/        db.js, cloudinary.js
│   ├── models/        User, Course, Category, Lesson, Enrollment, Quiz, Result
│   ├── middleware/    auth (protect/authorize), error, upload
│   ├── controllers/   auth, user, course, category, lesson, enrollment, quiz, ai, upload, stats
│   ├── routes/        index.js (all routes)
│   ├── tests/         api.test.js, lms.postman_collection.json
│   ├── app.js  server.js  seed.js
│   └── .env.example
├── frontend/
│   ├── src/           App, auth context, api client, components/, pages/
│   ├── vercel.json    SPA rewrite
│   └── .env.example
├── render.yaml
└── README.md
```

## Run locally

Prerequisites: Node 18+, a MongoDB instance (local or Atlas).

```bash
# 1. Backend
cd backend
cp .env.example .env        # set MONGO_URI, JWT_SECRET, ADMIN_SIGNUP_KEY and Razorpay test credentials
npm install
npm run seed                # demo users + sample course
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                 # http://localhost:5173
```

Demo logins after seeding: `admin@lms.com / admin123`, `instructor@lms.com / instructor123`, `student@lms.com / student123`.

To register an admin, set a private `ADMIN_SIGNUP_KEY` in the backend `.env`, restart the backend, then open `/admin-signup` and enter that key. The key must stay on the backend; never put it in a frontend environment variable or commit a real key. Admins log in from `/login`. If promoting an existing account, use that account's matching email and password with the signup key.

> `npm run seed` **wipes** all collections. Don't run it against production data.

## Environment variables (backend)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string (required) |
| `JWT_SECRET` | Long random string (required) |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `ADMIN_SIGNUP_KEY` | Long random secret required to create an admin through public signup (required for admin self-registration) |
| `RAZORPAY_KEY_ID` | Razorpay API key ID (needed for paid course checkout) |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret; keep this only in the backend environment |
| `CLIENT_URL` | Allowed frontend origin(s), comma-separated |
| `CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET` | Enables uploads (otherwise upload endpoints return 503) |
| `AI_API_KEY` | GroqCloud API key. Without it the assistant answers in demo mode |
| `AI_MODEL` | Groq model id (default `openai/gpt-oss-20b`) |

Frontend: `VITE_API_URL` (must end with `/api`).

Paid checkout uses Razorpay in INR. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the backend (use test credentials while developing). The secret must never be exposed in frontend environment variables. Admins can assign a free/paid status and price from the Administration dashboard; learners are enrolled in paid courses only after Razorpay reports a captured payment that passes server-side verification.

## API reference

All routes are prefixed with `/api`. 🔒 = JWT required.

| Method & path | Access | Description |
|---|---|---|
| `GET /health` | public | Health check |
| `POST /auth/register`, `POST /auth/login` | public | Returns `{ token, user }`; admin registration requires `ADMIN_SIGNUP_KEY` as `adminSignupKey`. Existing accounts can be promoted by using their matching email/password and the key. |
| `GET/PUT /auth/me`, `PUT /auth/password` | 🔒 any | Profile & password |
| `GET /users`, `PUT /users/:id`, `DELETE /users/:id` | admin | User management |
| `GET /categories` | public | Course category names |
| `GET /categories/manage`, `POST /categories`, `PUT/DELETE /categories/:id` | admin | Manage categories; renaming updates matching courses, deletion is blocked while courses still use it |
| `GET /courses` | public | Published courses; `search, category, level, page, limit` |
| `GET /courses/mine` | instructor, admin | Own courses (admin: all) |
| `GET /courses/:id` | public* | Details + lesson titles + quiz summaries (*drafts: owner/admin; enrolled learners can still access unpublished courses) |
| `PUT /courses/:id/pricing` | admin | `{ isPaid, price }` where `price` is INR (free courses use `0`) |
| `POST /courses` | instructor, admin | Create |
| `PUT/DELETE /courses/:id` | owner, admin | Update / cascade delete; courses with payment records cannot be deleted |
| `GET /courses/:courseId/lessons` | enrolled, owner, admin | Full lesson content |
| `POST /courses/:courseId/lessons` | owner, admin | Add lesson |
| `GET /lessons/:id`, `PUT`, `DELETE` | enrolled / owner, admin | Single lesson |
| `POST /payments/order`, `POST /payments/verify` | student | Create a Razorpay order and verify captured payment before paid-course enrollment |
| `POST /enrollments` | student | `{ courseId }`; free courses only |
| `GET /enrollments/mine` | 🔒 | My courses + progress |
| `GET /enrollments/course/:courseId` | 🔒 | My enrollment for a course |
| `GET /enrollments/course/:courseId/certificate` | student | Certificate when all course lessons are complete |
| `DELETE /enrollments/:courseId` | student | Unenroll |
| `POST/DELETE /enrollments/:courseId/lessons/:lessonId/complete` | student | Mark done / undo → recalculates progress |
| `GET /enrollments/course/:courseId/students` | owner, admin | Learner progress & scores |
| `POST /quizzes` | owner, admin | `{ course, title, passMark, questions[] }` |
| `GET /quizzes/course/:courseId`, `GET /quizzes/:id` | enrolled / staff | Students get questions **without** answers |
| `PUT/DELETE /quizzes/:id` | owner, admin | Edit / delete |
| `POST /quizzes/:id/submit` | student | `{ answers: [..] }` → graded result + review |
| `GET /quizzes/results/mine` | 🔒 | My results |
| `GET /quizzes/:id/results` | owner, admin | All results for a quiz |
| `POST /ai/chat` | 🔒 | `{ message, courseId?, lessonId?, history? }` |
| `POST /ai/generate-quiz` | owner, admin | `{ courseId, topic?, lessonId?, count? }` |
| `POST /upload/image`, `POST /upload/file` | 🔒 / staff | multipart field `file` → Cloudinary |
| `GET /stats/admin`, `GET /stats/instructor` | admin / instructor | Dashboard numbers |

## Testing

```bash
cd backend
npm test        # Jest + Supertest against an in-memory MongoDB
```

The suite covers registration & privilege-escalation protection, RBAC, draft visibility, enrollment gating, progress maths and certificate eligibility, quiz grading, hidden answers, AI demo mode, upload guard, category management, admin actions and cascade deletes.
(`mongodb-memory-server` downloads a MongoDB binary on first run, so it needs internet access once.)

For manual testing import `backend/tests/lms.postman_collection.json` into Postman. Log in with a seeded user first — the login request stores the token in a collection variable.

## Deployment

### 1. Database — MongoDB Atlas
Create a free cluster, add a database user, allow network access (`0.0.0.0/0` for Render), copy the connection string as `MONGO_URI`.

### 2. Backend — Render
1. Push this repo to GitHub.
2. Render → **New → Blueprint** (uses `render.yaml`) or **New → Web Service** with root directory `backend`, build `npm install`, start `npm start`.
3. Set env vars: `MONGO_URI`, `CLIENT_URL` (your Vercel URL, add it after step 3), Cloudinary keys, `AI_API_KEY`.
4. Verify `https://<service>.onrender.com/api/health`.
5. Optional: run `npm run seed` once from the Render shell to create demo data.

### 3. Frontend — Vercel
1. Vercel → **Add New Project** → import the repo, set **Root Directory** to `frontend` (framework: Vite).
2. Environment variable: `VITE_API_URL=https://<service>.onrender.com/api`.
3. Deploy, then put the Vercel URL into `CLIENT_URL` on Render (comma-separate if you also want to allow preview URLs) and redeploy the API.

Render's free tier sleeps when idle; the first request after a pause can take ~30–60 s.

## Git & GitHub

```bash
git init
git add .
git commit -m "feat: AI-powered LMS (MERN)"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## Notes & possible extensions
- Payments, discussion threads, and email notifications aren't included.
- Lesson order is edited with up/down buttons; drag-and-drop would be a nice upgrade.
- Cloudinary assets are deleted when a course/lesson is removed or its file is replaced.
