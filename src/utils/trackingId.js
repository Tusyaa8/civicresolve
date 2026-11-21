/**
 * Tracking ID Generator
 * Produces clean, readable codes formatted like 'CR-7K9A2X'
 * Uses unambiguous characters (excludes 0, O, 1, I) to prevent reading confusion.
 */

const crypto = require('crypto');

const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const PREFIX = 'CR-';

function generateTrackingId() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = bytes[i] % CHARSET.length;
    code += CHARSET[index];
  }
  return `${PREFIX}${code}`;
}

module.exports = {
  generateTrackingId
};
