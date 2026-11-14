import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProgressBar from '../components/ProgressBar.jsx';

export default function MyLearning() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/enrollments/mine').then((r) => setItems(r.data.enrollments)); }, []);
  if (!items) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>My learning</h1>
      {items.length === 0 ? (
        <div className="empty"><p>You haven’t enrolled in anything yet.</p><Link className="btn" to="/courses">Find a course</Link></div>
      ) : (
        <div className="stack">
          {items.map((e) => (
            <div key={e._id} className="card row-card">
              <Link to={`/learn/${e.course._id}`} className="thumb sm" style={e.course.thumbnail?.url ? { backgroundImage: `url(${e.course.thumbnail.url})` } : undefined} aria-label={`Continue ${e.course.title}`}>
                {!e.course.thumbnail?.url && <span>{e.course.title.slice(0, 1)}</span>}
              </Link>
              <Link to={`/learn/${e.course._id}`} className="grow learning-link">
                <h3>{e.course.title}</h3>
                <p className="muted small">{e.course.instructor?.name} · {e.completedLessons.length}/{e.totalLessons} lessons</p>
                <ProgressBar value={e.progress} />
              </Link>
              <strong>{e.progress === 100 ? 'Completed' : `${e.progress}%`}</strong>
              {e.progress === 100 && <Link className="btn ghost sm certificate-link" to={`/certificate/${e.course._id}`}>Certificate</Link>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
