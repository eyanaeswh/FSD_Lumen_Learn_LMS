const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const Result = require('../models/Result');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedCourse, recalcProgress } = require('../utils/access');

// POST /api/enrollments  { courseId }   (student)
exports.enroll = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.body.courseId);
  if (!course || !course.isPublished) throw new AppError('Course not found', 404);
  if (await Enrollment.exists({ user: req.user._id, course: course._id })) throw new AppError('Already enrolled', 409);
  if (course.isPaid) throw new AppError('Complete payment before enrolling in this course', 402);
  const enrollment = await Enrollment.create({ user: req.user._id, course: course._id });
  await Course.updateOne({ _id: course._id }, { $inc: { enrollmentCount: 1 } });
  res.status(201).json({ success: true, enrollment });
});

// DELETE /api/enrollments/:courseId   (student unenrolls)
exports.unenroll = asyncHandler(async (req, res) => {
  const e = await Enrollment.findOneAndDelete({ user: req.user._id, course: req.params.courseId });
  if (!e) throw new AppError('Enrollment not found', 404);
  await Course.updateOne({ _id: req.params.courseId }, { $inc: { enrollmentCount: -1 } });
  res.json({ success: true, message: 'Unenrolled' });
});

// GET /api/enrollments/mine
exports.myEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ user: req.user._id })
    .populate({ path: 'course', populate: { path: 'instructor', select: 'name' } })
    .sort('-updatedAt');
  const withTotals = await Promise.all(
    enrollments
      .filter((e) => e.course)
      .map(async (e) => ({ ...e.toObject(), totalLessons: await Lesson.countDocuments({ course: e.course._id }) }))
  );
  res.json({ success: true, enrollments: withTotals });
});

// GET /api/enrollments/course/:courseId   (current user's enrollment for a course)
exports.getEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({ user: req.user._id, course: req.params.courseId });
  res.json({ success: true, enrollment });
});

// GET /api/enrollments/course/:courseId/certificate
exports.certificate = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({ user: req.user._id, course: req.params.courseId });
  if (!enrollment) throw new AppError('Enrollment not found', 404);
  if (enrollment.progress !== 100 || !enrollment.completedAt) {
    throw new AppError('Complete every lesson to earn this certificate', 403);
  }
  const course = await Course.findById(enrollment.course).populate('instructor', 'name');
  if (!course) throw new AppError('Course not found', 404);
  res.json({
    success: true,
    certificate: {
      id: `LUM-${String(enrollment._id).slice(-8).toUpperCase()}`,
      studentName: req.user.name,
      courseTitle: course.title,
      instructorName: course.instructor?.name || 'Lumen Learn',
      issuedAt: enrollment.completedAt,
    },
  });
});

// POST/DELETE /api/enrollments/:courseId/lessons/:lessonId/complete
exports.markComplete = asyncHandler(async (req, res) => setComplete(req, res, true));
exports.markIncomplete = asyncHandler(async (req, res) => setComplete(req, res, false));

async function setComplete(req, res, complete) {
  const { courseId, lessonId } = req.params;
  const enrollment = await Enrollment.findOne({ user: req.user._id, course: courseId });
  if (!enrollment) throw new AppError('You are not enrolled in this course', 403);
  const lesson = await Lesson.findOne({ _id: lessonId, course: courseId });
  if (!lesson) throw new AppError('Lesson not found in this course', 404);

  const has = enrollment.completedLessons.some((id) => String(id) === lessonId);
  if (complete && !has) enrollment.completedLessons.push(lesson._id);
  if (!complete && has) enrollment.completedLessons = enrollment.completedLessons.filter((id) => String(id) !== lessonId);
  await recalcProgress(enrollment);
  res.json({ success: true, enrollment });
}

// GET /api/enrollments/course/:courseId/students   (owner / admin)
exports.courseStudents = asyncHandler(async (req, res) => {
  const course = await getOwnedCourse(req.params.courseId, req.user);
  const enrollments = await Enrollment.find({ course: course._id }).populate('user', 'name email');
  const results = await Result.find({ course: course._id });
  const students = enrollments.map((e) => {
    const mine = results.filter((r) => String(r.user) === String(e.user?._id));
    const avg = mine.length ? Math.round(mine.reduce((s, r) => s + r.percentage, 0) / mine.length) : null;
    return { enrollmentId: e._id, user: e.user, progress: e.progress, completedAt: e.completedAt, quizAttempts: mine.length, averageScore: avg };
  });
  res.json({ success: true, students });
});
