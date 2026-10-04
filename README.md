# PharmaGuard

Family medicine-safety web app. Upload a prescription (or type a medicine) once; PharmaGuard standardizes the
medicine with **RxNorm**, then checks **drug interactions** and **duplicates** against that person's and every other
family member's active medicines, stores everything in **PostgreSQL**, and shows it on the dashboards.

**Stack (exactly as specified):** React.js · Node.js + Express.js · PostgreSQL · JWT · Tesseract.js · RxNorm API ·
interaction checker (DDInter data) · OpenAI API.

---

## What you need installed first

1. **Node.js 18 or newer** – https://nodejs.org
2. **PostgreSQL** (any recent version) – https://www.postgresql.org/download/ – remember the password you set for the
   `postgres` user.
3. An **OpenAI API key** for the chatbot (optional – everything else works without it) – https://platform.openai.com/api-keys
4. An internet connection (RxNorm is an online service; Tesseract downloads its English language data on first use).

## Run it (3 steps)

Open a terminal in this folder (`pharmaguard/`):

```bash
# 1. install everything, build the website, create the database + tables, load interaction data
npm run setup

# 2. put your settings in backend/.env  (see below)

# 3. start
npm start
```

Then open **http://localhost:5000**, click **Create an account**, and log in.

### Settings – `backend/.env`
`npm run setup` creates this file for you. Open it and check:

| Setting | What to do |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:YOUR_PASSWORD@localhost:5432/pharmaguard` – put your real PostgreSQL password. **Do this before running setup if your password is not `postgres`** (run `npm run setup` once, edit the file, then run `npm run setup` again). |
| `OPENAI_API_KEY` | Your key, for the AI chatbot. Restart the server after changing it. |
| `OPENAI_MODEL` | Default `gpt-4o-mini`. |
| `JWT_SECRET` | Generated automatically. |

## Load full interaction data (important)

Drug interactions come from the **DDInter** database (about 300,000 documented drug–drug interactions with Major /
Moderate / Minor severity). `npm run setup` tries to download it automatically. If it cannot, the app falls back to a
small built-in **starter set (~40 well-known pairs)** and shows a warning banner. To load the full data:

1. Open https://ddinter2.scbdd.com/download/ and download all the CSV files (codes A, B, D, H, L, P, R, V).
2. Put them in `backend/data/ddinter/`.
3. Run `npm run import:ddinter`. The banner disappears once the full data is loaded.

> DDInter is free for academic / non-commercial use. Check its terms before any commercial use. Also note that a
> database cannot list every possible interaction – "no warning" never guarantees a combination is safe.

## How it works

```
Prescription image ──► Tesseract.js OCR ──► medicine lines ──► you review/confirm the list
Manual entry ─────────────────────────────────────────────────┐
                                                              ▼
                                   RxNorm  →  RxCUI + standard name + active ingredient(s)
                                                              ▼
                      ┌── Duplicate check (same ingredient)  ── same person + other family members
                      └── Interaction lookup (DDInter pairs) ── same person + other family members
                                                              ▼
                              stored in PostgreSQL (prescription, medicines, results)
                                                              ▼
                                   React dashboards read the stored results
```

* The checks run **once, when a medicine/prescription is added** – nothing is re-checked continuously.
* Only **active** medicines count. Marking a medicine *consumed* or *stopped* keeps it as history and its warnings
  disappear from the dashboards. Deleting removes it completely.
* Interactions are **never calculated** by the app – it only looks up documented pairs. The chatbot does not judge
  interactions either.

## The pages

1. **Family overview** – cards with name, age, gender, active medicines and flags (interactions, duplicates, family interactions). Click a person for details.
2. **Family safety** – interactions and duplicates *between* family members (who, which medicines, severity, evidence).
3. **Family & medicines** – add/remove members; mark medicines consumed/stopped; delete; see history.
4. **Add prescription** – upload an image (OCR) or type a medicine; review; save & check.
5. **AI assistant** – general medicine / disease / symptom questions via OpenAI.

## Notes & tips

* OCR works best with clear, typed prescriptions. You always get a review screen before anything is saved.
* RxNorm is US-based. International generic names (e.g. *paracetamol*) and some common Indian brand names (e.g. *Dolo*, *Crocin*)
  are converted to generic names via `backend/data/aliases.json` before the RxNorm lookup – add your own lines there.
  If a brand is not recognised, type its generic name instead.
* If RxNorm only finds a close (not exact) match, the app asks you to confirm it before saving.

## Development mode (optional)

```bash
cd backend  && npm run dev        # API on :5000
cd frontend && npm run dev        # React dev server on :5173 (proxies /api to :5000)
```

## Project layout

```
pharmaguard/
├── backend/
│   ├── src/            server.js, db.js, schema.sql, routes/, services/ (rxnorm, ocr, interactions, safetyEngine)
│   ├── scripts/        setup.js, importDdinter.js
│   ├── data/           aliases.json, starter-interactions.csv, ddinter/ (put DDInter CSVs here)
│   └── public/         the built React site (created by `npm run build`)
└── frontend/           React (Vite) source
```

## Troubleshooting

* **"Could not connect to PostgreSQL"** – make sure PostgreSQL is running and the password in `DATABASE_URL` is right.
* **"Could not reach the RxNorm service"** – check your internet connection.
* **Chatbot says it is not configured** – add `OPENAI_API_KEY` to `backend/.env` and restart.
* **Port 5000 busy** – change `PORT` in `backend/.env`.
