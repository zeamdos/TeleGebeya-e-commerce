const sharp = require('sharp');

/**
 * Takes a base64 data URL (e.g. "data:image/jpeg;base64,...") and
 * returns a small, compressed base64 thumbnail of the same image.
 */
async function generateThumbnail(base64DataUrl) {
  try {
    if (!base64DataUrl || !base64DataUrl.startsWith('data:image')) {
      return base64DataUrl; // not an image we can process, leave as-is
    }

    const matches = base64DataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return base64DataUrl;

    const buffer = Buffer.from(matches[2], 'base64');

    const thumbnailBuffer = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 60 })
      .toBuffer();

    return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Thumbnail generation failed:', err.message);
    return base64DataUrl; // fall back to original if anything goes wrong
  }
}

module.exports = { generateThumbnail };