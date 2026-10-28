(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const PAY_LABELS = {
    payme: '<span class="logo-payme">payme</span>',
    click: '<span class="logo-click">click</span>',
    demo: 'Demo to\'lov',
  };

  const state = { cfg: null, date: null, slot: null, avail: null, items: {}, payMethod: null };

  // --- Header / menyu ---
  const header = $('#header');
  const sticky = $('#stickyCta');
  const bron = $('#bron');
  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 40);
    const r = bron.getBoundingClientRect();
    sticky.classList.toggle('hide', window.scrollY < 300 || (r.top < window.innerHeight && r.bottom > 0));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const nav = $('#nav');
  $('#menuBtn').addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    $('#menuBtn').setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) nav.classList.remove('open');
  });
  $('#year').textContent = new Date().getFullYear();

  // --- Ma'lumotlarni sahifaga joylash ---
  function fillStatic(cfg) {
    const byId = Object.fromEntries(cfg.attractions.map((a) => [a.id, a]));
    document.querySelectorAll('[data-price]').forEach((el) => {
      el.innerHTML = `${fmt(byId[el.dataset.price].price)}`;
    });
    document.querySelectorAll('[data-rule]').forEach((el) => (el.textContent = byId[el.dataset.rule].rules));
    document.querySelectorAll('[data-brand]').forEach((el) => (el.textContent = cfg.brand[el.dataset.brand]));
    const tel = 'tel:' + cfg.brand.phone.replace(/[^\d+]/g, '');
    $('#phoneLink').href = tel;
    $('#phoneLink2').href = tel;
    $('#igLink').href = cfg.brand.instagram;
    $('#tgLink').href = cfg.brand.telegram;
    const q = encodeURIComponent(cfg.brand.mapQuery);
    $('#map').src = `https://maps.google.com/maps?q=${q}&z=12&output=embed`;
    $('#routeBtn').href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    $('#holdMin').textContent = cfg.holdMinutes;

    $('#priceList').innerHTML = cfg.attractions
      .map((a) => `<div class="price-row"><div><b>${esc(a.name)}</b><span>${esc(a.short)}</span></div><strong>${fmt(a.price)}</strong></div>`)
      .join('');
    const full = cfg.combo.includes.reduce((s, id) => s + byId[id].price, 0);
    $('#comboName').textContent = cfg.combo.name;
    $('#comboOld').textContent = fmt(full);
    $('#comboPrice').textContent = fmt(cfg.combo.price);
    $('#limits').innerHTML = cfg.attractions.map((a) => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.rules)}</td></tr>`).join('');

    $('#payMethods').innerHTML = cfg.payMethods
      .map(
        (m, i) =>
          `<label class="pay"><input type="radio" name="pay" value="${m}" ${i === 0 ? 'checked' : ''}> ${PAY_LABELS[m] || m}</label>`
      )
      .join('');
    state.payMethod = cfg.payMethods[0];
    $('#payMethods').addEventListener('change', (e) => (state.payMethod = e.target.value));
  }

  // --- Sanalar ---
  function addDays(d, n) {
    const x = new Date(d + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  }
  function renderDates() {
    const { today, lastDay } = state.cfg;
    const box = $('#dates');
    let html = '';
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, i);
      if (d > lastDay) break;
      const dt = new Date(d + 'T00:00:00Z');
      const wd = dt.getUTCDay();
      const label = i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : DAYS[wd];
      html += `<button type="button" class="date-chip ${wd === 0 || wd === 6 ? 'weekend' : ''}" data-date="${d}" aria-pressed="${d === state.date}">
        <small>${label}</small><b>${dt.getUTCDate()}</b><small>${MONTHS[dt.getUTCMonth()]}</small></button>`;
    }
    box.innerHTML = html;
    const inp = $('#dateInput');
    inp.min = today;
    inp.max = lastDay;
  }
  $('#dates').addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]');
    if (b) selectDate(b.dataset.date);
  });
  $('#dateInput').addEventListener('change', (e) => {
    if (e.target.value) selectDate(e.target.value);
  });

  async function selectDate(d) {
    state.date = d;
    state.slot = null;
    $('#dateInput').value = d;
    renderDates();
    $('#slots').innerHTML = '<p class="hint">Yuklanmoqda…</p>';
    try {
      const r = await fetch(`/api/availability?date=${d}`);
      const data = await r.json();
      if (state.date !== d) return;
      state.avail = data.slots;
    } catch {
      $('#slots').innerHTML = '<p class="hint">Internet bilan muammo. Qayta urinib ko\'ring.</p>';
      return;
    }
    const firstOpen = state.avail.find((s) => !s.past && Object.values(s.left).some((v) => v > 0));
    // Bugun bo'sh vaqt qolmagan bo'lsa — ertangi kunni ko'rsatamiz
    if (!firstOpen && d === state.cfg.today && !state.autoMoved) {
      state.autoMoved = true;
      return selectDate(addDays(d, 1));
    }
    state.slot = firstOpen ? firstOpen.slot : null;
    renderSlots();
    renderTickets();
    renderSummary();
  }

  // --- Vaqtlar ---
  function renderSlots() {
    const caps = Object.fromEntries(state.cfg.attractions.map((a) => [a.id, a.capacity]));
    $('#slots').innerHTML = state.avail
      .map((s) => {
        const total = Object.values(s.left).reduce((a, b) => a + b, 0);
        const cap = Object.values(caps).reduce((a, b) => a + b, 0);
        const full = total === 0;
        const label = s.past ? "O'tgan" : full ? "Joy yo'q" : total / cap < 0.25 ? 'Kam qoldi' : "Bo'sh";
        return `<button type="button" class="slot ${total / cap < 0.25 ? 'low' : ''}" data-slot="${s.slot}"
          ${s.past || full ? 'disabled' : ''} aria-pressed="${s.slot === state.slot}"><b>${s.slot}</b><small>${label}</small></button>`;
      })
      .join('');
  }
  $('#slots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b || b.disabled) return;
    state.slot = b.dataset.slot;
    renderSlots();
    renderTickets();
    renderSummary();
  });

  // --- Chiptalar ---
  function currentLeft() {
    const s = state.avail && state.avail.find((x) => x.slot === state.slot);
    return s ? s.left : null;
  }
  function seats(items) {
    const out = Object.fromEntries(state.cfg.attractions.map((a) => [a.id, items[a.id] || 0]));
    if (items.combo) for (const id of state.cfg.combo.includes) out[id] += items.combo;
    return out;
  }
  function canAdd(id) {
    const left = currentLeft();
    if (!left) return false;
    if ((state.items[id] || 0) >= state.cfg.maxPerItem) return false;
    const next = { ...state.items, [id]: (state.items[id] || 0) + 1 };
    const need = seats(next);
    return Object.keys(need).every((k) => need[k] <= left[k]);
  }
  function renderTickets() {
    const { attractions, combo } = state.cfg;
    const left = currentLeft();
    // Joy kamaysa tanlovni qisqartiramiz
    if (left) {
      for (const id of Object.keys(state.items)) {
        while (state.items[id] > 0 && Object.entries(seats(state.items)).some(([k, v]) => v > left[k])) state.items[id]--;
      }
    }
    const row = (p, isCombo) => {
      const n = state.items[p.id] || 0;
      let leftNote = '';
      if (left && !isCombo && left[p.id] <= 10) leftNote = `<div class="left">${left[p.id] ? `Faqat ${left[p.id]} ta joy qoldi` : "Bu vaqtda joy yo'q"}</div>`;
      return `<div class="ticket-row ${isCombo ? 'combo' : ''}">
        <div><b>${esc(p.name)}</b><span>${fmt(p.price)} / kishi</span>${leftNote}</div>
        <div class="stepper">
          <button type="button" data-dec="${p.id}" aria-label="Kamaytirish" ${n ? '' : 'disabled'}>−</button>
          <output>${n}</output>
          <button type="button" data-inc="${p.id}" aria-label="Ko'paytirish" ${canAdd(p.id) ? '' : 'disabled'}>+</button>
        </div></div>`;
    };
    $('#tickets').innerHTML = row(combo, true) + attractions.map((a) => row(a, false)).join('');
  }
  $('#tickets').addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    if (inc && canAdd(inc.dataset.inc)) state.items[inc.dataset.inc] = (state.items[inc.dataset.inc] || 0) + 1;
    else if (dec) state.items[dec.dataset.dec] = Math.max(0, (state.items[dec.dataset.dec] || 0) - 1);
    else return;
    renderTickets();
    renderSummary();
  });

  // --- Xulosa ---
  function renderSummary() {
    const { attractions, combo } = state.cfg;
    const products = [combo, ...attractions];
    if (state.date) {
      const dt = new Date(state.date + 'T00:00:00Z');
      $('#sumWhen').className = 'sum-line';
      $('#sumWhen').innerHTML = `<span>${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}, ${DAYS[dt.getUTCDay()]}</span><b>${state.slot || '—'}</b>`;
    }
    let total = 0;
    $('#sumLines').innerHTML = products
      .filter((p) => state.items[p.id])
      .map((p) => {
        const n = state.items[p.id];
        total += n * p.price;
        return `<div class="sum-line"><span>${esc(p.name)} × ${n}</span><b>${fmt(n * p.price)}</b></div>`;
      })
      .join('');
    $('#sumTotal').textContent = fmt(total);
    $('#payBtn').disabled = !(state.date && state.slot && total > 0);
  }

  // --- Telefon formati ---
  $('#phone').addEventListener('input', (e) => {
    let d = e.target.value.replace(/\D/g, '');
    if (d.startsWith('998')) d = d.slice(3);
    d = d.slice(0, 9);
    const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
    e.target.value = '+998 ' + p.join(' ');
  });
  $('#phone').addEventListener('focus', (e) => {
    if (!e.target.value) e.target.value = '+998 ';
  });

  // --- Yuborish ---
  $('#bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('#errors');
    errBox.textContent = '';
    const name = $('#name').value.trim();
    const phone = $('#phone').value;
    const errs = [];
    if (name.length < 2) errs.push('Ismingizni kiriting');
    if (phone.replace(/\D/g, '').length !== 12) errs.push("Telefon raqamini to'liq kiriting");
    if (errs.length) {
      errBox.textContent = errs.join('. ');
      return;
    }
    const btn = $('#payBtn');
    btn.disabled = true;
    btn.textContent = 'Yuborilmoqda…';
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: state.date, slot: state.slot, items: state.items, name, phone, payMethod: state.payMethod }),
      });
      const data = await r.json();
      if (!r.ok) {
        errBox.textContent = (data.errors || ['Xatolik yuz berdi']).join('. ');
        if (state.date) selectDate(state.date);
        return;
      }
      try {
        const saved = JSON.parse(localStorage.getItem('ugamTickets') || '[]');
        saved.unshift({ code: data.code, date: state.date, slot: state.slot });
        localStorage.setItem('ugamTickets', JSON.stringify(saved.slice(0, 10)));
      } catch {
        /* localStorage yopiq bo'lishi mumkin */
      }
      window.location.href = data.payUrl;
    } catch {
      errBox.textContent = "Internet bilan muammo. Qayta urinib ko'ring.";
    } finally {
      btn.disabled = false;
      btn.textContent = "To'lovga o'tish";
    }
  });

  // --- Ishga tushirish ---
  fetch('/api/config')
    .then((r) => r.json())
    .then((cfg) => {
      state.cfg = cfg;
      fillStatic(cfg);
      renderDates();
      selectDate(cfg.today);
    });
})();
