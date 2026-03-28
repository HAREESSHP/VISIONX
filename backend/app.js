/* ============================================
   VisionX — Full Ticketing Backend
   Express + MongoDB + Razorpay + Nodemailer + QR
   ============================================ */
require('dotenv').config();

const express   = require('express');
const mongoose  = require('mongoose');
const Razorpay  = require('razorpay');
const nodemailer = require('nodemailer');
const QRCode    = require('qrcode');
const crypto    = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path      = require('path');
const cors      = require('cors');

const app = express();

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));   // serve frontend

// ── MongoDB Connection ────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅  MongoDB connected');
    await Ticket.syncIndexes();
    console.log('✅  MongoDB indexes synced');
  })
  .catch(err => console.error('❌  MongoDB error:', err));

// ── Ticket Schema ─────────────────────────────
const ticketSchema = new mongoose.Schema({
  ticketId:   { type: String, unique: true, required: true },
  name:       { type: String, required: true },
  rollno:     { type: String, required: true },
  email:      { type: String, required: true },
  phone:      { type: String, required: true },
  college:    { type: String, required: true },
  department: { type: String, required: true },
  orderId:    { type: String },
  paymentId:  { type: String },
  amount:     { type: Number, default: 1 },
  status:     { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  scanned:    { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
});
const Ticket = mongoose.model('Ticket', ticketSchema);

// ── Razorpay Instance ─────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── Email Transporter ─────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* =============================================
   ROUTE: POST /api/create-order
   Creates Razorpay order + pending ticket
   ============================================= */
app.post('/api/create-order', async (req, res) => {
  try {
    const { name, rollno, email, phone, college, department } = req.body;

    if (!name || !rollno || !email || !phone || !college || !department) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already bought a ticket with this email or phone
    const existingTicket = await Ticket.findOne({
      $or: [{ email }, { phone }],
      status: 'paid'
    });
    if (existingTicket) {
      if (existingTicket.phone === phone) {
        return res.status(400).json({ error: 'A ticket has already been successfully purchased with this phone number.' });
      }
      return res.status(400).json({ error: 'A ticket has already been successfully purchased with this email address.' });
    }

    // Create Razorpay order (₹1 = 100 paise)
    const order = await razorpay.orders.create({
      amount:   100,
      currency: 'INR',
      receipt:  `rcpt_${Date.now()}`
    });

    // Generate unique ticket ID (VX + 8 chars)
    const ticketId = 'VX' + uuidv4().replace(/-/g, '').toUpperCase().slice(0, 8);

    // Save pending ticket
    await Ticket.create({
      ticketId, name, rollno, email, phone, college, department,
      orderId: order.id,
      status: 'pending'
    });

    res.json({
      orderId:  order.id,
      ticketId,
      amount:   100,
      key:      process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('create-order error:', err);
    if (err.name === 'MongoServerError' && err.code === 11000) {
      return res.status(400).json({ error: 'Hold on! You cannot purchase another ticket using the same details.' });
    }
    res.status(500).json({ error: 'Order creation failed. Error: ' + err.message });
  }
});

/* =============================================
   ROUTE: POST /api/verify-payment
   Verifies Razorpay signature, marks paid, sends email
   ============================================= */
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, ticketId } = req.body;

    // Verify HMAC signature
    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed — signature mismatch' });
    }

    // Update ticket to paid
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      { paymentId: razorpay_payment_id, status: 'paid' },
      { new: true }
    );

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Generate QR code containing only the verification link so scanners automatically open the ticket info page
    const qrContent = `${process.env.BASE_URL}/ticket/${ticket.ticketId}`;

    const qrDataUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width:  320,
      color:  { dark: '#1a1a2e', light: '#ffffff' }
    });

    // Send confirmation email with QR
    await sendTicketEmail(ticket, qrDataUrl);

    res.json({ success: true, ticketId: ticket.ticketId });
  } catch (err) {
    console.error('verify-payment error:', err);
    res.status(500).json({ error: 'Error: ' + err.message });
  }
});

/* =============================================
   ROUTE: GET /ticket/:ticketId
   QR scan destination — shows ticket details
   ============================================= */
app.get('/ticket/:ticketId', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket)            return res.status(404).send(scanHTML({ valid: false, reason: 'not_found' }));
    if (ticket.status !== 'paid') return res.send(scanHTML({ valid: false, reason: 'unpaid', ticket }));

    // Mark scanned
    if (!ticket.scanned) { ticket.scanned = true; await ticket.save(); }

    res.send(scanHTML({ valid: true, ticket }));
  } catch (err) {
    res.status(500).send('<h1>Server Error</h1>');
  }
});

/* =============================================
   ROUTE: GET /admin  →  serves admin.html
   ============================================= */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

/* =============================================
   ROUTE: GET /api/admin/tickets   (protected)
   ============================================= */
app.get('/api/admin/tickets', requireAdmin, async (req, res) => {
  const tickets = await Ticket.find().sort({ createdAt: -1 });
  res.json(tickets);
});

