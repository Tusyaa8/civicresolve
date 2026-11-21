const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

const STATUSES = ['Reported', 'In Progress', 'Resolved'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

// GET /api/issues  - public list, no personal data, no photos
router.get('/', async (req, res, next) => {
  try {
    const { status, priority, category, q } = req.query;
    const where = [];
    const params = [];
    if (STATUSES.includes(status)) { params.push(status); where.push(`status = $${params.length}`); }
    if (PRIORITIES.includes(priority)) { params.push(priority); where.push(`priority = $${params.length}`); }
    if (typeof category === 'string' && category) { params.push(category); where.push(`ai_category = $${params.length}`); }
    if (typeof q === 'string' && q.trim()) {
      params.push('%' + q.trim() + '%');
      const n = params.length;
      where.push(`(title ILIKE $${n} OR english_title ILIKE $${n} OR location_address ILIKE $${n} OR tracking_id ILIKE $${n})`);
    }
    const sql = `
      SELECT tracking_id,
             COALESCE(english_title, title) AS title,
             ai_category AS category, priority, status,
             location_address AS area, created_at, resolved_at
      FROM complaints
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC
      LIMIT 200`;
    const r = await query(sql, params);
    res.json({ issues: r.rows });
  } catch (err) { next(err); }
});

// GET /api/issues/stats  - progress towards resolution
router.get('/stats', async (req, res, next) => {
  try {
    const [s, c, p] = await Promise.all([
      query('SELECT status AS k, COUNT(*)::int AS n FROM complaints GROUP BY status'),
      query('SELECT COALESCE(ai_category, \'other\') AS k, COUNT(*)::int AS n FROM complaints GROUP BY 1'),
      query('SELECT COALESCE(priority, \'Medium\') AS k, COUNT(*)::int AS n FROM complaints GROUP BY 1')
    ]);
    const toMap = (rows) => Object.fromEntries(rows.map(r => [r.k, r.n]));
    const byStatus = { Reported: 0, 'In Progress': 0, Resolved: 0, ...toMap(s.rows) };
    const total = byStatus.Reported + byStatus['In Progress'] + byStatus.Resolved;
    res.json({
      total,
      byStatus,
      byCategory: toMap(c.rows),
      byPriority: toMap(p.rows),
      resolutionRate: total ? Math.round((byStatus.Resolved / total) * 100) : 0
    });
  } catch (err) { next(err); }
});

module.exports = router;
