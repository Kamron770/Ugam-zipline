(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const STATUS = { paid: ["To'langan", 'paid'], pending: ['Kutilmoqda', 'pending'], expired: ["O'tgan", 'expired'] };
  let cfg = null;
  const store = {
    get: () => { try { return localStorage.getItem('ugamAdmin') || ''; } catch { return ''; } },
    set: (v) => { try { v ? localStorage.setItem('ugamAdmin', v) : localStorage.removeItem('ugamAdmin'); } catch { /* ignore */ } },
  };
  let token = store.get();

  async function api(path) {
    const r = await fetch(path, { headers: { 'x-admin-token': token } });
    if (r.status === 401) throw new Error('auth');
    return r.json();
  }

  async function loadList() {
    const date = $('#date').value;
    const data = await api(`/api/admin/bookings?date=${date}`);
    const names = Object.fromEntries(cfg.attractions.map((a) => [a.id, a.name]));
    names.combo = 'Combo';
    $('#stats').innerHTML =
      `<div class="stat"><small>To'langan bron</small><b>${data.stats.paidCount}</b></div>` +
      `<div class="stat"><small>Tushum</small><b>${fmt(data.stats.revenue)}</b></div>` +
      cfg.attractions.map((a) => `<div class="stat"><small>${esc(a.name)}</small><b>${data.stats.people[a.id] || 0} kishi</b></div>`).join('');
    $('#rows').innerHTML =
      data.bookings
        .map((b) => {
          const [label, cls] = STATUS[b.status] || [b.status, ''];
          const items = Object.entries(b.items).map(([k, v]) => `${esc(names[k] || k)} ×${v}`).join('<br>');
          const used = cfg.attractions
            .filter((a) => b.allowance[a.id])
            .map((a) => `${esc(a.name)}: ${b.used[a.id] || 0}/${b.allowance[a.id]}`)
            .join('<br>');
          return `<tr><td><b>${b.slot}</b></td><td><a href="/ticket/${encodeURIComponent(b.code)}">${esc(b.code)}</a></td>
            <td>${esc(b.name)}<br><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></td><td>${items}</td><td>${fmt(b.total)}</td>
            <td><span class="status ${cls}">${label}</span></td><td><small>${used}</small></td></tr>`;
        })
        .join('') || '<tr><td colspan="7" class="hint">Bu kunga bron yo\'q</td></tr>';
  }

  async function start() {
    try {
      await loadList();
      $('#login').classList.add('hidden');
      $('#app').classList.remove('hidden');
      $('#logout').classList.remove('hidden');
    } catch {
      token = '';
      store.set('');
      $('#login').classList.remove('hidden');
    }
  }

  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    token = $('#pass').value;
    try {
      await api(`/api/admin/bookings?date=${$('#date').value}`);
      store.set(token);
      $('#loginErr').textContent = '';
      start();
    } catch {
      $('#loginErr').textContent = "Parol noto'g'ri";
    }
  });
  $('#logout').addEventListener('click', () => {
    store.set('');
    location.reload();
  });
  $('#find').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = $('#code').value.trim().toUpperCase();
    if (c) location.href = '/ticket/' + encodeURIComponent(c.startsWith('UG-') ? c : 'UG-' + c);
  });
  $('#date').addEventListener('change', loadList);
  $('#reload').addEventListener('click', loadList);

  fetch('/api/config')
    .then((r) => r.json())
    .then((c) => {
      cfg = c;
      $('#date').value = c.today;
      if (token) start();
      setInterval(() => { if (token && !$('#app').classList.contains('hidden')) loadList().catch(() => {}); }, 30000);
    });
})();
