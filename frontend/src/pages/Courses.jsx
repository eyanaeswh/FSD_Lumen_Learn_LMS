import { useEffect, useState } from 'react';
import api from '../api';
import CourseCard from '../components/CourseCard.jsx';

export default function Courses() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ courses: [], categories: [], pages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get('/courses', { params: { search: q || undefined, category: category || undefined, level: level || undefined, page } })
        .then((r) => setData(r.data)).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category, level, page]);

  return (
    <>
      <h1>Courses</h1>
      <div className="filters">
        <input placeholder="Search courses…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search" />
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Category">
          <option value="">All categories</option>
          {data.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} aria-label="Level">
          <option value="">Any level</option>
          <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
        </select>
      </div>
      {loading ? <p className="muted">Loading…</p> : data.courses.length ? (
        <div className="grid">{data.courses.map((c) => <CourseCard key={c._id} course={c} />)}</div>
      ) : <div className="empty"><p>No courses match your filters.</p></div>}
      {data.pages > 1 && (
        <div className="row center">
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page} of {data.pages}</span>
          <button className="btn ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
