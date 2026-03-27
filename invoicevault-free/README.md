# InvoiceVault

PDF invoice parser and dashboard. Upload invoices, it extracts the data, you export a CSV.

Built this because I was tired of manually copying invoice details into spreadsheets for a client project. Runs fully in-browser for extraction — no backend AI calls, no API keys.

---

## Stack

- **Frontend** — Vanilla JS + HTML/CSS (no framework, kept it simple)
- **Backend** — Node.js + Express (`server.js`)
- **PDF parsing** — Runs client-side using PDF.js, so nothing gets sent to a server
- **Deployment** — Render (configured via `render.yaml`)

---

## How the parsing works

When you drop a PDF in, it gets read by PDF.js in the browser. The text content gets extracted page by page, then I run a few regex patterns over it to pull out:

- Client name
- Invoice number
- Date
- Line items and totals

It's not perfect — PDFs with weird formatting or scanned images will miss some fields. That's why there's an inline edit mode for fixing anything the parser gets wrong.

---

## Running locally

```bash
git clone https://github.com/RamChopra1/invoicevault
cd invoicevault
npm install
node server.js
```

Opens on `http://localhost:3000`. No `.env` needed — no external services wired in.

---

## Project structure

```
invoicevault/
├── server.js          # Express server, serves static files
├── package.json
├── render.yaml        # Render deployment config
└── public/
    └── index.html     # All UI lives here
```

Kept it as a single HTML file intentionally — the app is simple enough that splitting into components would've been overkill.

---

## Deploying

Configured for [Render](https://render.com). Connect the repo and it picks up `render.yaml` automatically. Free tier works fine — only downside is the dyno sleeps after 15 mins idle so the first cold load takes ~30s.

---

## Known limitations

- Scanned PDFs (image-based) won't parse — PDF.js needs actual text layers
- Regex patterns are tuned for the invoice formats I was working with; unusual layouts will need manual edits
- No database — data lives in the browser session by design, nothing sensitive gets persisted

---

## License

MIT
