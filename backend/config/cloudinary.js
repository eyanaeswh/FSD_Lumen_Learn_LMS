const cloudinary = require('cloudinary').v2;

const configured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (configured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Upload an in-memory buffer to Cloudinary. */
const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'lms', resource_type: 'auto', ...options }, (err, res) =>
      err ? reject(err) : resolve(res)
    );
    stream.end(buffer);
  });

const destroyAsset = async (publicId, resourceType = 'image') => {
  if (!publicId || !configured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.warn('Cloudinary delete failed:', e.message);
  }
};

module.exports = { cloudinary, configured, uploadBuffer, destroyAsset };
