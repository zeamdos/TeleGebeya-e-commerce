const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

async function uploadImage(dataUrlOrPath, folder = 'telegebeya') {
  if (!isConfigured || !dataUrlOrPath) {
    return null;
  }
  try {
    const res = await cloudinary.uploader.upload(dataUrlOrPath, {
      folder,
      resource_type: 'auto',
      quality: 'auto:eco',
      fetch_format: 'auto'
    });
    return res.secure_url;
  } catch (err) {
    console.error('[Cloudinary] Upload failed (falling back safely):', err.message);
    return null;
  }
}

module.exports = { cloudinary, uploadImage, isConfigured };
