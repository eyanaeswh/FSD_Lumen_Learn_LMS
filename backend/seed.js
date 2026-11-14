// Usage: npm run seed   — creates demo users, a course with lessons and a quiz.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Course = require('./models/Course');
const Lesson = require('./models/Lesson');
const Quiz = require('./models/Quiz');
const Enrollment = require('./models/Enrollment');
const Result = require('./models/Result');

(async () => {
  await connectDB();
  await Promise.all([User, Course, Lesson, Quiz, Enrollment, Result].map((m) => m.deleteMany({})));

  const admin = await User.create({ name: 'Admin', email: 'admin@lms.com', password: 'admin123', role: 'admin' });
  const instructor = await User.create({ name: 'Ira Instructor', email: 'instructor@lms.com', password: 'instructor123', role: 'instructor', bio: 'Full-stack developer and teacher.' });
  await User.create({ name: 'Sam Student', email: 'student@lms.com', password: 'student123', role: 'student' });

  const course = await Course.create({
    title: 'JavaScript Foundations',
    description: 'Learn the core of JavaScript: variables, functions, arrays and asynchronous code.',
    category: 'Programming',
    level: 'beginner',
    tags: ['javascript', 'web'],
    instructor: instructor._id,
    isPublished: true,
  });
  await Lesson.insertMany([
    { course: course._id, order: 0, title: 'Variables and Types', duration: 10, content: 'JavaScript has let, const and var. Use const by default, let when you need to reassign. Primitive types: string, number, boolean, null, undefined, symbol, bigint.' },
    { course: course._id, order: 1, title: 'Functions', duration: 12, content: 'Functions are first-class values. Arrow functions give a short syntax: const add = (a, b) => a + b. Closures let a function remember variables from where it was created.' },
    { course: course._id, order: 2, title: 'Promises and async/await', duration: 15, content: 'A Promise represents a future value. async functions return promises and await pauses until a promise settles. Use try/catch to handle rejections.' },
  ]);
  await Quiz.create({
    course: course._id,
    title: 'JavaScript Basics Quiz',
    passMark: 60,
    questions: [
      { text: 'Which keyword declares a block-scoped constant?', options: ['var', 'let', 'const', 'static'], correctIndex: 2, explanation: 'const creates a block-scoped binding that cannot be reassigned.' },
      { text: 'What does an async function always return?', options: ['A string', 'A Promise', 'undefined', 'An array'], correctIndex: 1, explanation: 'async functions wrap their return value in a Promise.' },
      { text: 'Which is NOT a primitive type?', options: ['number', 'boolean', 'object', 'string'], correctIndex: 2, explanation: 'Objects are reference types, not primitives.' },
    ],
  });

  console.log('Seeded. Logins: admin@lms.com/admin123, instructor@lms.com/instructor123, student@lms.com/student123');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
