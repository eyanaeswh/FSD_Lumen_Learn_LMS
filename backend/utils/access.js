const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const AppError = require('./AppError');

/** Loads a course and ensures the user owns it (or is admin). */
exports.getOwnedCourse = async (courseId, user) => {
  const course = await Course.findById(courseId);
  if (!course) throw new AppError('Course not found', 404);
  if (user.role !== 'admin' && String(course.instructor) !== String(user._id)) {
    throw new AppError('You do not own this course', 403);
  }
  return course;
};

/** True if user is admin, the course instructor, or enrolled. */
exports.canAccessCourseContent = async (course, user) => {
  if (user.role === 'admin' || String(course.instructor) === String(user._id)) return true;
  return !!(await Enrollment.exists({ user: user._id, course: course._id }));
};

/** Recomputes progress % from completed lessons that still exist. */
exports.recalcProgress = async (enrollment) => {
  const lessonIds = (await Lesson.find({ course: enrollment.course }).select('_id')).map((l) => String(l._id));
  enrollment.completedLessons = enrollment.completedLessons.filter((id) => lessonIds.includes(String(id)));
  enrollment.progress = lessonIds.length
    ? Math.round((enrollment.completedLessons.length / lessonIds.length) * 100)
    : 0;
  enrollment.completedAt = enrollment.progress === 100 ? enrollment.completedAt || new Date() : undefined;
  await enrollment.save();
  return enrollment;
};
