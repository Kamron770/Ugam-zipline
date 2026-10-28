(() => {
  const code = decodeURIComponent(location.pathname.split('/').pop() || '');
  const box = document.getElementById('ticket');
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const STATUS = {
    paid: ["To'langan", 'paid'],
    pending: ["To'lov kutilmoqda", 'pending'],
    expired: ['Muddati o\'tgan', 'expired'],
    cancelled: ['Bekor qilingan', 'cancelled'],
  };
  let token = '';
  try {
    token = localStorage.getItem('ugamAdmin') || '';
  } catch {
    /* ignore */
  }
  let cfg = null;
  let timer = null;

  const names = () => {
    const m = Object.fromEntries(cfg.attractions.map((a) => [a.id, a.name]));
    if (cfg.combo) m.combo = cfg.combo.name;
    return m;
  };

  function render(t) {
    const n = names();
    const [y, mo, d] = t.date.split('-').map(Number);
    const [label, cls] = STATUS[t.status] || [t.status, ''];
    const items = Object.entries(t.items)
      .map(([id, c]) => `<div class="kv"><span>${esc(n[id] || id)}</span><b>× ${c}</b></div>`)
      .join('');
    let action = '';
    if (t.status === 'pending')
      action = `<a class="btn btn-lime" style="width:100%;margin-top:16px" href="${esc(t.payUrl)}">To'lovni yakunlash</a>
        <p class="hint center" style="margin-top:10px">To'lov tasdiqlangach bu sahifa o'zi yangilanadi.</p>`;
    if (t.status === 'expired')
      action = `<a class="btn btn-lime" style="width:100%;margin-top:16px" href="/#bron">Qaytadan bron qilish</a>`;

    const usage = cfg.attractions
      .filter((a) => t.allowance[a.id] > 0)
      .map((a) => {
        const used = t.used[a.id] || 0;
        const all = t.allowance[a.id];
        const btn = token && t.status === 'paid' && used < all
          ? `<span><button class="btn btn-dark" data-in="${a.id}" data-n="1">+1</button> <button class="btn btn-line" data-in="${a.id}" data-n="${all - used}">Hammasi</button></span>`
          : '';
        return `<div class="use-row"><span><b>${esc(a.name)}</b><br><small>${used} / ${all} o'tdi</small></span>${btn}</div>`;
      })
      .join('');

    box.innerHTML = `
      <div class="ticket-head">
        <img src="/assets/logo.png" alt="">
        <div><h1>Ugam Gravity Park</h1>
        <p>${d} ${MONTHS[mo - 1]} ${y} · ${esc(t.slot)}</p></div>
      </div>
      <div class="ticket-body">
        <p class="center"><span class="status ${cls}">${label}</span></p>
        ${t.status === 'paid' ? `<div class="ticket-qr"><img src="/api/tickets/${encodeURIComponent(t.code)}/qr.svg" alt="QR-kod" width="200" height="200"></div>` : ''}
        <div class="ticket-code">${esc(t.code)}</div>
        <div class="kv"><span>Ism</span><b>${esc(t.name)}</b></div>
        <div class="kv"><span>Telefon</span><b>${esc(t.phone)}</b></div>
        <div class="ticket-cut"></div>
        ${items}
        <div class="kv"><span>Jami</span><b>${fmt(t.total)}</b></div>
        ${action}
        ${t.status === 'paid' ? `<div class="ticket-cut"></div><h3>Attraksionlar</h3><div class="usage">${usage}</div>
          <p class="hint" style="margin-top:12px">Bu QR-kodni har bir attraksionda instruktorga ko'rsating. Sahifani skrinshot qilib qo'yishingiz mumkin.</p>` : ''}
        <p class="errors" id="err"></p>
      </div>`;
  }

  async function load() {
    const r = await fetch(`/api/tickets/${encodeURIComponent(code)}`);
    if (!r.ok) {
      box.innerHTML = '<div class="ticket-body center"><h3>Bron topilmadi</h3><p class="hint">Havolani tekshiring.</p></div>';
      return null;
    }
    const t = await r.json();
    if (token) {
      const ar = await fetch(`/api/admin/tickets/${encodeURIComponent(code)}`, { headers: { 'x-admin-token': token } });
      if (ar.ok) Object.assign(t, await ar.json());
      else token = '';
    }
    render(t);
    return t;
  }

  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-in]');
    if (!b) return;
    b.disabled = true;
    const r = await fetch('/api/admin/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ code, attraction: b.dataset.in, count: Number(b.dataset.n) }),
    });
    const data = await r.json();
    if (!r.ok) {
      document.getElementById('err').textContent = data.error;
      b.disabled = false;
      return;
    }
    render(data);
  });

  fetch('/api/config')
    .then((r) => r.json())
    .then(async (c) => {
      cfg = c;
      const t = await load();
      // To'lov kutilayotgan bo'lsa, holatni tekshirib turamiz
      if (t && t.status === 'pending') {
        timer = setInterval(async () => {
          const x = await load();
          if (!x || x.status !== 'pending') clearInterval(timer);
        }, 5000);
      }
    });
})();
