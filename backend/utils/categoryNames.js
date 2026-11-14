const Category = require('../models/Category');
const Course = require('../models/Course');

module.exports = async function getCategoryNames({ publishedOnly = false } = {}) {
  const [managed, used] = await Promise.all([
    Category.find().select('name').lean(),
    Course.distinct('category', publishedOnly ? { isPublished: true } : {}),
  ]);
  const names = new Map();
  for (const name of [...managed.map((category) => category.name), ...used]) {
    if (name) names.set(name.toLowerCase(), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
};
