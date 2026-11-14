const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { canAccessCourseContent, getOwnedCourse } = require('../utils/access');

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq({ system, messages, maxTokens = 800 }) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'openai/gpt-oss-20b',
      messages: [{ role: 'system', content: system }, ...messages],
      max_completion_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new AppError(`Groq API error (${res.status}): ${text.slice(0, 200)}`, 502);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AppError('Groq returned an empty response', 502);
  return content.trim();
}

// Simple offline helper so the feature still demos without an API key.
function fallbackReply(message, lesson, course) {
  const topic = lesson?.title || course?.title || 'this topic';
  const text = (lesson?.content || course?.description || '').replace(/\s+/g, ' ').trim();
  const summary = text ? text.slice(0, 280) + (text.length > 280 ? '…' : '') : 'No lesson text is available yet.';
  return (
    `(Demo mode — set a GroqCloud AI_API_KEY on the server for full AI answers.)\n\n` +
    `You asked: "${message}"\n\nHere's the key material for "${topic}":\n${summary}\n\n` +
    `Tip: re-read the lesson, try explaining it in your own words, then test yourself with the course quiz.`
  );
}

// POST /api/ai/chat   { message, courseId?, lessonId?, history?: [{role, content}] }
exports.chat = asyncHandler(async (req, res) => {
  const { message, courseId, lessonId, history = [] } = req.body;
  if (!message || !String(message).trim()) throw new AppError('Message is required');
  if (String(message).length > 2000) throw new AppError('Message too long (max 2000 characters)');

  let course = null;
  let lesson = null;
  if (lessonId) {
    lesson = await Lesson.findById(lessonId);
    if (!lesson) throw new AppError('Lesson not found', 404);
    course = await Course.findById(lesson.course);
  } else if (courseId) {
    course = await Course.findById(courseId);
  }
  if (course && !(await canAccessCourseContent(course, req.user))) {
    throw new AppError('Enroll in this course to use the assistant with its material', 403);
  }

  if (!process.env.AI_API_KEY) {
    return res.json({ success: true, mode: 'demo', reply: fallbackReply(message, lesson, course) });
  }

  const system = [
    'You are the AI Learning Assistant inside an online learning platform.',
    'Help the student understand the material: explain clearly, use short examples, and encourage them.',
    'Do not just hand over quiz answers; guide the student to the reasoning. Keep answers under 250 words unless asked for more.',
    course ? `Course: ${course.title}\nDescription: ${course.description}` : '',
    lesson ? `Current lesson: ${lesson.title}\nLesson content:\n${(lesson.content || '').slice(0, 6000)}` : '',
  ].filter(Boolean).join('\n\n');

  const cleanHistory = history
    .filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  // Keep the conversation history anchored on a user message.
  while (cleanHistory.length && cleanHistory[0].role !== 'user') cleanHistory.shift();

  const reply = await callGroq({ system, messages: [...cleanHistory, { role: 'user', content: String(message) }] });
  res.json({ success: true, mode: 'ai', reply });
});

// POST /api/ai/generate-quiz   { courseId, lessonId?, topic?, count? }   (instructor / admin)
exports.generateQuiz = asyncHandler(async (req, res) => {
  const { courseId, lessonId, topic, count = 5 } = req.body;
  const course = await getOwnedCourse(courseId, req.user);
  const lesson = lessonId ? await Lesson.findOne({ _id: lessonId, course: course._id }) : null;
  const n = Math.min(Math.max(parseInt(count) || 5, 1), 10);

  if (!process.env.AI_API_KEY) throw new AppError('AI is not configured on the server (missing AI_API_KEY)', 503);

  const source = lesson ? `Lesson "${lesson.title}":\n${lesson.content.slice(0, 6000)}` : `Topic: ${topic || course.title}`;
  const raw = await callGroq({
    maxTokens: 2000,
    system:
      'You write multiple-choice quiz questions. Respond with ONLY a JSON array, no prose, no markdown fences. ' +
      'Each item: {"text": string, "options": [4 strings], "correctIndex": 0-3, "explanation": string}.',
    messages: [{ role: 'user', content: `Create ${n} questions for the course "${course.title}".\n\n${source}` }],
  });
  let questions;
  try {
    questions = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    throw new AppError('AI returned an unreadable response, please try again', 502);
  }
  questions = (Array.isArray(questions) ? questions : [])
    .filter((q) => q.text && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex) && q.correctIndex < q.options.length)
    .slice(0, n);
  res.json({ success: true, questions });
});
