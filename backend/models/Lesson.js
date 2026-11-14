const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: [true, 'Lesson title is required'], trim: true, maxlength: 140 },
    content: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    attachment: { url: String, publicId: String, name: String },
    duration: { type: Number, default: 0 }, // minutes
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lesson', lessonSchema);
