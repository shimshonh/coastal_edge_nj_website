(function () {
  'use strict';
  var d = document, CE = window.CE || { units: [], plans: [] };
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function track(event, data) { try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: event }, data || {})); } catch (e) {} }
  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }
  function num(n) { return Number(n).toLocaleString('en-US'); }

  /* header */
  var header = $('[data-header]');
  function onScroll() { if (header) header.classList.toggle('solid', window.scrollY > 40); d.body.classList.toggle('scrolled', window.scrollY > 380); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  var toggle = $('[data-menu-toggle]'), menu = $('#mobile-menu');
  if (toggle && menu) toggle.addEventListener('click', function () {
    var open = menu.hidden; menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    d.body.classList.toggle('menu-open', open); d.body.style.overflow = open ? 'hidden' : '';
  });

  /* reveal on scroll */
  if (!reduce && 'IntersectionObserver' in window) {
    d.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  }

  /* hero slideshow */
  var hero = $('[data-hero]');
  if (hero && !reduce) {
    var slides = $$('img', hero), cur = 0;
    slides.forEach(function (s) { s.loading = 'eager'; });
    setInterval(function () { slides[cur].classList.remove('on'); cur = (cur + 1) % slides.length; slides[cur].classList.add('on'); }, 7000);
  }

  /* dialogs */
  function openDialog(dlg) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  function closeDialog(dlg) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  $$('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) closeDialog(dlg); });
  });

  /* lead forms */
  var COPY = {
    pricing: { eyebrow: 'Pricing', title: 'Request pricing', sub: 'Tell us where to reach you and the sales team will reply with current pricing.', button: 'Send request' },
    tour: { eyebrow: 'Private tour', title: 'Schedule a tour', sub: 'Leave your details and the sales team will confirm a time with you.', button: 'Request my tour' },
    plan: { eyebrow: 'Floor plan', title: 'Get the plan PDF', sub: 'Tell us where to reach you and the download opens right away.', button: 'Download the PDF' },
    brochure: { eyebrow: 'Brochure', title: 'Get the brochure', sub: 'Tell us where to reach you and the download opens right away.', button: 'Download the brochure' },
    retail: { eyebrow: 'Retail space', title: 'Ask about retail space', sub: 'Three ground floor retail spaces are offered. Leave your details and we will follow up.', button: 'Send request' }
  };
  var modal = $('#lead-modal');
  function openLead(o) {
    if (!modal) return;
    var form = $('form', modal), c = COPY[o.kind] || COPY.pricing, title = c.title;
    if (o.unit) title = (o.kind === 'tour' ? 'Tour residence ' : 'Pricing for residence ') + o.unit;
    else if (o.plan && o.kind === 'plan') title = o.plan + ' PDF';
    else if (o.plan && o.kind === 'tour') title = 'Tour ' + o.plan;
    $('[data-lead-eyebrow]', form).textContent = c.eyebrow;
    $('[data-lead-title]', form).textContent = title;
    $('[data-lead-sub]', form).textContent = c.sub;
    $('[data-submit]', form).textContent = c.button;
    form.kind.value = o.kind || 'pricing'; form.unit.value = o.unit || ''; form.plan.value = o.plan || '';
    form.dataset.download = o.download || '';
    $('[data-form-body]', form).hidden = false; $('[data-form-done]', form).hidden = true;
    // returning visitors who already shared their details go straight to the file
    if (o.download && store('ce_lead')) { showDone(form, true); }
    openDialog(modal);
    track('lead_open', { lead_kind: form.kind.value, unit: o.unit || '', plan: o.plan || '' });
  }
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-inquire]');
    if (t) { e.preventDefault(); var u = $('#unit-modal'); if (u && u.open) closeDialog(u); openLead({ kind: t.dataset.kind, unit: t.dataset.unit, plan: t.dataset.plan, download: t.dataset.download }); }
  });
  function showDone(form, returning) {
    var dl = form.dataset.download || (form.closest('[data-download]') || {}).dataset && form.closest('[data-download]').dataset.download;
    $('[data-form-body]', form).hidden = true;
    var done = $('[data-form-done]', form); done.hidden = false;
    var link = $('[data-download-link]', done), txt = $('[data-done-text]', done);
    if (dl) { link.href = dl; link.hidden = false; txt.textContent = returning ? 'Welcome back. Your download is ready.' : 'Your download is ready. The sales team will also follow up with you.'; }
    else { link.hidden = true; txt.textContent = 'The sales team will be in touch shortly.'; }
  }
  $$('[data-lead-form]').forEach(function (form) {
    form.addEventListener('input', function (e) { if (e.target.classList) e.target.classList.remove('bad'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('[data-error]', form), btn = $('[data-submit]', form), ok = true;
      $$('input[required]', form).forEach(function (i) {
        var bad = !i.value.trim() || (i.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value.trim()));
        i.classList.toggle('bad', bad); if (bad) ok = false;
      });
      if (!ok) { err.textContent = 'Please add your name and a valid email.'; err.hidden = false; return; }
      err.hidden = true;
      var data = {}; new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.url = location.href; data.referrer = d.referrer || '';
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending';
      fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
        .then(function () { store('ce_lead', '1'); track('lead_submit', { lead_kind: data.kind, unit: data.unit || '', plan: data.plan || '' }); showDone(form, false); })
        .catch(function () { err.textContent = 'Sorry, that did not go through. Please try again or call ' + CE.phone + '.'; err.hidden = false; })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });

  /* 3D tour */
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tour]'); if (!t) return;
    var dlg = $('#tour-modal'); if (!dlg || window.innerWidth < 700) { t.target = '_blank'; t.rel = 'noopener'; return; }
    e.preventDefault();
    $('[data-tour-frame]', dlg).innerHTML = '<iframe src="' + CE.tour + '" allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen" allowfullscreen title="Coastal Edge 3D tour"></iframe>';
    openDialog(dlg); track('tour_open');
    dlg.addEventListener('close', function () { $('[data-tour-frame]', dlg).innerHTML = ''; }, { once: true });
  });

  /* lightbox */
  var lb = $('#lightbox'), lbItems = [], lbIdx = 0;
  function lbShow(i) { lbIdx = (i + lbItems.length) % lbItems.length; var a = lbItems[lbIdx]; $('[data-lb-img]', lb).src = a.href; $('[data-lb-img]', lb).alt = a.dataset.caption || ''; $('[data-lb-cap]', lb).textContent = a.dataset.caption || ''; }
  d.addEventListener('click', function (e) {
    var a = e.target.closest('[data-gallery] a'); if (!a || !lb) return;
    e.preventDefault();
    lbItems = $$('a', a.closest('[data-gallery]')).filter(function (x) { return !x.hidden; });
    lbShow(lbItems.indexOf(a)); openDialog(lb);
  });
  if (lb) {
    $('[data-lb-prev]', lb).addEventListener('click', function () { lbShow(lbIdx - 1); });
    $('[data-lb-next]', lb).addEventListener('click', function () { lbShow(lbIdx + 1); });
    lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') lbShow(lbIdx - 1); if (e.key === 'ArrowRight') lbShow(lbIdx + 1); });
  }

  /* chip filters */
  function chipGroup(root, attr, cb) {
    $$('[' + attr + ']', root).forEach(function (b) {
      b.addEventListener('click', function () { $$('[' + attr + ']', root).forEach(function (x) { x.classList.toggle('on', x === b); }); cb(b.getAttribute(attr)); });
    });
  }
  var gf = $('[data-gallery-filters]');
  if (gf) chipGroup(gf, 'data-g', function (v) { $$('.masonry a').forEach(function (a) { a.hidden = v !== 'all' && a.dataset.cat !== v; }); });
  var pf = $('[data-plan-filters]');
  if (pf) chipGroup(pf, 'data-p-beds', function (v) { $$('[data-plan-grid] .plan-card').forEach(function (c) { c.hidden = v !== 'all' && c.dataset.group !== v; }); });

  /* availability */
  var list = $('[data-unit-list]');
  if (list) {
    var f = { beds: 'all', floor: 'all', sold: false }, fr = $('[data-filters]');
    var apply = function () {
      var shown = 0;
      $$('.unit-row[data-status]', list).forEach(function (r) {
        var ok = (f.beds === 'all' || r.dataset.beds === f.beds) && (f.floor === 'all' || r.dataset.floor === f.floor) && (f.sold || r.dataset.status !== 'S');
        r.hidden = !ok; if (ok) shown++;
      });
      $('[data-empty]', list).hidden = shown > 0;
    };
    chipGroup(fr, 'data-f-beds', function (v) { f.beds = v; apply(); });
    chipGroup(fr, 'data-f-floor', function (v) { f.floor = v; apply(); });
    $('[data-f-sold]', fr).addEventListener('change', function (e) { f.sold = e.target.checked; apply(); });
    apply();
  }
  var um = $('#unit-modal');
  if (um) d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-unit-open]'), row = !t && !e.target.closest('a, button') && e.target.closest('[data-row-unit]');
    if (!t && !row) return;
    var want = t ? t.dataset.unitOpen : row.dataset.rowUnit;
    var u = CE.units.filter(function (x) { return String(x.num) === want; })[0]; if (!u) return;
    var p = CE.plans.filter(function (x) { return x.n === u.plan; })[0];
    var label = { A: 'Available', U: 'Under contract', S: 'Sold' }[u.status];
    $('[data-u-img]', um).src = '/img/plans/plan-' + p.n + '-900.webp'; $('[data-u-img]', um).alt = 'Floor plan for residence ' + u.num;
    $('[data-u-eyebrow]', um).textContent = 'Floor ' + u.floor + ' | ' + p.name;
    $('[data-u-title]', um).textContent = 'Residence ' + u.num;
    $('[data-u-pill]', um).innerHTML = '<span class="pill pill-' + u.status + '">' + label + '</span>';
    $('[data-u-layout]', um).textContent = p.beds_label + ', ' + p.baths_label;
    $('[data-u-sf]', um).textContent = num(p.sf) + ' sf'; $('[data-u-deck]', um).textContent = num(p.deck) + ' sf';
    $('[data-u-exp]', um).textContent = p.exposure_label;
    $('[data-u-price]', um).textContent = u.status !== 'A' ? label : (u.price ? money(u.price) : 'On request');
    var b = $('[data-u-primary]', um); b.setAttribute('data-inquire', ''); b.dataset.plan = p.name;
    if (u.status === 'A') { b.dataset.unit = u.num; b.dataset.kind = u.price ? 'tour' : 'pricing'; b.textContent = u.price ? 'Tour this home' : 'Request pricing'; }
    else { delete b.dataset.unit; b.dataset.kind = 'pricing'; b.textContent = 'Ask about similar homes'; }
    $('[data-u-planlink]', um).href = '/floor-plans/' + p.slug + '/';
    openDialog(um); track('unit_view', { unit: u.num });
  });

  /* chat assistant */
  var chat = $('[data-chat]');
  if (chat) {
    var panel = $('.chat-panel', chat), log = $('[data-chat-log]', chat), cform = $('[data-chat-form]', chat), chips = $('[data-chat-chips]', chat);
    var history = [], busy = false, greeted = false;
    var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var rich = function (s) { // only site paths and phone numbers become links
      return esc(s).replace(/(^|[\s(])(\/(?:availability|floor-plans|amenities|gallery|neighborhood|faq|contact|brochure)\/[a-z0-9\-\/]*)/g, '$1<a href="$2">$2</a>')
        .replace(/\b(732-392-6688)\b/g, '<a href="tel:+17323926688">$1</a>');
    };
    var add = function (role, text, cls) { var m = d.createElement('div'); m.className = 'msg ' + (role === 'user' ? 'me' : 'bot') + (cls ? ' ' + cls : ''); m.innerHTML = role === 'user' ? esc(text) : rich(text); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; };
    var setOpen = function (open) {
      panel.hidden = !open; chat.classList.toggle('open', open);
      $$('[data-chat-toggle]', chat).forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
      if (open && !greeted) { greeted = true; add('assistant', 'Hi, I am the Coastal Edge assistant. Ask me about floor plans, availability, amenities or booking a tour.'); track('chat_open'); }
      if (open && window.innerWidth > 900) cform.q.focus();
    };
    $$('[data-chat-toggle]', chat).forEach(function (b) { b.addEventListener('click', function () { setOpen(panel.hidden); }); });
    d.addEventListener('click', function (e) { if (e.target.closest('[data-chat-open]')) { e.preventDefault(); setOpen(true); } });
    var send = function (text) {
      text = (text || '').trim(); if (!text || busy) return;
      busy = true; chips.hidden = true; add('user', text); history.push({ role: 'user', content: text });
      var wait = add('assistant', 'Typing', 'typing');
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-12), page: location.pathname }) })
        .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
        .then(function (j) { wait.remove(); add('assistant', j.reply); history.push({ role: 'assistant', content: j.reply }); if (j.lead_saved) { store('ce_lead', '1'); track('lead_submit', { lead_kind: 'chat' }); } })
        .catch(function () { wait.remove(); history.pop(); add('assistant', 'Sorry, I cannot answer right now. Please call ' + CE.phone + ' or use the form at /contact/ and the sales team will help you.'); })
        .then(function () { busy = false; });
    };
    cform.addEventListener('submit', function (e) { e.preventDefault(); var v = cform.q.value; cform.q.value = ''; send(v); });
    $$('button', chips).forEach(function (b) { b.addEventListener('click', function () { send(b.textContent); }); });
    if (/[?&]chat=1/.test(location.search)) setOpen(true);
  }
})();
