(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const STATUS = { paid: ["To'langan", 'paid'], pending: ['Kutilmoqda', 'pending'], expired: ["Muddati o'tgan", 'expired'], cancelled: ['Bekor qilingan', 'cancelled'] };
  const store = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  let token = store.get('ugamAdmin');
  let cfg = null;
  let attrs = []; // hamma attraksionlar (sotuvdan olinganlari ham)
  const nameOf = (id) => (attrs.find((a) => a.id === id) || {}).name || id;

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token, ...(opts.headers || {}) },
    });
    if (r.status === 401) throw new Error('auth');
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error('api'), { data });
    return data;
  }

  // --- Bo'limlar ---
  function show(view) {
    document.querySelectorAll('[data-view]').forEach((t) => t.setAttribute('aria-selected', t.dataset.view === view));
    for (const v of ['scan', 'list', 'attr']) $('#view-' + v).classList.toggle('hidden', v !== view);
    if (view !== 'scan') stopCam();
    if (view === 'list') loadList();
    if (view === 'attr') renderAttrs();
    store.set('ugamAdminView', view);
  }
  document.querySelectorAll('[data-view]').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

  // --- Skaner ---
  function renderStations() {
    const saved = store.get('ugamStation');
    const list = attrs.filter((a) => a.active);
    $('#station').innerHTML =
      '<option value="">— Attraksionni tanlang —</option>' +
      list.map((a) => `<option value="${esc(a.id)}" ${a.id === saved ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
  }
  $('#station').addEventListener('change', (e) => {
    store.set('ugamStation', e.target.value);
    if (current) renderResult(current);
  });

  const video = $('#video');
  const canvas = $('#canvas');
  let stream = null;
  let scanning = false;
  let current = null;

  async function startCam() {
    if (!window.jsQR) return showMsg('Skaner yuklanmadi. Sahifani yangilang.', 'bad');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      return showMsg("Kameraga ruxsat berilmadi. Brauzer sozlamalaridan kameraga ruxsat bering yoki kodni qo'lda yozing.", 'bad');
    }
    video.srcObject = stream;
    await video.play();
    $('#scanner').classList.add('on');
    $('#camBtn').classList.add('hidden');
    scanning = true;
    requestAnimationFrame(tick);
  }
  function stopCam() {
    scanning = false;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    $('#scanner').classList.remove('on');
    $('#camBtn').classList.remove('hidden');
  }
  $('#camBtn').addEventListener('click', startCam);

  function tick() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = (canvas.width = Math.min(video.videoWidth, 640));
      const h = (canvas.height = Math.round((video.videoHeight * w) / video.videoWidth));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const qr = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (qr && qr.data) {
        const code = extractCode(qr.data);
        if (code) {
          scanning = false;
          if (navigator.vibrate) navigator.vibrate(80);
          return lookup(code);
        }
      }
    }
    requestAnimationFrame(tick);
  }
  function extractCode(text) {
    const m = /(UG-[A-Z0-9]{6,12})/i.exec(text);
    return m ? m[1].toUpperCase() : null;
  }
  function resume() {
    current = null;
    $('#result').innerHTML = '';
    if (stream) {
      scanning = true;
      requestAnimationFrame(tick);
    }
  }

  $('#manual').addEventListener('submit', (e) => {
    e.preventDefault();
    let c = $('#code').value.trim().toUpperCase();
    if (!c) return;
    if (!c.startsWith('UG-')) c = 'UG-' + c;
    lookup(c);
  });

  function showMsg(text, kind) {
    $('#result').innerHTML = `<div class="panel scan-result ${kind}"><p style="margin:0;font-weight:800">${esc(text)}</p>
      <button class="btn btn-dark" type="button" data-next style="margin-top:12px">Keyingisi</button></div>`;
  }

  async function lookup(code) {
    $('#result').innerHTML = '<div class="panel">Tekshirilmoqda…</div>';
    try {
      current = await api(`/api/admin/tickets/${encodeURIComponent(code)}`);
      renderResult(current);
    } catch (e) {
      if (e.message === 'auth') return logout();
      showMsg(`${code} — bron topilmadi`, 'bad');
    }
  }

  function renderResult(t, flash) {
    const station = $('#station').value;
    const [label, cls] = STATUS[t.status] || [t.status, ''];
    const todayWarn = t.date !== cfg.today ? `<p class="warn-line">⚠ Bu chipta ${esc(t.date)} sanasi uchun (bugun ${esc(cfg.today)})</p>` : '';
    let main = '';
    let kind = 'ok';
    if (t.status !== 'paid') {
      kind = 'bad';
      main = `<p class="big-msg">⛔ ${label}. O'tkazmang.</p>`;
    } else if (!station) {
      kind = 'warn';
      main = '<p class="big-msg">Yuqorida qaysi attraksionda turganingizni tanlang.</p>';
    } else {
      const all = t.allowance[station] || 0;
      const used = t.used[station] || 0;
      const left = all - used;
      if (!all) {
        kind = 'bad';
        main = `<p class="big-msg">⛔ Bu chiptada «${esc(nameOf(station))}» yo'q</p>`;
      } else if (!left) {
        kind = 'bad';
        main = `<p class="big-msg">⛔ «${esc(nameOf(station))}» — hammasi uchib bo'lgan (${used}/${all})</p>`;
      } else {
        main = `<p class="big-msg">✅ «${esc(nameOf(station))}»: <b>${left}</b> kishi uchishi mumkin</p>
          <div class="row">
            <button class="btn btn-lime big" type="button" data-fly="1">✓ 1 kishi uchdi</button>
            ${left > 1 ? `<button class="btn btn-dark big" type="button" data-fly="${left}">✓ Hammasi uchdi (${left})</button>` : ''}
          </div>`;
      }
    }
    const rows = Object.keys(t.allowance)
      .filter((k) => t.allowance[k] > 0)
      .map((k) => `<div class="use-row ${k === station ? 'here' : ''}"><span><b>${esc(nameOf(k))}</b></span><span>${t.used[k] || 0} / ${t.allowance[k]} uchdi</span></div>`)
      .join('');
    $('#result').innerHTML = `<div class="panel scan-result ${kind}">
      ${flash ? `<p class="flash">${esc(flash)}</p>` : ''}
      <div class="row" style="justify-content:space-between;align-items:center">
        <h3 style="margin:0">${esc(t.code)}</h3><span class="status ${cls}">${label}</span>
      </div>
      <p class="hint" style="margin:6px 0 12px">${esc(t.name)} · ${esc(t.phone)} · ${esc(t.date)} ${esc(t.slot)}</p>
      ${todayWarn}${main}
      <div class="usage">${rows}</div>
      <button class="btn btn-line" type="button" data-next style="margin-top:14px;width:100%">Keyingi chipta →</button>
    </div>`;
  }

  $('#result').addEventListener('click', async (e) => {
    if (e.target.closest('[data-next]')) return resume();
    const fly = e.target.closest('[data-fly]');
    if (!fly || !current) return;
    fly.disabled = true;
    try {
      const n = Number(fly.dataset.fly);
      current = await api('/api/admin/checkin', {
        method: 'POST',
        body: JSON.stringify({ code: current.code, attraction: $('#station').value, count: n }),
      });
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      renderResult(current, `Belgilandi: ${n} kishi uchdi`);
    } catch (err) {
      if (err.message === 'auth') return logout();
      showMsg((err.data && err.data.error) || 'Xatolik', 'bad');
    }
  });

  // --- Bronlar ---
  async function loadList() {
    const data = await api(`/api/admin/bookings?date=${$('#date').value}`);
    $('#stats').innerHTML =
      `<div class="stat"><small>To'langan bron</small><b>${data.stats.paidCount}</b></div>` +
      `<div class="stat"><small>Tushum</small><b>${fmt(data.stats.revenue)}</b></div>` +
      attrs
        .filter((a) => a.active || data.stats.people[a.id])
        .map((a) => `<div class="stat"><small>${esc(a.name)}</small><b>${data.stats.flown[a.id] || 0} / ${data.stats.people[a.id] || 0}</b><small style="color:#fff;opacity:.6;letter-spacing:0;text-transform:none">uchdi / bron</small></div>`)
        .join('');
    $('#rows').innerHTML =
      data.bookings
        .map((b) => {
          const [label, cls] = STATUS[b.status] || [b.status, ''];
          const items = Object.entries(b.items).map(([k, v]) => `${esc(nameOf(k))} ×${v}`).join('<br>');
          const used = Object.keys(b.allowance)
            .filter((k) => b.allowance[k])
            .map((k) => `${esc(nameOf(k))}: ${b.used[k] || 0}/${b.allowance[k]}`)
            .join('<br>');
          return `<tr><td><b>${b.slot}</b></td><td><a href="/ticket/${encodeURIComponent(b.code)}">${esc(b.code)}</a></td>
            <td>${esc(b.name)}<br><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></td><td>${items}</td><td>${fmt(b.total)}</td>
            <td><span class="status ${cls}">${label}</span></td><td><small>${used}</small></td></tr>`;
        })
        .join('') || "<tr><td colspan=\"7\" class=\"hint\">Bu kunga bron yo'q</td></tr>";
  }
  $('#date').addEventListener('change', loadList);
  $('#reload').addEventListener('click', loadList);

  // --- Attraksionlar ---
  async function loadAttrs() {
    attrs = await api('/api/admin/attractions');
    renderStations();
  }
  function renderAttrs() {
    $('#attrList').innerHTML = attrs
      .map(
        (a) => `<div class="attr-item ${a.active ? '' : 'off'}">
          ${a.image ? `<img src="${esc(a.image)}" alt="">` : '<div class="noimg">🎢</div>'}
          <div class="info"><b>${esc(a.name)}</b><span>${fmt(a.price)} · soatiga ${a.capacity} kishi</span>
            <span>${a.active ? '🟢 Sotuvda' : "⚪ Sotuvda emas"}</span></div>
          <button class="btn btn-line" type="button" data-edit="${esc(a.id)}">Tahrirlash</button>
        </div>`
      )
      .join('');
  }
  let editing = null;
  function openForm(a) {
    editing = a ? a.id : null;
    const f = $('#attrForm');
    $('#attrFormTitle').textContent = a ? a.name : 'Yangi attraksion';
    for (const k of ['name', 'subtitle', 'price', 'capacity', 'summary', 'sort', 'short', 'limitsTitle', 'image', 'poster'])
      f.elements[k].value = a ? a[k] ?? '' : '';
    f.elements.rules.value = a ? (a.rules || []).join('\n') : '';
    f.elements.limits.value = a ? (a.limits || []).join('\n') : '';
    f.elements.active.checked = a ? a.active : true;
    for (const k of ['image', 'poster']) $('#prev-' + k).src = f.elements[k].value || '';
    $('#attrErr').textContent = '';
    f.classList.remove('hidden');
    $('#attrList').classList.add('hidden');
    f.scrollIntoView({ behavior: 'smooth' });
  }
  function closeForm() {
    $('#attrForm').classList.add('hidden');
    $('#attrList').classList.remove('hidden');
  }
  $('#addAttr').addEventListener('click', () => openForm(null));
  $('#cancelAttr').addEventListener('click', closeForm);
  $('#attrList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) openForm(attrs.find((a) => a.id === b.dataset.edit));
  });

  // Rasmni kichraytirib yuklash
  document.querySelectorAll('[data-upload]').forEach((inp) =>
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      const key = inp.dataset.upload;
      $('#attrErr').textContent = 'Rasm yuklanmoqda…';
      try {
        const img = await createImageBitmap(file);
        const max = key === 'poster' ? 1600 : 1400;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const { url } = await api('/api/admin/upload', { method: 'POST', body: JSON.stringify({ dataUrl: c.toDataURL('image/jpeg', 0.85) }) });
        $('#attrForm').elements[key].value = url;
        $('#prev-' + key).src = url;
        $('#attrErr').textContent = '';
      } catch (err) {
        $('#attrErr').textContent = (err.data && err.data.error) || 'Rasm yuklanmadi';
      }
    })
  );

  $('#attrForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {};
    for (const k of ['name', 'subtitle', 'summary', 'short', 'limitsTitle', 'image', 'poster', 'rules', 'limits']) body[k] = f.elements[k].value;
    body.price = Number(f.elements.price.value);
    body.capacity = Number(f.elements.capacity.value);
    if (f.elements.sort.value !== '') body.sort = Number(f.elements.sort.value);
    body.active = f.elements.active.checked;
    try {
      await api(editing ? `/api/admin/attractions/${encodeURIComponent(editing)}` : '/api/admin/attractions', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      await loadAttrs();
      closeForm();
      renderAttrs();
    } catch (err) {
      if (err.message === 'auth') return logout();
      $('#attrErr').textContent = ((err.data && err.data.errors) || ['Saqlanmadi']).join('. ');
    }
  });

  // --- Kirish / chiqish ---
  async function start() {
    try {
      await loadAttrs();
      $('#login').classList.add('hidden');
      $('#app').classList.remove('hidden');
      $('#logout').classList.remove('hidden');
      show(store.get('ugamAdminView') || 'scan');
    } catch {
      logout(true);
    }
  }
  function logout(silent) {
    token = '';
    store.set('ugamAdmin', '');
    stopCam();
    $('#app').classList.add('hidden');
    $('#logout').classList.add('hidden');
    $('#login').classList.remove('hidden');
    if (!silent) $('#loginErr').textContent = 'Qaytadan kiring';
  }
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    token = $('#pass').value;
    try {
      await api('/api/admin/attractions');
      store.set('ugamAdmin', token);
      $('#loginErr').textContent = '';
      start();
    } catch {
      $('#loginErr').textContent = "Parol noto'g'ri";
    }
  });
  $('#logout').addEventListener('click', () => logout(true));

  fetch('/api/config')
    .then((r) => r.json())
    .then((c) => {
      cfg = c;
      $('#date').value = c.today;
      if (token) start();
    });
})();
