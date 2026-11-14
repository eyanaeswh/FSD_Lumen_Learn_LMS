process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.ADMIN_SIGNUP_KEY = 'test-admin-key';
process.env.RAZORPAY_KEY_ID = 'test-razorpay-key';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';
process.env.AI_API_KEY = ''; // force demo mode

const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');

let mongod;
const tokens = {};
let courseId, lessonId, lesson2Id, quizId;

const api = () => request(app);
const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await User.init();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Auth', () => {
  test('registers student and instructor and requires the admin signup key', async () => {
    const s = await api().post('/api/auth/register').send({ name: 'S', email: 's@t.com', password: 'secret1' });
    expect(s.status).toBe(201);
    expect(s.body.user.role).toBe('student');
    tokens.student = s.body.token;

    const i = await api().post('/api/auth/register').send({ name: 'I', email: 'i@t.com', password: 'secret1', role: 'instructor' });
    expect(i.body.user.role).toBe('instructor');
    tokens.instructor = i.body.token;

    const existing = await api().post('/api/auth/register').send({ name: 'A', email: 'a@t.com', password: 'secret1' });
    expect(existing.body.user.role).toBe('student');
    const denied = await api().post('/api/auth/register').send({ name: 'A', email: 'a@t.com', password: 'secret1', role: 'admin' });
    expect(denied.status).toBe(403);
    expect((await User.findOne({ email: 'a@t.com' })).role).toBe('student');

    const invalidKey = await api().post('/api/auth/register').send({
      name: 'A', email: 'a@t.com', password: 'secret1', role: 'admin', adminSignupKey: 'wrong-key',
    });
    expect(invalidKey.status).toBe(403);
    expect((await User.findOne({ email: 'a@t.com' })).role).toBe('student');

    const a = await api().post('/api/auth/register').send({
      name: 'A', email: 'a@t.com', password: 'secret1', role: 'admin', adminSignupKey: process.env.ADMIN_SIGNUP_KEY,
    });
    expect(a.status).toBe(200);
    expect(a.body.user.role).toBe('admin');
    tokens.admin = a.body.token;

    const invalidPassword = await api().post('/api/auth/register').send({
      name: 'A', email: 'a@t.com', password: 'wrong1', role: 'admin', adminSignupKey: process.env.ADMIN_SIGNUP_KEY,
    });
    expect(invalidPassword.status).toBe(409);
  });

  test('rejects duplicate email, bad login and missing token', async () => {
    expect((await api().post('/api/auth/register').send({ name: 'x', email: 's@t.com', password: 'secret1' })).status).toBe(409);
    expect((await api().post('/api/auth/login').send({ email: 's@t.com', password: 'wrong' })).status).toBe(401);
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(auth('student'))).body.user.email).toBe('s@t.com');
  });
});

describe('Role-based authorization', () => {
  test('students cannot create courses; admin routes are admin-only', async () => {
    expect((await api().post('/api/courses').set(auth('student')).send({ title: 'x', description: 'y' })).status).toBe(403);
    expect((await api().get('/api/users').set(auth('instructor'))).status).toBe(403);
    const list = await api().get('/api/users').set(auth('admin'));
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(3);
  });
});

