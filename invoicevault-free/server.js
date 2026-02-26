const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app = express();

// ── Pick a writable data directory ───────────────────────────────────────────
const CANDIDATES = [
  '/opt/render/project/src/data',   // Render paid disk mount
  path.join(__dirname, 'data'),     // local / same folder
  '/tmp/invoicevault_data',         // always writable fallback
];

function getDataDir() {
  for (const dir of CANDIDATES) {
    try { fs.mkdirSync(dir, { recursive: true }); return dir; } catch {}
  }
  throw new Error('Cannot create data directory');
}

const DATA_DIR  = getDataDir();
const DATA_FILE = path.join(DATA_DIR, 'invoices.json');

console.log('Data directory:', DATA_DIR);

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]');
  console.log('Created fresh invoices.json');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadInvoices() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { console.error('load error:', e.message); return []; }
}
function saveInvoices(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => { console.log(req.method, req.path); next(); });

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — open yourdomain.com/api/health to debug
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dataDir: DATA_DIR,
    fileExists: fs.existsSync(DATA_FILE),
    invoiceCount: loadInvoices().length,
    time: new Date().toISOString()
  });
});

app.get('/api/invoices', (req, res) => {
  try { res.json(loadInvoices()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', (req, res) => {
  try {
    const inv = req.body;
    if (!inv || !inv.id) return res.status(400).json({ error: 'Missing invoice id' });
    const invoices = loadInvoices();
    if (invoices.find(i => i.id === inv.id)) return res.json({ ok: true }); // already saved
    invoices.unshift(inv);
    saveInvoices(invoices);
    console.log('Saved:', inv.invoiceNumber, 'for', inv.clientName);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/invoices/:id', (req, res) => {
  try { saveInvoices(loadInvoices().filter(i => i.id !== req.params.id)); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/invoices/:id', (req, res) => {
  try {
    const invoices = loadInvoices();
    const idx = invoices.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    invoices[idx] = { ...invoices[idx], ...req.body };
    saveInvoices(invoices);
    res.json(invoices[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/export', (req, res) => {
  try {
    const invoices = loadInvoices();
    const headers = ['Invoice #','Client','Date','Year','Quarter','Month','Subtotal (CAD)','Tax HST (CAD)','Total (CAD)','Currency','File', 'Items Purchased', 'Total Quantity'];
    const rows = invoices.map(inv => [
      inv.invoiceNumber, inv.clientName, inv.date, inv.year, inv.quarter,
      inv.monthName, inv.subtotal, inv.tax, inv.total, inv.currency, inv.fileName,
      // Items Purchased — join all line item descriptions with " | " separator
      (inv.lineItems && inv.lineItems.length
        ? inv.lineItems.map(li => li.description).join(' | ')
        : ''),

      // Total Quantity — sum of all line item quantities
      (inv.lineItems && inv.lineItems.length
        ? inv.lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0)
        : '')
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoicevault_export.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`InvoiceVault running on port ${PORT}, data in ${DATA_DIR}`));
