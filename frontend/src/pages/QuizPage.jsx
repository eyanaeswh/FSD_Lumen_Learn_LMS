import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';

export default function QuizPage() {
  const { quizId } = useParams();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/quizzes/${quizId}`).then((r) => { setQuiz(r.data.quiz); setAnswers(r.data.quiz.questions.map(() => -1)); }).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, [quizId]);

  if (error) return <div className="empty"><h2>{error}</h2></div>;
  if (!quiz) return <p className="muted">Loading…</p>;
  const staffPreview = user.role !== 'student';

  const submit = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/quizzes/${quizId}/submit`, { answers }); setOutcome(data); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  if (outcome) {
    const { result, review } = outcome;
    return (
      <div className="quiz">
        <div className={`score card ${result.passed ? 'pass' : 'fail'}`}>
          <h1>{result.percentage}%</h1>
          <p>{result.score} of {result.total} correct — {result.passed ? 'you passed!' : `you need ${quiz.passMark}% to pass.`}</p>
          <div className="row center">
            <button className="btn" onClick={() => { setOutcome(null); load(); }}>Try again</button>
            <Link className="btn ghost" to={`/learn/${quiz.course}`}>Back to course</Link>
          </div>
        </div>
        <h2>Review</h2>
        {review.map((r, i) => (
          <div key={i} className={`card q ${r.correct ? 'ok' : 'bad'}`}>
            <p><strong>{i + 1}. {r.question}</strong></p>
            <p className="small">Your answer: {r.yourAnswer >= 0 ? quiz.questions[i].options[r.yourAnswer] : <em>none</em>}</p>
            {!r.correct && <p className="small">Correct: {quiz.questions[i].options[r.correctIndex]}</p>}
            {r.explanation && <p className="muted small">{r.explanation}</p>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="quiz">
      <h1>{quiz.title}</h1>
      <p className="muted">{quiz.questions.length} questions · pass mark {quiz.passMark}%{quiz.description ? ` · ${quiz.description}` : ''}</p>
      {staffPreview && <p className="notice">Preview mode — only students can submit quizzes.</p>}
      {quiz.questions.map((q, i) => (
        <fieldset key={q._id} className="card q">
          <legend>{i + 1}. {q.text}</legend>
          {q.options.map((o, j) => (
            <label key={j} className={`opt ${answers[i] === j ? 'on' : ''}`}>
              <input type="radio" name={`q${i}`} checked={answers[i] === j} onChange={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))} />{o}
            </label>
          ))}
        </fieldset>
      ))}
      {!staffPreview && (
        <button className="btn lg" disabled={busy} onClick={submit}>
          {busy ? 'Submitting…' : `Submit (${answers.filter((a) => a >= 0).length}/${answers.length} answered)`}
        </button>
      )}
    </div>
  );
}