describe('Courses & lessons', () => {
  test('instructor creates a course (draft hidden from public until published)', async () => {
    const res = await api().post('/api/courses').set(auth('instructor')).send({ title: 'Node 101', description: 'Learn Node', category: 'Programming' });
    expect(res.status).toBe(201);
    courseId = res.body.course._id;
    expect((await api().get('/api/courses')).body.total).toBe(0);
    expect((await api().get(`/api/courses/${courseId}`)).status).toBe(404);

    await api().put(`/api/courses/${courseId}`).set(auth('instructor')).send({ isPublished: true });
    expect((await api().get('/api/courses')).body.total).toBe(1);
  });

  test('admin controls course pricing and instructors cannot change it', async () => {
    const denied = await api().put(`/api/courses/${courseId}/pricing`).set(auth('instructor')).send({ isPaid: true, price: 20 });
    expect(denied.status).toBe(403);

    const updated = await api().put(`/api/courses/${courseId}/pricing`).set(auth('admin')).send({ isPaid: true, price: 12.34 });
    expect(updated.status).toBe(200);
    expect(updated.body.course.isPaid).toBe(true);
    expect(updated.body.course.price).toBe(12.34);
    expect((await api().put(`/api/courses/${courseId}/pricing`).set(auth('admin')).send({ isPaid: true, price: 0 })).status).toBe(400);
  });

  test('adds lessons; lesson content is gated behind enrollment', async () => {
    const l1 = await api().post(`/api/courses/${courseId}/lessons`).set(auth('instructor')).send({ title: 'Intro', content: 'Node is a runtime' });
    const l2 = await api().post(`/api/courses/${courseId}/lessons`).set(auth('instructor')).send({ title: 'Modules', content: 'require() and import' });
    lessonId = l1.body.lesson._id;
    lesson2Id = l2.body.lesson._id;
    expect((await api().get(`/api/lessons/${lessonId}`).set(auth('student'))).status).toBe(403);
    expect((await api().get(`/api/lessons/${lessonId}`).set(auth('instructor'))).status).toBe(200);
  });

  test('another instructor cannot modify the course', async () => {
    const other = await api().post('/api/auth/register').send({ name: 'O', email: 'o@t.com', password: 'secret1', role: 'instructor' });
    const res = await api().put(`/api/courses/${courseId}`).set({ Authorization: `Bearer ${other.body.token}` }).send({ title: 'hack' });
    expect(res.status).toBe(403);
  });
});

describe('Enrollment & progress', () => {
  test('student enrolls once and tracks progress', async () => {
    expect((await api().post('/api/enrollments').set(auth('student')).send({ courseId })).status).toBe(402);

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url) => {
      if (url.endsWith('/orders')) {
        return { ok: true, status: 200, json: async () => ({ id: 'order_test_1', amount: 1234, currency: 'INR' }) };
      }
      if (url.endsWith('/payments/pay_test_1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'pay_test_1',
            order_id: 'order_test_1',
            amount: 1234,
            currency: 'INR',
            status: 'captured',
            captured: true,
          }),
        };
      }
      throw new Error(`Unexpected Razorpay request: ${url}`);
    });
    try {
      const order = await api().post('/api/payments/order').set(auth('student')).send({ courseId });
      expect(order.status).toBe(201);
      expect(order.body.order.amount).toBe(1234);

      const invalid = await api().post('/api/payments/verify').set(auth('student')).send({
        razorpay_order_id: 'order_test_1',
        razorpay_payment_id: 'pay_test_1',
        razorpay_signature: 'f'.repeat(64),
      });
      expect(invalid.status).toBe(400);

      const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update('order_test_1|pay_test_1')
        .digest('hex');
      const verified = await api().post('/api/payments/verify').set(auth('student')).send({
        razorpay_order_id: 'order_test_1',
        razorpay_payment_id: 'pay_test_1',
        razorpay_signature: signature,
      });
      expect(verified.status).toBe(201);
      expect(verified.body.enrollment.course).toBe(courseId);

      await api().put(`/api/courses/${courseId}`).set(auth('instructor')).send({ isPublished: false });
      expect((await api().get(`/api/courses/${courseId}`).set(auth('student'))).status).toBe(200);
      await api().put(`/api/courses/${courseId}`).set(auth('instructor')).send({ isPublished: true });
    } finally {
      global.fetch = originalFetch;
    }

    expect((await api().post('/api/enrollments').set(auth('student')).send({ courseId })).status).toBe(409);
    expect((await api().get(`/api/lessons/${lessonId}`).set(auth('student'))).status).toBe(200);

    let r = await api().post(`/api/enrollments/${courseId}/lessons/${lessonId}/complete`).set(auth('student'));
    expect(r.body.enrollment.progress).toBe(50);
    expect((await api().get(`/api/enrollments/course/${courseId}/certificate`).set(auth('student'))).status).toBe(403);
    r = await api().post(`/api/enrollments/${courseId}/lessons/${lesson2Id}/complete`).set(auth('student'));
    expect(r.body.enrollment.progress).toBe(100);
    expect(r.body.enrollment.completedAt).toBeTruthy();
    const certificate = await api().get(`/api/enrollments/course/${courseId}/certificate`).set(auth('student'));
    expect(certificate.status).toBe(200);
    expect(certificate.body.certificate.courseTitle).toBe('Node 101');
    expect(certificate.body.certificate.studentName).toBe('S');
    r = await api().delete(`/api/enrollments/${courseId}/lessons/${lesson2Id}/complete`).set(auth('student'));
    expect(r.body.enrollment.progress).toBe(50);
    expect((await api().get(`/api/enrollments/course/${courseId}/certificate`).set(auth('student'))).status).toBe(403);

    const mine = await api().get('/api/enrollments/mine').set(auth('student'));
    expect(mine.body.enrollments[0].totalLessons).toBe(2);
  });
});

