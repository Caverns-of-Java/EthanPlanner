# EthanPlanner

EthanPlanner is a static planning app designed for GitHub Pages with a Google Apps Script backend and Google Sheets as storage.

## What is implemented now

- Frontend scaffold with responsive monthly calendar UI
- Pink-green design token system and themed components
- Date panel for tasks, journal entries, and colour chips
- Legend editor dialog with create/delete actions
- Drag and swipe style colour highlighting using pointer events
- Apps Script backend endpoint handlers for entries and legend operations

## Workspace structure

- frontend: static app for GitHub Pages
- backend: Apps Script source files and clasp config
- sheets: Google Sheets setup docs
- docs: deployment and architecture notes

## Quick start

1. Set up your Google Sheet using sheets/SHEET_SETUP.md.
2. Create Apps Script project bound to that sheet and copy backend/src files.
3. Deploy Apps Script web app and copy the /exec URL.
4. Set API base URL in frontend/js/config.js.
5. Serve frontend locally with any static server and verify.

## Notes

- Apps Script does not provide native doDelete handlers. This implementation uses POST with _method="DELETE" for delete operations.
- Calendar indicators are loaded for dates as they are visited or changed. A month aggregate endpoint can be added later for richer month preload.
