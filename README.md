# ResearchPilot (HTML + CSS + Bootstrap + Node.js)

No `npm install` needed. The backend uses only Node's built-in modules.

## Run (Windows PowerShell)
```powershell
node --version          # needs Node 18 or newer
cd C:\path\to\ResearchPilot
node server.js
```
Open http://localhost:3000 , click **Register**. The first account you register is the admin (can download backups).
Bootstrap and Chart.js load from a CDN, so the browser needs internet the first time.
To stop: Ctrl+C. To use another port: `$env:PORT=4000; node server.js`

## Files
- `server.js` – backend: login, validation, REST API, uploads, exports, dashboard numbers
- `modules.js` – every module's fields (add a field here and it appears in the form, table, API and CSV)
- `public/index.html`, `style.css`, `app.js` – the website
- `data/db.json` – your data (created automatically). `uploads/` – your PDFs. Back up both folders.

## What works
Login/register (hashed passwords, signed tokens), projects, papers (duplicate detection by DOI/title, PDF upload and view), 13-field literature review,
gaps, questions, hypotheses, methodologies and agents (+ SVG/PNG architecture diagram), datasets, experiments, metric results with comparison/ablation charts,
tasks with Gantt, 14-section manuscript editor with Word export, journals/conferences (with a "verified" tick, nothing assumed), submissions,
supervisor meetings, notes, global search, dashboard charts, CSV (opens in Excel) and BibTeX export, JSON backup, dark mode.

## Not included
AI assistant, PDF text extraction, calendar view, manuscript version history, in-app restore, MySQL (data is a JSON file – fine for one person, not for many users).
