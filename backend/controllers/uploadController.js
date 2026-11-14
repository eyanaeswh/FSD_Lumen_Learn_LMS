const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { configured, uploadBuffer, destroyAsset } = require('../config/cloudinary');

const ensure = (req) => {
  if (!configured()) throw new AppError('File uploads are not configured (missing Cloudinary credentials)', 503);
  if (!req.file) throw new AppError('No file uploaded (field name must be "file")');
};

// POST /api/upload/image
exports.uploadImage = asyncHandler(async (req, res) => {
  ensure(req);
  if (!req.file.mimetype.startsWith('image/')) throw new AppError('Only image files are allowed');
  const r = await uploadBuffer(req.file.buffer, { folder: 'lms/images', resource_type: 'image' });
  res.status(201).json({ success: true, file: { url: r.secure_url, publicId: r.public_id } });
});

// POST /api/upload/file   (lesson attachments: pdf, docs, zip, video...)
exports.uploadFile = asyncHandler(async (req, res) => {
  ensure(req);
  const isVideo = req.file.mimetype.startsWith('video/');
  const r = await uploadBuffer(req.file.buffer, {
    folder: 'lms/files',
    resource_type: isVideo ? 'video' : 'auto',
    use_filename: true,
  });
  res.status(201).json({ success: true, file: { url: r.secure_url, publicId: r.public_id, name: req.file.originalname } });
});

// DELETE /api/upload   { publicId, resourceType? }
exports.removeFile = asyncHandler(async (req, res) => {
  await destroyAsset(req.body.publicId, req.body.resourceType || 'image');
  res.json({ success: true });
});
