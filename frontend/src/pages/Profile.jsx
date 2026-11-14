import { useState } from 'react';
import api, { errMsg, uploadAsset } from '../api';
import { useAuth } from '../auth.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, bio: user.bio || '', avatar: user.avatar });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try { const { data } = await api.put('/auth/me', f); setUser(data.user); setMsg('Profile saved ✓'); } catch (err) { setMsg(errMsg(err)); }
  };
  const avatar = async (file) => {
    if (!file) return;
    setMsg('Uploading…');
    try { const a = await uploadAsset(file, 'image'); setF((x) => ({ ...x, avatar: a })); setMsg('Photo uploaded — click Save'); } catch (err) { setMsg(errMsg(err)); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try { const { data } = await api.put('/auth/password', pw); localStorage.setItem('token', data.token); setPw({ currentPassword: '', newPassword: '' }); setPwMsg('Password updated ✓'); } catch (err) { setPwMsg(errMsg(err)); }
  };

  return (
    <div className="narrow">
      <h1>Profile</h1>
      <p className="muted">{user.email} · {user.role}</p>
      <form className="form" onSubmit={save}>
        {f.avatar?.url && <img className="avatar" src={f.avatar.url} alt="Your avatar" />}
        <label>Photo<input type="file" accept="image/*" onChange={(e) => avatar(e.target.files[0])} /></label>
        <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Bio<textarea rows={3} maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
        <div className="row"><button className="btn">Save</button>{msg && <span className="muted">{msg}</span>}</div>
      </form>
      <h2>Change password</h2>
      <form className="form" onSubmit={changePw}>
        <label>Current password<input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></label>
        <label>New password<input type="password" required minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></label>
        <div className="row"><button className="btn ghost">Update password</button>{pwMsg && <span className="muted">{pwMsg}</span>}</div>
      </form>
    </div>
  );
}
