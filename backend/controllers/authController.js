const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const sendToken = (user, status, res) => {
  const token = user.signToken();
  res.status(status).json({
    success: true,
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, bio: user.bio, avatar: user.avatar },
  });
};

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, adminSignupKey } = req.body;
  if (!name || !email || !password) throw new AppError('Name, email and password are required');
  if (password.length < 6) throw new AppError('Password must be at least 6 characters');
  if (role === 'admin') {
    if (!process.env.ADMIN_SIGNUP_KEY) throw new AppError('Admin signup is not configured', 403);
    if (adminSignupKey !== process.env.ADMIN_SIGNUP_KEY) throw new AppError('Invalid admin signup key', 403);

    const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (existingUser) {
      if (!(await existingUser.matchPassword(password))) throw new AppError('Email already registered', 409);
      if (!existingUser.isActive) throw new AppError('Account deactivated. Contact an administrator.', 403);
      existingUser.role = 'admin';
      await existingUser.save();
      return sendToken(existingUser, 200, res);
    }
  }
  const safeRole = ['student', 'instructor', 'admin'].includes(role) ? role : 'student';
  const user = await User.create({ name, email, password, role: safeRole });
  sendToken(user, 201, res);
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new AppError('Invalid credentials', 401);
  if (!user.isActive) throw new AppError('Account deactivated. Contact an administrator.', 403);
  sendToken(user, 200, res);
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => res.json({ success: true, user: req.user }));

// PUT /api/auth/me
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, bio, avatar } = req.body;
  if (name !== undefined) req.user.name = name;
  if (bio !== undefined) req.user.bio = bio;
  if (avatar !== undefined) req.user.avatar = avatar;
  await req.user.save();
  res.json({ success: true, user: req.user });
});

// PUT /api/auth/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) throw new AppError('Provide current password and a new password (min 6 chars)');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword))) throw new AppError('Current password is incorrect', 401);
  user.password = newPassword;
  await user.save();
  sendToken(user, 200, res);
});
