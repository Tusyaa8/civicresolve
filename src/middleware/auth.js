const crypto = require('crypto');

const COOKIE = 'cr_admin';
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

// Session signing key is derived from ADMIN_PASSWORD (no extra env var needed)
function secret() {
  return crypto.createHash('sha256')
    .update('civicresolve-session:' + (process.env.ADMIN_PASSWORD || ''))
    .digest();
}

function sign(payload) {
  const mac = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return payload + '.' + mac;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const a = Buffer.from(token);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(payload) > Date.now();
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function passwordMatches(input) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof input !== 'string') return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function isAdmin(req) {
  return verifyToken(readCookie(req, COOKIE));
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({ error: 'Not authorized' });
}

function setSession(req, res) {
  res.cookie(COOKIE, sign(String(Date.now() + MAX_AGE_MS)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: MAX_AGE_MS
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE);
}

module.exports = { isAdmin, requireAdmin, passwordMatches, setSession, clearSession };
