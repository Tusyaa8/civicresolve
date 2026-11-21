# CivicResolve

**An AI-powered civic issue reporting and management platform.**
Citizens report potholes, garbage, broken streetlights, water leakage and more, in their own language. Google Gemini reads each complaint, classifies it, rates its urgency, routes it to the right department, and replies to the citizen in their own language. Everyone can then follow the issue from **Reported → In Progress → Resolved**.

Built with Node.js, Express, PostgreSQL and Google Gemini (`@google/genai`).

---

## For judges: try it in 2 minutes

| | |
|---|---|
| **Live app** | https://civicresolve.tusyaa.qzz.io/ |
| **Admin page** | https://civicresolve.tusyaa.qzz.io/admin |
| **Admin password** | `greatIndia2026` |

> The admin password is a **demo password for evaluation only**. Citizens never need an account.
> The app runs on a self-hosted server behind a Cloudflare Tunnel (see [Deployment](#deployment)). If the page does not load, please try again in a minute.

### Suggested walkthrough

1. **Open the live app** and switch the language from the top-right selector. All 12 languages change every label, and Urdu flips the layout right-to-left.
2. **Report a problem** (`/report`). Use your own words in any supported language, or paste one of these:
   - Tamil: `பேருந்து நிறுத்தம் அருகே பெரிய பள்ளம் உள்ளது. நேற்று இரண்டு பைக்குகள் விழுந்தன.`
   - Hindi: `गली के कोने पर तीन दिन से कचरा उठाया नहीं गया है, बदबू आ रही है।`
   - Add a photo and a location (the **Use my current location** button works over HTTPS).
3. **See the AI result** on the success screen: category, priority with a reason, recommended department, and a reply in the citizen's own language. Note the **tracking ID** (for example `CR-7K9A2X`).
4. **Track it** (`/track`) by entering the ID and see the status timeline.
5. **Browse public issues** (`/issues`): progress counts, a progress bar, and filters by category, status and priority.
6. **Act as the authority** (`/admin`): log in, see complaints sorted by priority, open one, change its status, add a note, or override the AI's category, priority or department.
7. **Go back to `/track`** with the same ID. The citizen now sees the new status and your note.

> **Sample data:** ten example complaints (IDs `CR-DEMO01` to `CR-DEMO10`) in six languages are included so the dashboards are not empty. They were added with `scripts/seed.js` and do not use the AI.

---

## How it meets the problem statement

| Requirement | How CivicResolve delivers it |
|---|---|
| Citizens submit complaints with title, description, location, category and optional image | `/report` form. Category can be left on "Let AI decide". Photos are resized in the browser and stored with the complaint. No login needed. |
| Gemini identifies the category | Gemini returns one of: pothole, garbage, streetlight, water_leakage, road_damage, drainage, other. It also flags when the citizen's choice disagrees with its own. |
| Classify urgency and public impact | Priority **Critical / High / Medium / Low**, with a one-sentence reason (accident risk, health hazard, nearby school or hospital, and so on). |
| Recommend the appropriate department | Roads, Sanitation, Electricity, Water Supply, Drainage or General. |
| Dashboard with Reported, In Progress and Resolved | `/track` (one complaint with a timeline) and `/issues` (all public complaints, counts and progress bar). |
| Admin reviews, updates status and manages issues | `/admin` with search, filters, status changes, notes, AI overrides, photo and map link, and a full timeline. |
| End-to-end flow from submission to resolution | Submit → AI triage → admin updates → citizen sees progress. |
| Visualize progress towards resolution | Status counts, resolution rate, progress bar, and category and priority breakdowns. |
| Accessible to everyone | 12 Indian languages, mobile-first layout, large buttons, no sign-up. |

---

## Features

### For citizens
- **12 languages** for the interface and for writing complaints: English, Hindi, Bengali, Telugu, Marathi, Tamil, Urdu (right-to-left), Gujarati, Kannada, Malayalam, Odia and Punjabi. Mixed-language text such as Hinglish also works.
- **One-tap GPS location** with a manual fallback.
- **Photo upload** with in-browser resizing.
- **Instant AI feedback** in the citizen's own language, plus a tracking ID.
- **Live tracking** with a status timeline and any notes from the authority.
- **Public issues page** with filters, progress counts and automatic refresh.

### For authorities
- **Priority-sorted queue**: Critical first, resolved last.
- **Search and filters** by status, priority, category and department.
- **Detail view** with the original text, the English translation, the photo, a map link, the AI's reasoning, and whether the photo matches the description.
- **Human in the loop**: change status, add a note, or override the AI's category, priority and department. Every change is logged in the timeline.
- **Summary panel** with totals, resolution rate, and breakdowns by category and priority.

---

## How the AI works

When a complaint is submitted, the backend sends the title, description, location and photo (if any) to **Gemini 3.8 Flash** with a strict JSON schema. Gemini returns:

| Field | Purpose |
|---|---|
| `detected_language` | Language the citizen wrote in |
| `english_title`, `english_description` | Translation so any officer can read it |
| `category` | One of the fixed categories |
| `priority` and `priority_reason` | Urgency and public impact, with a one-sentence explanation |
| `department` | Recommended department |
| `english_summary` | One-line summary for officers |
| `image_matches` | Whether the photo shows the described issue |
| `citizen_message` | Friendly reply written in the citizen's own language |
| `category_mismatch` | Whether the AI disagrees with the citizen's chosen category |

Every value is validated against the allowed lists before saving, so the AI can never break the interface.

**Reliability by design:** if Gemini is unavailable, times out, or the free-tier quota is exhausted, the complaint is **still saved**. It is routed by the category the citizen chose, given a default priority of Medium, and marked **needs review** so an officer can correct it in the admin page. A complaint is never lost because of the AI.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript (no framework), Noto fonts for every script |
| Backend | Node.js and Express |
| AI | Google Gemini via the official `@google/genai` SDK |
| Database | PostgreSQL (Render) via `pg` |
| Hosting | Self-hosted Node server exposed with a Cloudflare Tunnel |
| Built with | Google Antigravity (first stages) and hand-written code |

---

## Security notes

- Secrets (Gemini key, database URL, admin password) live only in environment variables. `.env` is git-ignored.
- The Gemini key is used only on the server and is never sent to the browser.
- The admin password is checked on the server. After login, a signed, HTTP-only session cookie is issued that expires after 6 hours.
- Failed admin logins are rate-limited (5 per 15 minutes per IP). Complaint submissions are rate-limited (20 per 15 minutes per IP).
- All database queries are parameterized. Input is validated on the server, and output is escaped in the admin and public pages.
- Public pages never expose personal data or photos.

---

## Project structure

```text
civicresolve/
├── server.js                  # Express app, routes, startup
├── package.json
├── .env.example               # Environment variable template (no real values)
├── scripts/
│   ├── seed.js                # Adds/removes demo complaints (CR-DEMO01..10)
│   ├── checkDb.js             # Prints complaint count and latest entries
│   └── testGemini.js          # Tests Gemini analysis from the terminal
├── src/
│   ├── db/                    # Postgres pool and automatic table creation
│   ├── middleware/auth.js     # Admin session handling
│   ├── routes/
│   │   ├── complaints.js      # Submit and track
│   │   ├── issues.js          # Public list and progress stats
│   │   └── admin.js           # Admin login, list, detail, update
│   ├── services/
│   │   ├── gemini.js          # AI analysis, validation and fallback
│   │   └── photoStorage.js    # Photo storage abstraction
│   └── utils/trackingId.js    # Short readable tracking IDs
└── public/
    ├── index.html, report.html, track.html, issues.html
    ├── admin-panel.html       # Admin dashboard
    ├── css/style.css
    ├── js/ (i18n.js, issues.js)
    └── locales/               # en, hi, bn, te, mr, ta, ur, gu, kn, ml, or, pa (.json)
```

## API overview

| Method and path | Access | Purpose |
|---|---|---|
| `POST /api/complaints` | Public | Submit a complaint (AI triage included) |
| `GET /api/complaints/:trackingId` | Public | Look up a complaint and its timeline |
| `GET /api/issues` | Public | Public list with filters (no personal data) |
| `GET /api/issues/stats` | Public | Counts, resolution rate, breakdowns |
| `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/session` | Admin | Session handling |
| `GET /api/admin/complaints` | Admin | Priority-sorted list with filters |
| `GET /api/admin/complaints/:trackingId` | Admin | Full detail with photo and timeline |
| `PATCH /api/admin/complaints/:trackingId` | Admin | Update status, note, category, priority, department |
| `GET /api/health` | Public | Health check |

---

## Run locally

**Requirements:** Node.js 20 or newer, a PostgreSQL database, and a Gemini API key from [Google AI Studio](https://aistudio.google.com/).

```bash
git clone <your-repository-url>
cd civicresolve
npm install
cp .env.example .env     # then fill in the values below
npm start
```

Open http://localhost:3000.

### Environment variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | API key from Google AI Studio |
| `GEMINI_MODEL` | Model name, for example `gemini-3.8-flash` |
| `DATABASE_URL` | PostgreSQL connection string (use the external URL when the app runs outside Render) |
| `ADMIN_PASSWORD` | Password for the `/admin` page. Choose a long, unique one. |
| `PORT` | Optional. Defaults to `3000`. |

Tables are created automatically on first start.

### Useful scripts

```bash
npm run check-db            # Shows the number of complaints and the latest five
npm run test-gemini         # Runs sample complaints through Gemini
node scripts/seed.js        # Adds 10 demo complaints
node scripts/seed.js --clear   # Removes only the demo complaints
```

---

## Deployment

CivicResolve is two parts: a Node server and a PostgreSQL database. The live demo uses **Option A**.

### Option A: self-hosted server + Cloudflare Tunnel + Render Postgres (used for the live demo)

1. **Create the database.** On [Render](https://render.com), create a free PostgreSQL database. Copy its **External Database URL**.
2. **Set up the server.** On the machine that will host the app:
   ```bash
   git clone <your-repository-url> && cd civicresolve
   npm install
   cp .env.example .env     # fill in GEMINI_API_KEY, GEMINI_MODEL, DATABASE_URL, ADMIN_PASSWORD
   ```
3. **Keep it running** with a process manager:
   ```bash
   npx pm2 start server.js --name civicresolve
   npx pm2 save
   ```
   After editing `.env`, run `npx pm2 restart civicresolve`.
4. **Expose it with Cloudflare Tunnel** (gives HTTPS, which the GPS button needs):
   - Quick test link (the address changes each run):
     ```bash
     cloudflared tunnel --url http://localhost:3000
     ```
   - Permanent address on your own domain:
     ```bash
     cloudflared tunnel login
     cloudflared tunnel create civicresolve
     cloudflared tunnel route dns civicresolve app.example.com
     ```
     Then create `~/.cloudflared/config.yml`:
     ```yaml
     tunnel: <TUNNEL-ID>
     credentials-file: /home/<user>/.cloudflared/<TUNNEL-ID>.json
     ingress:
       - hostname: app.example.com
         service: http://localhost:3000
       - service: http_status:404
     ```
     and start it with `cloudflared tunnel run civicresolve`.
5. **Optional:** run `node scripts/seed.js` to add the demo complaints.

### Option B: everything on Render

1. Push the repository to GitHub (make sure `.env` is not committed).
2. In Render, choose **New → Web Service**, connect the repository, and pick the **same region as your database**.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the environment variables `GEMINI_API_KEY`, `GEMINI_MODEL`, `ADMIN_PASSWORD`, and `DATABASE_URL` (use the **Internal** Database URL here).
5. Deploy and open the `.onrender.com` link.

---

## Known limitations

- **Single shared admin password.** This is deliberate for a prototype. A production system would use individual accounts (for example Google sign-in for a list of approved officers) and an audit of who changed what.
- **Free-tier limits.** The Gemini free tier has a daily request cap, and the free Render database expires after 30 days. When the AI is unavailable, the manual-review fallback keeps the system working.
- **Photos are stored in the database** to keep the prototype simple. For large scale, they should move to object storage (the storage layer is already isolated in `photoStorage.js`).
- **Hosting depends on one machine** in the live demo. The same app deploys unchanged to Render, Cloud Run or any Node host.
- **UI translations are machine-assisted** and should be reviewed by native speakers before real-world use.

## Future work

Duplicate-report grouping, a map view of all issues, SMS or WhatsApp status updates, a "re-analyze with AI" button for complaints flagged for review, voice input, and per-officer accounts.

---

*Built for the CivicResolve hackathon challenge by **Tusyaa Bala Ganash K**.*
