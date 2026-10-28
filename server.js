const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const QRCode = require('qrcode');
const config = require('./src/config');
const { open } = require('./src/db');
const { createBookingService } = require('./src/bookings');
const payme = require('./src/payme');
const click = require('./src/click');

function loadEnvFile() {
  try {
    process.loadEnvFile(path.join(__dirname, '.env'));
  } catch {
    /* .env bo'lmasa ham ishlaydi */
  }
}

function createApp(env = process.env, { dbFile, now } = {}) {
  const db = open(dbFile || env.DB_FILE || path.join(__dirname, 'data', 'park.db'));
  const bookings = createBookingService(db, config, now);
  const baseUrl = (env.BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, '');

  const paymeCfg = { merchantId: env.PAYME_MERCHANT_ID, key: env.PAYME_KEY, test: env.PAYME_TEST === '1' };
  const clickCfg = {
    serviceId: env.CLICK_SERVICE_ID,
    merchantId: env.CLICK_MERCHANT_ID,
    secretKey: env.CLICK_SECRET_KEY,
  };
  const methods = [];
  if (paymeCfg.merchantId && paymeCfg.key) methods.push('payme');
  if (clickCfg.serviceId && clickCfg.merchantId && clickCfg.secretKey) methods.push('click');
  const demo = env.PAYMENT_DEMO === '1' || (env.PAYMENT_DEMO !== '0' && methods.length === 0);
  if (demo) methods.push('demo');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

  const ticketUrl = (b) => `${baseUrl}/ticket/${b.code}`;

  function paymentUrl(b) {
    if (b.pay_method === 'payme') return payme.checkoutUrl(paymeCfg, b, ticketUrl(b));
    if (b.pay_method === 'click') return click.payUrl(clickCfg, b, ticketUrl(b));
    return `/pay-demo?code=${b.code}`;
  }

  // --- Ommaviy API ---
  app.get('/api/config', (req, res) => {
    res.json({
      brand: config.brand,
      slots: config.slots,
      attractions: config.attractions,
      combo: config.combo,
      maxPerItem: config.maxPerItem,
      holdMinutes: config.holdMinutes,
      today: bookings.today(),
      lastDay: bookings.addDays(bookings.today(), config.bookingDaysAhead),
      payMethods: methods,
    });
  });

  app.get('/api/availability', (req, res) => {
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Sana noto'g'ri" });
    res.json({ date, slots: bookings.availability(date) });
  });

  app.post('/api/bookings', (req, res) => {
    const input = req.body || {};
    if (!methods.includes(input.payMethod)) return res.status(400).json({ errors: ["To'lov usulini tanlang"] });
    const result = bookings.create(input);
    if (result.errors) return res.status(400).json({ errors: result.errors });
    const b = result.booking;
    res.status(201).json({ code: b.code, total: b.total, payUrl: paymentUrl(b), ticketUrl: `/ticket/${b.code}` });
  });

  app.get('/api/tickets/:code', (req, res) => {
    const b = bookings.getByCode(req.params.code);
    if (!b) return res.status(404).json({ error: 'Bron topilmadi' });
    const view = bookings.publicView(b);
    if (view.status === 'pending') view.payUrl = paymentUrl(b);
    res.json(view);
  });

  app.get('/api/tickets/:code/qr.svg', async (req, res) => {
    const b = bookings.getByCode(req.params.code);
    if (!b) return res.status(404).end();
    const svg = await QRCode.toString(ticketUrl(b), { type: 'svg', margin: 1, color: { dark: '#173d17', light: '#ffffff' } });
    res.type('image/svg+xml').send(svg);
  });

  app.get('/ticket/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ticket.html')));

  // --- Demo to'lov (Payme/Click ulanmaguncha sinash uchun) ---
  app.post('/api/demo-pay/:code', (req, res) => {
    if (!demo) return res.status(404).json({ error: "Demo to'lov o'chirilgan" });
    const b = bookings.getByCode(req.params.code);
    if (!b) return res.status(404).json({ error: 'Bron topilmadi' });
    if (!bookings.canPay(b)) return res.status(400).json({ error: "Bronni to'lab bo'lmaydi" });
    bookings.markPaid(b.id);
    res.json({ ok: true, ticketUrl: `/ticket/${b.code}` });
  });

  // --- To'lov tizimlari callbacklari ---
  app.post('/api/payme', payme.createPaymeHandler({ db, bookings, key: paymeCfg.key, now }));
  const clickHandlers = click.createClickHandlers({
    db,
    bookings,
    secretKey: clickCfg.secretKey,
    serviceId: clickCfg.serviceId,
    now,
  });
  app.post('/api/click/prepare', clickHandlers.prepare);
  app.post('/api/click/complete', clickHandlers.complete);

  // --- Admin (xodimlar) ---
  function admin(req, res, next) {
    const pass = env.ADMIN_PASSWORD || '';
    const given = String(req.headers['x-admin-token'] || '');
    const ok =
      pass.length > 0 &&
      given.length === pass.length &&
      crypto.timingSafeEqual(Buffer.from(given), Buffer.from(pass));
    if (!ok) return res.status(401).json({ error: "Parol noto'g'ri" });
    next();
  }

  app.get('/api/admin/bookings', admin, (req, res) => {
    const date = String(req.query.date || bookings.today());
    const list = bookings.list(date).map((b) => ({
      ...bookings.publicView(b),
      phone: b.phone,
      createdAt: b.created_at,
    }));
    const paid = list.filter((b) => b.status === 'paid');
    res.json({
      date,
      bookings: list,
      stats: {
        paidCount: paid.length,
        revenue: paid.reduce((s, b) => s + b.total, 0),
        people: paid.reduce(
          (acc, b) => {
            for (const [k, v] of Object.entries(b.allowance)) acc[k] = (acc[k] || 0) + v;
            return acc;
          },
          {}
        ),
      },
    });
  });

  app.get('/api/admin/tickets/:code', admin, (req, res) => {
    const b = bookings.getByCode(req.params.code);
    if (!b) return res.status(404).json({ error: 'Bron topilmadi' });
    res.json({ ...bookings.publicView(b), phone: b.phone });
  });

  app.post('/api/admin/checkin', admin, (req, res) => {
    const { code, attraction, count } = req.body || {};
    const r = bookings.checkIn(code, attraction, count);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ...bookings.publicView(r.booking), phone: r.booking.phone });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi' }));
  app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

  return { app, db, demo, methods };
}

if (require.main === module) {
  loadEnvFile();
  const { app, methods } = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Ugam Gravity Park sayti: http://localhost:${port}`);
    console.log(`To'lov usullari: ${methods.join(', ')}`);
    if (!process.env.ADMIN_PASSWORD) console.log('Diqqat: ADMIN_PASSWORD o\'rnatilmagan — admin panel yopiq.');
  });
}

module.exports = { createApp };
