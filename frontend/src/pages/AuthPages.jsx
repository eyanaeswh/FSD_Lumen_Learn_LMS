import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api';

function Shell({ title, sub, children }) {
  return (
    <div className="auth card">
      <div className="card-body">
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(form.email, form.password); navigate(location.state?.from || '/dashboard', { replace: true }); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  const demo = (email, password) => setForm({ email, password });

  return (
    <Shell title="Welcome back" sub="Log in to continue learning.">
      <form onSubmit={submit} className="form">
        <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
      </form>
      <p className="muted small">Demo accounts (after seeding):{' '}
        <button type="button" className="link" onClick={() => demo('student@lms.com', 'student123')}>student</button>{' · '}
        <button type="button" className="link" onClick={() => demo('instructor@lms.com', 'instructor123')}>instructor</button>{' · '}
        <button type="button" className="link" onClick={() => demo('admin@lms.com', 'admin123')}>admin</button>
      </p>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
      <p className="muted">Platform owner? <Link to="/admin-signup">Create an admin account</Link></p>
    </Shell>
  );
}

export function Register({ adminOnly = false }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: adminOnly ? 'admin' : 'student',
    adminSignupKey: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await register(form); navigate('/dashboard', { replace: true }); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Shell
      title={adminOnly ? 'Create an admin account' : 'Create your account'}
      sub={adminOnly ? 'Register with the signup key provided by the platform owner.' : 'Learn new skills, share your own, or manage the platform.'}
    >
      <form onSubmit={submit} className="form">
        <label>Full name<input required value={form.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
        <label>Password<input type="password" required minLength={6} value={form.password} onChange={set('password')} /></label>
        {!adminOnly && (
          <fieldset className="seg">
            <legend>I want to</legend>
            <label className={form.role === 'student' ? 'on' : ''}><input type="radio" name="role" checked={form.role === 'student'} onChange={() => setForm({ ...form, role: 'student' })} />Learn</label>
            <label className={form.role === 'instructor' ? 'on' : ''}><input type="radio" name="role" checked={form.role === 'instructor'} onChange={() => setForm({ ...form, role: 'instructor' })} />Teach</label>
          </fieldset>
        )}
        {form.role === 'admin' && (
          <>
            {!adminOnly && <p className="muted small">Admin signup requires a key from the platform owner. To promote an existing account, use its email and password with the key.</p>}
            <label>Admin signup key<input type="password" required autoComplete="off" value={form.adminSignupKey} onChange={set('adminSignupKey')} /></label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      </form>
      <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
      {!adminOnly && <p className="muted">Platform owner? <Link to="/admin-signup">Create an admin account</Link></p>}
    </Shell>
  );
}

export function AdminSignup() {
  return <Register adminOnly />;
}
