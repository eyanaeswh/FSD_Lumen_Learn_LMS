const Course = require('../models/Course');
const Payment = require('../models/Payment');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const Enrollment = require('../models/Enrollment');
const Result = require('../models/Result');
const getCategoryNames = require('../utils/categoryNames');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedCourse } = require('../utils/access');
const { destroyAsset } = require('../config/cloudinary');

const FIELDS = ['title', 'description', 'category', 'level', 'tags', 'thumbnail', 'isPublished'];
const pick = (body) => Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

// GET /api/courses?search=&category=&level=&page=&limit=   (public — published only)
exports.listCourses = asyncHandler(async (req, res) => {
  const { search, category, level } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 12, 50);
  const filter = { isPublished: true };
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (search) filter.$text = { $search: search };

  const [courses, total] = await Promise.all([
    Course.find(filter).populate('instructor', 'name avatar').sort('-createdAt').skip((page - 1) * limit).limit(limit),
    Course.countDocuments(filter),
  ]);
  const categories = await getCategoryNames({ publishedOnly: true });
  res.json({ success: true, total, page, pages: Math.ceil(total / limit), categories, courses });
});

// GET /api/courses/mine  (instructor: own courses; admin: all)
exports.myCourses = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { instructor: req.user._id };
  const courses = await Course.find(filter).populate('instructor', 'name').sort('-createdAt');
  res.json({ success: true, courses });
});

// GET /api/courses/:id  (public for published; owner/admin can see drafts)
exports.getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
    .populate('instructor', 'name avatar bio')
    .populate({ path: 'lessons', select: 'title duration order' });
  if (!course) throw new AppError('Course not found', 404);
  const isOwner = req.user && (req.user.role === 'admin' || String(course.instructor._id) === String(req.user._id));
  const enrollment = req.user ? await Enrollment.findOne({ user: req.user._id, course: course._id }) : null;
  if (!course.isPublished && !isOwner && !enrollment) throw new AppError('Course not found', 404);

  const quizzes = await Quiz.find({ course: course._id }).select('title description passMark questions');
  res.json({
    success: true,
    course,
    quizzes: quizzes.map((q) => ({ _id: q._id, title: q.title, description: q.description, passMark: q.passMark, questionCount: q.questions.length })),
    enrollment,
  });
});

// POST /api/courses  (instructor, admin)
exports.createCourse = asyncHandler(async (req, res) => {
  const course = await Course.create({ ...pick(req.body), instructor: req.user._id });
  res.status(201).json({ success: true, course });
});

// PUT /api/courses/:id
exports.updateCourse = asyncHandler(async (req, res) => {
  const course = await getOwnedCourse(req.params.id, req.user);
  const data = pick(req.body);
  if (data.thumbnail && course.thumbnail?.publicId && course.thumbnail.publicId !== data.thumbnail.publicId) {
    await destroyAsset(course.thumbnail.publicId);
  }
  Object.assign(course, data);
  await course.save();
  res.json({ success: true, course });
});

// PUT /api/courses/:id/pricing (admin only)
exports.updatePricing = asyncHandler(async (req, res) => {
  const { isPaid, price } = req.body;
  if (typeof isPaid !== 'boolean') throw new AppError('Choose whether the course is paid or free');
  if (isPaid && (!Number.isFinite(price) || price <= 0 || Math.abs(price * 100 - Math.round(price * 100)) > 1e-8)) {
    throw new AppError('Paid courses need a price greater than zero with at most two decimal places');
  }
  if (!isPaid && price !== 0) throw new AppError('Free courses must have a price of zero');

  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError('Course not found', 404);
  course.isPaid = isPaid;
  course.price = price;
  await course.save();
  res.json({ success: true, course });
});

// DELETE /api/courses/:id  — cascades lessons, quizzes, enrollments, results
exports.deleteCourse = asyncHandler(async (req, res) => {
  const course = await getOwnedCourse(req.params.id, req.user);
  if (await Payment.exists({ course: course._id })) {
    throw new AppError('This course has payment records and cannot be deleted. Unpublish it instead.', 409);
  }
  const lessons = await Lesson.find({ course: course._id });
  await Promise.all(lessons.map((l) => destroyAsset(l.attachment?.publicId, 'raw')));
  await destroyAsset(course.thumbnail?.publicId);
  await Promise.all([
    Lesson.deleteMany({ course: course._id }),
    Quiz.deleteMany({ course: course._id }),
    Enrollment.deleteMany({ course: course._id }),
    Result.deleteMany({ course: course._id }),
  ]);
  await course.deleteOne();
  res.json({ success: true, message: 'Course deleted' });
});
