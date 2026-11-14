const router = require('express').Router();
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const courses = require('../controllers/courseController');
const lessons = require('../controllers/lessonController');
const enroll = require('../controllers/enrollmentController');
const quizzes = require('../controllers/quizController');
const ai = require('../controllers/aiController');
const uploads = require('../controllers/uploadController');
const stats = require('../controllers/statsController');
const categories = require('../controllers/categoryController');
const payments = require('../controllers/paymentController');

const staff = authorize('instructor', 'admin');

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

// Auth
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/me', protect, auth.updateMe);
router.put('/auth/password', protect, auth.changePassword);

// Users (admin)
router.get('/users', protect, authorize('admin'), users.listUsers);
router.put('/users/:id', protect, authorize('admin'), users.updateUser);
router.delete('/users/:id', protect, authorize('admin'), users.deleteUser);

// Courses
router.get('/categories', categories.listCategories);
router.get('/categories/manage', protect, authorize('admin'), categories.manageCategories);
router.post('/categories', protect, authorize('admin'), categories.createCategory);
router.put('/categories/:id', protect, authorize('admin'), categories.updateCategory);
router.delete('/categories/:id', protect, authorize('admin'), categories.deleteCategory);
router.get('/courses', courses.listCourses);
router.get('/courses/mine', protect, staff, courses.myCourses);
router.post('/courses', protect, staff, courses.createCourse);
router.get('/courses/:id', optionalAuth, courses.getCourse);
router.put('/courses/:id', protect, staff, courses.updateCourse);
router.put('/courses/:id/pricing', protect, authorize('admin'), courses.updatePricing);
router.delete('/courses/:id', protect, staff, courses.deleteCourse);

// Lessons
router.get('/courses/:courseId/lessons', protect, lessons.listLessons);
router.post('/courses/:courseId/lessons', protect, staff, lessons.createLesson);
router.get('/lessons/:id', protect, lessons.getLesson);
router.put('/lessons/:id', protect, staff, lessons.updateLesson);
router.delete('/lessons/:id', protect, staff, lessons.deleteLesson);

// Enrollment & progress
router.post('/payments/order', protect, authorize('student'), payments.createOrder);
router.post('/payments/verify', protect, authorize('student'), payments.verifyPayment);
router.post('/enrollments', protect, authorize('student'), enroll.enroll);
router.get('/enrollments/mine', protect, enroll.myEnrollments);
router.get('/enrollments/course/:courseId/certificate', protect, authorize('student'), enroll.certificate);
router.get('/enrollments/course/:courseId', protect, enroll.getEnrollment);
router.get('/enrollments/course/:courseId/students', protect, staff, enroll.courseStudents);
router.delete('/enrollments/:courseId', protect, authorize('student'), enroll.unenroll);
router.post('/enrollments/:courseId/lessons/:lessonId/complete', protect, authorize('student'), enroll.markComplete);
router.delete('/enrollments/:courseId/lessons/:lessonId/complete', protect, authorize('student'), enroll.markIncomplete);

// Quizzes & results
router.get('/quizzes/results/mine', protect, quizzes.myResults);
router.post('/quizzes', protect, staff, quizzes.createQuiz);
router.get('/quizzes/course/:courseId', protect, quizzes.courseQuizzes);
router.get('/quizzes/:id', protect, quizzes.getQuiz);
router.put('/quizzes/:id', protect, staff, quizzes.updateQuiz);
router.delete('/quizzes/:id', protect, staff, quizzes.deleteQuiz);
router.post('/quizzes/:id/submit', protect, authorize('student'), quizzes.submitQuiz);
router.get('/quizzes/:id/results', protect, staff, quizzes.quizResults);

// AI assistant
router.post('/ai/chat', protect, ai.chat);
router.post('/ai/generate-quiz', protect, staff, ai.generateQuiz);

// Cloudinary uploads
router.post('/upload/image', protect, upload.single('file'), uploads.uploadImage);
router.post('/upload/file', protect, staff, upload.single('file'), uploads.uploadFile);
router.delete('/upload', protect, staff, uploads.removeFile);

// Stats
router.get('/stats/admin', protect, authorize('admin'), stats.adminStats);
router.get('/stats/instructor', protect, authorize('instructor'), stats.instructorStats);

module.exports = router;
