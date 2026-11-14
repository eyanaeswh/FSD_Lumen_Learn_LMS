const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Result = require('../models/Result');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/stats/admin
exports.adminStats = asyncHandler(async (req, res) => {
  const [students, instructors, admins, courses, published, enrollments, completed, results] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'instructor' }),
    User.countDocuments({ role: 'admin' }),
    Course.countDocuments(),
    Course.countDocuments({ isPublished: true }),
    Enrollment.countDocuments(),
    Enrollment.countDocuments({ progress: 100 }),
    Result.find().select('percentage passed'),
  ]);
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;
  const popular = await Course.find().sort('-enrollmentCount').limit(5).select('title enrollmentCount');
  res.json({
    success: true,
    stats: { students, instructors, admins, courses, published, enrollments, completed, quizAttempts: results.length, avgScore, popular },
  });
});

// GET /api/stats/instructor
exports.instructorStats = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user._id }).select('title enrollmentCount isPublished');
  const ids = courses.map((c) => c._id);
  const [enrollments, results] = await Promise.all([
    Enrollment.find({ course: { $in: ids } }).select('progress'),
    Result.find({ course: { $in: ids } }).select('percentage'),
  ]);
  res.json({
    success: true,
    stats: {
      courses: courses.length,
      published: courses.filter((c) => c.isPublished).length,
      students: enrollments.length,
      avgProgress: enrollments.length ? Math.round(enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length) : 0,
      avgScore: results.length ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0,
    },
  });
});
