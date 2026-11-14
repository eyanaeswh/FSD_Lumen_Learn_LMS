import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import AIAssistant from '../components/AIAssistant.jsx';

function embedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return yt ? `https://www.youtube.com/embed/${yt[1]}` : null;
}

export default function Learn() {
  const { courseId, lessonId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [error, setError] = useState('');
  const [showAI, setShowAI] = useState(false);
  const isStudent = user.role === 'student';

  useEffect(() => {
    (async () => {
      try {
        const [c, l, q, e] = await Promise.all([
          api.get(`/courses/${courseId}`),
          api.get(`/courses/${courseId}/lessons`),
          api.get(`/quizzes/course/${courseId}`),
          api.get(`/enrollments/course/${courseId}`),
        ]);
        setCourse(c.data.course); setLessons(l.data.lessons); setQuizzes(q.data.quizzes); setEnrollment(e.data.enrollment);
      } catch (err) { setError(errMsg(err)); }
    })();
  }, [courseId]);

  const current = useMemo(() => lessons.find((l) => l._id === lessonId) || lessons[0], [lessons, lessonId]);
  const done = (id) => enrollment?.completedLessons?.includes(id);

  if (error) return <div className="empty"><h2>{error}</h2><Link to={`/courses/${courseId}`}>View course page</Link></div>;
  if (!course) return <p className="muted">Loading…</p>;

  const toggle = async () => {
    const path = `/enrollments/${courseId}/lessons/${current._id}/complete`;
    const { data } = await (done(current._id) ? api.delete(path) : api.post(path));
    setEnrollment(data.enrollment);
  };
  const idx = lessons.findIndex((l) => l._id === current?._id);
  const next = lessons[idx + 1];
  const embed = current?.videoUrl && embedUrl(current.videoUrl);

  return (
    <div className="learn">
      <aside className="outline">
        <Link to={`/courses/${courseId}`} className="muted small">← {course.title}</Link>
        {enrollment && (<><p className="small"><strong>{enrollment.progress}%</strong> complete</p><ProgressBar value={enrollment.progress} /></>)}
        <h4>Lessons</h4>
        <ol>
          {lessons.map((l) => (
            <li key={l._id}>
              <Link className={l._id === current?._id ? 'active' : ''} to={`/learn/${courseId}/lesson/${l._id}`}>
                <span className={`tick ${done(l._id) ? 'on' : ''}`} aria-label={done(l._id) ? 'completed' : 'not completed'} />{l.title}
              </Link>
            </li>
          ))}
        </ol>
        {quizzes.length > 0 && (<><h4>Quizzes</h4><ul className="plain">
          {quizzes.map((q) => <li key={q._id}><Link to={`/quiz/${q._id}`}>{q.title}</Link></li>)}
        </ul></>)}
      </aside>

      <article className="lesson">
        {!current ? <div className="empty"><p>No lessons have been added yet.</p></div> : (<>
          <h1>{current.title}</h1>
          {current.videoUrl && (embed
            ? <div className="video"><iframe src={embed} title={current.title} allowFullScreen /></div>
            : <video className="video" src={current.videoUrl} controls />)}
          <div className="prose">{current.content.split('\n').map((p, i) => p.trim() && <p key={i}>{p}</p>)}</div>
          {current.attachment?.url && <a className="btn ghost" href={current.attachment.url} target="_blank" rel="noreferrer">Download {current.attachment.name || 'attachment'}</a>}
          <div className="row spread">
            {isStudent && enrollment && <button className={`btn ${done(current._id) ? 'ghost' : ''}`} onClick={toggle}>{done(current._id) ? 'Mark as not done' : 'Mark as complete'}</button>}
            {next && <button className="btn ghost" onClick={() => navigate(`/learn/${courseId}/lesson/${next._id}`)}>Next: {next.title}</button>}
          </div>
        </>)}
      </article>

      <div className={`ai-dock ${showAI ? 'open' : ''}`}>
        <button className="ai-toggle btn" onClick={() => setShowAI(!showAI)}>{showAI ? 'Close assistant' : 'Ask the AI assistant'}</button>
        {showAI && <AIAssistant courseId={courseId} lessonId={current?._id} lessonTitle={current?.title} />}
      </div>
    </div>
  );
}