/* =============================================
   ROUTE: GET /api/admin/stats     (protected)
   ============================================= */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const [paid, scanned, pending] = await Promise.all([
    Ticket.countDocuments({ status: 'paid' }),
    Ticket.countDocuments({ scanned: true }),
    Ticket.countDocuments({ status: 'pending' })
  ]);
  res.json({ paid, scanned, pending, revenue: paid * 1 });
});

/* =============================================
   ROUTE: POST /api/admin/approve-ticket
   Admin manual override to approve a ticket
   ============================================= */
app.post('/api/admin/approve-ticket', requireAdmin, async (req, res) => {
  try {
    const { ticketId } = req.body;
    const ticket = await Ticket.findOneAndUpdate(
      { ticketId, status: 'pending' },
      { status: 'paid', paymentId: 'Manual Admin Approval' },
      { new: true }
    );

    if (!ticket) return res.status(404).json({ error: 'Pending ticket not found' });

    // Generate QR Content
    const qrContent = `${process.env.BASE_URL}/ticket/${ticket.ticketId}`;
    const qrDataUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width:  320,
      color:  { dark: '#1a1a2e', light: '#ffffff' }
    });

    // Send Mail
    await sendTicketEmail(ticket, qrDataUrl);

    res.json({ success: true, ticket });
  } catch (err) {
    console.error('Manual approval error:', err);
    res.status(500).json({ error: 'Approval failed: ' + err.message });
  }
});

// ── Admin auth middleware ──────────────────────
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/* =============================================
   EMAIL — ticket confirmation with QR
   ============================================= */
