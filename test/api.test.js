const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../server');
const { md5 } = require('../src/click');

// Toshkent bo'yicha 2026-06-07 (yakshanba) 08:00
let clock = Date.UTC(2026, 5, 7, 3, 0);
const now = () => clock;
const env = {
  ADMIN_PASSWORD: 'secret',
  PAYME_MERCHANT_ID: 'm1',
  PAYME_KEY: 'pkey',
  CLICK_SERVICE_ID: '11',
  CLICK_MERCHANT_ID: '22',
  CLICK_SECRET_KEY: 'ckey',
  PAYMENT_DEMO: '1',
  BASE_URL: 'https://park.test',
};
let server, base;

before(async () => {
  const os = require('node:os'); const fs = require('node:fs'); const path = require('node:path');
  env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ugam-up-'));
  const { app } = createApp(env, { dbFile: ':memory:', now });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (path, body, headers = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const book = (extra = {}) =>
  post('/api/bookings', {
    date: '2026-06-07',
    slot: '10:00',
    name: 'Aziz',
    phone: '+998 90 123 45 67',
    items: { superman: 2, bridge: 1 },
    payMethod: 'demo',
    ...extra,
  });
const paymeAuth = { authorization: 'Basic ' + Buffer.from('Paycom:pkey').toString('base64') };
const rpc = (method, params) => post('/api/payme', { id: 1, method, params }, paymeAuth).then((r) => r.json());

test('narx serverda hisoblanadi va demo to\'lov chiptani ochadi', async () => {
  const r = await book();
  assert.equal(r.status, 201);
  const b = await r.json();
  assert.equal(b.total, 2 * 250000 + 40000);
  let t = await (await fetch(`${base}/api/tickets/${b.code}`)).json();
  assert.equal(t.status, 'pending');
  assert.deepEqual(t.allowance, { zipline: 0, superman: 2, swing: 0, bridge: 1 });
  assert.equal(t.phone, '+99890*****67');
  const pay = await post(`/api/demo-pay/${b.code}`, {});
  assert.equal(pay.status, 200);
  t = await (await fetch(`${base}/api/tickets/${b.code}`)).json();
  assert.equal(t.status, 'paid');
  const qr = await fetch(`${base}/api/tickets/${b.code}/qr.svg`);
  assert.match(await qr.text(), /<svg/);
});

test("noto'g'ri ma'lumotlar rad etiladi", async () => {
  const r = await book({ phone: '123', items: {}, slot: '07:00' });
  assert.equal(r.status, 400);
  const { errors } = await r.json();
  assert.ok(errors.length >= 3);
  assert.equal((await book({ date: '2026-06-06' })).status, 400); // o'tgan kun
  assert.equal((await book({ items: { zipline: -1 } })).status, 400);
  assert.equal((await book({ items: { combo: 1 } })).status, 400); // paket o'chirilgan
  assert.equal((await book({ payMethod: 'cash' })).status, 400);
});

test("sig'im oshib ketmaydi", async () => {
  // giga belanchak sig'imi 30
  const first = await book({ slot: '12:00', items: { swing: 20 } });
  assert.equal(first.status, 201);
  const second = await book({ slot: '12:00', items: { swing: 11 } });
  assert.equal(second.status, 400);
  const av = await (await fetch(`${base}/api/availability?date=2026-06-07`)).json();
  assert.equal(av.slots.find((s) => s.slot === '12:00').left.swing, 10);
  // to'lanmagan bron muddati o'tgach joy bo'shaydi
  clock += 21 * 60 * 1000;
  const third = await book({ slot: '12:00', items: { swing: 11 } });
  assert.equal(third.status, 201);
});

test('Payme oqimi: tekshirish, yaratish, bajarish, bekor qilish', async () => {
  const b = await (await book({ payMethod: 'payme', slot: '15:00' })).json();
  assert.match(b.payUrl, /^https:\/\/checkout\.paycom\.uz\//);
  const t = await (await fetch(`${base}/api/tickets/${b.code}`)).json();
  // order_id = bron id (payUrl ichida)
  const decoded = Buffer.from(b.payUrl.split('/').pop(), 'base64').toString();
  const orderId = /ac\.order_id=(\d+)/.exec(decoded)[1];
  assert.match(decoded, new RegExp(`a=${t.total * 100}`));

  const bad = await post('/api/payme', { id: 1, method: 'CheckPerformTransaction', params: {} });
  assert.equal((await bad.json()).error.code, -32504);

  let res = await rpc('CheckPerformTransaction', { amount: 1, account: { order_id: orderId } });
  assert.equal(res.error.code, -31001);
  res = await rpc('CheckPerformTransaction', { amount: t.total * 100, account: { order_id: '99999' } });
  assert.equal(res.error.code, -31050);
  res = await rpc('CheckPerformTransaction', { amount: t.total * 100, account: { order_id: orderId } });
  assert.equal(res.result.allow, true);

  res = await rpc('CreateTransaction', { id: 'tx1', time: clock, amount: t.total * 100, account: { order_id: orderId } });
  assert.equal(res.result.state, 1);
  res = await rpc('CreateTransaction', { id: 'tx2', time: clock, amount: t.total * 100, account: { order_id: orderId } });
  assert.equal(res.error.code, -31052);
  res = await rpc('PerformTransaction', { id: 'tx1' });
  assert.equal(res.result.state, 2);
  const again = await rpc('PerformTransaction', { id: 'tx1' });
  assert.equal(again.result.perform_time, res.result.perform_time);
  assert.equal((await (await fetch(`${base}/api/tickets/${b.code}`)).json()).status, 'paid');

  res = await rpc('CheckTransaction', { id: 'tx1' });
  assert.equal(res.result.state, 2);
  res = await rpc('GetStatement', { from: 0, to: clock + 1 });
  assert.ok(res.result.transactions.some((x) => x.id === 'tx1'));

  res = await rpc('CancelTransaction', { id: 'tx1', reason: 5 });
  assert.equal(res.result.state, -2);
  assert.equal((await (await fetch(`${base}/api/tickets/${b.code}`)).json()).status, 'cancelled');
});

test('Click oqimi: prepare va complete imzo bilan', async () => {
  const b = await (await book({ payMethod: 'click', slot: '16:00', items: { bridge: 2 } })).json();
  assert.match(b.payUrl, /my\.click\.uz/);
  const orderId = new URL(b.payUrl).searchParams.get('transaction_param');
  const p = {
    click_trans_id: '777',
    service_id: '11',
    click_paydoc_id: '1',
    merchant_trans_id: orderId,
    amount: '80000.00',
    action: '0',
    error: '0',
    error_note: '',
    sign_time: '2026-06-07 10:00:00',
  };
  const sign = (x, prep) =>
    md5(x.click_trans_id + x.service_id + 'ckey' + x.merchant_trans_id + (prep ?? '') + x.amount + x.action + x.sign_time);
  const form = (o) =>
    fetch(base + o.path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o.body) }).then((r) => r.json());

  let r = await form({ path: '/api/click/prepare', body: { ...p, sign_string: 'bad' } });
  assert.equal(r.error, -1);
  r = await form({ path: '/api/click/prepare', body: { ...p, amount: '1.00', sign_string: sign({ ...p, amount: '1.00' }) } });
  assert.equal(r.error, -2);
  r = await form({ path: '/api/click/prepare', body: { ...p, sign_string: sign(p) } });
  assert.equal(r.error, 0);
  const c = { ...p, action: '1', merchant_prepare_id: String(r.merchant_prepare_id) };
  r = await form({ path: '/api/click/complete', body: { ...c, sign_string: sign(c, c.merchant_prepare_id) } });
  assert.equal(r.error, 0);
  assert.equal((await (await fetch(`${base}/api/tickets/${b.code}`)).json()).status, 'paid');
  r = await form({ path: '/api/click/complete', body: { ...c, sign_string: sign(c, c.merchant_prepare_id) } });
  assert.equal(r.error, -4);
});

test("admin: parol, ro'yxat va attraksionda belgilash", async () => {
  const b = await (await book({ slot: '17:00', items: { zipline: 1, swing: 1 } })).json();
  await post(`/api/demo-pay/${b.code}`, {});
  const h = { 'x-admin-token': 'secret' };
  assert.equal((await fetch(`${base}/api/admin/bookings?date=2026-06-07`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/bookings?date=2026-06-07`, { headers: { 'x-admin-token': 'nope' } })).status, 401);
  const list = await (await fetch(`${base}/api/admin/bookings?date=2026-06-07`, { headers: h })).json();
  assert.ok(list.bookings.some((x) => x.code === b.code && x.phone === '+998901234567'));
  assert.ok(list.stats.revenue > 0);

  let r = await post('/api/admin/checkin', { code: b.code, attraction: 'zipline' }, h);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).used.zipline, 1);
  r = await post('/api/admin/checkin', { code: b.code, attraction: 'zipline' }, h);
  assert.equal(r.status, 400);
  r = await post('/api/admin/checkin', { code: b.code, attraction: 'swing', count: 1 }, h);
  assert.equal(r.status, 200);
});

test("admin yangi attraksion qo'shadi, tahrirlaydi va sotuvdan oladi", async () => {
  const h = { 'x-admin-token': 'secret' };
  const put = (path, body) => fetch(base + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
  assert.equal((await post('/api/admin/attractions', { name: 'X' })).status, 401);
  let r = await post('/api/admin/attractions', { name: 'Bungee', price: 0 }, h);
  assert.equal(r.status, 400);
  r = await post('/api/admin/attractions', { name: "Bungee jumping", price: 300000, capacity: 5, rules: 'Bir\nIkki\n', limits: ['Vazn 50–100 kg'] }, h);
  assert.equal(r.status, 201);
  const a = await r.json();
  assert.equal(a.id, 'bungee-jumping');
  assert.deepEqual(a.rules, ['Bir', 'Ikki']);

  let cfg = await (await fetch(base + '/api/config')).json();
  assert.ok(cfg.attractions.some((x) => x.id === a.id));
  const b = await (await book({ slot: '18:00', items: { 'bungee-jumping': 2 } })).json();
  assert.equal(b.total, 600000);
  assert.equal((await book({ slot: '18:00', items: { 'bungee-jumping': 4 } })).status, 400); // sig'im 5
  await post(`/api/demo-pay/${b.code}`, {});

  // narxni o'zgartirish va sotuvdan olish
  r = await put(`/api/admin/attractions/${a.id}`, { price: 350000, active: false });
  assert.equal(r.status, 200);
  cfg = await (await fetch(base + '/api/config')).json();
  assert.ok(!cfg.attractions.some((x) => x.id === a.id));
  assert.equal((await book({ slot: '18:00', items: { 'bungee-jumping': 1 } })).status, 400);
  // eski bron baribir ishlaydi va nomi ko'rinadi
  const t = await (await fetch(`${base}/api/tickets/${b.code}`)).json();
  assert.equal(t.names['bungee-jumping'], 'Bungee jumping');
  r = await post('/api/admin/checkin', { code: b.code, attraction: 'bungee-jumping', count: 2 }, h);
  assert.equal(r.status, 200);
  r = await post('/api/admin/checkin', { code: b.code, attraction: 'bungee-jumping' }, h);
  assert.match((await r.json()).error, /hamma/);
  r = await post('/api/admin/checkin', { code: b.code, attraction: 'swing' }, h);
  assert.match((await r.json()).error, /yo'q/);
  const all = await (await fetch(base + '/api/admin/attractions', { headers: h })).json();
  assert.equal(all.find((x) => x.id === a.id).price, 350000);
  const list = await (await fetch(`${base}/api/admin/bookings?date=2026-06-07`, { headers: h })).json();
  assert.equal(list.stats.flown['bungee-jumping'], 2);
});

test('admin rasm yuklaydi', async () => {
  const h = { 'x-admin-token': 'secret' };
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal((await post('/api/admin/upload', { dataUrl: png })).status, 401);
  assert.equal((await post('/api/admin/upload', { dataUrl: 'data:text/html;base64,AAAA' }, h)).status, 400);
  const r = await post('/api/admin/upload', { dataUrl: png }, h);
  assert.equal(r.status, 201);
  const { url } = await r.json();
  const img = await fetch(base + url);
  assert.equal(img.status, 200);
  assert.match(img.headers.get('content-type'), /png/);
});
