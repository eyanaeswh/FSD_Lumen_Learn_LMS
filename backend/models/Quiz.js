const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: {
    type: [String],
    validate: [(v) => v.length >= 2 && v.length <= 6, 'Each question needs 2-6 options'],
  },
  correctIndex: { type: Number, required: true, min: 0 },
  explanation: { type: String, default: '' },
});

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: [true, 'Quiz title is required'], trim: true },
    description: { type: String, default: '' },
    passMark: { type: Number, default: 60, min: 0, max: 100 },
    questions: [questionSchema],
  },
  { timestamps: true }
);

quizSchema.pre('validate', function (next) {
  for (const q of this.questions) {
    if (q.correctIndex >= q.options.length) {
      const err = new Error('correctIndex is out of range for a question');
      err.status = 400;
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Quiz', quizSchema);
