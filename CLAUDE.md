# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vietnamese primary-school essay grading system ("Trợ lý Chấm & Chữa Bài AI"). Teachers upload photos/PDFs of handwritten student essays; the backend OCRs and grades them with a vision model, then a teacher reviews and approves. Multi-school, with two roles: `admin` and `teacher`. All UI copy, comments, and error messages are in Vietnamese — keep new ones in Vietnamese.

## Commands

Run from the repo root:

```bash
npm install          # postinstall installs backend/ and frontend/ deps
npm run build        # vite build in frontend/, then copies frontend/dist -> ./dist
npm start            # node backend/src/server.js (API + built SPA on :5000)
npm run backend      # backend only
```

Development:

```bash
cd backend && npm run dev      # node --watch src/server.js
cd frontend && npm run dev     # Vite on :5173; api.js auto-targets http://localhost:5000/api
npm run seed                   # backend: seed sample data
npm run test-db                # backend: verify MongoDB connection
```

Tests use the built-in `node:test` runner — there is no Jest/Vitest:

```bash
npm --prefix backend test                        # all backend tests
node --test backend/test/rubric.test.js          # a single test file
cd frontend && node --test test/                 # frontend tests (no npm script exists)
```

There is an `.oxlintrc.json` in `frontend/` but no lint script and no oxlint dependency wired up.

## Architecture

**Single-port monolith.** `backend/src/server.js` is the only server process: it mounts the REST API at `/api`, static `/uploads` and `/samples`, and serves the built React SPA, with a catch-all `app.get('*')` that returns `index.html` for non-API paths. It probes several candidate directories for `index.html` (`frontend/dist`, `dist`, …), so `npm run build` (which copies to `./dist`) is what production serves. Do not hand-edit `dist/`; it is generated output.

**Env loading order** (the override chain is deliberate): `backend/.env` with `override: true`, then root `.env` without override, then the process env. Required: `MONGODB_URI` (or `MONGO_URL`/`DATABASE_URL`/`MONGO_PRIVATE_URL`), `JWT_SECRET`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`). Optional: `OPENAI_API_KEY` + `ENABLE_OPENAI_FALLBACK=true`, `GEMINI_MODEL`, and Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`). `db.js` overrides DNS to 8.8.8.8 only on local Windows with `mongodb+srv://` — keep that scoped, it breaks Railway's internal DNS otherwise.

**Data model** (Mongoose, `backend/src/models/`):
- `User` — `role: admin | teacher`; `username` unique+lowercase; `school` is a free-text name and is the tenancy key; `assignedClasses` holds `classId` strings; password hashed in a `pre('save')` hook.
- `Class` — `classId` is a human string and globally unique; `school`, `teacherUsername`, and an optional per-class `rubric` (empty = use default).
- `Student` — unique per `(studentId, classId)`; `studentId` is a string like `HS01`, not an ObjectId.
- `Submission` — many per student; `submissionNumber` increments per student, never overwrites. No unique index on `(classId, studentId)` by design.
- `Assignment` — a single global document, lazily created.

**Authorization.** `requireAuth` verifies the JWT and loads the user (rejecting inactive accounts); then `requireAdmin` or `requireClassAccess`. `requireClassAccess` resolves `req.params.classId` and applies `canAccessClass`: admin always passes; a teacher passes if they own the class (`teacherUsername`), are in `assignedClasses`, or share the class's `school`. Most class routes are guarded with the `classAccess = [requireAuth, requireClassAccess]` array placed **before** multer, so unauthenticated uploads never hit disk.

**Route ordering in `backend/src/routes/api.js` matters**: `/attachments` routes must stay above the wildcard `DELETE /:submissionId`, otherwise Express swallows them. Keep specific submission routes before wildcards.

