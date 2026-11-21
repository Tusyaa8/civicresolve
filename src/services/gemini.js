/**
 * Gemini AI Analysis Service
 * Uses the official "@google/genai" package and GEMINI_MODEL from .env.
 * Analyzes civic complaints submitted in any Indian language, Hinglish/mixed languages,
 * extracts urgency, department routing, English translations, and friendly citizen feedback.
 * Strict zero-secret logging policy enforced.
 */

const dns = require('dns');
// Prefer IPv4 to avoid IPv6 connect delays in cloud sandbox environments
dns.setDefaultResultOrder('ipv4first');

const { GoogleGenAI, Type } = require('@google/genai');
const dotenv = require('dotenv');

dotenv.config();

// Allowed Enums as specified in project requirements
const ALLOWED_CATEGORIES = ['pothole', 'garbage', 'streetlight', 'water_leakage', 'road_damage', 'drainage', 'other'];
const ALLOWED_DEPARTMENTS = ['Roads', 'Sanitation', 'Electricity', 'Water Supply', 'Drainage', 'General'];
// Used only when Gemini fails: pick the department from the category
const DEPARTMENT_BY_CATEGORY = {
  pothole: 'Roads',
  road_damage: 'Roads',
  garbage: 'Sanitation',
  streetlight: 'Electricity',
  water_leakage: 'Water Supply',
  drainage: 'Drainage',
  other: 'General'
};
const ALLOWED_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const ALLOWED_IMAGE_MATCHES = ['yes', 'no', 'no_image'];

// Initialize GoogleGenAI SDK client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Backup model(s) used when the main model is overloaded (503) or out of quota (429).
// Comma-separated list in GEMINI_FALLBACK_MODELS, e.g. "gemini-3.6-flash".
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash')
  .split(',').map((m) => m.trim()).filter(Boolean);
const MODELS = [MODEL_NAME, ...FALLBACK_MODELS.filter((m) => m !== MODEL_NAME)];
const TIMEOUT_MS = 12000;        // limit for each single attempt
const TOTAL_BUDGET_MS = 20000;   // no new attempt starts after this much total time

/**
 * Clean and validate structured AI response against allowed enums
 */
function sanitizeAiResponse(rawJson, citizenCategory, hasImage) {
  let category = (rawJson.category || '').toLowerCase().trim();
  if (!ALLOWED_CATEGORIES.includes(category)) {
    category = 'other';
  }

  let priority = (rawJson.priority || '').trim();
  // Capitalize first letter
  priority = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  if (!ALLOWED_PRIORITIES.includes(priority)) {
    priority = 'Medium';
  }

  let department = (rawJson.department || '').trim();
  const matchedDept = ALLOWED_DEPARTMENTS.find(
    (d) => d.toLowerCase() === department.toLowerCase()
  );
  department = matchedDept || 'General';

  let imageMatches = (rawJson.image_matches || '').toLowerCase().trim();
  if (!ALLOWED_IMAGE_MATCHES.includes(imageMatches)) {
    imageMatches = hasImage ? 'yes' : 'no_image';
  }

  // Determine category mismatch
  let categoryMismatch = false;
  if (citizenCategory && citizenCategory.trim() && citizenCategory !== 'other') {
    categoryMismatch = citizenCategory.toLowerCase().trim() !== category;
  }

  return {
    detected_language: String(rawJson.detected_language || 'English').trim(),
    english_title: String(rawJson.english_title || '').trim(),
    english_description: String(rawJson.english_description || '').trim(),
    category,
    priority,
    priority_reason: String(rawJson.priority_reason || '').trim(),
    department,
    english_summary: String(rawJson.english_summary || '').trim(),
    image_matches: imageMatches,
    citizen_message: String(rawJson.citizen_message || '').trim(),
    category_mismatch: categoryMismatch,
    needs_review: false
  };
}

/**
 * Fallback response when AI service fails or times out
 * Ensures citizen complaints are NEVER lost or blocked
 */
function createFallbackResponse(title, description, citizenCategory, hasImage, reason = '') {
  let category = 'other';
  if (citizenCategory && ALLOWED_CATEGORIES.includes(citizenCategory.toLowerCase())) {
    category = citizenCategory.toLowerCase();
  }

  return {
    detected_language: 'Unknown',
    english_title: title,
    english_description: description,
    category,
    priority: 'Medium',
    priority_reason: reason || 'Automated analysis temporarily unavailable; routed for manual authority verification.',
    department: DEPARTMENT_BY_CATEGORY[category] || 'General',
    english_summary: `Issue: ${title.slice(0, 100)}`,
    image_matches: hasImage ? 'yes' : 'no_image',
    citizen_message: 'Your complaint has been successfully recorded and forwarded to municipal staff for review.',
    category_mismatch: false,
    needs_review: true
  };
}

/**
 * Execute single generation request to Gemini with timeout
 */
