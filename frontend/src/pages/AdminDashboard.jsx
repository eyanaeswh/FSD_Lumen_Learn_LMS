import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';

export default function AdminDashboard() {
  const { user: me } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [courses, setCourses] = useState([]);
  const [pricing, setPricing] = useState({});
  const [pricingError, setPricingError] = useState('');
  const [savingCourse, setSavingCourse] = useState('');
  const [categories, setCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  const loadUsers = () => api.get('/users', { params: { q: q || undefined, role: role || undefined } }).then((r) => setUsers(r.data.users));
  const loadCategories = () => api.get('/categories/manage').then((r) => {
    setCategories(r.data.categories);
    setUsedCategories(r.data.usedCategories);
  }).catch((e) => setCategoryError(errMsg(e)));
  const loadCourses = () => api.get('/courses/mine').then((r) => {
    setCourses(r.data.courses);
    setPricing(Object.fromEntries(r.data.courses.map((course) => [
      course._id,
      { isPaid: course.isPaid || false, price: course.price || '' },
    ])));
  }).catch((e) => setPricingError(errMsg(e)));
  useEffect(() => { api.get('/stats/admin').then((r) => setStats(r.data.stats)); }, []);
  useEffect(() => { const t = setTimeout(loadUsers, 250); return () => clearTimeout(t); }, [q, role]);
  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadCourses(); }, []);

  const update = async (u, patch) => {
    setError('');
    try { await api.put(`/users/${u._id}`, patch); loadUsers(); } catch (e) { setError(errMsg(e)); }
  };
  const remove = async (u) => {
    if (!confirm(`Delete ${u.name}?`)) return;
    try { await api.delete(`/users/${u._id}`); loadUsers(); } catch (e) { setError(errMsg(e)); }
  };
  const addCategory = async (e) => {
    e.preventDefault();
    setCategoryError('');
    try {
      await api.post('/categories', { name: categoryName });
      setCategoryName('');
      await loadCategories();
    } catch (e) { setCategoryError(errMsg(e)); }
  };
  const saveCategory = async (category) => {
    setCategoryError('');
    try {
      await api.put(`/categories/${category._id}`, { name: editingCategory.name });
      setEditingCategory(null);
      await loadCategories();
    } catch (e) { setCategoryError(errMsg(e)); }
  };
  const deleteCategory = async (category) => {
    if (!confirm(`Delete the “${category.name}” category?`)) return;
    setCategoryError('');
    try {
      await api.delete(`/categories/${category._id}`);
      await loadCategories();
    } catch (e) { setCategoryError(errMsg(e)); }
  };
  const savePricing = async (course) => {
    const choice = pricing[course._id];
    setPricingError('');
    setSavingCourse(course._id);
    try {
      await api.put(`/courses/${course._id}/pricing`, {
        isPaid: choice.isPaid,
        price: choice.isPaid ? Number(choice.price) : 0,
      });
      await loadCourses();
    } catch (e) { setPricingError(errMsg(e)); }
    finally { setSavingCourse(''); }
  };

  return (
    <>
      <h1>Administration</h1>
      {stats && (
        <div className="stats">
          <div><strong>{stats.students}</strong><span>students</span></div>
          <div><strong>{stats.instructors}</strong><span>instructors</span></div>
          <div><strong>{stats.published}/{stats.courses}</strong><span>courses published</span></div>
          <div><strong>{stats.enrollments}</strong><span>enrollments ({stats.completed} completed)</span></div>
          <div><strong>{stats.quizAttempts}</strong><span>quiz attempts</span></div>
          <div><strong>{stats.avgScore}%</strong><span>avg. quiz score</span></div>
        </div>
      )}
      {stats?.popular?.length > 0 && <p className="muted">Most popular: {stats.popular.map((c) => `${c.title} (${c.enrollmentCount})`).join(', ')}</p>}

      <h2>Course pricing</h2>
      <p className="muted">Set each course to free or paid. Paid prices are charged in Indian rupees (INR) through Razorpay.</p>
      {pricingError && <p className="error">{pricingError}</p>}
      {!courses.length ? <p className="muted">No courses available yet.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Course</th><th>Instructor</th><th>Access</th><th>Price (INR)</th><th /></tr></thead>
          <tbody>{courses.map((course) => {
            const choice = pricing[course._id] || { isPaid: false, price: '' };
            return <tr key={course._id}>
              <td>{course.title}</td>
              <td>{course.instructor?.name || '—'}</td>
              <td><select value={choice.isPaid ? 'paid' : 'free'} onChange={(e) => setPricing({
                ...pricing,
                [course._id]: { ...choice, isPaid: e.target.value === 'paid' },
              })} aria-label={`Pricing type for ${course.title}`}>
                <option value="free">Free</option><option value="paid">Paid</option>
              </select></td>
              <td><input type="number" min="0.01" step="0.01" disabled={!choice.isPaid} value={choice.isPaid ? choice.price : ''}
                onChange={(e) => setPricing({ ...pricing, [course._id]: { ...choice, price: e.target.value } })}
                aria-label={`Price in INR for ${course.title}`} /></td>
              <td><button className="btn sm" disabled={savingCourse === course._id || (choice.isPaid && (!choice.price || Number(choice.price) <= 0))}
                onClick={() => savePricing(course)}>{savingCourse === course._id ? 'Saving…' : 'Save price'}</button></td>
            </tr>;
          })}</tbody>
        </table></div>
      )}

      <h2>Users</h2>
      <div className="filters">
        <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option><option value="student">Students</option><option value="instructor">Instructors</option><option value="admin">Admins</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u._id}>
            <td>{u.name}</td><td>{u.email}</td>
            <td><select value={u.role} disabled={u._id === me._id} onChange={(e) => update(u, { role: e.target.value })} aria-label={`Role for ${u.name}`}>
              <option value="student">student</option><option value="instructor">instructor</option><option value="admin">admin</option></select></td>
            <td><span className={`badge ${u.isActive ? 'ok' : 'bad'}`}>{u.isActive ? 'Active' : 'Deactivated'}</span></td>
            <td className="actions">
              <button className="btn ghost sm" disabled={u._id === me._id} onClick={() => update(u, { isActive: !u.isActive })}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
              <button className="btn danger sm" disabled={u._id === me._id} onClick={() => remove(u)}>Delete</button>
            </td>
          </tr>))}
        </tbody>
      </table></div>
      <h2>Categories</h2>
      <p className="muted">Manage the categories available to organize courses. Categories currently used by a course can’t be deleted until that course is reassigned.</p>
      {categoryError && <p className="error">{categoryError}</p>}
      <form className="inline-form" onSubmit={addCategory}>
        <input required maxLength={80} placeholder="New category name…" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} aria-label="New category name" />
        <button className="btn">Add category</button>
      </form>
      {categories.length > 0 && <div className="table-wrap category-table"><table>
        <thead><tr><th>Category</th><th>Courses</th><th /></tr></thead>
        <tbody>{categories.map((category) => {
          const inUse = usedCategories.includes(category.name);
          const editing = editingCategory?._id === category._id;
          return <tr key={category._id}>
            <td>{editing
              ? <input maxLength={80} value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} aria-label={`Edit ${category.name}`} />
              : category.name}</td>
            <td>{inUse ? 'In use' : 'Not in use'}</td>
            <td className="actions">{editing
              ? <><button className="btn sm" disabled={!editingCategory.name.trim()} onClick={() => saveCategory(category)}>Save</button><button className="btn ghost sm" onClick={() => setEditingCategory(null)}>Cancel</button></>
              : <><button className="btn ghost sm" onClick={() => setEditingCategory({ _id: category._id, name: category.name })}>Rename</button><button className="btn danger sm" disabled={inUse} onClick={() => deleteCategory(category)}>Delete</button></>}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    </>
  );
}
