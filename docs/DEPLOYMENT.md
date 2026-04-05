# Deployment Guide

## Backend (Apps Script)

1. Open your Google Sheet.
2. Go to Extensions > Apps Script.
3. Replace default script files with files from backend/src.
4. Set manifest values from backend/appsscript.json.
5. Deploy as Web app.
6. Choose execute as yourself and access level according to your use case.
7. Copy the deployed URL ending with /exec.

Optional local workflow with clasp:

1. Install clasp: npm install -g @google/clasp
2. In backend/.clasp.json set scriptId.
3. Run clasp push from backend folder.

## Frontend (GitHub Pages)

1. Put frontend contents in your GitHub repo.
2. In frontend/js/config.js set API_BASE_URL to deployed Apps Script /exec URL.
3. Commit and push to main branch.
4. Enable GitHub Pages in repo settings.
5. Set source to main branch and frontend folder if using folder deploy.

## Verification

- Open live page and ensure month renders.
- Open a date and add a task.
- Add a journal note.
- Add and remove colour chips.
- Edit legend and verify updates after reload.
