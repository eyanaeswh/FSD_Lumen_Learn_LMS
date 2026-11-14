import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg, uploadAsset } from '../api';
import ProgressBar from '../components/ProgressBar.jsx';

const TABS = ['Details', 'Lessons', 'Quizzes', 'Students'];

export default function CourseEditor() {
  const { id } = useParams();
  const [tab, setTab] = useState('Details');
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get(`/courses/${id}`).then((r) => setCourse(r.data.course)).catch((e) => setError(errMsg(e))); }, [id]);
  if (error) return <div className="empty"><h2>{error}</h2></div>;
  if (!course) return <p className="muted">Loading…</p>;

  return (
    <>
      <Link to="/instructor" className="muted small">← Back to dashboard</Link>
      <div className="row spread"><h1>{course.title}</h1><span className={`badge ${course.isPublished ? 'ok' : 'draft'}`}>{course.isPublished ? 'Published' : 'Draft'}</span></div>
      <div className="tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Details' && <Details course={course} setCourse={setCourse} />}
      {tab === 'Lessons' && <Lessons courseId={id} />}
      {tab === 'Quizzes' && <Quizzes courseId={id} />}
      {tab === 'Students' && <Students courseId={id} />}
    </>
  );
}

function Details({ course, setCourse }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ title: course.title, description: course.description, category: course.category, level: course.level, tags: (course.tags || []).join(', '), thumbnail: course.thumbnail, isPublished: course.isPublished });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  useEffect(() => { api.get('/categories').then((r) => setCategories(r.data.categories)).catch((err) => setMsg(errMsg(err))); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      const { data } = await api.put(`/courses/${course._id}`, { ...f, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean) });
      setCourse({ ...course, ...data.course }); setMsg('Saved ✓');
    } catch (err) { setMsg(errMsg(err)); } finally { setBusy(false); }
  };
  const upload = async (file) => {
    if (!file) return;
    setMsg('Uploading image…');
    try { const t = await uploadAsset(file, 'image'); setF((x) => ({ ...x, thumbnail: t })); setMsg('Image uploaded — click Save to apply'); } catch (err) { setMsg(errMsg(err)); }
  };
  const remove = async () => {
    if (!confirm('Delete this course and all of its lessons, quizzes and enrollments? This cannot be undone.')) return;
    await api.delete(`/courses/${course._id}`); navigate('/instructor');
  };

  return (
    <form className="form wide" onSubmit={save}>
      <label>Title<input required value={f.title} onChange={set('title')} /></label>
      <label>Description<textarea required rows={5} value={f.description} onChange={set('description')} /></label>
      <div className="two">
        <label>Category<input list="course-categories" value={f.category} onChange={set('category')} /><datalist id="course-categories">{categories.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label>Level<select value={f.level} onChange={set('level')}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
      </div>
      <label>Tags (comma separated)<input value={f.tags} onChange={set('tags')} /></label>
      <label>Thumbnail
        {f.thumbnail?.url && <img className="preview" src={f.thumbnail.url} alt="Course thumbnail" />}
        <input type="file" accept="image/*" onChange={(e) => upload(e.target.files[0])} />
      </label>
      <label className="check"><input type="checkbox" checked={f.isPublished} onChange={(e) => setF({ ...f, isPublished: e.target.checked })} />Published (visible to learners)</label>
      <div className="row">
        <button className="btn" disabled={busy}>Save changes</button>
        <button type="button" className="btn danger" onClick={remove}>Delete course</button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </form>
  );
}

const emptyLesson = { title: '', content: '', videoUrl: '', duration: 0, attachment: null };

