const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/users?role=&q=   (admin)
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) filter.$or = [{ name: new RegExp(escape(req.query.q), 'i') }, { email: new RegExp(escape(req.query.q), 'i') }];
  const users = await User.find(filter).sort('-createdAt');
  res.json({ success: true, count: users.length, users });
});

// PUT /api/users/:id   (admin) — change role / active flag
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  const { role, isActive, name } = req.body;
  if (String(user._id) === String(req.user._id) && (role || isActive === false)) {
    throw new AppError('You cannot change your own role or deactivate yourself');
  }
  if (role) {
    if (!['student', 'instructor', 'admin'].includes(role)) throw new AppError('Invalid role');
    user.role = role;
  }
  if (typeof isActive === 'boolean') user.isActive = isActive;
  if (name) user.name = name;
  await user.save();
  res.json({ success: true, user });
});

// DELETE /api/users/:id   (admin)
exports.deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) throw new AppError('You cannot delete yourself');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: 'User deleted' });
});

function escape(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
