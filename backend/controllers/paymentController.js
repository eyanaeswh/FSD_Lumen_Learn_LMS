const crypto = require('crypto');
const Course = require('../models/Course');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const razorpayAuth = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new AppError('Razorpay is not configured. Contact the platform administrator.', 503);
  }
  return {
    keyId: RAZORPAY_KEY_ID,
    authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
  };
};

const requestRazorpay = async (path, options = {}) => {
  const { authorization } = razorpayAuth();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new AppError(`Razorpay request failed (${response.status})`, 502);
  return data;
};

// POST /api/payments/order { courseId }
exports.createOrder = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.body.courseId);
  if (!course || !course.isPublished) throw new AppError('Course not found', 404);
  if (!course.isPaid || !course.price) throw new AppError('This course is free; enroll directly', 400);
  if (await Enrollment.exists({ user: req.user._id, course: course._id })) throw new AppError('Already enrolled', 409);

  const amount = Math.round(course.price * 100);
  const order = await requestRazorpay('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: `course_${course._id}_${Date.now()}`.slice(0, 40),
      notes: { courseId: String(course._id), userId: String(req.user._id) },
    }),
  });
  if (!order.id || order.amount !== amount || order.currency !== 'INR') {
    throw new AppError('Razorpay returned an invalid payment order', 502);
  }

  await Payment.create({
    orderId: order.id,
    user: req.user._id,
    course: course._id,
    amount,
    currency: 'INR',
  });
  res.status(201).json({
    success: true,
    order: { id: order.id, amount, currency: 'INR' },
    keyId: process.env.RAZORPAY_KEY_ID,
    course: { title: course.title },
    user: { name: req.user.name, email: req.user.email },
  });
});

// POST /api/payments/verify
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (![orderId, paymentId, signature].every((value) => typeof value === 'string')) {
    throw new AppError('Payment verification details are required');
  }

  const payment = await Payment.findOne({ orderId, user: req.user._id });
  if (!payment) throw new AppError('Payment order not found', 404);
  const { authorization } = razorpayAuth();
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  if (!/^[\da-f]{64}$/i.test(signature)) throw new AppError('Invalid payment signature', 400);
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new AppError('Invalid payment signature', 400);
  }

  const gatewayPayment = await requestRazorpay(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });
  if (
    gatewayPayment.order_id !== orderId ||
    gatewayPayment.amount !== payment.amount ||
    gatewayPayment.currency !== payment.currency ||
    gatewayPayment.status !== 'captured' ||
    gatewayPayment.captured !== true
  ) {
    throw new AppError('Payment has not been captured for this course', 409);
  }

  payment.status = 'paid';
  payment.paymentId = paymentId;
  await payment.save();
  let enrollment = await Enrollment.findOne({ user: payment.user, course: payment.course });
  if (!enrollment) {
    try {
      enrollment = await Enrollment.create({ user: payment.user, course: payment.course });
      await Course.updateOne({ _id: payment.course }, { $inc: { enrollmentCount: 1 } });
    } catch (error) {
      if (error.code !== 11000) throw error;
      enrollment = await Enrollment.findOne({ user: payment.user, course: payment.course });
      if (!enrollment) throw error;
    }
  }
  res.status(201).json({ success: true, enrollment });
});
