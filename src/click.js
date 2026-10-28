// Click SHOP API (Prepare / Complete). Hujjat: https://docs.click.uz
// Click kabinetida: Prepare URL = https://SAYT/api/click/prepare, Complete URL = https://SAYT/api/click/complete

const crypto = require('node:crypto');

function payUrl(cfg, booking, returnUrl) {
  const q = new URLSearchParams({
    service_id: cfg.serviceId,
    merchant_id: cfg.merchantId,
    amount: String(booking.total),
    transaction_param: String(booking.id),
    return_url: returnUrl,
  });
  return `https://my.click.uz/services/pay?${q}`;
}

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

function createClickHandlers({ db, bookings, secretKey, serviceId, now = () => Date.now() }) {
  function verify(p, withPrepareId) {
    const parts = [p.click_trans_id, p.service_id, secretKey, p.merchant_trans_id];
    if (withPrepareId) parts.push(p.merchant_prepare_id);
    parts.push(p.amount, p.action, p.sign_time);
    return md5(parts.join('')) === String(p.sign_string || '');
  }

  function base(p, extra) {
    return { click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id, ...extra };
  }

  function prepare(req, res) {
    const p = req.body || {};
    if (!secretKey || !verify(p, false) || String(p.service_id) !== String(serviceId))
      return res.json(base(p, { error: -1, error_note: 'SIGN CHECK FAILED' }));
    if (String(p.action) !== '0') return res.json(base(p, { error: -3, error_note: 'Action not found' }));
    const b = bookings.getById(Number(p.merchant_trans_id));
    if (!b) return res.json(base(p, { error: -5, error_note: 'Order not found' }));
    if (b.status === 'paid') return res.json(base(p, { error: -4, error_note: 'Already paid' }));
    if (Math.abs(Number(p.amount) - b.total) > 0.01)
      return res.json(base(p, { error: -2, error_note: 'Incorrect amount' }));
    if (!bookings.canPay(b)) return res.json(base(p, { error: -9, error_note: 'Order expired' }));
    const info = db
      .prepare("INSERT INTO click_tx (click_trans_id, booking_id, amount, status, created_at) VALUES (?, ?, ?, 'prepared', ?)")
      .run(String(p.click_trans_id), b.id, Number(p.amount), now());
    bookings.extendHold(b.id, 30);
    return res.json(base(p, { merchant_prepare_id: Number(info.lastInsertRowid), error: 0, error_note: 'Success' }));
  }

  function complete(req, res) {
    const p = req.body || {};
    if (!secretKey || !verify(p, true) || String(p.service_id) !== String(serviceId))
      return res.json(base(p, { error: -1, error_note: 'SIGN CHECK FAILED' }));
    if (String(p.action) !== '1') return res.json(base(p, { error: -3, error_note: 'Action not found' }));
    const tx = db.prepare('SELECT * FROM click_tx WHERE id = ?').get(Number(p.merchant_prepare_id));
    if (!tx || tx.click_trans_id !== String(p.click_trans_id) || tx.booking_id !== Number(p.merchant_trans_id))
      return res.json(base(p, { error: -6, error_note: 'Transaction not found' }));
    const b = bookings.getById(tx.booking_id);
    if (!b) return res.json(base(p, { error: -5, error_note: 'Order not found' }));
    if (tx.status === 'completed' || b.status === 'paid')
      return res.json(base(p, { merchant_confirm_id: tx.id, error: -4, error_note: 'Already paid' }));
    if (tx.status === 'cancelled') return res.json(base(p, { error: -9, error_note: 'Transaction cancelled' }));
    if (Math.abs(Number(p.amount) - b.total) > 0.01)
      return res.json(base(p, { error: -2, error_note: 'Incorrect amount' }));
    if (Number(p.error) < 0) {
      db.prepare("UPDATE click_tx SET status = 'cancelled' WHERE id = ?").run(tx.id);
      return res.json(base(p, { error: -9, error_note: 'Transaction cancelled' }));
    }
    if (b.status !== 'pending') return res.json(base(p, { error: -9, error_note: 'Order cancelled' }));
    db.prepare("UPDATE click_tx SET status = 'completed' WHERE id = ?").run(tx.id);
    bookings.markPaid(b.id);
    return res.json(base(p, { merchant_confirm_id: tx.id, error: 0, error_note: 'Success' }));
  }

  return { prepare, complete };
}

module.exports = { createClickHandlers, payUrl, md5 };
