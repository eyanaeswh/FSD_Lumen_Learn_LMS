const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const Result = require('../models/Result');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedCourse, canAccessCourseContent } = require('../utils/access');

const isStaff = (quiz, course, user) => user.role === 'admin' || String(course.instructor) === String(user._id);

// remove answers for learners
const sanitize = (quiz) => {
  const o = quiz.toObject();
  o.questions = o.questions.map(({ correctIndex, explanation, ...q }) => q);
  return o;
};

// POST /api/quizzes   { course, title, passMark, questions[] }
exports.createQuiz = asyncHandler(async (req, res) => {
  const { course: courseId, title, description, passMark, questions } = req.body;
  await getOwnedCourse(courseId, req.user);
  const quiz = await Quiz.create({ course: courseId, title, description, passMark, questions });
  res.status(201).json({ success: true, quiz });
});

// GET /api/quizzes/course/:courseId
exports.courseQuizzes = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) throw new AppError('Course not found', 404);
  if (!(await canAccessCourseContent(course, req.user))) throw new AppError('Enroll in this course to view quizzes', 403);
  const quizzes = await Quiz.find({ course: course._id });
  res.json({ success: true, quizzes: quizzes.map((q) => (isStaff(q, course, req.user) ? q : sanitize(q))) });
});

// GET /api/quizzes/:id
exports.getQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new AppError('Quiz not found', 404);
  const course = await Course.findById(quiz.course);
  if (!(await canAccessCourseContent(course, req.user))) throw new AppError('Enroll in this course to take this quiz', 403);
  res.json({ success: true, quiz: isStaff(quiz, course, req.user) ? quiz : sanitize(quiz) });
});

// PUT /api/quizzes/:id
exports.updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new AppError('Quiz not found', 404);
  await getOwnedCourse(quiz.course, req.user);
  ['title', 'description', 'passMark', 'questions'].forEach((f) => req.body[f] !== undefined && (quiz[f] = req.body[f]));
  await quiz.save();
  res.json({ success: true, quiz });
});

// DELETE /api/quizzes/:id
exports.deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new AppError('Quiz not found', 404);
  await getOwnedCourse(quiz.course, req.user);
  await Result.deleteMany({ quiz: quiz._id });
  await quiz.deleteOne();
  res.json({ success: true, message: 'Quiz deleted' });
});

// POST /api/quizzes/:id/submit   { answers: [index, ...] }
exports.submitQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new AppError('Quiz not found', 404);
  const course = await Course.findById(quiz.course);
  if (!(await canAccessCourseContent(course, req.user))) throw new AppError('Enroll in this course to take this quiz', 403);
  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new AppError(`Provide an answers array with ${quiz.questions.length} entries (use -1 for unanswered)`);
  }
  let score = 0;
  const review = quiz.questions.map((q, i) => {
    const correct = answers[i] === q.correctIndex;
    if (correct) score++;
    return { question: q.text, yourAnswer: answers[i], correctIndex: q.correctIndex, correct, explanation: q.explanation };
  });
  const total = quiz.questions.length;
  const percentage = total ? Math.round((score / total) * 100) : 0;
  const result = await Result.create({
    user: req.user._id, quiz: quiz._id, course: quiz.course,
    score, total, percentage, passed: percentage >= quiz.passMark, answers,
  });
  res.status(201).json({ success: true, result, review });
});

// GET /api/quizzes/results/mine
exports.myResults = asyncHandler(async (req, res) => {
  const results = await Result.find({ user: req.user._id })
    .populate('quiz', 'title passMark').populate('course', 'title').sort('-createdAt');
  res.json({ success: true, results });
});

// GET /api/quizzes/:id/results   (owner / admin)
exports.quizResults = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new AppError('Quiz not found', 404);
  await getOwnedCourse(quiz.course, req.user);
  const results = await Result.find({ quiz: quiz._id }).populate('user', 'name email').sort('-createdAt');
  res.json({ success: true, results });
});
