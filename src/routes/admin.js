const express = require('express');
const rateLimit = require('express-rate-limit');
const { query, getClient } = require('../db/pool');
const { isAdmin, requireAdmin, passwordMatches, setSession, clearSession } = require('../middleware/auth');

const router = express.Router();

const STATUSES = ['Reported', 'In Progress', 'Resolved'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const CATEGORIES = ['pothole', 'garbage', 'streetlight', 'water_leakage', 'road_damage', 'drainage', 'other'];
const DEPARTMENTS = ['Roads', 'Sanitation', 'Electricity', 'Water Supply', 'Drainage', 'General'];

// Only failed attempts count: 5 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed attempts. Try again in 15 minutes.' }
});

router.post('/login', loginLimiter, (req, res) => {
  if (passwordMatches((req.body || {}).password)) {
    setSession(req, res);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Wrong password' });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ authenticated: isAdmin(req) });
});

// List complaints, Critical first, resolved last
router.get('/complaints', requireAdmin, async (req, res, next) => {
  try {
    const { status, priority, category, department, q } = req.query;
    const where = [];
    const params = [];
    if (STATUSES.includes(status)) { params.push(status); where.push(`status = $${params.length}`); }
    if (PRIORITIES.includes(priority)) { params.push(priority); where.push(`priority = $${params.length}`); }
    if (CATEGORIES.includes(category)) { params.push(category); where.push(`ai_category = $${params.length}`); }
    if (DEPARTMENTS.includes(department)) { params.push(department); where.push(`department = $${params.length}`); }
    if (typeof q === 'string' && q.trim()) {
      params.push('%' + q.trim() + '%');
      const n = params.length;
      where.push(`(tracking_id ILIKE $${n} OR title ILIKE $${n} OR english_title ILIKE $${n} OR english_summary ILIKE $${n} OR location_address ILIKE $${n})`);
    }
    const sql = `
      SELECT tracking_id, title, english_title, english_summary,
             ai_category AS category, priority, priority_reason, department,
             status, needs_review, location_address, created_at, updated_at
      FROM complaints
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY CASE status WHEN 'Resolved' THEN 1 ELSE 0 END,
               CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END,
               created_at DESC
      LIMIT 300`;
    const r = await query(sql, params);
    res.json({ complaints: r.rows });
  } catch (err) { next(err); }
});

// One complaint with photo and timeline
router.get('/complaints/:trackingId', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.trackingId).trim().toUpperCase();
    const r = await query('SELECT * FROM complaints WHERE tracking_id = $1 LIMIT 1', [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const c = r.rows[0];
    const logs = await query(
      'SELECT status, note, created_at FROM complaint_logs WHERE complaint_id = $1 ORDER BY created_at ASC',
      [c.id]
    );
    res.json({ complaint: c, timeline: logs.rows });
  } catch (err) { next(err); }
});

// Update status / note / override AI category, priority, department
router.patch('/complaints/:trackingId', requireAdmin, async (req, res, next) => {
  const client = await getClient();
  try {
    const id = String(req.params.trackingId).trim().toUpperCase();
    const { status, note, category, priority, department } = req.body || {};

    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
    if (department && !DEPARTMENTS.includes(department)) return res.status(400).json({ error: 'Invalid department' });
    const cleanNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null;

    await client.query('BEGIN');
    const cur = await client.query(
      'SELECT id, status, ai_category, priority, department FROM complaints WHERE tracking_id = $1 FOR UPDATE',
      [id]
    );
    if (!cur.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const row = cur.rows[0];

    const newStatus = status || row.status;
    const newCategory = category || row.ai_category;
    const newPriority = priority || row.priority;
    const newDepartment = department || row.department;

    const changes = [];
    if (newCategory !== row.ai_category) changes.push(`Category ${row.ai_category} to ${newCategory}`);
    if (newPriority !== row.priority) changes.push(`Priority ${row.priority} to ${newPriority}`);
    if (newDepartment !== row.department) changes.push(`Department ${row.department} to ${newDepartment}`);

    await client.query(
      `UPDATE complaints
       SET status = $1, ai_category = $2, priority = $3, department = $4,
           admin_notes = COALESCE($5, admin_notes),
           needs_review = FALSE,
           updated_at = NOW(),
           resolved_at = CASE WHEN $6::boolean THEN COALESCE(resolved_at, NOW()) ELSE NULL END
       WHERE id = $7`,
      [newStatus, newCategory, newPriority, newDepartment, cleanNote, newStatus === 'Resolved', row.id]
    );

    if (newStatus !== row.status || changes.length || cleanNote) {
      const text = [cleanNote, changes.length ? 'Updated by authority: ' + changes.join('; ') : '']
        .filter(Boolean).join(' | ') || 'Status updated by authority';
      await client.query(
        'INSERT INTO complaint_logs (complaint_id, status, note) VALUES ($1, $2, $3)',
        [row.id, newStatus, text]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
