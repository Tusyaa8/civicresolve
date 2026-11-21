/**
 * Complaints API Routes
 * Handles citizen issue submission with Gemini AI triage, tracking lookups, and log auditing.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { getClient, query } = require('../db/pool');
const { savePhoto } = require('../services/photoStorage');
const { generateTrackingId } = require('../utils/trackingId');
const { analyzeComplaint } = require('../services/gemini');

const router = express.Router();

// Rate limiting: max 20 submissions per 15 minutes per IP
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many complaints submitted from this IP address. Please try again later.'
  }
});

/**
 * POST /api/complaints
 * Submit a new civic complaint with Gemini AI analysis
 */
router.post('/', submissionLimiter, async (req, res, next) => {
  const client = await getClient();
  try {
    const {
      title,
      description,
      location,
      category,
      language = 'en',
      latitude,
      longitude,
      image
    } = req.body;

    // Server-side validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (!location || typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({ error: 'Location is required' });
    }

    const cleanTitle = title.trim().slice(0, 255);
    const cleanDesc = description.trim();
    const cleanLocation = location.trim();
    const cleanCategory = category && category.trim() ? category.trim() : null;
    const cleanLang = (language || 'en').trim().slice(0, 20);

    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;

    // Process photo through storage abstraction
    let storedImageData = null;
    if (image) {
      try {
        storedImageData = await savePhoto(image);
      } catch (imgErr) {
        return res.status(400).json({ error: 'Invalid photo data' });
      }
    }

    // -------------------------------------------------------------
    // Gemini AI Analysis (Multimodal, Multilingual, with Retry & Fallback)
    // -------------------------------------------------------------
    const aiResult = await analyzeComplaint({
      title: cleanTitle,
      description: cleanDesc,
      location: cleanLocation,
      category: cleanCategory,
      image: storedImageData
    });

    // Begin database transaction
    await client.query('BEGIN');

    // Generate unique tracking ID
    let trackingId = generateTrackingId();
    let collision = true;
    let attempts = 0;

    while (collision && attempts < 5) {
      const checkRes = await client.query(
        'SELECT id FROM complaints WHERE tracking_id = $1 LIMIT 1',
        [trackingId]
      );
      if (checkRes.rows.length === 0) {
        collision = false;
      } else {
        trackingId = generateTrackingId();
        attempts++;
      }
    }

    // Insert complaint with AI fields populated
    const insertComplaintSql = `
      INSERT INTO complaints (
        tracking_id,
        title,
        description,
        english_title,
        english_description,
        language,
        detected_language,
        input_category,
        ai_category,
        category_mismatch,
        priority,
        priority_reason,
        department,
        english_summary,
        citizen_message,
        image_matches,
        needs_review,
        location_address,
        latitude,
        longitude,
        image_data,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, 'Reported'
      )
      RETURNING *;
    `;

    const complaintResult = await client.query(insertComplaintSql, [
      trackingId,
      cleanTitle,
      cleanDesc,
      aiResult.english_title || cleanTitle,
      aiResult.english_description || cleanDesc,
      cleanLang,
      aiResult.detected_language,
      cleanCategory,
      aiResult.category,
      aiResult.category_mismatch,
      aiResult.priority,
      aiResult.priority_reason,
      aiResult.department,
      aiResult.english_summary,
      aiResult.citizen_message,
      aiResult.image_matches,
      aiResult.needs_review,
      cleanLocation,
      lat,
      lng,
      storedImageData
    ]);

    const newComplaint = complaintResult.rows[0];

    // Create initial timeline log with AI summary
    const logNote = aiResult.needs_review
      ? 'Complaint submitted by citizen. Automated AI analysis unavailable; flagged for manual authority review.'
      : `Complaint submitted. AI Analysis: [${aiResult.category}] | Priority: [${aiResult.priority}] | Department: [${aiResult.department}]`;

    const insertLogSql = `
      INSERT INTO complaint_logs (
        complaint_id,
        status,
        note
      ) VALUES ($1, 'Reported', $2);
    `;

    await client.query(insertLogSql, [newComplaint.id, logNote]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      tracking_id: newComplaint.tracking_id,
      status: newComplaint.status,
      created_at: newComplaint.created_at,
      ai_analysis: aiResult
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Complaint Submission Error]:', err.message);
    next(err);
  } finally {
    client.release();
  }
});

/**
 * GET /api/complaints/:trackingId
 * Look up a complaint by its Tracking ID
 */
router.get('/:trackingId', async (req, res, next) => {
  try {
    const rawId = req.params.trackingId;
    if (!rawId || typeof rawId !== 'string') {
      return res.status(400).json({ error: 'Tracking ID is required' });
    }

    const trackingId = rawId.trim().toUpperCase();

    const complaintSql = `
      SELECT 
        id,
        tracking_id,
        title,
        description,
        english_title,
        english_description,
        language,
        detected_language,
        input_category,
        ai_category,
        category_mismatch,
        priority,
        priority_reason,
        department,
        english_summary,
        citizen_message,
        image_matches,
        needs_review,
        status,
        location_address,
        latitude,
        longitude,
        admin_notes,
        created_at,
        updated_at,
        resolved_at
      FROM complaints
      WHERE tracking_id = $1
      LIMIT 1;
    `;

    const complaintRes = await query(complaintSql, [trackingId]);

    if (complaintRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = complaintRes.rows[0];

    // Fetch timeline logs
    const logsSql = `
      SELECT id, status, note, created_at
      FROM complaint_logs
      WHERE complaint_id = $1
      ORDER BY created_at ASC;
    `;
    const logsRes = await query(logsSql, [complaint.id]);

    return res.json({
      complaint: {
        tracking_id: complaint.tracking_id,
        title: complaint.title,
        description: complaint.description,
        english_title: complaint.english_title,
        english_description: complaint.english_description,
        detected_language: complaint.detected_language,
        category: complaint.ai_category || complaint.input_category || 'other',
        category_mismatch: complaint.category_mismatch,
        priority: complaint.priority || 'Medium',
        priority_reason: complaint.priority_reason,
        department: complaint.department || 'General',
        english_summary: complaint.english_summary,
        citizen_message: complaint.citizen_message,
        image_matches: complaint.image_matches,
        needs_review: complaint.needs_review,
        status: complaint.status,
        location_address: complaint.location_address,
        admin_notes: complaint.admin_notes,
        created_at: complaint.created_at,
        updated_at: complaint.updated_at,
        resolved_at: complaint.resolved_at
      },
      timeline: logsRes.rows
    });
  } catch (err) {
    console.error('[Complaint Lookup Error]:', err.message);
    next(err);
  }
});

module.exports = router;
