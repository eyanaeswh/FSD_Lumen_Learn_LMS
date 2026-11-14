const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    key: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function (next) {
  this.key = this.name.trim().toLowerCase();
  next();
});

module.exports = mongoose.model('Category', categorySchema);
