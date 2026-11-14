const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnedCourse, canAccessCourseContent, recalcProgress } = require('../utils/access');
const { destroyAsset } = require('../config/cloudinary');

const FIELDS = ['title', 'content', 'videoUrl', 'attachment', 'duration', 'order'];
const pick = (b) => Object.fromEntries(FIELDS.filter((f) => b[f] !== undefined).map((f) => [f, b[f]]));

// GET /api/courses/:courseId/lessons   (enrolled / owner / admin) — full content
exports.listLessons = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) throw new AppError('Course not found', 404);
  if (!(await canAccessCourseContent(course, req.user))) throw new AppError('Enroll in this course to view lessons', 403);
  const lessons = await Lesson.find({ course: course._id }).sort('order createdAt');
  res.json({ success: true, lessons });
});

// POST /api/courses/:courseId/lessons
exports.createLesson = asyncHandler(async (req, res) => {
  const course = await getOwnedCourse(req.params.courseId, req.user);
  const data = pick(req.body);
  if (data.order === undefined) data.order = await Lesson.countDocuments({ course: course._id });
  const lesson = await Lesson.create({ ...data, course: course._id });
  await syncEnrollments(course._id);
  res.status(201).json({ success: true, lesson });
});

// GET /api/lessons/:id
exports.getLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new AppError('Lesson not found', 404);
  const course = await Course.findById(lesson.course);
  if (!(await canAccessCourseContent(course, req.user))) throw new AppError('Enroll in this course to view this lesson', 403);
  res.json({ success: true, lesson });
});

// PUT /api/lessons/:id
exports.updateLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new AppError('Lesson not found', 404);
  await getOwnedCourse(lesson.course, req.user);
  const data = pick(req.body);
  if (data.attachment && lesson.attachment?.publicId && lesson.attachment.publicId !== data.attachment.publicId) {
    await destroyAsset(lesson.attachment.publicId, 'raw');
  }
  Object.assign(lesson, data);
  await lesson.save();
  res.json({ success: true, lesson });
});

// DELETE /api/lessons/:id
exports.deleteLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new AppError('Lesson not found', 404);
  await getOwnedCourse(lesson.course, req.user);
  await destroyAsset(lesson.attachment?.publicId, 'raw');
  await lesson.deleteOne();
  await syncEnrollments(lesson.course);
  res.json({ success: true, message: 'Lesson deleted' });
});

// keep every learner's progress % accurate when lessons are added / removed
async function syncEnrollments(courseId) {
  const enrollments = await Enrollment.find({ course: courseId });
  await Promise.all(enrollments.map(recalcProgress));
}
