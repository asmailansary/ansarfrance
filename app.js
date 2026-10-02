/* ===================== هقَّوة — منطق الموقع ===================== */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = HQ.esc;
  document.documentElement.classList.add('js');

  const TX = window.HQ_TEXTS, LK = window.HQ_LINKS;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const S = {
    lang: store.get('hqLang', 'ar'),
    content: {}, settings: {}, logos: {}, font: null,
    products: [], offers: [], gallery: [],
    cart: store.get('hqCart', []),
    user: null, favs: [], orders: [], cat: 'all', accTab: 'profile'
  };

  /* ---------- نصوص الواجهة (غير قابلة للتحرير من اللوحة) ---------- */
  const UI = {
    ar: { login: 'تسجيل الدخول', account: 'حسابي', cart: 'سلة الطلب', add: 'أضف', sar: 'ر.س', total: 'الإجمالي', send: 'إرسال الطلب',
      emptyCart: 'السلة فارغة، أضف شيئاً يعجبك ☕', branch: 'الفرع', note: 'ملاحظات (اختياري)', sent: 'تم إرسال طلبك، بالعافية!',
      loginFirst: 'سجّل دخولك بحساب جوجل لإرسال الطلب', loginDesc: 'تسجيل الدخول اختياري، وبه تستطيع إرسال الطلبات وحفظ مفضلاتك ومتابعة طلباتك.',
      google: 'المتابعة بحساب جوجل', logout: 'تسجيل الخروج', profile: 'الملف الشخصي', favs: 'المفضلة', orders: 'طلباتي',
      noFavs: 'لم تضف أي منتج للمفضلة بعد', noOrders: 'لا توجد طلبات بعد', demo: 'وضع المعاينة: اربط Supabase لإرسال الطلبات',
      olaya: 'فرع العليا', tuwaiq: 'فرع طويق', order: 'طلب', items: 'عناصر', err: 'حدث خطأ، حاول مرة أخرى',
      st: { new: 'جديد', preparing: 'قيد التحضير', ready: 'جاهز', done: 'مكتمل', cancelled: 'ملغي' }, email: 'البريد', welcome: 'أهلاً' },
    en: { login: 'Sign in', account: 'Account', cart: 'Your order', add: 'Add', sar: 'SAR', total: 'Total', send: 'Send order',
      emptyCart: 'Your cart is empty — add something you like ☕', branch: 'Branch', note: 'Notes (optional)', sent: 'Your order was sent — enjoy!',
      loginFirst: 'Sign in with Google to send your order', loginDesc: 'Signing in is optional. It lets you send orders, save favourites and track your orders.',
      google: 'Continue with Google', logout: 'Sign out', profile: 'Profile', favs: 'Favourites', orders: 'My orders',
      noFavs: 'No favourites yet', noOrders: 'No orders yet', demo: 'Preview mode: connect Supabase to send orders',
      olaya: 'Olaya Branch', tuwaiq: 'Tuwaiq Branch', order: 'Order', items: 'items', err: 'Something went wrong, try again',
      st: { new: 'New', preparing: 'Preparing', ready: 'Ready', done: 'Completed', cancelled: 'Cancelled' }, email: 'Email', welcome: 'Hello' }
  };
  const ui = (k) => UI[S.lang][k];

  /* ---------- النصوص القابلة للتحرير ---------- */
  function txt(key) {
    const c = S.content[key], d = TX[key] || { ar: '', en: '' };
    if (c && c[S.lang] != null && c[S.lang] !== '') return c[S.lang];
    return d[S.lang];
  }
  const toLatinDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

  function applyTexts() {
    $$('[data-t]').forEach((el) => {
      const key = el.dataset.t, c = S.content[key] || {};
      const v = txt(key);
      if (el.hasAttribute('data-count')) {
        el.dataset.target = v;
        el.textContent = el.dataset.done ? v : '0';
      } else el.textContent = v;
      const sz = Number(c.size);
      el.style.zoom = sz && sz !== 100 ? sz / 100 : '';
      el.hidden = !!c.hidden;
    });
    if (document.body.classList.contains('stats-in')) runCounters();
  }

  function applySettings() {
    const st = S.settings, root = document.documentElement;
    const name = (st['siteName_' + S.lang] || '').trim();
    const nameEl = $('#brandName');
    nameEl.textContent = name || (S.lang === 'ar' ? 'هقَّوة' : 'Haqwa');
    nameEl.hidden = !st.showName;
    nameEl.style.zoom = st.nameSize ? st.nameSize / 100 : '';
    document.title = (name || (S.lang === 'ar' ? 'هقَّوة' : 'Haqwa')) + (S.lang === 'ar' ? ' | مقهى ومحمصة' : ' | Café & Roastery');
    root.style.setProperty('--logo-h', (st.logoSize || 44) + 'px');
    $$('[data-sec]').forEach((a) => { a.hidden = st.sections && st.sections[a.dataset.sec] === false; });
    $$('[data-section]').forEach((s) => { s.hidden = st.sections && st.sections[s.dataset.section] === false; });
    // الشعار الثانوي (المناسبات)
    const oc = $('#occasion');
    if (st.logo2Visible && S.logos.logo2) {
      $('#occasionImg').src = S.logos.logo2;
      $('#occasionImg').style.width = (st.logo2Size || 180) + 'px';
      oc.hidden = false; oc.style.maxWidth = 'none';
    } else oc.hidden = true;
  }

  function applyLogos() {
    $$('[data-logo="main"]').forEach((i) => { i.src = S.logos.main || 'assets/logo-green.png'; });
    $$('[data-logo="cream"]').forEach((i) => { i.src = S.logos.light || 'assets/logo-cream.png'; });
  }

  /* ---------- المنتجات ---------- */
  const PH = '<svg class="ph" viewBox="0 0 64 64" fill="none" stroke="#6a704c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 26h34v10a14 14 0 0 1-14 14h-6a14 14 0 0 1-14-14z"/><path d="M46 29h4a6 6 0 0 1 0 12h-5"/><path d="M22 10c-3 4 3 6 0 11M32 10c-3 4 3 6 0 11"/></svg>';
  const L = (o, f) => o[f + '_' + S.lang] || o[f + '_ar'] || '';
  const money = (n) => (Number(n) || 0) + ' <small>' + ui('sar') + '</small>';
  const visible = (a) => a.filter((x) => x.visible !== false);

  function renderMenu() {
    const list = visible(S.products);
    const cats = Array.from(new Set(list.map((p) => L(p, 'category')).filter(Boolean)));
    if (S.cat !== 'all' && cats.indexOf(S.cat) < 0) S.cat = 'all';
    $('#menuChips').innerHTML = cats.length
      ? [['all', txt('menu.all')]].concat(cats.map((c) => [c, c])).map((c) => '<button class="chip' + (S.cat === c[0] ? ' on' : '') + '" data-cat="' + esc(c[0]) + '">' + esc(c[1]) + '</button>').join('')
      : '';
    const shown = list.filter((p) => S.cat === 'all' || L(p, 'category') === S.cat);
    $('#menuGrid').innerHTML = shown.length ? shown.map((p) => {
      const fav = S.favs.indexOf(p.id) > -1;
      return '<article class="card" data-id="' + esc(p.id) + '"><div class="pic">' + (p.image ? '<img loading="lazy" alt="" src="' + p.image + '">' : PH) +
        '<button class="fav' + (fav ? ' on' : '') + '" data-fav="' + esc(p.id) + '" aria-label="fav"><svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z"/></svg></button></div>' +
        '<div class="body"><h3>' + esc(L(p, 'name')) + '</h3><p class="desc">' + esc(L(p, 'desc')) + '</p>' +
        '<div class="row"><span class="price">' + money(p.price) + '</span><button class="add" data-add="' + esc(p.id) + '">' + ui('add') + '</button></div></div></article>';
    }).join('') : '<p class="empty">' + esc(txt('menu.empty')) + '</p>';
    staggerIn($$('#menuGrid .card'));
  }

  function renderOffers() {
    const list = visible(S.offers);
    $('#offerGrid').innerHTML = list.length ? list.map((o) =>
      '<article class="offer">' + (o.image ? '<img loading="lazy" alt="" src="' + o.image + '">' : '') +
      '<h3>' + esc(L(o, 'title')) + '</h3><p>' + esc(L(o, 'desc')) + '</p>' +
      (L(o, 'price_label') ? '<span class="tag">' + esc(L(o, 'price_label')) + '</span>' : '') + '</article>'
    ).join('') : '<p class="empty" style="grid-column:1/-1;text-align:center;color:var(--muted)">' + esc(txt('offers.empty')) + '</p>';
    staggerIn($$('#offerGrid .offer'));
  }

  function renderGallery() {
    const list = visible(S.gallery);
    let html;
    if (list.length) {
      html = list.map((g) => '<figure class="shot s-' + (g.size === 'sm' ? 'sm' : g.size === 'lg' ? 'lg' : 'md') + '"><img loading="lazy" alt="" src="' + g.image + '">' +
        (L(g, 'caption') ? '<figcaption>' + esc(L(g, 'caption')) + '</figcaption>' : '') + '</figure>').join('');
      // نكرر القائمة حتى يمتلئ الشريط ثم نضاعفها لدورة سلسة
      let n = Math.max(1, Math.ceil(6 / list.length));
      html = new Array(n + 1).join(html);
    } else {
      html = new Array(7).join('<figure class="shot ph s-md"><img alt="" src="' + (S.logos.light || 'assets/logo-cream.png') + '"></figure>');
    }
    $('#track').innerHTML = html + html;
  }

  /* ---------- إظهار تدريجي ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in'); io.unobserve(e.target);
      if (e.target.closest('.stats')) { document.body.classList.add('stats-in'); runCounters(); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;
  function observe(el) { if (io) io.observe(el); else el.classList.add('in'); }
  function staggerIn(els) { els.forEach((el, i) => { el.style.transitionDelay = Math.min(i, 8) * 0.06 + 's'; observe(el); }); }
  $$('[data-reveal]').forEach((el, i) => { el.style.setProperty('--d', (i % 4) * 0.08 + 's'); observe(el); });

  /* ---------- عدّادات متحركة ---------- */
  function runCounters() {
    $$('[data-count]').forEach((el) => {
      if (el.dataset.done || el.hidden) return;
      const raw = el.dataset.target || el.textContent;
      const n = parseInt(toLatinDigits(raw).replace(/[^0-9]/g, ''), 10);
      if (isNaN(n)) { el.textContent = raw; el.dataset.done = 1; return; }
      el.dataset.done = 1;
      const suffix = toLatinDigits(raw).replace(/^[0-9٠-٩,.\s]+/, '');
      const t0 = performance.now(), dur = 1800;
      (function tick(t) {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(n * e) + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* ---------- القرص (ساعة 24) ---------- */
  function buildDial() {
    let t = '', n = '';
    for (let i = 0; i < 24; i++) {
      const big = i % 3 === 0, a = (i * 15 - 90) * Math.PI / 180;
      const r1 = big ? 166 : 172, r2 = 182;
      t += '<line class="' + (big ? 'big' : '') + '" x1="' + (200 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (200 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (200 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (200 + r2 * Math.sin(a)).toFixed(1) + '"/>';
      if (big) n += '<text x="' + (200 + 146 * Math.cos(a)).toFixed(1) + '" y="' + (200 + 146 * Math.sin(a)).toFixed(1) + '">' + (i === 0 ? 24 : i) + '</text>';
    }
    $('#ticks').innerHTML = t; $('#nums').innerHTML = n;
  }
  function tickClock() {
    let h = 0, m = 0;
    try {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      h = parseInt(p.find((x) => x.type === 'hour').value, 10) % 24; m = parseInt(p.find((x) => x.type === 'minute').value, 10);
    } catch (e) { const d = new Date(); h = d.getHours(); m = d.getMinutes(); }
    $('#hand').style.transform = 'rotate(' + ((h + m / 60) * 15) + 'deg)';
    $('#nowTime').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /* ---------- ساعة الهقوة: التمرير يحرّك الشمس ---------- */
  const SKY = [[0, '#f6efe4', '#e6dccb'], [0.34, '#fbfaf7', '#cfd6b8'], [0.67, '#ecd2a2', '#b99a5c'], [1, '#33381f', '#12140b']];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const mix = (a, b, t) => hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t));
  function skyAt(p) {
    let i = 0; while (i < SKY.length - 2 && p > SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1], t = Math.max(0, Math.min(1, (p - a[0]) / (b[0] - a[0])));
    return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
  }
  let lastPhase = -1;
  function onScroll() {
    $('#topbar').classList.toggle('stuck', window.scrollY > 30);
    const c = $('#clock'); if (c.hidden) return;
    const r = c.getBoundingClientRect(), total = r.height - window.innerHeight;
    if (r.top > window.innerHeight || r.bottom < 0) return;
    const p = Math.max(0, Math.min(1, -r.top / total));
    const [a, b] = skyAt(p);
    $('#sky').style.background = 'linear-gradient(180deg,rgb(' + a + '),rgb(' + b + '))';
    $('#celestial').style.setProperty('--sun-rot', (-72 + p * 144) + 'deg');
    const ph = Math.min(3, Math.floor(p * 4));
    const night = p > 0.68;
    $('.clock-sticky').classList.toggle('night', night);
    $('#celestial').classList.toggle('night', night);
    if (ph !== lastPhase) {
      lastPhase = ph;
      $$('#phases .phase').forEach((el, i) => el.classList.toggle('on', i === ph));
      $$('#phaseDots i').forEach((el, i) => el.classList.toggle('on', i === ph));
    }
  }

  /* ---------- روابط ---------- */
  function buildLinks() {
    ['heroKeeta', 'keetaCard'].forEach((id) => { $('#' + id).href = LK.keeta; });
    $('#brOlaya').href = LK.olaya; $('#brTuwaiq').href = LK.tuwaiq;
    const ico = {
      instagram: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/></svg>',
      tiktok: '<svg viewBox="0 0 24 24"><path d="M15 3v11a4 4 0 1 1-4-4"/><path d="M15 3c.3 2.6 2.1 4.4 5 4.7"/></svg>',
      snapchat: '<svg viewBox="0 0 24 24"><path d="M12 3c3 0 4.6 2.2 4.6 5v1.8l2.4 1.1-2 1c.5 1.5 1.5 2.3 2.5 2.8-1 .8-2.4.7-3 1.5-.6 1-1.6 1.5-4.5 1.5s-3.900-.5-4.500-1.500c-.6-.8-2-.7-3-1.500 1-.5 2-1.300 2.500-2.800l-2-1 2.400-1.100V8c0-2.800 1.600-5 4.600-5z"/></svg>',
      whatsapp: '<svg viewBox="0 0 24 24"><path d="M3.500 20.500l1.400-4.300A8.500 8.500 0 1 1 8.200 19.200z"/><path d="M9 8.500c0 3.500 3 6.500 6.500 6.500l1.200-1.500-2-1-1 .8c-1-.5-1.800-1.300-2.300-2.300l.8-1-1-2z"/></svg>'
    };
    const names = { instagram: 'Instagram', tiktok: 'TikTok', snapchat: 'Snapchat', whatsapp: 'WhatsApp' };
    $('#socials').innerHTML = Object.keys(names).map((k) => '<a class="soc" target="_blank" rel="noopener" href="' + LK[k] + '">' + ico[k] + '<span>' + names[k] + '</span></a>').join('');
  }

  /* ---------- مساعدات الواجهة ---------- */
  let toastT;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
  function openDrawer(id) { closeDrawers(); $('#' + id).classList.add('open'); $('#scrim').classList.add('on'); }
  function closeDrawers() { $$('.drawer').forEach((d) => d.classList.remove('open')); $('#scrim').classList.remove('on'); }

  /* ---------- السلة ---------- */
  const byId = (id) => S.products.find((p) => p.id === id);
  function saveCart() { store.set('hqCart', S.cart); }
  function addToCart(id) {
    const l = S.cart.find((x) => x.id === id);
    if (l) l.qty++; else S.cart.push({ id, qty: 1 });
    saveCart(); renderCart(); toast('✓ ' + L(byId(id) || {}, 'name'));
  }
  function renderCart() {
    S.cart = S.cart.filter((l) => byId(l.id));
    const count = S.cart.reduce((a, l) => a + l.qty, 0);
    const b = $('#cartCount'); b.textContent = count; b.classList.toggle('show', count > 0);
    $('#cartTitle').textContent = ui('cart');
    const total = S.cart.reduce((a, l) => a + l.qty * (Number(byId(l.id).price) || 0), 0);
    $('#cartBody').innerHTML = S.cart.length ? S.cart.map((l) => {
      const p = byId(l.id);
      return '<div class="line"><div class="th">' + (p.image ? '<img alt="" src="' + p.image + '">' : '☕') + '</div><div><b>' + esc(L(p, 'name')) + '</b><small>' + (Number(p.price) || 0) + ' ' + ui('sar') + '</small></div>' +
        '<div class="qty"><button data-dec="' + esc(l.id) + '">−</button><span>' + l.qty + '</span><button data-inc="' + esc(l.id) + '">+</button></div></div>';
    }).join('') : '<p class="empty">' + ui('emptyCart') + '</p>';
    $('#cartFoot').innerHTML = S.cart.length
      ? '<label class="field">' + ui('branch') + '<select id="ordBranch"><option value="olaya">' + ui('olaya') + '</option><option value="tuwaiq">' + ui('tuwaiq') + '</option></select></label>' +
        '<label class="field">' + ui('note') + '<textarea id="ordNote"></textarea></label>' +
        '<div class="total"><span>' + ui('total') + '</span><span>' + total + ' ' + ui('sar') + '</span></div>' +
        '<button class="btn solid" id="sendOrder" style="justify-content:center">' + ui('send') + '</button>'
      : '';
  }
  async function sendOrder() {
    if (HQ.demo) return toast(ui('demo'));
    if (!S.user) { toast(ui('loginFirst')); openAccount(); return; }
    const btn = $('#sendOrder'); btn.disabled = true;
    try {
      const items = S.cart.map((l) => { const p = byId(l.id); return { id: p.id, name_ar: p.name_ar || '', name_en: p.name_en || '', price: Number(p.price) || 0, qty: l.qty }; });
      const { error } = await HQ.sb.from('orders').insert({
        user_id: S.user.uid, name: S.user.displayName || '', email: S.user.email || '', photo: S.user.photoURL || '',
        items, total: items.reduce((a, i) => a + i.price * i.qty, 0),
        branch: $('#ordBranch').value, note: $('#ordNote').value.trim().slice(0, 300), status: 'new'
      });
      if (error) throw error;
      S.cart = []; saveCart(); renderCart(); closeDrawers(); toast(ui('sent'));
    } catch (e) { console.error(e); toast(ui('err')); btn.disabled = false; }
  }

  /* ---------- الحساب ---------- */
  const G_SVG = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.600 1.200 9.100 3.600l6.800-6.800C35.900 2.400 30.400 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.200C12.400 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.200 5.500-4.700 7.200l7.600 5.900c4.400-4.100 6.900-10.100 6.900-17.600z"/><path fill="#FBBC05" d="M10.500 28.600A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.8-4.600l-7.900-6.200A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.200z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.100-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z"/></svg>';
  function openAccount() { renderAccount(); openDrawer('accDrawer'); }
  function renderAccount() {
    $('#accTitle').textContent = S.user ? ui('account') : ui('login');
    const b = $('#accBody');
    if (!S.user) {
      b.innerHTML = '<p style="color:var(--muted)">' + ui('loginDesc') + '</p><button class="gbtn" id="gLogin">' + G_SVG + '<span>' + ui('google') + '</span></button>' +
        (HQ.demo ? '<p class="empty" style="font-size:13px">' + ui('demo') + '</p>' : '');
      return;
    }
    const u = S.user;
    const tabs = ['profile', 'favs', 'orders'].map((t) => '<button class="chip' + (S.accTab === t ? ' on' : '') + '" data-tab="' + t + '">' + ui(t) + '</button>').join('');
    let body = '';
    if (S.accTab === 'profile') {
      body = '<div class="profile">' + (u.photoURL ? '<img alt="" src="' + esc(u.photoURL) + '">' : '<img alt="" src="assets/favicon.png">') + '<div><b>' + esc(u.displayName || '') + '</b><br><small style="color:var(--muted)">' + esc(u.email || '') + '</small></div></div>' +
        '<button class="pill" id="logoutBtn" style="justify-self:start">' + ui('logout') + '</button>';
    } else if (S.accTab === 'favs') {
      const fs = S.favs.map(byId).filter(Boolean);
      body = fs.length ? fs.map((p) => '<div class="line"><div class="th">' + (p.image ? '<img alt="" src="' + p.image + '">' : '☕') + '</div><div><b>' + esc(L(p, 'name')) + '</b><small>' + (Number(p.price) || 0) + ' ' + ui('sar') + '</small></div><div class="qty"><button data-fav="' + esc(p.id) + '" title="x">♥</button><button data-add="' + esc(p.id) + '">+</button></div></div>').join('') : '<p class="empty">' + ui('noFavs') + '</p>';
    } else {
      const os = S.orders.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      body = os.length ? os.map((o) => {
        const d = o.created_at ? new Date(o.created_at).toLocaleString(S.lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '…';
        return '<div class="order"><b>' + ui('order') + ' · ' + o.items.length + ' ' + ui('items') + ' · ' + o.total + ' ' + ui('sar') + '</b><small>' + esc(o.items.map((i) => (S.lang === 'ar' ? i.name_ar : i.name_en || i.name_ar) + '×' + i.qty).join('، ')) + '</small><small style="color:var(--muted)">' + d + '</small><span class="st ' + (o.status === 'done' ? 'done' : '') + '">' + (ui('st')[o.status] || o.status) + '</span></div>';
      }).join('') : '<p class="empty">' + ui('noOrders') + '</p>';
    }
    b.innerHTML = '<div class="acc-tabs">' + tabs + '</div>' + body;
  }
  function renderAccBtn() {
    const u = S.user;
    $('#accountBtn').textContent = u ? (u.displayName || ui('account')).split(' ')[0] : ui('login');
  }
  async function toggleFav(id) {
    if (HQ.demo) return toast(ui('demo'));
    if (!S.user) { toast(ui('loginFirst')); openAccount(); return; }
    const favs = S.favs.indexOf(id) > -1 ? S.favs.filter((x) => x !== id) : S.favs.concat(id);
    S.favs = favs; renderMenu(); renderAccount();
    const { error } = await HQ.sb.from('profiles').upsert({ id: S.user.uid, favs });
    if (error) toast(ui('err'));
  }
  async function googleLogin() {
    if (HQ.demo) return toast(ui('demo'));
    const { error } = await HQ.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } });
    if (error) toast(ui('err'));
  }

  /* ---------- اللغة ---------- */
  function renderAll() {
    const h = document.documentElement;
    h.lang = S.lang; h.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    $('#langBtn').textContent = S.lang === 'ar' ? 'EN' : 'عربي';
    applyTexts(); applySettings(); applyLogos(); renderMenu(); renderOffers(); renderGallery(); renderCart(); renderAccBtn(); renderAccount();
  }
  function setLang(l, animate) {
    if (!animate) { S.lang = l; store.set('hqLang', l); renderAll(); return; }
    const c = $('#curtain'); c.className = 'curtain cover'; void c.offsetWidth; c.classList.add('run');
    setTimeout(() => { S.lang = l; store.set('hqLang', l); renderAll(); onScroll(); setTimeout(() => { c.className = 'curtain open'; }, 120); }, 650);
  }

  /* ---------- البيانات ---------- */
  function load() {
    if (HQ.demo) {
      S.products = window.HQ_SAMPLE_PRODUCTS.map((p, i) => Object.assign({ id: 'demo' + i }, p));
      S.offers = window.HQ_SAMPLE_OFFERS.map((p, i) => Object.assign({ id: 'demoo' + i }, p));
      renderAll(); return;
    }
    const sb = HQ.sb;
    HQ.live('site_kv', (q) => q.select('*'), (rows) => {
      const kv = {}; rows.forEach((r) => (kv[r.key] = r.value));
      S.content = (kv.content && kv.content.texts) || {}; S.settings = kv.settings || {}; S.logos = kv.logos || {};
      S.font = kv.font || null; HQ.applyCustomFont(S.font); renderAll();
    });
    ['products', 'offers', 'gallery'].forEach((t) => HQ.live(t, (q) => q.select('*').order('sort'), (rows) => { S[t] = rows; renderAll(); }));
    renderAll();

    let unF = null, unO = null, curUid = null;
    const setUser = (u) => {
      const uid = u ? u.id : null; if (uid === curUid) return; curUid = uid;
      if (unF) unF(); if (unO) unO(); S.favs = []; S.orders = [];
      if (u) {
        const m = u.user_metadata || {};
        S.user = { uid: u.id, email: u.email || '', displayName: m.full_name || m.name || (u.email || '').split('@')[0], photoURL: m.avatar_url || m.picture || '' };
        sb.from('profiles').upsert({ id: u.id, name: S.user.displayName, email: S.user.email, photo: S.user.photoURL }, { ignoreDuplicates: false }).then(() => {});
        unF = HQ.live('profiles', (q) => q.select('favs').eq('id', u.id), (r) => { S.favs = (r[0] && r[0].favs) || []; renderMenu(); renderAccount(); });
        unO = HQ.live('orders', (q) => q.select('*').eq('user_id', u.id), (r) => { S.orders = r; renderAccount(); });
      } else S.user = null;
      renderAccBtn(); renderAccount();
    };
    sb.auth.getSession().then(({ data }) => setUser(data.session && data.session.user));
    sb.auth.onAuthStateChange((_e, session) => setUser(session && session.user));
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button,a'); if (!t) return;
    if (t.dataset.cat != null) { S.cat = t.dataset.cat; renderMenu(); }
    else if (t.dataset.add) { addToCart(t.dataset.add); }
    else if (t.dataset.fav) { e.preventDefault(); toggleFav(t.dataset.fav); }
    else if (t.dataset.inc || t.dataset.dec) {
      const id = t.dataset.inc || t.dataset.dec, l = S.cart.find((x) => x.id === id);
      if (l) { l.qty += t.dataset.inc ? 1 : -1; if (l.qty <= 0) S.cart = S.cart.filter((x) => x !== l); saveCart(); renderCart(); }
    }
    else if (t.id === 'sendOrder') sendOrder();
    else if (t.id === 'gLogin') googleLogin();
    else if (t.id === 'logoutBtn') { HQ.sb.auth.signOut(); closeDrawers(); }
    else if (t.dataset.tab) { S.accTab = t.dataset.tab; renderAccount(); }
    else if (t.hasAttribute('data-close')) closeDrawers();
    else if (t.tagName === 'A' && t.getAttribute('href') && t.getAttribute('href').charAt(0) === '#' && t.getAttribute('href').length > 1) {
      e.preventDefault(); $('#nav').classList.remove('open'); $('#burger').classList.remove('on');
      const target = $(t.getAttribute('href'));
      if (target) { if (window.__lenis) window.__lenis.scrollTo(target, { offset: -60, duration: 1.4 }); else target.scrollIntoView({ behavior: 'smooth' }); }
    }
  });
  $('#scrim').addEventListener('click', closeDrawers);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawers(); });
  $('#cartBtn').addEventListener('click', () => { renderCart(); openDrawer('cartDrawer'); });
  $('#accountBtn').addEventListener('click', openAccount);
  $('#langBtn').addEventListener('click', () => setLang(S.lang === 'ar' ? 'en' : 'ar', true));
  $('#burger').addEventListener('click', (e) => { e.currentTarget.classList.toggle('on'); $('#nav').classList.toggle('open'); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- التشغيل ---------- */
  buildDial(); buildLinks(); tickClock(); setInterval(tickClock, 20000);
  $$('.drawer-body').forEach((d) => d.setAttribute('data-lenis-prevent', ''));
  setLang(S.lang, false);
  load();
  onScroll();

  if (window.Lenis) {
    const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    window.__lenis = lenis;
    lenis.on('scroll', onScroll);
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }

  // فتح الستارة بعد التحميل
  const openCurtain = () => setTimeout(() => { $('#curtain').classList.add('open'); }, 900);
  if (document.readyState === 'complete') openCurtain(); else window.addEventListener('load', openCurtain);
  setTimeout(() => { $('#curtain').classList.add('open'); }, 3500);
})();
