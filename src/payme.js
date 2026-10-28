// Payme Merchant API (JSON-RPC). Hujjat: https://developer.help.paycom.uz
// Payme kabinetida endpoint sifatida https://SAYT/api/payme ni ko'rsating.

const TX_TIMEOUT = 12 * 60 * 60 * 1000; // 12 soat

const ERR = {
  auth: { code: -32504, message: 'Ruxsat yo\'q' },
  method: { code: -32601, message: 'Metod topilmadi' },
  amount: { code: -31001, message: "Summa noto'g'ri" },
  txNotFound: { code: -31003, message: 'Tranzaksiya topilmadi' },
  cantCancel: { code: -31007, message: "Bekor qilib bo'lmaydi: xizmat ko'rsatilgan" },
  cantPerform: { code: -31008, message: "Amalni bajarib bo'lmaydi" },
  order: { code: -31050, message: 'Bron topilmadi', data: 'order_id' },
  orderState: { code: -31051, message: "Bronni to'lab bo'lmaydi", data: 'order_id' },
  busy: { code: -31052, message: "Bron uchun boshqa to'lov jarayonda", data: 'order_id' },
};

function checkoutUrl(cfg, booking, returnUrl) {
  const params = [
    `m=${cfg.merchantId}`,
    `ac.order_id=${booking.id}`,
    `a=${booking.total * 100}`,
    `c=${returnUrl}`,
    'l=uz',
  ].join(';');
  const host = cfg.test ? 'https://test.paycom.uz' : 'https://checkout.paycom.uz';
  return `${host}/${Buffer.from(params).toString('base64')}`;
}

function createPaymeHandler({ db, bookings, key, now = () => Date.now() }) {
  const getTx = (id) => db.prepare('SELECT * FROM payme_tx WHERE id = ?').get(id);
  const txView = (tx) => ({
    create_time: tx.create_time,
    perform_time: tx.perform_time,
    cancel_time: tx.cancel_time,
    transaction: String(tx.id),
    state: tx.state,
    reason: tx.reason ?? null,
  });

  function checkOrder(params) {
    const b = bookings.getById(Number(params.account && params.account.order_id));
    if (!b) throw ERR.order;
    if (Number(params.amount) !== b.total * 100) throw ERR.amount;
    if (!bookings.canPay(b)) throw ERR.orderState;
    return b;
  }

  function cancelTx(tx, reason, state) {
    const t = now();
    db.prepare('UPDATE payme_tx SET state = ?, cancel_time = ?, reason = ? WHERE id = ?').run(state, t, reason, tx.id);
    return getTx(tx.id);
  }

  const methods = {
    CheckPerformTransaction(params) {
      checkOrder(params);
      return { allow: true };
    },

    CreateTransaction(params) {
      const existing = getTx(params.id);
      if (existing) {
        if (existing.state !== 1) throw ERR.cantPerform;
        if (now() - existing.create_time > TX_TIMEOUT) {
          cancelTx(existing, 4, -1);
          throw ERR.cantPerform;
        }
        return { create_time: existing.create_time, transaction: existing.id, state: existing.state };
      }
      const b = checkOrder(params);
      const active = db.prepare('SELECT id FROM payme_tx WHERE booking_id = ? AND state = 1').get(b.id);
      if (active) throw ERR.busy;
      const t = now();
      db.prepare(
        'INSERT INTO payme_tx (id, booking_id, amount, time, state, create_time) VALUES (?, ?, ?, ?, 1, ?)'
      ).run(params.id, b.id, Number(params.amount), Number(params.time), t);
      bookings.extendHold(b.id, 30);
      return { create_time: t, transaction: params.id, state: 1 };
    },

    PerformTransaction(params) {
      const tx = getTx(params.id);
      if (!tx) throw ERR.txNotFound;
      if (tx.state === 2) return { transaction: tx.id, perform_time: tx.perform_time, state: 2 };
      if (tx.state !== 1) throw ERR.cantPerform;
      if (now() - tx.create_time > TX_TIMEOUT) {
        cancelTx(tx, 4, -1);
        throw ERR.cantPerform;
      }
      const t = now();
      db.prepare('UPDATE payme_tx SET state = 2, perform_time = ? WHERE id = ?').run(t, tx.id);
      bookings.markPaid(tx.booking_id);
      return { transaction: tx.id, perform_time: t, state: 2 };
    },

    CancelTransaction(params) {
      const tx = getTx(params.id);
      if (!tx) throw ERR.txNotFound;
      if (tx.state === 1) {
        const c = cancelTx(tx, params.reason, -1);
        return { transaction: c.id, cancel_time: c.cancel_time, state: -1 };
      }
      if (tx.state === 2) {
        const b = bookings.getById(tx.booking_id);
        if (b && bookings.anyUsed(b)) throw ERR.cantCancel;
        const c = cancelTx(tx, params.reason, -2);
        bookings.markCancelled(tx.booking_id);
        return { transaction: c.id, cancel_time: c.cancel_time, state: -2 };
      }
      return { transaction: tx.id, cancel_time: tx.cancel_time, state: tx.state };
    },

    CheckTransaction(params) {
      const tx = getTx(params.id);
      if (!tx) throw ERR.txNotFound;
      return txView(tx);
    },

    GetStatement(params) {
      const rows = db
        .prepare('SELECT * FROM payme_tx WHERE time >= ? AND time <= ? ORDER BY time')
        .all(Number(params.from), Number(params.to));
      return {
        transactions: rows.map((tx) => ({
          id: tx.id,
          time: tx.time,
          amount: tx.amount,
          account: { order_id: String(tx.booking_id) },
          ...txView(tx),
        })),
      };
    },
  };

  return function handle(req, res) {
    const body = req.body || {};
    const reply = (payload) => res.json({ jsonrpc: '2.0', id: body.id ?? null, ...payload });
    const expected = 'Basic ' + Buffer.from('Paycom:' + key).toString('base64');
    if (!key || req.headers.authorization !== expected) return reply({ error: ERR.auth });
    const fn = methods[body.method];
    if (!fn) return reply({ error: ERR.method });
    try {
      return reply({ result: fn(body.params || {}) });
    } catch (e) {
      if (e && typeof e.code === 'number') return reply({ error: e });
      console.error('Payme xatosi:', e);
      return reply({ error: { code: -32400, message: 'Ichki xato' } });
    }
  };
}

module.exports = { createPaymeHandler, checkoutUrl };
