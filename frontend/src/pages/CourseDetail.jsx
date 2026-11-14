import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import ProgressBar from '../components/ProgressBar.jsx';

let razorpayScript;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScript) {
    razorpayScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => {
        razorpayScript = null;
        reject(new Error('Could not load Razorpay checkout. Please try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScript;
}

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/courses/${id}`).then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, [id, user?._id]);

  if (error) return <div className="empty"><h2>{error}</h2><Link to="/courses">Back to courses</Link></div>;
  if (!data) return <p className="muted">Loading…</p>;
  const { course, quizzes, enrollment } = data;
  const isStudent = user?.role === 'student';
  const canManage = user && (user.role === 'admin' || user._id === course.instructor._id);

  const enroll = async () => {
    if (!user) return navigate('/login', { state: { from: `/courses/${id}` } });
    try { await api.post('/enrollments', { courseId: id }); navigate(`/learn/${id}`); } catch (e) { setError(errMsg(e)); }
  };

  const buyCourse = async () => {
    if (!user) return navigate('/login', { state: { from: `/courses/${id}` } });
    setBusy(true);
    setError('');
    try {
      const { data: payment } = await api.post('/payments/order', { courseId: id });
      await loadRazorpay();
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: payment.order.amount,
        currency: payment.order.currency,
        name: 'Lumen Learn',
        description: payment.course.title,
        order_id: payment.order.id,
        prefill: payment.user,
        theme: { color: '#0b7a75' },
        handler: async (response) => {
          try {
            await api.post('/payments/verify', response);
            navigate(`/learn/${id}`);
          } catch (e) {
            setError(errMsg(e));
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on('payment.failed', (response) => {
        setError(response.error?.description || 'Payment failed. Please try again.');
        setBusy(false);
      });
      checkout.open();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="detail">
      <div>
        <div className="meta"><span>{course.category}</span><span className="dot" /><span>{course.level}</span></div>
        <h1>{course.title}</h1>
        <p className="lead">{course.description}</p>
        <p className="muted">Taught by <strong>{course.instructor.name}</strong>{course.instructor.bio ? ` — ${course.instructor.bio}` : ''}</p>

        <h2>Curriculum</h2>
        {course.lessons?.length ? (
          <ol className="lesson-list">
            {course.lessons.map((l) => <li key={l._id}><span>{l.title}</span><span className="muted small">{l.duration ? `${l.duration} min` : ''}</span></li>)}
          </ol>
        ) : <p className="muted">Lessons are coming soon.</p>}

        {quizzes.length > 0 && (<>
          <h2>Assessments</h2>
          <ul className="plain">{quizzes.map((q) => <li key={q._id}>{q.title} <span className="muted small">· {q.questionCount} questions · pass at {q.passMark}%</span></li>)}</ul>
        </>)}
      </div>

      <aside className="card side">
        <div className="thumb big" style={course.thumbnail?.url ? { backgroundImage: `url(${course.thumbnail.url})` } : undefined}>
          {!course.thumbnail?.url && <span>{course.title.slice(0, 1)}</span>}
        </div>
        <div className="card-body">
          <p className="center"><strong>{course.isPaid ? `₹${Number(course.price).toFixed(2)} INR` : 'Free'}</strong></p>
          {enrollment ? (<>
            <p><strong>{enrollment.progress}%</strong> complete</p>
            <ProgressBar value={enrollment.progress} />
            <Link className="btn block" to={`/learn/${id}`}>{enrollment.progress ? 'Continue learning' : 'Start learning'}</Link>
          </>) : canManage ? (
            <Link className="btn block" to={`/instructor/courses/${id}`}>Manage course</Link>
          ) : (!user || isStudent) ? (
            <button className="btn block" disabled={busy} onClick={course.isPaid ? buyCourse : enroll}>
              {busy ? 'Opening secure checkout…' : course.isPaid ? `Buy course · ₹${Number(course.price).toFixed(2)}` : 'Enroll for free'}
            </button>
          ) : <p className="muted">Only student accounts can enroll.</p>}
          <p className="muted small center">{course.enrollmentCount} learners · {course.lessons?.length || 0} lessons</p>
        </div>
      </aside>
    </div>
  );
}
