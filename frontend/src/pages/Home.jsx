import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import CourseCard from '../components/CourseCard.jsx';
import { useAuth } from '../auth.jsx';

export default function Home() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const loadCourses = () => api.get('/courses?limit=6')
    .then((r) => { setCourses(r.data.courses); setError(''); })
    .catch((e) => setError(errMsg(e)));
  useEffect(() => { loadCourses(); }, []);

  return (
    <>
      <section className="hero">
        <h1>Learn with a tutor<br />that never closes.</h1>
        <p>Structured courses, quizzes that show you what you missed, and an AI study assistant that reads the lesson you’re on and answers in context.</p>
        <div className="row">
          <Link to="/courses" className="btn lg">Browse courses</Link>
          {!user && <Link to="/register" className="btn lg ghost">Create a free account</Link>}
        </div>
      </section>
      <section>
        <div className="section-head"><h2>Fresh on the platform</h2><Link to="/courses">See all</Link></div>
        {error ? (
          <div className="empty"><p className="error">Could not load courses: {error}</p><button className="btn ghost" onClick={loadCourses}>Try again</button></div>
        ) : courses.length ? (
          <div className="grid">{courses.map((c) => <CourseCard key={c._id} course={c} />)}</div>
        ) : (
          <div className="empty"><p>No courses yet. Instructors can publish the first one from their dashboard.</p></div>
        )}
      </section>
    </>
  );
}
