import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';

export default function Certificate() {
  const { courseId } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/enrollments/course/${courseId}/certificate`)
      .then((response) => setCertificate(response.data.certificate))
      .catch((err) => setError(errMsg(err)));
  }, [courseId]);

  if (error) return <div className="empty"><h2>Certificate unavailable</h2><p>{error}</p><Link to="/my-learning">Back to my learning</Link></div>;
  if (!certificate) return <p className="muted">Preparing your certificate…</p>;

  return (
    <div className="certificate-page">
      <div className="row spread certificate-actions">
        <Link to="/my-learning">← My learning</Link>
        <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <article className="certificate">
        <div className="certificate-inner">
          <p className="certificate-brand">Lumen Learn</p>
          <p className="certificate-eyebrow">CERTIFICATE OF COMPLETION</p>
          <h1>This is to certify that</h1>
          <p className="certificate-student">{certificate.studentName}</p>
          <p className="certificate-copy">has successfully completed the course</p>
          <h2 className="certificate-course">{certificate.courseTitle}</h2>
          <p className="certificate-copy">taught by {certificate.instructorName}</p>
          <div className="certificate-footer">
            <div><strong>{new Date(certificate.issuedAt).toLocaleDateString()}</strong><span>Date completed</span></div>
            <div><strong>{certificate.id}</strong><span>Certificate ID</span></div>
          </div>
        </div>
      </article>
    </div>
  );
}
