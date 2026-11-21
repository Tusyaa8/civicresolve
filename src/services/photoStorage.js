/**
 * Photo Storage Abstraction Service
 * Decouples photo persistence from application logic.
 * Currently persists optimized base64 data URIs into PostgreSQL (Render-safe).
 * Can be swapped with Cloud Object Storage (S3, Cloudinary, GCS) by altering these functions.
 */

/**
 * Save an image to storage
 * @param {string|null} base64DataUri - JPEG/PNG base64 data URI
 * @returns {Promise<string|null>} - Saved identifier or data URI
 */
async function savePhoto(base64DataUri) {
  if (!base64DataUri || typeof base64DataUri !== 'string') {
    return null;
  }

  // Validate format (data:image/...;base64,...)
  if (!base64DataUri.startsWith('data:image/')) {
    throw new Error('Invalid image format: must be a base64 data URI');
  }

  // Future migration point:
  // e.g. upload to S3/Cloudinary and return https://res.cloudinary.com/...
  return base64DataUri;
}

/**
 * Retrieve an image reference for display
 * @param {string|null} imageIdentifier - Stored image data or URL
 * @returns {string|null} - URL or data URI ready for <img> src
 */
async function getPhoto(imageIdentifier) {
  return imageIdentifier || null;
}

module.exports = {
  savePhoto,
  getPhoto
};
