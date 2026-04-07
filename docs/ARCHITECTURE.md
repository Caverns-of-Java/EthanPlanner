# Architecture

## Web App (docs)

- docs/index.html: layout for calendar, date panel, and legend editor
- docs/css/styles.css: visual system, pink-green palette, responsive behavior
- docs/js/calendar.js: Monday-first month generation and grid rendering
- docs/js/api.js: endpoint wrapper for entries and legend APIs
- docs/js/app.js: app state, panel interactions, drag highlighting, legend UI

## Backend

- src/main.gs: request routing by pathInfo and method override
- src/entries.gs: GET by date, POST create, DELETE by id
- src/legend.gs: GET list, POST upsert, DELETE by colour
- src/utils.gs: sheet helpers, validation, response formatting, UUID

## Data flow

1. User interaction triggers API call.
2. Backend writes or reads Google Sheet rows.
3. Web app updates local date cache and rerenders calendar indicators.
