import { Link } from 'react-router-dom';

export default function CourseCard({ course, to }) {
  return (
    <Link to={to || `/courses/${course._id}`} className="card course-card">
      <div className="thumb" style={course.thumbnail?.url ? { backgroundImage: `url(${course.thumbnail.url})` } : undefined}>
        {!course.thumbnail?.url && <span>{course.title.slice(0, 1)}</span>}
        {!course.isPublished && <em className="badge draft">Draft</em>}
      </div>
      <div className="card-body">
        <div className="meta"><span>{course.category}</span><span className="dot" /><span>{course.level}</span></div>
        <h3>{course.title}</h3>
        <p className="muted clamp">{course.description}</p>
        <div className="meta small">
          <span>{course.isPaid ? `₹${Number(course.price).toFixed(2)}` : 'Free'} · {course.instructor?.name || ''}</span>
          <span>{course.enrollmentCount} learner{course.enrollmentCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  );
}
