import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import CourseCard from '../components/CourseCard.jsx';

export default function InstructorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState(null);
  const [stats, setStats] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/courses/mine').then((r) => setCourses(r.data.courses));
    if (user.role === 'instructor') api.get('/stats/instructor').then((r) => setStats(r.data.stats));
  }, [user.role]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/courses', { title, description: 'Describe what learners will achieve in this course.' });
      navigate(`/instructor/courses/${data.course._id}`);
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <h1>{user.role === 'admin' ? 'All courses' : 'Teaching'}</h1>
      {stats && (
        <div className="stats">
          <div><strong>{stats.courses}</strong><span>courses ({stats.published} live)</span></div>
          <div><strong>{stats.students}</strong><span>enrollments</span></div>
          <div><strong>{stats.avgProgress}%</strong><span>avg. progress</span></div>
          <div><strong>{stats.avgScore}%</strong><span>avg. quiz score</span></div>
        </div>
      )}
      <form className="inline-form" onSubmit={create}>
        <input required placeholder="New course title…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New course title" />
        <button className="btn">Create course</button>
      </form>
      {error && <p className="error">{error}</p>}
      {!courses ? <p className="muted">Loading…</p> : courses.length === 0 ? (
        <div className="empty"><p>You haven’t created any courses yet. Add a title above to begin.</p></div>
      ) : <div className="grid">{courses.map((c) => <CourseCard key={c._id} course={c} to={`/instructor/courses/${c._id}`} />)}</div>}
    </>
  );
}