async function sendTicketEmail(ticket, qrDataUrl) {
  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');

  await transporter.sendMail({
    from:    `"VisionX Events 🎉" <${process.env.EMAIL_USER}>`,
    to:      ticket.email,
    subject: `🎟️ Your VisionX Event Pass – Entry Details Inside`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body  { margin:0; padding:0; background:#0a0a14; font-family:Arial,sans-serif; }
    .wrap { max-width:600px; margin:0 auto; background:#12122a; border-radius:20px; overflow:hidden; }
    .hdr  { background:linear-gradient(135deg,#6366f1,#ec4899); padding:40px; text-align:center; color:#fff; }
    .hdr h1 { margin:0; font-size:2rem; font-weight:800; letter-spacing:-1px; }
    .hdr p  { margin:8px 0 0; opacity:.9; font-size:1rem; }
    .body { padding:36px 40px; color:#fff; }
    .body p { font-size: 1rem; line-height: 1.6; color: rgba(255,255,255,0.9); margin-bottom: 20px; }
    .instructions { background: rgba(99,102,241,0.1); border-left: 4px solid #6366f1; padding: 20px; border-radius: 8px; margin: 24px 0; }
    .instructions h3 { margin-top: 0; color: #a5b4fc; font-size: 1.1rem; margin-bottom: 12px; }
    .instructions ul { margin: 0; padding-left: 20px; color: rgba(255,255,255,0.8); }
    .instructions li { margin-bottom: 8px; font-size: 0.95rem; }
    .qr   { text-align:center; padding:30px 0; background:rgba(255,255,255,0.02); border-radius:12px; margin:20px 0;}
    .qr img { width:200px; height:200px; background:#fff; border-radius:16px; padding:12px; }
    .qr p { color:rgba(255,255,255,.5); margin-top:12px; font-size:.85rem; }
    .note { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); border-radius:12px; padding:18px; color:rgba(255,255,255,.8); font-size:.9rem; text-align:center; line-height:1.5; }
    .note strong { color: #ef4444; }
    .ftr  { background:rgba(255,255,255,.04); padding:22px; text-align:center; color:rgba(255,255,255,.4); font-size:.85rem; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>VisionX 🎟️</h1>
      <p>Entry Pass Successfully Generated</p>
    </div>
    <div class="body">
      <p>Dear Participant,</p>
      <p>Greetings from VisionX!</p>
      <p>Thank you for registering for our upcoming Main Event. We’re excited to have you be a part of this experience.</p>
      <p>Your entry pass (QR Code Scanner) has been successfully generated. Please find it attached with this email. This QR code will be used for verification at the entry gate.</p>
      
      <div class="qr">
        <img src="cid:qrcode" alt="Entry QR Code"/>
        <p>Ticket ID: ${ticket.ticketId}</p>
      </div>

      <div class="instructions">
        <h3>📌 Important Instructions:</h3>
        <ul>
          <li>Carry this QR code soft copy to the venue</li>
          <li>Ensure your phone is charged for quick access</li>
          <li>Reach the venue on time as per your slot</li>
          <li>Follow instructions from the organizing team</li>
        </ul>
      </div>

      <div class="note">
        ⚠️ <strong>Note:</strong> Each QR code is unique and valid for one-time entry only.
      </div>

      <p style="margin-top:24px;">We look forward to seeing you at the event. Get ready for an exciting experience!</p>
      <p>For any queries, feel free to contact us.</p>
    </div>
    <div class="ftr">
      Best Regards,<br/>
      <strong>VisionX Team</strong><br/>
      Guru Nanak Institutions
    </div>
  </div>
</body>
</html>`,
    attachments: [{
      filename: 'visionx-ticket-qr.png',
      content:  base64,
      encoding: 'base64',
      cid:      'qrcode'
    }]
  });
}

/* =============================================
   QR SCAN PAGE HTML — shown when QR is scanned
   ============================================= */
function scanHTML({ valid, reason, ticket }) {
  if (!valid) {
    const isNotFound = reason === 'not_found';
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invalid Ticket — VisionX</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Poppins',sans-serif;background:#0a0a14;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#12122a;border-radius:24px;padding:50px 40px;text-align:center;max-width:400px;width:100%;border:1px solid rgba(239,68,68,.3);box-shadow:0 0 60px rgba(239,68,68,.1)}.icon{font-size:4rem;margin-bottom:20px}h1{color:#ef4444;font-size:1.6rem;margin-bottom:12px}p{color:rgba(255,255,255,.5);line-height:1.7}</style>
</head><body><div class="card">
<div class="icon">${isNotFound ? '❌' : '⚠️'}</div>
<h1>${isNotFound ? 'Invalid Ticket' : 'Payment Incomplete'}</h1>
<p>${isNotFound ? 'This ticket does not exist or has been tampered with.' : `Ticket ${ticket?.ticketId} payment was not completed.`}</p>
</div></body></html>`;
  }

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VisionX Ticket — ${ticket.ticketId}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Poppins',sans-serif;background:linear-gradient(135deg,#0a0a14,#0f0f20);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#12122a;border-radius:24px;overflow:hidden;max-width:440px;width:100%;border:1px solid rgba(99,102,241,.35);box-shadow:0 30px 80px rgba(0,0,0,.6)}
.hdr{background:linear-gradient(135deg,#6366f1,#ec4899);padding:32px;text-align:center}
.hdr h1{font-size:1.8rem;font-weight:800;color:#fff}
.hdr p{margin-top:6px;color:rgba(255,255,255,.85);font-size:.95rem}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(16,185,129,.25);border:1px solid rgba(16,185,129,.6);color:#10b981;padding:8px 22px;border-radius:50px;font-weight:700;margin-top:16px;font-size:.9rem}
.body{padding:32px}
.row{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.9rem}
.row:last-child{border-bottom:none}
.lbl{color:rgba(255,255,255,.45)}
.val{font-weight:600;color:#fff;text-align:right;max-width:55%}
.tid{color:#f97316;font-size:1.05rem;font-weight:800}
.green{color:#10b981}
.scanned{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:14px;padding:14px;text-align:center;color:#10b981;font-size:.85rem;margin-top:24px}
.ftr{background:rgba(255,255,255,.04);padding:18px;text-align:center;color:rgba(255,255,255,.35);font-size:.78rem}
</style></head><body>
<div class="card">
  <div class="hdr">
    <h1>🎟 VisionX</h1>
    <p>Cultural Day Concert 2026</p>
    <div class="badge">✅ Valid Ticket</div>
  </div>
  <div class="body">
    <div class="row"><span class="lbl">Name</span><span class="val">${ticket.name}</span></div>
    <div class="row"><span class="lbl">Roll No</span><span class="val">${ticket.rollno}</span></div>
    <div class="row"><span class="lbl">Ticket ID</span><span class="val tid">${ticket.ticketId}</span></div>
    <div class="row"><span class="lbl">Phone</span><span class="val">${ticket.phone}</span></div>
    <div class="row"><span class="lbl">College</span><span class="val">${ticket.college}</span></div>
    <div class="row"><span class="lbl">Department</span><span class="val">${ticket.department}</span></div>
    <div class="row"><span class="lbl">Event Date</span><span class="val">April 04, 2026 | 5 PM</span></div>
    <div class="row"><span class="lbl">Venue</span><span class="val">GNIT Open Grounds</span></div>
    <div class="row"><span class="lbl">Amount Paid</span><span class="val green">₹1 ✓</span></div>
    <div class="scanned">✅ Entry validated — ${ticket.scanned ? 'already scanned once' : 'first scan'}</div>
  </div>
  <div class="ftr">VisionX Club • Guru Nanak Institutions, Hyderabad</div>
</div>
</body></html>`;
}

// ── Start Server ──────────────────────────────
const PORT = process.env.PORT || 5500;
// Only listen fully when NOT running in Serverless/Vercel environments
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`\n🚀  VisionX Server → http://localhost:${PORT}`);
    console.log(`🎟  Ticket scan  → http://localhost:${PORT}/ticket/:id`);
    console.log(`🛡  Admin panel  → http://localhost:${PORT}/admin\n`);
  });
}

// Export the app for Vercel serverless functions
module.exports = app;
