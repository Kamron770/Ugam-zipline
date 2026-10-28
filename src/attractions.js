// Attraksionlar ro'yxati ma'lumotlar bazasida saqlanadi va admin paneldan boshqariladi.
// Birinchi ishga tushishda src/config.js dagi ro'yxat bazaga ko'chiriladi.

const TEXT_FIELDS = { name: 60, subtitle: 80, short: 300, summary: 80, limitsTitle: 30, image: 300, poster: 300 };

function slugify(s) {
  const map = { "o'": 'o', "g'": 'g', 'sh': 'sh', 'ch': 'ch' };
  let out = String(s || '').toLowerCase();
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'attraksion';
}

function createAttractionStore(db, seed = [], now = () => Date.now()) {
  const row2obj = (r) => ({ ...JSON.parse(r.data), id: r.id, sort: r.sort, active: !!r.active });

  if (!db.prepare('SELECT COUNT(*) AS n FROM attractions').get().n) {
    const ins = db.prepare('INSERT INTO attractions (id, data, sort, active, updated_at) VALUES (?, ?, ?, 1, ?)');
    seed.forEach((a, i) => {
      const { id, ...data } = a;
      ins.run(id, JSON.stringify(data), (i + 1) * 10, now());
    });
  }

  function list({ includeInactive = false } = {}) {
    const rows = db
      .prepare(`SELECT * FROM attractions ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort, id`)
      .all();
    return rows.map(row2obj);
  }

  function get(id) {
    const r = db.prepare('SELECT * FROM attractions WHERE id = ?').get(String(id));
    return r ? row2obj(r) : null;
  }

  function clean(input, base = {}) {
    const errors = [];
    const out = { ...base };
    for (const [k, max] of Object.entries(TEXT_FIELDS)) {
      if (input[k] === undefined) continue;
      const v = String(input[k] ?? '').trim();
      if (v.length > max) errors.push(`«${k}» juda uzun`);
      out[k] = v;
    }
    for (const k of ['rules', 'limits']) {
      if (input[k] === undefined) continue;
      const arr = Array.isArray(input[k]) ? input[k] : String(input[k]).split('\n');
      out[k] = arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
    }
    for (const k of ['price', 'capacity']) {
      if (input[k] === undefined) continue;
      const n = Number(input[k]);
      if (!Number.isInteger(n) || n < (k === 'price' ? 1000 : 1) || n > (k === 'price' ? 100000000 : 10000))
        errors.push(k === 'price' ? "Narx noto'g'ri" : "Sig'im noto'g'ri");
      out[k] = n;
    }
    for (const k of ['image', 'poster']) {
      if (out[k] && !/^(\/|https:\/\/)/.test(out[k])) errors.push("Rasm manzili noto'g'ri");
    }
    if (!out.name) errors.push('Nomini kiriting');
    if (!out.price) errors.push('Narxini kiriting');
    if (!out.capacity) errors.push("Sig'imini kiriting");
    out.rules = out.rules || [];
    out.limits = out.limits || [];
    return { errors, data: out };
  }

  function create(input) {
    const { errors, data } = clean(input);
    if (errors.length) return { errors };
    let id = slugify(input.id || data.name);
    for (let i = 2; get(id); i++) id = `${slugify(input.id || data.name)}-${i}`;
    const sort = Number.isInteger(Number(input.sort)) && input.sort !== '' && input.sort !== undefined
      ? Number(input.sort)
      : (db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM attractions').get().m + 10);
    db.prepare('INSERT INTO attractions (id, data, sort, active, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      JSON.stringify(data),
      sort,
      input.active === false ? 0 : 1,
      now()
    );
    return { attraction: get(id) };
  }

  function update(id, input) {
    const cur = get(id);
    if (!cur) return { errors: ['Attraksion topilmadi'] };
    const { id: _i, sort: _s, active: _a, ...base } = cur;
    const { errors, data } = clean(input, base);
    if (errors.length) return { errors };
    const sort = input.sort !== undefined && input.sort !== '' ? Number(input.sort) : cur.sort;
    const active = input.active !== undefined ? (input.active ? 1 : 0) : cur.active ? 1 : 0;
    db.prepare('UPDATE attractions SET data = ?, sort = ?, active = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(data),
      Number.isInteger(sort) ? sort : cur.sort,
      active,
      now(),
      cur.id
    );
    return { attraction: get(cur.id) };
  }

  return { list, get, create, update };
}

module.exports = { createAttractionStore, slugify };
