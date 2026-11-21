# CivicResolve

An AI-powered civic issue reporting and management platform built with **Node.js**, **Express**, **PostgreSQL**, and **Google Gemini** (`@google/genai`).

CivicResolve empowers citizens to report civic infrastructure issues (such as potholes, overflowing garbage, broken streetlights, water leakage, and road damage) directly to municipal authorities without cumbersome logins, while providing automated AI categorization, priority scoring, department routing, and live tracking.

---

## Features (Stage 1)

1. **Pages**:
   - **Home (`/`)**: Overview, quick action CTAs, and explanation of how the platform functions.
   - **Report a Problem (`/report`)**: Mobile-first complaint form with title, category selector, description, GPS location detection, and photo attachment preview.
   - **Track a Complaint (`/track`)**: Lookup by tracking ID with a visual 3-step progress timeline (`Reported` &rarr; `In Progress` &rarr; `Resolved`).
   - **Public Issues (`/issues`)**: Public civic feed with filters for category, status, priority, and area keyword search.
   - **Admin Portal (`/admin`)**: Authority gateway placeholder (to be connected in upcoming stages).

2. **12 Indian & Regional Languages**:
   - English (`en`)
   - Hindi / हिन्दी (`hi`)
   - Bengali / বাংলা (`bn`)
   - Telugu / తెలుగు (`te`)
   - Marathi / मराठी (`mr`)
   - Tamil / தமிழ் (`ta`)
   - Urdu / اردو (`ur`) — with automatic **Right-to-Left (RTL)** layout support
   - Gujarati / ગુજરાતી (`gu`)
   - Kannada / ಕನ್ನಡ (`kn`)
   - Malayalam / മലയാളം (`ml`)
   - Odia / ଓଡ଼ିଆ (`or`)
   - Punjabi / ਪੰਜਾਬੀ (`pa`)

3. **Multi-Language Architecture**:
   - Zero hardcoded UI strings in HTML templates.
   - One translation JSON file per language in `public/locales/<lang>.json`.
   - Browser preference persistence in `localStorage`.
   - Native font support for all Indic scripts and Urdu Nastaliq.

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation

1. Clone or navigate to the repository:
   ```bash
   cd civicresolve
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   Fill in your actual credentials in `.env`:
   - `GEMINI_API_KEY`: Google AI Studio API key
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `DATABASE_URL`: PostgreSQL connection string (e.g. Render Postgres)
   - `ADMIN_PASSWORD`: Secure password for municipal authority access
   - `PORT`: Optional port (defaults to `3000`)

4. Start the application:
   ```bash
   npm start
   ```

5. Open your browser and visit:
   ```
   http://localhost:3000
   ```

---

## File Structure

```text
civicresolve/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules (.env, node_modules)
├── README.md                 # Project documentation
├── package.json              # Project dependencies and npm scripts
├── server.js                 # Express server & page routing
├── public/
│   ├── index.html            # Home page
│   ├── report.html           # Report an issue page
│   ├── track.html            # Track complaint page
│   ├── issues.html           # Public issues page
│   ├── admin.html            # Admin dashboard placeholder
│   ├── css/
│   │   └── style.css         # Mobile-first stylesheet with Indic & RTL support
│   ├── js/
│   │   └── i18n.js           # Multi-language translation engine
│   └── locales/              # 12-language translation dictionaries
│       ├── en.json
│       ├── hi.json
│       ├── bn.json
│       ├── te.json
│       ├── mr.json
│       ├── ta.json
│       ├── ur.json           # Urdu (RTL)
│       ├── gu.json
│       ├── kn.json
│       ├── ml.json
│       ├── or.json
│       └── pa.json
```
