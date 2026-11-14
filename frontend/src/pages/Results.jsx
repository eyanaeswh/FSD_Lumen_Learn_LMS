import { useEffect, useState } from 'react';
import api from '../api';

export default function Results() {
  const [results, setResults] = useState(null);
  useEffect(() => { api.get('/quizzes/results/mine').then((r) => setResults(r.data.results)); }, []);
  if (!results) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>My quiz results</h1>
      {results.length === 0 ? <div className="empty"><p>No quiz attempts yet.</p></div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Quiz</th><th>Course</th><th>Score</th><th>Outcome</th><th>Date</th></tr></thead>
          <tbody>{results.map((r) => (
            <tr key={r._id}>
              <td>{r.quiz?.title || '(deleted)'}</td><td>{r.course?.title}</td>
              <td>{r.score}/{r.total} ({r.percentage}%)</td>
              <td><span className={`badge ${r.passed ? 'ok' : 'bad'}`}>{r.passed ? 'Passed' : 'Not passed'}</span></td>
              <td>{new Date(r.createdAt).toLocaleDateString()}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </>
  );
}