function Lessons({ courseId }) {
  const [lessons, setLessons] = useState([]);
  const [editing, setEditing] = useState(null); // lesson object or 'new'
  const [f, setF] = useState(emptyLesson);
  const [msg, setMsg] = useState('');

  const load = () => api.get(`/courses/${courseId}/lessons`).then((r) => setLessons(r.data.lessons));
  useEffect(() => { load(); }, [courseId]);

  const open = (l) => { setEditing(l); setF(l === 'new' ? emptyLesson : { ...emptyLesson, ...l }); setMsg(''); };
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { title: f.title, content: f.content, videoUrl: f.videoUrl, duration: Number(f.duration) || 0, attachment: f.attachment || undefined };
      if (editing === 'new') await api.post(`/courses/${courseId}/lessons`, body);
      else await api.put(`/lessons/${editing._id}`, body);
      setEditing(null); load();
    } catch (err) { setMsg(errMsg(err)); }
  };
  const del = async (l) => { if (confirm(`Delete “${l.title}”?`)) { await api.delete(`/lessons/${l._id}`); load(); } };
  const move = async (i, dir) => {
    const a = lessons[i], b = lessons[i + dir];
    if (!b) return;
    await Promise.all([api.put(`/lessons/${a._id}`, { order: i + dir }), api.put(`/lessons/${b._id}`, { order: i })]);
    load();
  };
  const attach = async (file) => {
    if (!file) return;
    setMsg('Uploading…');
    try { const a = await uploadAsset(file, 'file'); setF((x) => ({ ...x, attachment: a })); setMsg('Attached ✓'); } catch (err) { setMsg(errMsg(err)); }
  };

  if (editing) {
    return (
      <form className="form wide" onSubmit={save}>
        <h2>{editing === 'new' ? 'New lesson' : 'Edit lesson'}</h2>
        <label>Title<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label>Lesson text<textarea rows={10} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></label>
        <div className="two">
          <label>Video URL (YouTube or direct link)<input value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} /></label>
          <label>Duration (minutes)<input type="number" min="0" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></label>
        </div>
        <label>Attachment {f.attachment?.name && <span className="muted">— {f.attachment.name}</span>}<input type="file" onChange={(e) => attach(e.target.files[0])} /></label>
        <div className="row"><button className="btn">Save lesson</button><button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>{msg && <span className="error">{msg}</span>}</div>
      </form>
    );
  }
  return (
    <>
      <div className="row spread"><h2>Lessons</h2><button className="btn" onClick={() => open('new')}>Add lesson</button></div>
      {lessons.length === 0 ? <div className="empty"><p>No lessons yet.</p></div> : (
        <ol className="lesson-list edit">
          {lessons.map((l, i) => (
            <li key={l._id}>
              <span className="grow">{l.title}</span>
              <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button className="btn ghost sm" disabled={i === lessons.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button className="btn ghost sm" onClick={() => open(l)}>Edit</button>
              <button className="btn danger sm" onClick={() => del(l)}>Delete</button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

const blankQ = () => ({ text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });

function Quizzes({ courseId }) {
  const [quizzes, setQuizzes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const load = () => api.get(`/quizzes/course/${courseId}`).then((r) => setQuizzes(r.data.quizzes));
  useEffect(() => { load(); }, [courseId]);

  const open = (q) => { setEditing(q); setF(q === 'new' ? { title: '', description: '', passMark: 60, questions: [blankQ()] } : { ...q }); setMsg(''); };
  const setQ = (i, patch) => setF({ ...f, questions: f.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const setOpt = (i, j, v) => setQ(i, { options: f.questions[i].options.map((o, k) => (k === j ? v : o)) });

  const save = async (e) => {
    e.preventDefault();
    const questions = f.questions.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) }));
    try {
      const body = { title: f.title, description: f.description, passMark: Number(f.passMark), questions };
      if (editing === 'new') await api.post('/quizzes', { ...body, course: courseId });
      else await api.put(`/quizzes/${editing._id}`, body);
      setEditing(null); load();
    } catch (err) { setMsg(errMsg(err)); }
  };
  const del = async (q) => { if (confirm(`Delete “${q.title}” and its results?`)) { await api.delete(`/quizzes/${q._id}`); load(); } };
  const generate = async () => {
    setAiBusy(true); setMsg('');
    try {
      const { data } = await api.post('/ai/generate-quiz', { courseId, topic: f.title, count: 5 });
      setF({ ...f, questions: [...f.questions.filter((q) => q.text.trim()), ...data.questions.map((q) => ({ explanation: '', ...q }))] });
      setMsg(`Added ${data.questions.length} AI-drafted questions — review them before saving.`);
    } catch (err) { setMsg(errMsg(err)); } finally { setAiBusy(false); }
  };

  if (editing) {
    return (
      <form className="form wide" onSubmit={save}>
        <h2>{editing === 'new' ? 'New quiz' : 'Edit quiz'}</h2>
        <div className="two">
          <label>Title<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label>Pass mark (%)<input type="number" min="0" max="100" value={f.passMark} onChange={(e) => setF({ ...f, passMark: e.target.value })} /></label>
        </div>
        <label>Description<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        {f.questions.map((q, i) => (
          <fieldset key={i} className="card q">
            <legend>Question {i + 1}</legend>
            <input required placeholder="Question text" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
            {q.options.map((o, j) => (
              <label key={j} className="opt-edit">
                <input type="radio" name={`c${i}`} checked={q.correctIndex === j} onChange={() => setQ(i, { correctIndex: j })} title="Mark as correct" />
                <input placeholder={`Option ${j + 1}`} value={o} onChange={(e) => setOpt(i, j, e.target.value)} />
              </label>
            ))}
            <input placeholder="Explanation shown after submitting (optional)" value={q.explanation || ''} onChange={(e) => setQ(i, { explanation: e.target.value })} />
            <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, questions: f.questions.filter((_, k) => k !== i) })}>Remove question</button>
          </fieldset>
        ))}
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => setF({ ...f, questions: [...f.questions, blankQ()] })}>Add question</button>
          <button type="button" className="btn ghost" disabled={aiBusy} onClick={generate}>{aiBusy ? 'Drafting…' : 'Draft questions with AI'}</button>
        </div>
        <p className="muted small">The selected radio button marks the correct option. Empty options are dropped on save.</p>
        <div className="row"><button className="btn">Save quiz</button><button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>{msg && <span className="muted">{msg}</span>}</div>
      </form>
    );
  }
  return (
    <>
      <div className="row spread"><h2>Quizzes</h2><button className="btn" onClick={() => open('new')}>Add quiz</button></div>
      {quizzes.length === 0 ? <div className="empty"><p>No quizzes yet.</p></div> : (
        <ul className="lesson-list edit">{quizzes.map((q) => (
          <li key={q._id}><span className="grow">{q.title} <span className="muted small">· {q.questions.length} questions</span></span>
            <Link className="btn ghost sm" to={`/quiz/${q._id}`}>Preview</Link>
            <button className="btn ghost sm" onClick={() => open(q)}>Edit</button>
            <button className="btn danger sm" onClick={() => del(q)}>Delete</button></li>
        ))}</ul>
      )}
    </>
  );
}

function Students({ courseId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get(`/enrollments/course/${courseId}/students`).then((r) => setRows(r.data.students)); }, [courseId]);
  if (!rows) return <p className="muted">Loading…</p>;
  return rows.length === 0 ? <div className="empty"><p>No one has enrolled yet.</p></div> : (
    <div className="table-wrap"><table>
      <thead><tr><th>Student</th><th>Progress</th><th>Quiz attempts</th><th>Avg. score</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.enrollmentId}>
          <td>{r.user?.name}<br /><span className="muted small">{r.user?.email}</span></td>
          <td style={{ minWidth: 140 }}><ProgressBar value={r.progress} /><span className="small">{r.progress}%</span></td>
          <td>{r.quizAttempts}</td><td>{r.averageScore === null ? '—' : `${r.averageScore}%`}</td>
        </tr>))}
      </tbody>
    </table></div>
  );
}
