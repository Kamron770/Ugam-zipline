(() => {
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const DAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const PAY_LABELS = {
    payme: '<span class="logo-payme">payme</span>',
    click: '<span class="logo-click">click</span>',
    demo: "Demo to'lov",
  };
  const SHIELD =
    '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/><path d="m8 12 3 3 5-6" fill="none" stroke="#173d17" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const state = { cfg: null, date: null, slot: null, avail: null, items: {}, payMethod: null };
  const products = () => (state.cfg.combo ? [state.cfg.combo, ...state.cfg.attractions] : state.cfg.attractions);

  // --- Header / menyu ---
  const header = $('#header');
  const sticky = $('#stickyCta');
  const bron = $('#bron');
  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 30);
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

  // --- Afishani to'liq ko'rish ---
  function openPoster(src, alt) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}"><button type="button" aria-label="Yopish">✕</button>`;
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target.tagName === 'BUTTON') box.remove();
    });
    document.body.appendChild(box);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.lightbox').forEach((b) => b.remove());
  });

  // --- Ma'lumotlarni sahifaga joylash ---
  function fillStatic(cfg) {
    $('#cards').innerHTML = cfg.attractions
      .map(
        (a) => `<article class="card">
          <div class="card-img"><img src="${esc(a.image)}" alt="${esc(a.name)}" loading="lazy"></div>
          <div class="card-body">
            <h3>${esc(a.name)}${a.subtitle ? `<small>${esc(a.subtitle)}</small>` : ''}</h3>
            <p>${esc(a.short)}</p>
            <div class="card-meta"><span class="card-price">${fmt(a.price)}</span><span class="limit-chip">${esc(a.summary)}</span></div>
            <div class="card-actions">
              <button class="btn btn-line" type="button" data-rules="${a.id}">Qoidalar</button>
              <button class="btn btn-lime" type="button" data-book="${a.id}">Bron qilish</button>
            </div>
          </div></article>`
      )
      .join('');

    $('#priceList').innerHTML = products()
      .map(
        (a) => `<div class="price-row"><div><b>${esc(a.name)}${a.subtitle ? ' ' + esc(a.subtitle) : ''}</b><span>${esc(a.summary || a.short)}</span></div><strong>${fmt(a.price)}</strong></div>`
      )
      .join('');

    $('#tabs').innerHTML = cfg.attractions
      .map((a, i) => `<button class="tab" role="tab" type="button" data-tab="${a.id}" aria-selected="${i === 0}">${esc(a.name)}</button>`)
      .join('');
    showPoster(cfg.attractions[0].id);

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

    $('#payMethods').innerHTML = cfg.payMethods
      .map((m, i) => `<label class="pay"><input type="radio" name="pay" value="${m}" ${i === 0 ? 'checked' : ''}> ${PAY_LABELS[m] || m}</label>`)
      .join('');
    state.payMethod = cfg.payMethods[0];
    $('#payMethods').addEventListener('change', (e) => (state.payMethod = e.target.value));
  }

  function showPoster(id) {
    const a = state.cfg.attractions.find((x) => x.id === id);
    document.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === id));
    $('#poster').innerHTML = `<div class="poster" role="tabpanel">
      <button class="poster-img" type="button" data-poster="${a.id}" aria-label="Afishani kattalashtirish">
        <picture><source media="(min-width: 821px)" srcset="${esc(a.poster)}"><img src="${esc(a.image)}" alt="${esc(a.name)} afishasi" loading="lazy"></picture>
        <span class="zoom">🔍 Afishani ko'rish</span></button>
      <div class="poster-body">
        <h3>${esc(a.name)}${a.subtitle ? ' ' + esc(a.subtitle) : ''}</h3>
        <div class="poster-col"><span class="brush">Qoidalar</span><ul class="checks">${a.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
        <div class="poster-col"><span class="brush red">⚠ ${esc(a.limitsTitle || 'Cheklovlar')}</span><ul class="checks ban">${a.limits.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
        <div class="motto">${SHIELD}<span>Sizning xavfsizligingiz — bizning ustuvor maqsadimiz!</span></div>
      </div></div>`;
  }

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) return showPoster(tab.dataset.tab);
    const rules = e.target.closest('[data-rules]');
    if (rules) {
      showPoster(rules.dataset.rules);
      return $('#xavfsizlik').scrollIntoView({ behavior: 'smooth' });
    }
    const poster = e.target.closest('[data-poster]');
    if (poster) {
      const a = state.cfg.attractions.find((x) => x.id === poster.dataset.poster);
      return openPoster(a.poster, a.name);
    }
    const book = e.target.closest('[data-book]');
    if (book) {
      const id = book.dataset.book;
      if (!state.items[id] && canAdd(id)) state.items[id] = 1;
      renderTickets();
      renderSummary();
      bron.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // --- Sanalar ---
  function addDays(d, n) {
    const x = new Date(d + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  }
  function renderDates() {
    const { today, lastDay } = state.cfg;
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
    $('#dates').innerHTML = html;
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
      $('#slots').innerHTML = "<p class=\"hint\">Internet bilan muammo. Qayta urinib ko'ring.</p>";
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
    const cap = state.cfg.attractions.reduce((s, a) => s + a.capacity, 0);
    $('#slots').innerHTML = state.avail
      .map((s) => {
        const total = Object.values(s.left).reduce((a, b) => a + b, 0);
        const low = total / cap < 0.25;
        const label = s.past ? "O'tgan" : total === 0 ? "Joy yo'q" : low ? 'Kam qoldi' : "Bo'sh";
        return `<button type="button" class="slot ${low ? 'low' : ''}" data-slot="${s.slot}"
          ${s.past || total === 0 ? 'disabled' : ''} aria-pressed="${s.slot === state.slot}"><b>${s.slot}</b><small>${label}</small></button>`;
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
    if (items.combo && state.cfg.combo) for (const id of state.cfg.combo.includes) out[id] += items.combo;
    return out;
  }
  function canAdd(id) {
    const left = currentLeft();
    if (!left) return false;
    if ((state.items[id] || 0) >= state.cfg.maxPerItem) return false;
    const need = seats({ ...state.items, [id]: (state.items[id] || 0) + 1 });
    return Object.keys(need).every((k) => need[k] <= left[k]);
  }
  function renderTickets() {
    const left = currentLeft();
    // Joy kamaysa tanlovni qisqartiramiz
    if (left) {
      for (const id of Object.keys(state.items)) {
        while (state.items[id] > 0 && Object.entries(seats(state.items)).some(([k, v]) => v > left[k])) state.items[id]--;
      }
    }
    $('#tickets').innerHTML = products()
      .map((p) => {
        const n = state.items[p.id] || 0;
        const isAttr = !p.includes;
        let note = '';
        if (left && isAttr && left[p.id] <= 10) note = `<div class="left">${left[p.id] ? `Faqat ${left[p.id]} ta joy qoldi` : "Bu vaqtda joy yo'q"}</div>`;
        return `<div class="ticket-row ${n ? 'on' : ''}">
          ${p.image ? `<img src="${esc(p.image)}" alt="">` : ''}
          <div class="info"><b>${esc(p.name)}</b><span>${fmt(p.price)} / kishi</span>${note}</div>
          <div class="stepper">
            <button type="button" data-dec="${p.id}" aria-label="Kamaytirish" ${n ? '' : 'disabled'}>−</button>
            <output>${n}</output>
            <button type="button" data-inc="${p.id}" aria-label="Ko'paytirish" ${canAdd(p.id) ? '' : 'disabled'}>+</button>
          </div></div>`;
      })
      .join('');
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
    if (state.date) {
      const dt = new Date(state.date + 'T00:00:00Z');
      $('#sumWhen').className = 'sum-line';
      $('#sumWhen').innerHTML = `<span>${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}, ${DAYS[dt.getUTCDay()]}</span><b>${state.slot || '—'}</b>`;
    }
    let total = 0;
    $('#sumLines').innerHTML = products()
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
    if (!$('#agree').checked) errs.push('Qoidalar bilan tanishganingizni belgilang');
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