describe('Quizzes & results', () => {
  test('instructor creates quiz; students never see answers', async () => {
    const res = await api().post('/api/quizzes').set(auth('instructor')).send({
      course: courseId,
      title: 'Node quiz',
      passMark: 50,
      questions: [
        { text: 'Q1', options: ['a', 'b'], correctIndex: 1 },
        { text: 'Q2', options: ['a', 'b', 'c'], correctIndex: 0 },
      ],
    });
    expect(res.status).toBe(201);
    quizId = res.body.quiz._id;
    const view = await api().get(`/api/quizzes/${quizId}`).set(auth('student'));
    expect(view.body.quiz.questions[0].correctIndex).toBeUndefined();
  });

  test('rejects an invalid correctIndex', async () => {
    const res = await api().post('/api/quizzes').set(auth('instructor')).send({
      course: courseId, title: 'bad', questions: [{ text: 'Q', options: ['a', 'b'], correctIndex: 5 }],
    });
    expect(res.status).toBe(400);
  });

  test('grades a submission and stores the result', async () => {
    const res = await api().post(`/api/quizzes/${quizId}/submit`).set(auth('student')).send({ answers: [1, 1] });
    expect(res.status).toBe(201);
    expect(res.body.result.score).toBe(1);
    expect(res.body.result.percentage).toBe(50);
    expect(res.body.result.passed).toBe(true);
    const mine = await api().get('/api/quizzes/results/mine').set(auth('student'));
    expect(mine.body.results).toHaveLength(1);
    const staffView = await api().get(`/api/quizzes/${quizId}/results`).set(auth('instructor'));
    expect(staffView.body.results).toHaveLength(1);
  });

  test('wrong answer-array length is rejected', async () => {
    expect((await api().post(`/api/quizzes/${quizId}/submit`).set(auth('student')).send({ answers: [1] })).status).toBe(400);
  });
});