**Grading pipeline** (`backend/src/services/aiGradingService.js`, ~1100 lines):
1. `autoGradeSubmission(sub, { forceReOcr, rubric })` collects image attachments — both R2 HTTPS URLs (fetched) and local files under `backend/uploads` — and skips re-OCR when `sub.text` is valid Vietnamese.
2. Provider chain: **Gemini Vision first** (`callGeminiVision`), then **OpenAI Vision only if `ENABLE_OPENAI_FALLBACK === 'true'`** — OpenAI is intentionally off by default.
3. If vision fails, the code deliberately does **not** fall back to Tesseract for handwriting. A deterministic local NLP scorer (`evaluateVietnameseEssay`) is used only when the rubric has the default 4-item 4-2-2-2 shape (`isDefaultRubricShape`); with a custom rubric the submission becomes `needs_review` with empty scores.
4. It never fabricates a sample essay when OCR is impossible — the submission stays `needs_review` with guidance text and sanitized `errorDetails`.
5. Model output is parsed and clamped; **totals are always recomputed from per-criterion scores**, never trusted from the model. Score arrays that don't match the rubric length produce no scores.

**Rubric system** (`backend/src/config/rubric.js`). `DEFAULT_RUBRIC` is 4 items summing to 10. Classes may define 1–10 custom items. Each submission snapshots the rubric it was graded under in `sub.rubric`, so later class edits don't silently shift old scores. Use `getEffectiveRubric(class)` (class rubric or default), `getSubmissionRubric(sub, classRubric)` (saved snapshot → default for legacy scored subs → class rubric for ungraded), `validateRubric()` for input, and `normalizeScores()` for clamping. Teacher scores are validated against the submission's rubric first, then the class rubric.

**Submission state machine**: `new → processing → suggested | needs_review | provider_unavailable | failed`, with `approved` set only by `reviewSubmission`. `pending` and `completed` exist in the enum for compatibility. Batch upload (`receive-batch`) intentionally creates `new` submissions and does **not** auto-grade; grading is an explicit per-student or per-class action. An approved submission cannot be re-graded by AI (`rejectIfApprovedForAI`). Every teacher action appends to `sub.logs` as an audit trail.

**Uploads / storage.** Multer writes to `backend/uploads` with a timestamp-random filename; if R2 is configured, `r2StorageService.js` uploads via hand-rolled AWS SigV4 (no SDK) and the local file is deleted, storing the public URL in `attachments[].filePath`. Local and remote paths are both handled downstream, so never assume `filePath` is a local path.

**Frontend** (`frontend/src/`). `App.jsx` holds essentially all top-level state (current user, class, students, page) and switches pages by `currentUser.role` — admins are confined to `admin_*` pages, teachers to the class pages. `api.js` is the single HTTP layer: base is `/api` in production and `http://localhost:5000/api` when the dev server is on port 5173; the JWT and cached user live in `localStorage` under `tl_auth_token` / `tl_auth_user`. `GradingPage.jsx` (~2000 lines) is the core workflow component (review, edit, approve, attachments, AI grading, batch grading, per-student submission history). Export is client-side XLSX via `write-excel-file` (`utils/exportXlsx.js` + `utils/gradebookExportData.js`).

## Bootstrap behavior

On startup, `ensureRootAdmin` runs `runSeed()` when `Class.countDocuments() === 0`, creating sample schools/teachers/classes/students/submissions. It also creates `admin` / `admin@123` when no admin exists and a default `Assignment` when none exists. Because of this, a *genuinely empty* DB gets demo data on first boot; re-seeding requires clearing the collections.

## Notes

- `dist_legacy_static/` is a previous offline prototype (plain JS, `localStorage`/IndexedDB, sample data) and is not served or imported by the Express server. Don't confuse it with `dist/`.
- `docs/AI_INTEGRATION.md` is an early design proposal, not a description of the implemented API — parts of it (e.g. "these endpoints are not implemented yet") are now stale.
- `run_local.py` and `start_app.bat` are convenience launchers (Node if present, otherwise a Python static server over `dist/`); `railway.json` + `Dockerfile` deploy the same single process.
