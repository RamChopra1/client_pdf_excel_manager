require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ExcelJS = require('exceljs');
const cookieParser = require('cookie-parser');

const app = express();

// ── Configuration ────────────────────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'password123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'invoicevault_secret_88';

// Global error handlers for crash prevention/logging
process.on('uncaughtException', (err) => {
  console.error('FATAL: Uncaught Exception:', err);
  // Optional: keep running or exit gracefully
  // process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// ── Database Connection ──────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection) return cachedConnection;
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not defined in environment variables');

  cachedConnection = await mongoose.connect(MONGODB_URI, {
    // bufferCommands: true, // Default is true, allowing commands to queue until connected
  });
  console.log('Connected to MongoDB Atlas');
  return cachedConnection;
}

// Pre-connect globally (works for most cases)
connectToDatabase().catch(err => console.error('Initial MongoDB connection error:', err));

// Middleware to ensure DB is connected for every request
const ensureDb = async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
};
app.use(ensureDb);

// ── Schema Definition ────────────────────────────────────────────────────────
const invoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  fileName: String,
  uploadedAt: { type: Date, default: Date.now },
  invoiceNumber: String,
  clientName: String,
  date: String,
  year: Number,
  month: Number,
  monthName: String,
  quarter: String,
  subtotal: Number,
  tax: Number,
  total: Number,
  currency: String,
  paymentMethod: String,
  hstNumber: String,
  lineItems: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    ourPrice: Number,
    amount: Number
  }],
  category: { type: String, default: 'General' },
  rawTextPreview: String
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser(SESSION_SECRET));

// Auth check middleware
const checkAuth = (req, res, next) => {
  const { auth_token } = req.signedCookies;
  if (auth_token === 'authenticated') {
    next();
  } else {
    // If it's an API call, return 401. If it's a page request, redirect.
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.redirect('/login');
  }
};

// Public routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.cookie('auth_token', 'authenticated', {
      httpOnly: true,
      signed: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax'
    });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

// Protected routes
app.use(checkAuth);
app.use(express.static(path.join(__dirname, 'public'))); // Protect all static files including index.html
app.use((req, res, next) => { console.log(req.method, req.path); next(); });

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const count = await Invoice.countDocuments();
    res.json({
      status: 'ok',
      dbConnected: mongoose.connection.readyState === 1,
      invoiceCount: count,
      time: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ uploadedAt: -1 });
    res.json(invoices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const inv = req.body;
    console.log('--- POST /api/invoices ---');
    console.log('Body ID:', inv ? inv.id : 'N/A');
    console.log('Filename:', inv ? inv.fileName : 'N/A');

    if (!inv || !inv.id) {
      console.error('ERROR: Missing invoice id in request body');
      return res.status(400).json({
        error: 'Missing invoice id',
        receivedBodyKeys: inv ? Object.keys(inv) : 'none'
      });
    }

    // Check if exists
    const existing = await Invoice.findOne({ id: inv.id });
    if (existing) {
      console.log('Invoice already exists:', inv.id);
      return res.json({ ok: true, exists: true });
    }

    const newInvoice = new Invoice({
      ...inv,
      clientName: (inv.clientName || '').slice(0, 500), // Safety limit
      invoiceNumber: (inv.invoiceNumber || '').slice(0, 100)
    });

    await newInvoice.save();
    console.log('Saved to DB:', inv.invoiceNumber, 'for', inv.clientName);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/invoices error details:', {
      message: e.message,
      code: e.code,
      name: e.name,
      stack: e.stack
    });
    res.status(500).json({ error: e.message, code: e.code, name: e.name });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    await Invoice.findOneAndDelete({ id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const updated = await Invoice.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ uploadedAt: -1 });
    const workbook = new ExcelJS.Workbook();

    const sheetsMap = {};
    invoices.forEach(inv => {
      const year = inv.year || new Date().getFullYear();
      let sheetName = year.toString();
      if (year === 2025) {
        const month = inv.month || 1;
        sheetName = month <= 6 ? '2025 ( JAN-JUN )' : '2025 ( JUL-DEC )';
      }
      if (!sheetsMap[sheetName]) sheetsMap[sheetName] = [];
      sheetsMap[sheetName].push(inv);
    });

    if (Object.keys(sheetsMap).length === 0) sheetsMap[new Date().getFullYear().toString()] = [];

    for (const [sheetName, invList] of Object.entries(sheetsMap)) {
      const sheet = workbook.addWorksheet(sheetName);
      sheet.mergeCells('A1:N1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'ORDERS OF GREENBANK WHOLESALE';
      titleCell.font = { bold: true, size: 20 };
      titleCell.alignment = { horizontal: 'center' };

      const headers = [
        'S. NO.', 'INV. NO.', 'INV. DATE', 'SOLD TO', 'QUANTITY', 'PER PC.',
        'PRODUCT', 'AMOUNT', 'TAX', 'TOTAL', 'AMT. RCD', 'OUR PRICE', 'PROFIT', 'ASIS CUT'
      ];
      const headerRow = sheet.getRow(2);
      headerRow.values = headers;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C00000' } };
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      sheet.columns = [
        { key: 'sno', width: 13 }, { key: 'invNo', width: 13 }, { key: 'date', width: 15 },
        { key: 'soldTo', width: 35 }, { key: 'qty', width: 15 }, { key: 'price', width: 12 },
        { key: 'prod', width: 35 }, { key: 'amt', width: 13 }, { key: 'tax', width: 12 },
        { key: 'total', width: 14 }, { key: 'rcd', width: 15 }, { key: 'ourPrice', width: 17 },
        { key: 'profit', width: 13 }, { key: 'asis', width: 13 }
      ];

      let currentRow = 9;
      let sNo = 1;

      invList.forEach(inv => {
        const items = inv.lineItems || [];
        const dateStr = inv.date ? inv.date.split('-').reverse().join('-') : '';

        items.forEach((item, idx) => {
          const row = sheet.getRow(currentRow);
          const isFirst = idx === 0;
          const qty = item.quantity || 0;
          const unitPrice = item.unitPrice || 0;
          const ourPrice = item.ourPrice || 0;
          const amount = +(qty * unitPrice).toFixed(2);
          const profit = +(amount - (qty * ourPrice)).toFixed(2);
          const asisCut = +(profit / 2).toFixed(2);

          row.values = [
            isFirst ? sNo : '', isFirst ? inv.invoiceNumber : '', isFirst ? dateStr : '',
            isFirst ? inv.clientName : '', qty, unitPrice, item.description,
            amount, isFirst ? (inv.tax || 0) : '', isFirst ? (inv.total || 0) : '',
            isFirst ? (inv.total || 0) : '', ourPrice, profit, asisCut
          ];

          ['F', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
            const cell = row.getCell(col);
            if (cell.value !== '') cell.numFmt = '#,##0.00';
          });
          currentRow++;
        });
        sNo++;
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="invoicevault_export.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`InvoiceVault running on port ${PORT}`));