async function callGeminiOnce(model, title, description, location, citizenCategory, imageBase64) {
  const parts = [];
  const hasImage = Boolean(imageBase64);

  // If photo is attached, include inline data
  if (hasImage && typeof imageBase64 === 'string' && imageBase64.startsWith('data:image/')) {
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      });
    }
  }

  const promptText = `
You are the AI triage engine for CivicResolve, an Indian civic issue reporting platform.
Citizens submit infrastructure complaints in ANY Indian language (Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Gujarati, Kannada, Malayalam, Odia, Punjabi), mixed languages (Hinglish/Tanglish), or English with regional idioms.

Analyze this civic complaint and provide a structured JSON classification:
- Citizen Title: "${title}"
- Citizen Description: "${description}"
- Location: "${location || 'Not specified'}"
- Citizen Selected Category: "${citizenCategory || 'None (Let AI decide)'}"
- Photo Attached: ${hasImage ? 'Yes (see attached image)' : 'No'}

Rules:
1. Category must be EXACTLY ONE of: pothole, garbage, streetlight, water_leakage, road_damage, drainage, other
2. Priority must be EXACTLY ONE of: Critical, High, Medium, Low
   - Critical: Imminent danger to life, open manholes on main roads, live electric wire, huge crater causing accidents.
   - High: Severe disruption, blocked major drainage, overflow near hospital/school, water main burst.
   - Medium: Localized disruption, normal pothole on residential road, uncollected garbage bin, broken streetlight.
   - Low: Minor cosmetic defect, faded lane marking, small debris.
3. Priority Reason: exactly one short sentence explaining the urgency and public impact (mention risk to pedestrians/bikers, health hazards, traffic jam, or nearby school/hospital).
4. Department must be EXACTLY ONE of: Roads, Sanitation, Electricity, Water Supply, Drainage, General
5. English Title & English Description: complete accurate English translation of what the citizen wrote.
6. English Summary: one concise line for the municipal officer.
7. Image Matches: if photo attached, return "yes" if the photo visually shows the described civic issue, or "no" if irrelevant. If no photo, return "no_image".
8. Citizen Message: a warm, polite 1-2 sentence reassurance written IN THE CITIZEN'S OWN LANGUAGE (matching the detected input language), informing them which category, priority level, and department their complaint has been assigned to.
9. Category Mismatch: Return true if the citizen picked a category and your analysis determined a different category. Otherwise false.
10. Citizens often misspell words or write in a hurry (for example "pathole", "pathone", "garbadge"). Interpret the intended meaning, and if a photo is attached, use it to help decide the category.
`.trim();

  parts.push({ text: promptText });

  // Call Gemini using official @google/genai SDK with responseSchema
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Gemini API call timed out')), TIMEOUT_MS);
  });

  const requestPromise = ai.models.generateContent({
    model,
    contents: parts,
    config: {
      // Low thinking = much faster answers (3.8 Flash does not support 'minimal')
      thinkingConfig: { thinkingLevel: 'low' },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detected_language: { type: Type.STRING },
          english_title: { type: Type.STRING },
          english_description: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: ALLOWED_CATEGORIES
          },
          priority: {
            type: Type.STRING,
            enum: ALLOWED_PRIORITIES
          },
          priority_reason: { type: Type.STRING },
          department: {
            type: Type.STRING,
            enum: ALLOWED_DEPARTMENTS
          },
          english_summary: { type: Type.STRING },
          image_matches: {
            type: Type.STRING,
            enum: ALLOWED_IMAGE_MATCHES
          },
          citizen_message: { type: Type.STRING },
          category_mismatch: { type: Type.BOOLEAN }
        },
        required: [
          'detected_language',
          'english_title',
          'english_description',
          'category',
          'priority',
          'priority_reason',
          'department',
          'english_summary',
          'image_matches',
          'citizen_message',
          'category_mismatch'
        ]
      }
    }
  });

  let response;
  try {
    response = await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  const rawJson = JSON.parse(text);
  return sanitizeAiResponse(rawJson, citizenCategory, hasImage);
}

/**
 * Analyze a complaint. If the main model is overloaded (503), out of quota (429) or slow,
 * the backup model is tried, then the main model once more. If everything fails, a safe
 * fallback is returned so a complaint is NEVER lost or blocked.
 * @param {Object} complaintData - { title, description, location, category, image }
 * @returns {Promise<Object>} - Structured AI analysis object
 */
async function analyzeComplaint({ title, description, location, category, image }) {
  const hasImage = Boolean(image);
  const started = Date.now();
  const attempts = [...MODELS, MODELS[0]];

  for (let i = 0; i < attempts.length; i++) {
    if (Date.now() - started > TOTAL_BUDGET_MS) break;
    try {
      return await callGeminiOnce(attempts[i], title, description, location, category, image);
    } catch (err) {
      const msg = String(err.message || err);
      // Log the real reason (never the key) so the cause is visible in the server logs
      console.warn(`[Gemini attempt ${i + 1} failed on ${attempts[i]}]:`, msg.slice(0, 200));
      // A bad key will not be fixed by another model
      if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg)) break;
      await new Promise((res) => setTimeout(res, 600));
    }
  }

  // Graceful fallback: submission NEVER blocks
  return createFallbackResponse(title, description, category, hasImage);
}

module.exports = {
  analyzeComplaint,
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_DEPARTMENTS
};
