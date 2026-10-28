const crypto = require('node:crypto');

// Bron logikasi: narx hisoblash, bo'sh joylarni tekshirish, holatni o'zgartirish.
function createBookingService(db, config, now = () => Date.now()) {
  const attractionIds = config.attractions.map((a) => a.id);
  const products = [...config.attractions, config.combo];
  const priceOf = Object.fromEntries(products.map((p) => [p.id, p.price]));

  function tashkentNow() {
    return new Date(now() + config.timezoneOffsetHours * 3600 * 1000);
  }
  function today() {
    return tashkentNow().toISOString().slice(0, 10);
  }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Bitta bron har bir attraksiondan nechta joy egallaydi (combo hammasiga kiradi)
  function seatsFor(items) {
    const seats = Object.fromEntries(attractionIds.map((id) => [id, items[id] || 0]));
    if (items.combo) for (const id of config.combo.includes) seats[id] += items.combo;
    return seats;
  }

  function parse(row) {
    if (!row) return null;
    return { ...row, items: JSON.parse(row.items), used: JSON.parse(row.used) };
  }

  // Slotdagi band joylar (to'langan + muddati o'tmagan kutilayotgan bronlar)
  function takenSeats(date, slot, excludeId = 0) {
    const rows = db
      .prepare(
        `SELECT items FROM bookings WHERE date = ? AND slot = ? AND id != ?
         AND (status = 'paid' OR (status = 'pending' AND expires_at > ?))`
      )
      .all(date, slot, excludeId, now());
    const taken = Object.fromEntries(attractionIds.map((id) => [id, 0]));
    for (const r of rows) {
      const s = seatsFor(JSON.parse(r.items));
      for (const id of attractionIds) taken[id] += s[id];
    }
    return taken;
  }

  function slotIsPast(date, slot) {
    if (date !== today()) return date < today();
    const t = tashkentNow();
    const [h, m] = slot.split(':').map(Number);
    // Oyna tugashidan oldin bron qilish mumkin (slot boshlanib ketgan bo'lsa ham)
    return t.getUTCHours() * 60 + t.getUTCMinutes() >= h * 60 + m + 60;
  }

  function availability(date) {
    return config.slots.map((slot) => {
      const taken = takenSeats(date, slot);
      const left = Object.fromEntries(
        config.attractions.map((a) => [a.id, Math.max(0, a.capacity - taken[a.id])])
      );
      return { slot, past: slotIsPast(date, slot), left };
    });
  }

  function fits(date, slot, items, excludeId = 0) {
    const taken = takenSeats(date, slot, excludeId);
    const need = seatsFor(items);
    return config.attractions.every((a) => taken[a.id] + need[a.id] <= a.capacity);
  }

  function validate(input) {
    const errors = [];
    const { date, slot } = input;
    const name = String(input.name || '').trim();
    const phone = String(input.phone || '').replace(/[^\d+]/g, '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) errors.push("Sanani tanlang");
    else if (date < today() || date > addDays(today(), config.bookingDaysAhead))
      errors.push("Bu sanaga bron qilib bo'lmaydi");
    if (!config.slots.includes(slot)) errors.push('Vaqtni tanlang');
    else if (date && slotIsPast(date, slot)) errors.push("Bu vaqt o'tib ketgan");
    if (name.length < 2 || name.length > 80) errors.push('Ismingizni kiriting');
    if (!/^\+?998\d{9}$/.test(phone) && !/^\d{9}$/.test(phone))
      errors.push("Telefon raqamini to'g'ri kiriting (+998 XX XXX XX XX)");

    const items = {};
    let count = 0;
    for (const p of products) {
      const n = Number((input.items || {})[p.id] || 0);
      if (!Number.isInteger(n) || n < 0 || n > config.maxPerItem) {
        errors.push("Chipta soni noto'g'ri");
        break;
      }
      if (n) items[p.id] = n;
      count += n;
    }
    if (!count) errors.push('Kamida bitta chipta tanlang');
    const payMethod = input.payMethod;
    return {
      errors,
      value: {
        date,
        slot,
        name,
        phone: phone.startsWith('+') ? phone : phone.length === 9 ? '+998' + phone : '+' + phone,
        items,
        payMethod,
      },
    };
  }

  function total(items) {
    return Object.entries(items).reduce((s, [id, n]) => s + priceOf[id] * n, 0);
  }

  function newCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(8);
    let s = '';
    for (const b of bytes) s += alphabet[b % alphabet.length];
    return 'UG-' + s;
  }

  function create(input) {
    const { errors, value } = validate(input);
    if (errors.length) return { errors };
    if (!fits(value.date, value.slot, value.items))
      return { errors: ["Bu vaqtda joy qolmadi. Boshqa vaqtni tanlang."] };
    const sum = total(value.items);
    const t = now();
    const code = newCode();
    const info = db
      .prepare(
        `INSERT INTO bookings (code, date, slot, name, phone, items, total, pay_method, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        value.date,
        value.slot,
        value.name,
        value.phone,
        JSON.stringify(value.items),
        sum,
        value.payMethod,
        t,
        t + config.holdMinutes * 60 * 1000
      );
    return { booking: getById(Number(info.lastInsertRowid)) };
  }

  function getById(id) {
    return parse(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
  }
  function getByCode(code) {
    return parse(db.prepare('SELECT * FROM bookings WHERE code = ?').get(String(code || '').toUpperCase()));
  }

  // To'lov kelganda: kutilayotgan bron hali to'lanishi mumkinmi?
  function canPay(b) {
    if (!b || b.status !== 'pending') return false;
    if (b.expires_at > now()) return true;
    // Muddati o'tgan, lekin joy hali bor bo'lsa — qabul qilamiz
    return !slotIsPast(b.date, b.slot) && fits(b.date, b.slot, b.items, b.id);
  }

  // To'lov jarayoni boshlanganda joyni yana ushlab turamiz
  function extendHold(id, minutes) {
    db.prepare(`UPDATE bookings SET expires_at = MAX(expires_at, ?) WHERE id = ? AND status = 'pending'`).run(
      now() + minutes * 60 * 1000,
      id
    );
  }

  function markPaid(id) {
    db.prepare(`UPDATE bookings SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'`).run(now(), id);
    return getById(id);
  }
  function markCancelled(id) {
    db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(id);
    return getById(id);
  }

  // Har bir attraksionda nechta odam o'tishi mumkin
  function allowance(b) {
    return seatsFor(b.items);
  }
  function anyUsed(b) {
    return Object.values(b.used).some((n) => n > 0);
  }

  function checkIn(code, attractionId, count) {
    const b = getByCode(code);
    if (!b) return { error: 'Bron topilmadi' };
    if (b.status !== 'paid') return { error: "Bron to'lanmagan" };
    if (!attractionIds.includes(attractionId)) return { error: 'Attraksion noto\'g\'ri' };
    const allowed = allowance(b)[attractionId];
    const used = b.used[attractionId] || 0;
    const n = Math.max(1, Math.floor(Number(count) || 1));
    if (used + n > allowed) return { error: `Bu attraksionda faqat ${allowed - used} ta joy qolgan` };
    b.used[attractionId] = used + n;
    db.prepare('UPDATE bookings SET used = ? WHERE id = ?').run(JSON.stringify(b.used), b.id);
    return { booking: getById(b.id) };
  }

  function list(date) {
    return db
      .prepare(`SELECT * FROM bookings WHERE date = ? AND status != 'cancelled' ORDER BY slot, id`)
      .all(date)
      .map(parse)
      .filter((b) => b.status === 'paid' || b.expires_at > now());
  }

  // Mijozga ko'rsatiladigan ma'lumot
  function publicView(b) {
    const expired = b.status === 'pending' && !canPay(b);
    return {
      code: b.code,
      date: b.date,
      slot: b.slot,
      name: b.name,
      phone: b.phone.replace(/(\+998\d{2})\d{5}(\d{2})/, '$1*****$2'),
      items: b.items,
      total: b.total,
      status: expired ? 'expired' : b.status,
      payMethod: b.pay_method,
      allowance: allowance(b),
      used: b.used,
    };
  }

  return {
    today,
    addDays,
    availability,
    create,
    getById,
    getByCode,
    canPay,
    extendHold,
    markPaid,
    markCancelled,
    checkIn,
    list,
    allowance,
    anyUsed,
    publicView,
    products,
  };
}

module.exports = { createBookingService };
