import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user
    ? {
        student: [['/my-learning', 'My learning'], ['/results', 'Results']],
        instructor: [['/instructor', 'Teaching']],
        admin: [['/admin', 'Admin'], ['/instructor', 'All courses']],
      }[user.role]
    : [];

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true" />Lumen Learn</Link>
        <nav className="nav-links">
          <NavLink to="/courses">Courses</NavLink>
          {links.map(([to, label]) => <NavLink key={to + label} to={to}>{label}</NavLink>)}
        </nav>
        <div className="nav-user">
          {user ? (
            <>
              <Link to="/profile" className="chip">{user.name.split(' ')[0]} · {user.role}</Link>
              <button className="btn ghost" onClick={() => { logout(); navigate('/'); }}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn ghost">Log in</Link>
              <Link to="/register" className="btn">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
