const Category = require('../models/Category');
const Course = require('../models/Course');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const getCategoryNames = require('../utils/categoryNames');

exports.listCategories = asyncHandler(async (req, res) => {
  res.json({ success: true, categories: await getCategoryNames({ publishedOnly: true }) });
});

exports.manageCategories = asyncHandler(async (req, res) => {
  const [categories, usedCategories] = await Promise.all([
    Category.find().sort('name'),
    Course.distinct('category'),
  ]);
  res.json({ success: true, categories, usedCategories });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 80) throw new AppError('Category name is required and must be 80 characters or fewer');
  const category = await Category.create({ name });
  res.status(201).json({ success: true, category });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 80) throw new AppError('Category name is required and must be 80 characters or fewer');
  if (name !== category.name) {
    if (await Category.exists({ key: name.toLowerCase(), _id: { $ne: category._id } })) {
      throw new AppError('A category with this name already exists', 409);
    }
    await Course.updateMany({ category: category.name }, { $set: { category: name } });
    category.name = name;
    await category.save();
  }
  res.json({ success: true, category });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  if (await Course.exists({ category: category.name })) {
    throw new AppError('Reassign courses using this category before deleting it', 409);
  }
  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});
