# InvoiceVault — Setup Guide
## Get your app live in 3 steps. Completely free. No API key needed.

---

## STEP 1 — Put the code on GitHub (5 mins)

1. Go to **github.com** → Sign up or log in
2. Click the **"+"** top right → **"New repository"**
3. Name it `invoicevault` → set to **Private** → click **Create**
4. Click **"uploading an existing file"**
5. Drag in ALL files from this folder:
   - `server.js`
   - `package.json`
   - `render.yaml`
   - The `public/` folder (with `index.html` inside)
6. Click **"Commit changes"**

---

## STEP 2 — Deploy to Render (5 mins)

1. Go to **render.com** → sign up with your GitHub account
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect a repository"** → choose `invoicevault`
4. Render will detect everything automatically
5. Click **"Create Web Service"**
6. Wait ~2 minutes ⏳
7. You get a URL like `https://invoicevault.onrender.com` — **done!**

---

## STEP 3 — Share the link

Send that URL to your team. Anyone can open it and start uploading invoices immediately.

---

## How to use it

1. Click **"Upload PDFs"** tab
2. Drag your invoice PDF files in (or click to browse)
3. The app reads the text from each PDF and extracts:
   - Client name, invoice number, date, amounts
4. Everything appears in the dashboard automatically
5. If any field was wrong, click **✏️ Edit** to fix it
6. Click **Export CSV** anytime to download all data as a spreadsheet

---

## Cost
- **Render free tier: $0/month**
- **Extraction: $0** — no AI service used, all done in browser
- Only cost: if you want the app to stay always-on (no sleep), upgrade Render to $7/mo

---

## Troubleshooting

**Amounts showing as $0?**
→ Click ✏️ Edit on that invoice and type the correct amounts manually
→ This happens with PDFs that use unusual formatting

**App is slow to load first time?**
→ Free Render tier "sleeps" after 15 mins. First visit wakes it up (~30 seconds). Upgrade to paid tier to avoid this.

**App won't load at all?**
→ Check Render dashboard → click your service → "Logs" tab
