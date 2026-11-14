import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Protected from './components/Protected.jsx';
import Home from './pages/Home.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import { AdminSignup, Login, Register } from './pages/AuthPages.jsx';
import MyLearning from './pages/MyLearning.jsx';
import Learn from './pages/Learn.jsx';
import QuizPage from './pages/QuizPage.jsx';
import Results from './pages/Results.jsx';
import InstructorDashboard from './pages/InstructorDashboard.jsx';
import CourseEditor from './pages/CourseEditor.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Profile from './pages/Profile.jsx';
import Certificate from './pages/Certificate.jsx';
import { useAuth } from './auth.jsx';

function DashboardRedirect() {
  const { user } = useAuth();
  const to = { student: '/my-learning', instructor: '/instructor', admin: '/admin' }[user.role];
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin-signup" element={<AdminSignup />} />

          <Route path="/dashboard" element={<Protected><DashboardRedirect /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />

          <Route path="/my-learning" element={<Protected roles={['student']}><MyLearning /></Protected>} />
          <Route path="/results" element={<Protected roles={['student']}><Results /></Protected>} />
          <Route path="/certificate/:courseId" element={<Protected roles={['student']}><Certificate /></Protected>} />
          <Route path="/learn/:courseId" element={<Protected><Learn /></Protected>} />
          <Route path="/learn/:courseId/lesson/:lessonId" element={<Protected><Learn /></Protected>} />
          <Route path="/quiz/:quizId" element={<Protected><QuizPage /></Protected>} />

          <Route path="/instructor" element={<Protected roles={['instructor', 'admin']}><InstructorDashboard /></Protected>} />
          <Route path="/instructor/courses/:id" element={<Protected roles={['instructor', 'admin']}><CourseEditor /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />

          <Route path="*" element={<div className="empty"><h2>Page not found</h2><p>That page doesn’t exist.</p></div>} />
        </Routes>
      </main>
    </>
  );
}