describe('AI assistant & uploads', () => {
  test('chat works in demo mode for enrolled students', async () => {
    const res = await api().post('/api/ai/chat').set(auth('student')).send({ message: 'Explain modules', lessonId });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('demo');
    expect(res.body.reply).toMatch(/Modules|Intro/);
  });

  test('chat uses Groq chat completions when an API key is configured', async () => {
    const originalFetch = global.fetch;
    const originalKey = process.env.AI_API_KEY;
    const originalModel = process.env.AI_MODEL;
    process.env.AI_API_KEY = 'gsk_test';
    process.env.AI_MODEL = '';
    global.fetch = jest.fn(async (url, options) => {
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(options.headers.authorization).toBe('Bearer gsk_test');
      const body = JSON.parse(options.body);
      expect(body.model).toBe('openai/gpt-oss-20b');
      expect(body.max_completion_tokens).toBe(800);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[body.messages.length - 1]).toEqual({ role: 'user', content: 'Explain Groq' });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Groq response' } }] }),
      };
    });

    try {
      const res = await api().post('/api/ai/chat').set(auth('student')).send({ message: 'Explain Groq' });
      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('ai');
      expect(res.body.reply).toBe('Groq response');
    } finally {
      global.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = originalKey;
      if (originalModel === undefined) delete process.env.AI_MODEL;
      else process.env.AI_MODEL = originalModel;
    }
  });

  test('AI quiz generation parses Groq chat completion output', async () => {
    const originalFetch = global.fetch;
    const originalKey = process.env.AI_API_KEY;
    process.env.AI_API_KEY = 'gsk_test';
    global.fetch = jest.fn(async (_url, options) => {
      expect(options.headers.authorization).toBe('Bearer gsk_test');
      const body = JSON.parse(options.body);
      expect(body.max_completion_tokens).toBe(2000);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify([{ text: 'Question?', options: ['A', 'B'], correctIndex: 1, explanation: 'B' }]),
            },
          }],
        }),
      };
    });

    try {
      const res = await api().post('/api/ai/generate-quiz').set(auth('instructor')).send({ courseId });
      expect(res.status).toBe(200);
      expect(res.body.questions).toHaveLength(1);
      expect(res.body.questions[0].correctIndex).toBe(1);
    } finally {
      global.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = originalKey;
    }
  });

  test('chat requires auth and non-empty message', async () => {
    expect((await api().post('/api/ai/chat').send({ message: 'hi' })).status).toBe(401);
    expect((await api().post('/api/ai/chat').set(auth('student')).send({ message: '  ' })).status).toBe(400);
  });

  test('upload returns 503 when Cloudinary is not configured', async () => {
    const res = await api().post('/api/upload/image').set(auth('student')).attach('file', Buffer.from('x'), 'a.png');
    expect(res.status).toBe(503);
  });
});

describe('Admin', () => {
  test('stats and user management', async () => {
    const stats = await api().get('/api/stats/admin').set(auth('admin'));
    expect(stats.body.stats.courses).toBe(1);
    const users = await api().get('/api/users').set(auth('admin'));
    const student = users.body.users.find((u) => u.email === 's@t.com');
    const upd = await api().put(`/api/users/${student._id}`).set(auth('admin')).send({ isActive: false });
    expect(upd.body.user.isActive).toBe(false);
    expect((await api().get('/api/auth/me').set(auth('student'))).status).toBe(401); // deactivated
  });

  test('category management is admin-only and renames course categories', async () => {
    const denied = await api().post('/api/categories').set(auth('instructor')).send({ name: 'Web Dev' });
    expect(denied.status).toBe(403);
    const created = await api().post('/api/categories').set(auth('admin')).send({ name: 'Programming' });
    expect(created.status).toBe(201);
    const categoryId = created.body.category._id;
    const duplicate = await api().post('/api/categories').set(auth('admin')).send({ name: 'programming' });
    expect(duplicate.status).toBe(409);
    const rename = await api().put(`/api/categories/${categoryId}`).set(auth('admin')).send({ name: 'Web Development' });
    expect(rename.status).toBe(200);
    const Course = require('../models/Course');
    expect((await Course.findById(courseId)).category).toBe('Web Development');
    expect((await api().get('/api/courses')).body.categories).toContain('Web Development');
    expect((await api().delete(`/api/categories/${categoryId}`).set(auth('admin'))).status).toBe(409);
  });

  test('paid courses with payment history cannot be deleted; free course deletion cascades', async () => {
    const Lesson = require('../models/Lesson');
    expect((await api().delete(`/api/courses/${courseId}`).set(auth('instructor'))).status).toBe(409);
    expect(await Lesson.countDocuments({ course: courseId })).toBe(2);

    const free = await api().post('/api/courses').set(auth('instructor')).send({ title: 'Temporary', description: 'Temporary course' });
    const lesson = await api().post(`/api/courses/${free.body.course._id}/lessons`).set(auth('instructor')).send({ title: 'Temporary lesson' });
    expect((await api().delete(`/api/courses/${free.body.course._id}`).set(auth('instructor'))).status).toBe(200);
    expect(await Lesson.findById(lesson.body.lesson._id)).toBeNull();
  });
});
