/* ===================== هقَّوة — لوحة التحكم (Supabase) ===================== */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = HQ.esc;
  const DOMAIN = 'hqwa-staff.app';          // نطاق وهمي يحوّل اسم المستخدم إلى بريد داخلي
  const A = { user: null, staff: null, tab: 'orders', content: {}, settings: {}, logos: {}, font: null, subs: [], busy: false };
  const view = $('#view');

  /* ---------- أدوات ---------- */
  let tT;
  function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(tT); tT = setTimeout(() => (t.className = 'toast'), 3600); }
  const fmtDate = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' }) + ' والساعة ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '…'; };
  function sub(unsub) { A.subs.push(unsub); }
  function clearSubs() { A.subs.forEach((u) => { try { u(); } catch (e) {} }); A.subs = []; }
  const isAdmin = () => A.staff && A.staff.role === 'admin';
  const emailOf = (u) => u.trim().toLowerCase() + '@' + DOMAIN;
  const sb = () => HQ.sb;
  const errMsg = (e) => {
    const m = String((e && (e.message || e.error_description)) || e || '');
    if (/invalid login credentials/i.test(m)) return 'اسم المستخدم أو كلمة المرور غير صحيحة';
    if (/already registered|already been registered/i.test(m)) return 'اسم المستخدم مستخدم من قبل، اختر اسماً آخر';
    if (/duplicate key/i.test(m)) return 'اسم المستخدم مستخدم من قبل';
    if (/password/i.test(m) && /(least|short|weak)/i.test(m)) return 'كلمة المرور ضعيفة (6 أحرف على الأقل)';
    if (/rate limit|too many/i.test(m)) return 'محاولات كثيرة، انتظر قليلاً ثم حاول مرة أخرى';
    if (/signups? (not allowed|are disabled)|email.*disabled/i.test(m)) return 'فعّل تسجيل الدخول بالبريد وكلمة المرور من Supabase (راجع الخطوات)';
    if (/row-level security|permission|forbidden|not authorized/i.test(m)) return 'لا تملك صلاحية لهذه العملية';
    if (/admin already exists/i.test(m)) return 'تم إنشاء المدير مسبقاً';
    if (/email not confirmed/i.test(m)) return 'أوقف خيار "Confirm email" في Supabase (راجع الخطوات)';
    return m || 'حدث خطأ';
  };
  async function log(action) {
    try { await sb().from('activity').insert({ user_id: A.user.id, name: A.staff.name, action }); } catch (e) { console.warn(e); }
  }
  function pick(accept, multiple) {
    return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple; i.onchange = () => res(Array.from(i.files)); i.click(); });
  }
  const confirmBox = (msg) => window.confirm(msg);
  const must = (r) => { if (r && r.error) throw r.error; return r; };

  /* ---------- الدخول ---------- */
  function showLogin(msg) { $('#app').hidden = true; $('#login').hidden = false; $('#loginErr').textContent = msg || ''; }
  async function checkSetup() {
    try { const { data } = await sb().rpc('needs_setup'); const need = data === true; $('#setupForm').hidden = !need; $('#loginForm').hidden = need; $('#loginHint').hidden = need; } catch (e) { console.warn(e); }
  }
  async function boot(u) {
    try {
      const { data, error } = await sb().from('staff').select('*').eq('id', u.id).maybeSingle();
      if (error) throw error;
      if (!data || data.active === false) { showLogin(data ? 'تم تعطيل هذا الحساب، تواصل مع المدير' : 'هذا الحساب ليس حساب موظف. سجّل دخولك بحساب الموظف.'); return; }
      A.user = u; A.staff = data;
      showApp();
    } catch (e) { showLogin(errMsg(e)); }
  }
  let countSub = null;
  function showApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    $('#meName').textContent = A.staff.name; $('#meRole').textContent = isAdmin() ? 'مدير' : 'موظف';
    $('#meImg').src = A.staff.photo || 'assets/favicon.png';
    const tabs = [['orders', '🧾', 'الطلبات'], ['products', '☕', 'المنتجات'], ['offers', '🏷️', 'العروض'], ['gallery', '🖼️', 'المعرض'], ['texts', '✍️', 'النصوص'], ['identity', '🎨', 'الشعار والهوية']];
    if (isAdmin()) tabs.push(['staff', '👥', 'الموظفون']);
    tabs.push(['activity', '📜', 'سجل النشاط']);
    $('#tabs').innerHTML = tabs.map((t) => '<button class="tab" data-tab="' + t[0] + '"><span class="ic">' + t[1] + '</span><span class="tx">' + t[2] + '</span>' + (t[0] === 'orders' ? '<span class="cnt" id="newCnt" hidden>0</span>' : '') + '</button>').join('');
    HQ.kvGet('logos').then((l) => { if (l.light) $$('[data-logo="light"]').forEach((i) => (i.src = l.light)); }).catch(() => {});
    HQ.kvGet('font').then((f) => HQ.applyCustomFont(f)).catch(() => {});
    if (countSub) countSub();
    countSub = HQ.live('orders', (q) => q.select('id').eq('status', 'new'), (rows) => { const c = $('#newCnt'); if (c) { c.textContent = rows.length; c.hidden = !rows.length; } });
    go(A.tab);
  }
  function go(tab) {
    clearSubs(); A.tab = tab; view.onclick = null; view.onchange = null;
    $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    ({ orders: viewOrders, products: () => crudView(CFG.products), offers: () => crudView(CFG.offers), gallery: () => crudView(CFG.gallery), texts: viewTexts, identity: viewIdentity, staff: viewStaff, activity: viewActivity }[tab] || viewOrders)();
    window.scrollTo(0, 0);
  }

  /* ================= الطلبات ================= */
  const STATUS = { new: 'جديد', preparing: 'قيد التحضير', ready: 'جاهز', done: 'مكتمل', cancelled: 'ملغي' };
  const BRANCH = { olaya: 'فرع العليا', tuwaiq: 'فرع طويق' };
  function viewOrders() {
    view.innerHTML = '<div class="head"><h2>الطلبات</h2><span class="muted">تتحدث مباشرة عند وصول طلب جديد</span></div><div class="list" id="ordList"><p class="empty">جارٍ التحميل…</p></div>';
    sub(HQ.live('orders', (q) => q.select('*').order('created_at', { ascending: false }).limit(100), (rows) => {
      const l = $('#ordList'); if (!l) return;
      if (!rows.length) { l.innerHTML = '<p class="empty">لا توجد طلبات بعد</p>'; return; }
      l.innerHTML = rows.map((o) =>
        '<article class="ord' + (o.status === 'new' ? ' fresh' : '') + '" data-id="' + o.id + '"><div class="ord-top"><div><b>' + esc(o.name || 'زائر') + '</b> <small class="muted">' + esc(o.email || '') + '</small></div><span class="pill ' + o.status + '">' + (STATUS[o.status] || o.status) + '</span></div>' +
        '<ul>' + (o.items || []).map((i) => '<li><span>' + esc(i.name_ar) + ' × ' + i.qty + '</span><span>' + i.price * i.qty + ' ر.س</span></li>').join('') + '</ul>' +
        (o.note ? '<p>📝 ' + esc(o.note) + '</p>' : '') +
        '<div class="ord-foot"><small class="muted">' + (BRANCH[o.branch] || '') + ' · ' + fmtDate(o.created_at) + ' · <b>' + o.total + ' ر.س</b></small>' +
        '<div class="acts-row"><select data-st>' + Object.keys(STATUS).map((k) => '<option value="' + k + '"' + (k === o.status ? ' selected' : '') + '>' + STATUS[k] + '</option>').join('') + '</select><button class="ib red" data-del title="حذف">🗑</button></div></div></article>'
      ).join('');
    }));
    view.onchange = async (e) => {
      const s = e.target.closest('[data-st]'); if (!s) return;
      try { must(await sb().from('orders').update({ status: s.value }).eq('id', s.closest('.ord').dataset.id)); log('غيّر حالة طلب إلى "' + STATUS[s.value] + '"'); toast('تم تحديث الحالة'); } catch (er) { toast(errMsg(er), true); }
    };
    view.onclick = async (e) => {
      const b = e.target.closest('[data-del]'); if (!b || !confirmBox('حذف هذا الطلب نهائياً؟')) return;
      try { must(await sb().from('orders').delete().eq('id', b.closest('.ord').dataset.id)); log('حذف طلباً'); } catch (er) { toast(errMsg(er), true); }
    };
  }

  /* ================= منتجات / عروض / معرض (CRUD عام) ================= */
  const CFG = {
    products: {
      col: 'products', title: 'المنتجات', one: 'منتج', add: 'إضافة منتج', seed: true,
      name: (x) => x.name_ar || x.name_en || 'منتج', subt: (x) => (x.price != null ? x.price + ' ر.س' : '') + (x.category_ar ? ' · ' + x.category_ar : ''),
      fields: [['name_ar', 'الاسم (عربي)', 'text'], ['name_en', 'الاسم (إنجليزي)', 'text'], ['desc_ar', 'الوصف (عربي)', 'textarea'], ['desc_en', 'الوصف (إنجليزي)', 'textarea'],
        ['price', 'السعر (ر.س)', 'number'], ['category_ar', 'التصنيف (عربي) مثل: قهوة', 'text'], ['category_en', 'التصنيف (إنجليزي) مثل: Coffee', 'text'], ['image', 'الصورة', 'image'], ['visible', 'ظاهر في الموقع', 'bool']]
    },
    offers: {
      col: 'offers', title: 'العروض', one: 'عرض', add: 'إضافة عرض',
      name: (x) => x.title_ar || x.title_en || 'عرض', subt: (x) => x.price_label_ar || '',
      fields: [['title_ar', 'عنوان العرض (عربي)', 'text'], ['title_en', 'عنوان العرض (إنجليزي)', 'text'], ['desc_ar', 'التفاصيل (عربي)', 'textarea'], ['desc_en', 'التفاصيل (إنجليزي)', 'textarea'],
        ['price_label_ar', 'شارة السعر (عربي) مثل: 20 ر.س', 'text'], ['price_label_en', 'شارة السعر (إنجليزي)', 'text'], ['image', 'الصورة', 'image'], ['visible', 'ظاهر في الموقع', 'bool']]
    },
    gallery: {
      col: 'gallery', title: 'معرض الصور', one: 'صورة', add: 'إضافة صورة', multi: true,
      name: (x) => x.caption_ar || x.caption_en || 'صورة بدون عنوان', subt: (x) => ({ sm: 'حجم صغير', md: 'حجم متوسط', lg: 'حجم كبير' }[x.size || 'md']),
      fields: [['image', 'الصورة', 'image'], ['caption_ar', 'العنوان على الصورة (عربي)', 'text'], ['caption_en', 'العنوان على الصورة (إنجليزي)', 'text'],
        ['size', 'حجم الصورة في المعرض', 'select', [['sm', 'صغير'], ['md', 'متوسط'], ['lg', 'كبير']]], ['visible', 'ظاهرة في الموقع', 'bool']]
    }
  };

  function crudView(cfg) {
    view.innerHTML = '<div class="head"><h2>' + cfg.title + '</h2><div class="acts">' +
      (cfg.seed ? '<button class="btn line sm" id="seedBtn">+ بيانات تجريبية</button>' : '') +
      (cfg.multi ? '<button class="btn line sm" id="multiBtn">رفع عدة صور</button>' : '') +
      '<button class="btn sm" id="addBtn">+ ' + cfg.add + '</button></div></div><div class="list" id="crudList"><p class="empty">جارٍ التحميل…</p></div>';
    let items = [];
    const maxOrder = () => items.reduce((m, x) => Math.max(m, Number(x.sort) || 0), 0);
    sub(HQ.live(cfg.col, (q) => q.select('*').order('sort'), (rows) => {
      items = rows;
      const l = $('#crudList'); if (!l) return;
      l.innerHTML = items.length ? items.map((x, i) => '<div class="row' + (x.visible === false ? ' off' : '') + '" data-id="' + x.id + '"><div class="thumb">' + (x.image ? '<img alt="" src="' + esc(x.image) + '">' : '☕') + '</div>' +
        '<div><b>' + esc(cfg.name(x)) + '</b><small>' + esc(cfg.subt(x) || '') + (x.visible === false ? ' · مخفي' : '') + '</small></div>' +
        '<div class="acts-row"><button class="ib" data-up title="تحريك للأعلى"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="ib" data-down title="تحريك للأسفل"' + (i === items.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="ib" data-vis title="' + (x.visible === false ? 'إظهار' : 'إخفاء') + '">' + (x.visible === false ? '🙈' : '👁') + '</button><button class="ib" data-edit title="تعديل">✎</button><button class="ib red" data-del title="حذف">🗑</button></div></div>').join('')
        : '<p class="empty">لا يوجد شيء هنا بعد — اضغط "' + cfg.add + '"</p>';
    }));

    view.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'addBtn') return form(cfg, null, maxOrder() + 1);
      if (b.id === 'multiBtn') {
        const files = await pick('image/*', true); if (!files.length) return;
        let n = maxOrder(); toast('جارٍ رفع ' + files.length + ' صورة…');
        try { for (const f of files) { n++; const url = await HQ.uploadImage(f, 'gallery', 1400, 0.82); must(await sb().from('gallery').insert({ image: url, caption_ar: '', caption_en: '', size: 'md', visible: true, sort: n })); } log('أضاف ' + files.length + ' صورة إلى المعرض'); toast('تمت إضافة الصور'); } catch (er) { toast(errMsg(er), true); }
        return;
      }
      if (b.id === 'seedBtn') {
        if (!confirmBox('إضافة 3 منتجات تجريبية وعرض تجريبي؟ (يمكنك تعديلها أو حذفها لاحقاً)')) return;
        try {
          const base = maxOrder();
          must(await sb().from('products').insert(window.HQ_SAMPLE_PRODUCTS.map((p, i) => Object.assign({}, p, { sort: base + i + 1 }))));
          must(await sb().from('offers').insert(window.HQ_SAMPLE_OFFERS.map((o, i) => Object.assign({}, o, { sort: Date.now() + i }))));
          log('أضاف بيانات تجريبية (منتجات وعرض)'); toast('تمت الإضافة');
        } catch (er) { toast(errMsg(er), true); }
        return;
      }
      const row = b.closest('.row'); if (!row) return;
      const i = items.findIndex((x) => x.id === row.dataset.id), x = items[i], t = sb().from(cfg.col);
      try {
        if (b.hasAttribute('data-edit')) form(cfg, x);
        else if (b.hasAttribute('data-vis')) { must(await sb().from(cfg.col).update({ visible: x.visible === false }).eq('id', x.id)); log((x.visible === false ? 'أظهر ' : 'أخفى ') + cfg.one + ' "' + cfg.name(x) + '"'); }
        else if (b.hasAttribute('data-del')) { if (confirmBox('حذف ' + cfg.one + ' "' + cfg.name(x) + '" نهائياً؟')) { must(await sb().from(cfg.col).delete().eq('id', x.id)); log('حذف ' + cfg.one + ' "' + cfg.name(x) + '"'); } }
        else if (b.hasAttribute('data-up') || b.hasAttribute('data-down')) {
          const y = items[b.hasAttribute('data-up') ? i - 1 : i + 1]; if (!y) return;
          must(await sb().from(cfg.col).update({ sort: y.sort }).eq('id', x.id)); must(await sb().from(cfg.col).update({ sort: x.sort }).eq('id', y.id));
        }
      } catch (er) { toast(errMsg(er), true); }
    };
  }

  function form(cfg, item, nextOrder) {
    const data = Object.assign({ visible: true }, item || {});
    let pending = null, cleared = false;
    const html = cfg.fields.map((f) => {
      const [k, label, type, opts] = f, v = data[k];
      if (type === 'textarea') return '<label>' + label + '<textarea data-k="' + k + '">' + esc(v || '') + '</textarea></label>';
      if (type === 'number') return '<label>' + label + '<input type="number" step="any" min="0" data-k="' + k + '" value="' + esc(v != null ? v : '') + '"></label>';
      if (type === 'select') return '<label>' + label + '<select data-k="' + k + '">' + opts.map((o) => '<option value="' + o[0] + '"' + ((v || 'md') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>';
      if (type === 'bool') return '<label class="switch"><input type="checkbox" data-k="' + k + '"' + (v !== false ? ' checked' : '') + '> ' + label + '</label>';
      if (type === 'image') return '<div><div class="muted" style="font-size:14px;margin-bottom:6px">' + label + '</div><div class="imgfield"><div class="thumb" id="imgPrev">' + (v ? '<img alt="" src="' + esc(v) + '">' : '🖼') + '</div><button type="button" class="btn line sm" id="imgPick">اختيار صورة</button><button type="button" class="btn danger sm" id="imgClr">إزالة</button></div></div>';
      return '<label>' + label + '<input data-k="' + k + '" value="' + esc(v || '') + '"></label>';
    }).join('');
    modal('<h3>' + (item ? 'تعديل ' : 'إضافة ') + cfg.one + '</h3><form id="mForm">' + html + '<div class="mfoot"><button type="button" class="btn line" data-x>إلغاء</button><button class="btn" id="mSave">حفظ</button></div></form>');
    if ($('#imgPick')) $('#imgPick').onclick = async () => {
      const [f] = await pick('image/*'); if (!f) return;
      pending = f; cleared = false; $('#imgPrev').innerHTML = '<img alt="" src="' + HQ.previewURL(f) + '">';
    };
    if ($('#imgClr')) $('#imgClr').onclick = () => { pending = null; cleared = true; $('#imgPrev').textContent = '🖼'; };
    $('#mForm').onsubmit = async (e) => {
      e.preventDefault();
      const out = {};
      $$('#mForm [data-k]').forEach((el) => { out[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim(); });
      if (cfg.col === 'gallery' && !pending && (cleared || !data.image)) return toast('اختر صورة أولاً', true);
      if (cfg.col !== 'gallery' && !(out.name_ar || out.title_ar || out.name_en || out.title_en)) return toast('أدخل الاسم', true);
      $('#mSave').disabled = true;
      try {
        if (cfg.fields.some((f) => f[0] === 'image')) out.image = pending ? await HQ.uploadImage(pending, cfg.col, 1400, 0.82) : cleared ? '' : (data.image || '');
        if (item) must(await sb().from(cfg.col).update(out).eq('id', item.id));
        else { out.sort = nextOrder; must(await sb().from(cfg.col).insert(out)); }
        log((item ? 'عدّل ' : 'أضاف ') + cfg.one + ' "' + cfg.name(out) + '"');
        closeModal(); toast('تم الحفظ');
      } catch (er) { toast(errMsg(er), true); $('#mSave').disabled = false; }
    };
  }

  function modal(html) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-x]')) closeModal(); });

  /* ================= النصوص ================= */
  async function viewTexts() {
    view.innerHTML = '<div class="head"><h2>نصوص الموقع</h2><span class="muted">عدّل النص والحجم أو أخفِه. اترك الخانة فارغة لاستخدام النص الافتراضي</span></div><div id="tx"><p class="empty">جارٍ التحميل…</p></div>';
    try { A.content = (await HQ.kvGet('content')).texts || {}; } catch (e) { toast(errMsg(e), true); }
    if (A.tab !== 'texts') return;
    const T = window.HQ_TEXTS, G = window.HQ_GROUPS, groups = {};
    Object.keys(T).forEach((k) => { (groups[k.split('.')[0]] = groups[k.split('.')[0]] || []).push(k); });
    const work = JSON.parse(JSON.stringify(A.content)), dirty = new Set();
    $('#tx').innerHTML = Object.keys(groups).map((g) => '<section class="card tgroup"><h3>' + (G[g] || g) + '</h3>' + groups[g].map((k) => {
      const c = work[k] || {}, d = T[k], long = d.long;
      const inp = (lang) => (long ? '<textarea data-k="' + k + '" data-l="' + lang + '" placeholder="' + esc(d[lang]) + '" ' + (lang === 'en' ? 'dir="ltr"' : '') + '>' + esc(c[lang] || '') + '</textarea>' : '<input data-k="' + k + '" data-l="' + lang + '" placeholder="' + esc(d[lang]) + '" value="' + esc(c[lang] || '') + '" ' + (lang === 'en' ? 'dir="ltr"' : '') + '>');
      return '<div class="trow" data-row="' + k + '"><div class="lbl"><code>' + k + '</code>الافتراضي: ' + esc(d.ar.slice(0, 60)) + '</div><label>عربي' + inp('ar') + '</label><label>English' + inp('en') + '</label>' +
        '<div><div class="range-row"><label>الحجم<input type="range" min="50" max="250" step="5" data-k="' + k + '" data-s value="' + (c.size || 100) + '"></label><output>' + (c.size || 100) + '%</output></div></div>' +
        '<div style="display:grid;gap:8px"><label class="switch"><input type="checkbox" data-k="' + k + '" data-h ' + (c.hidden ? 'checked' : '') + '> إخفاء</label><button class="btn line sm" data-reset="' + k + '" type="button">استرجاع</button></div></div>';
    }).join('') + '</section>').join('') + '<div class="savebar"><span id="dirtyTxt">لا توجد تغييرات</span><button class="btn" id="saveTx" disabled>حفظ التغييرات</button></div>';

    const mark = () => { $('#dirtyTxt').textContent = dirty.size ? 'تغييرات غير محفوظة: ' + dirty.size : 'لا توجد تغييرات'; $('#saveTx').disabled = !dirty.size; };
    const onEdit = (el) => {
      const k = el.dataset.k, c = (work[k] = work[k] || {});
      if (el.hasAttribute('data-s')) { c.size = Number(el.value); el.closest('.range-row').querySelector('output').textContent = el.value + '%'; }
      else if (el.hasAttribute('data-h')) c.hidden = el.checked;
      else c[el.dataset.l] = el.value;
      dirty.add(k); el.closest('.trow').classList.add('chg'); mark();
    };
    $('#tx').addEventListener('input', (e) => e.target.dataset.k && onEdit(e.target));
    $('#tx').addEventListener('change', (e) => e.target.dataset.k && e.target.type === 'checkbox' && onEdit(e.target));
    $('#tx').addEventListener('click', (e) => {
      const b = e.target.closest('[data-reset]'); if (!b) return;
      const k = b.dataset.reset; delete work[k]; dirty.add(k);
      const row = b.closest('.trow'); row.classList.add('chg');
      $$('[data-l]', row).forEach((i) => (i.value = '')); $('[data-s]', row).value = 100; $('output', row).textContent = '100%'; $('[data-h]', row).checked = false; mark();
    });
    $('#saveTx').onclick = async () => {
      const clean = {}; Object.keys(work).forEach((k) => { const c = work[k]; if ((c.ar || c.en || c.hidden || (c.size && c.size !== 100))) clean[k] = { ar: c.ar || '', en: c.en || '', size: c.size || 100, hidden: !!c.hidden }; });
      try { await HQ.kvSet('content', { texts: clean }); A.content = clean; log('عدّل نصوص الموقع (' + dirty.size + ' نص)'); dirty.clear(); $$('.trow.chg').forEach((r) => r.classList.remove('chg')); mark(); toast('تم حفظ النصوص'); } catch (e) { toast(errMsg(e), true); }
    };
  }

  /* ================= الشعار والهوية ================= */
  async function viewIdentity() {
    view.innerHTML = '<div class="head"><h2>الشعار والهوية</h2></div><div id="idn"><p class="empty">جارٍ التحميل…</p></div>';
    try {
      const [s, l, f] = await Promise.all([HQ.kvGet('settings'), HQ.kvGet('logos'), HQ.kvGet('font')]);
      A.settings = s; A.logos = l; A.font = f && f.url ? f : null;
    } catch (e) { toast(errMsg(e), true); }
    if (A.tab !== 'identity') return;
    const st = A.settings, lg = A.logos;
    const SECS = [['stats', 'الأرقام المتحركة'], ['story', 'قسم القصة'], ['time', 'ساعة الهقوة'], ['menu', 'القائمة'], ['offers', 'العروض'], ['gallery', 'المعرض'], ['delivery', 'التوصيل (كيتا)'], ['hours', 'أوقات العمل'], ['branches', 'الفروع'], ['contact', 'التواصل']];
    const range = (id, label, min, max, val) => '<div class="range-row"><label>' + label + '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" value="' + val + '"></label><output>' + val + '</output></div>';

    $('#idn').innerHTML =
      '<div class="grid2"><section class="card"><h3>الشعار الرئيسي (للخلفيات الفاتحة)</h3><div class="logo-prev"><img id="pvMain" alt="" src="' + esc(lg.main || 'assets/logo-green.png') + '"></div>' +
      range('logoSize', 'حجم الشعار في الشريط العلوي (px)', 24, 110, st.logoSize || 44) +
      '<div class="mfoot" style="justify-content:flex-start"><button class="btn line sm" id="upMain">رفع شعار جديد</button><button class="btn danger sm" id="rmMain">استرجاع الأصلي</button><button class="btn sm" id="saveSize">حفظ الحجم</button></div></section>' +
      '<section class="card"><h3>الشعار الفاتح (للخلفيات الخضراء والداكنة)</h3><div class="logo-prev dark"><img id="pvLight" alt="" src="' + esc(lg.light || 'assets/logo-cream.png') + '"></div><p class="muted" style="font-size:14px;margin-bottom:10px">يظهر في شاشة التحميل والقرص والفوتر. ارفع نسخة بخلفية شفافة (PNG).</p>' +
      '<div class="mfoot" style="justify-content:flex-start"><button class="btn line sm" id="upLight">رفع شعار</button><button class="btn danger sm" id="rmLight">استرجاع الأصلي</button></div></section></div>' +

      '<section class="card"><h3>الشعار الثانوي للمناسبات (اليوم الوطني، يوم القهوة…)</h3><div class="grid2"><div><div class="logo-prev"><img id="pvL2" alt="" src="' + esc(lg.logo2 || 'assets/favicon.png') + '" ' + (lg.logo2 ? '' : 'style="opacity:.25"') + '></div></div><div style="display:grid;gap:14px;align-content:start">' +
      '<label class="switch"><input type="checkbox" id="l2vis" ' + (st.logo2Visible ? 'checked' : '') + '> إظهار الشعار الثانوي في الموقع</label>' + range('l2size', 'عرض الشعار (px)', 80, 420, st.logo2Size || 180) +
      '<div class="mfoot" style="justify-content:flex-start;margin:0"><button class="btn line sm" id="upL2">رفع / استبدال</button><button class="btn danger sm" id="rmL2">حذف</button><button class="btn sm" id="saveL2">حفظ</button></div></div></div></section>' +

      '<section class="card"><h3>اسم الموقع</h3><div class="grid2"><label>الاسم (عربي)<input id="nmAr" value="' + esc(st.siteName_ar || '') + '" placeholder="هقَّوة"></label><label>الاسم (إنجليزي)<input id="nmEn" dir="ltr" value="' + esc(st.siteName_en || '') + '" placeholder="Haqwa"></label></div>' +
      '<div class="grid2" style="margin-top:14px"><label class="switch"><input type="checkbox" id="nmShow" ' + (st.showName ? 'checked' : '') + '> إظهار الاسم بجانب الشعار</label>' + range('nmSize', 'حجم الاسم %', 60, 250, st.nameSize || 100) + '</div><div class="mfoot" style="justify-content:flex-start"><button class="btn sm" id="saveName">حفظ الاسم</button></div></section>' +

      '<section class="card"><h3>خط الموقع</h3><p class="muted" style="font-size:14px;margin-bottom:10px">ارفع ملف خط (TTF / OTF / WOFF / WOFF2) بحجم أقل من 5MB ليُطبّق على كامل الموقع.</p>' +
      '<div class="fontbox" id="fontPrev" style="' + (A.font ? "font-family:'HQCustom'" : '') + '">' + (A.font && A.font.name ? esc(A.font.name) + ' — لا خابت الهقوة .. تقهوى' : 'الخط الافتراضي — لا خابت الهقوة .. تقهوى') + '</div>' +
      '<div class="mfoot" style="justify-content:flex-start"><button class="btn line sm" id="upFont">رفع ملف خط</button><button class="btn danger sm" id="rmFont">إزالة الخط المخصص</button></div></section>' +

      '<section class="card"><h3>أقسام الموقع (إظهار / إخفاء)</h3><div class="sec-toggles">' + SECS.map((s) => '<label class="switch"><input type="checkbox" data-sec="' + s[0] + '" ' + (!st.sections || st.sections[s[0]] !== false ? 'checked' : '') + '> ' + s[1] + '</label>').join('') + '</div><div class="mfoot" style="justify-content:flex-start"><button class="btn sm" id="saveSecs">حفظ الأقسام</button></div></section>';

    if (A.font) HQ.applyCustomFont(A.font);
    ['logoSize', 'l2size', 'nmSize'].forEach((id) => { const el = $('#' + id); el.addEventListener('input', () => (el.closest('.range-row').querySelector('output').textContent = el.value)); });
    const saveS = async (patch, msg) => { try { const n = Object.assign({}, A.settings, patch); await HQ.kvSet('settings', n); A.settings = n; log(msg); toast('تم الحفظ'); return true; } catch (e) { toast(errMsg(e), true); return false; } };
    const saveL = async (patch, msg) => {
      try { const n = Object.assign({}, A.logos, patch); Object.keys(n).forEach((k) => n[k] == null && delete n[k]); await HQ.kvSet('logos', n); A.logos = n; log(msg); toast('تم الحفظ'); return true; } catch (e) { toast(errMsg(e), true); return false; }
    };
    const upLogo = async (key, prevId, label) => {
      const [f] = await pick('image/png,image/webp,image/svg+xml,image/jpeg'); if (!f) return;
      try {
        toast('جارٍ الرفع…');
        const url = await HQ.uploadImage(f, 'logos', 700, 0.9, true);
        if (await saveL({ [key]: url }, 'غيّر ' + label)) { $('#' + prevId).src = url; $('#' + prevId).style.opacity = 1; }
      } catch (e) { toast(errMsg(e), true); }
    };
    $('#upMain').onclick = () => upLogo('main', 'pvMain', 'الشعار الرئيسي');
    $('#upLight').onclick = () => upLogo('light', 'pvLight', 'الشعار الفاتح');
    $('#upL2').onclick = () => upLogo('logo2', 'pvL2', 'الشعار الثانوي');
    $('#rmMain').onclick = async () => { if (await saveL({ main: null }, 'استرجع الشعار الرئيسي الأصلي')) $('#pvMain').src = 'assets/logo-green.png'; };
    $('#rmLight').onclick = async () => { if (await saveL({ light: null }, 'استرجع الشعار الفاتح الأصلي')) $('#pvLight').src = 'assets/logo-cream.png'; };
    $('#rmL2').onclick = async () => { if (confirmBox('حذف الشعار الثانوي؟') && await saveL({ logo2: null }, 'حذف الشعار الثانوي')) { $('#pvL2').src = 'assets/favicon.png'; $('#pvL2').style.opacity = 0.25; $('#l2vis').checked = false; saveS({ logo2Visible: false }, 'أخفى الشعار الثانوي'); } };
    $('#saveSize').onclick = () => saveS({ logoSize: Number($('#logoSize').value) }, 'غيّر حجم الشعار');
    $('#saveL2').onclick = () => saveS({ logo2Visible: $('#l2vis').checked, logo2Size: Number($('#l2size').value) }, 'عدّل إعدادات الشعار الثانوي');
    $('#saveName').onclick = () => saveS({ siteName_ar: $('#nmAr').value.trim(), siteName_en: $('#nmEn').value.trim(), showName: $('#nmShow').checked, nameSize: Number($('#nmSize').value) }, 'عدّل اسم الموقع');
    $('#saveSecs').onclick = () => { const sections = {}; $$('[data-sec]').forEach((c) => (sections[c.dataset.sec] = c.checked)); saveS({ sections }, 'عدّل ظهور أقسام الموقع'); };
    $('#upFont').onclick = async () => {
      const [f] = await pick('.ttf,.otf,.woff,.woff2'); if (!f) return;
      if (f.size > 5 * 1024 * 1024) return toast('حجم الخط كبير (الحد الأقصى 5MB)', true);
      try {
        toast('جارٍ رفع الخط…');
        const ext = (f.name.split('.').pop() || 'ttf').toLowerCase();
        const url = await HQ.upload(f, 'fonts', ext), name = f.name.replace(/\.[^.]+$/, '');
        await HQ.kvSet('font', { name, url }); A.font = { name, url }; HQ.applyCustomFont(A.font);
        $('#fontPrev').style.fontFamily = "'HQCustom'"; $('#fontPrev').textContent = name + ' — لا خابت الهقوة .. تقهوى'; log('غيّر خط الموقع إلى "' + name + '"'); toast('تم رفع الخط');
      } catch (e) { toast(errMsg(e), true); }
    };
    $('#rmFont').onclick = async () => { try { await HQ.kvSet('font', {}); HQ.applyCustomFont(null); A.font = null; $('#fontPrev').style.fontFamily = ''; $('#fontPrev').textContent = 'الخط الافتراضي'; log('أزال الخط المخصص'); toast('تمت الإزالة'); } catch (e) { toast(errMsg(e), true); } };
  }

  /* ================= الموظفون ================= */
  function viewStaff() {
    view.innerHTML = '<div class="head"><h2>الموظفون</h2><button class="btn sm" id="addStaff">+ إنشاء حساب موظف</button></div><p class="notice" style="margin-bottom:16px">الموظف يستطيع التعامل مع الموقع بالكامل لكنه لا يستطيع إنشاء حسابات موظفين آخرين. هذه الصلاحية للمدير فقط.</p><div class="list" id="stList"></div>';
    let items = [];
    sub(HQ.live('staff', (q) => q.select('*').order('created_at'), (rows) => {
      items = rows;
      const l = $('#stList'); if (!l) return;
      l.innerHTML = items.map((x) => '<div class="row' + (x.active === false ? ' off' : '') + '" data-id="' + x.id + '"><div class="thumb">' + (x.photo ? '<img alt="" src="' + esc(x.photo) + '">' : '👤') + '</div><div><b>' + esc(x.name) + ' <span class="pill">' + (x.role === 'admin' ? 'مدير' : 'موظف') + '</span></b><small dir="ltr" style="display:block;text-align:start">@' + esc(x.username) + (x.active === false ? ' · معطّل' : '') + '</small></div>' +
        '<div class="acts-row">' + (x.id === A.user.id ? '<span class="muted">أنت</span>' : '<button class="ib" data-pass title="تغيير كلمة المرور">🔑</button><button class="ib" data-toggle title="' + (x.active === false ? 'تفعيل' : 'تعطيل') + '">' + (x.active === false ? '▶' : '⏸') + '</button><button class="ib red" data-del title="حذف">🗑</button>') + '</div></div>').join('');
    }));
    view.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'addStaff') return staffForm();
      const row = b.closest('.row'); if (!row) return;
      const x = items.find((i) => i.id === row.dataset.id);
      try {
        if (b.hasAttribute('data-toggle')) { must(await sb().from('staff').update({ active: x.active === false }).eq('id', x.id)); log((x.active === false ? 'فعّل' : 'عطّل') + ' حساب الموظف "' + x.name + '"'); }
        else if (b.hasAttribute('data-pass')) {
          const p = window.prompt('كلمة المرور الجديدة للموظف "' + x.name + '" (6 أحرف أو أكثر):'); if (!p) return;
          must(await sb().rpc('admin_set_password', { p_id: x.id, p_pass: p })); log('غيّر كلمة مرور الموظف "' + x.name + '"'); toast('تم تغيير كلمة المرور');
        }
        else if (b.hasAttribute('data-del') && confirmBox('حذف الموظف "' + x.name + '" نهائياً؟ لن يتمكن من الدخول بعد الآن.')) { must(await sb().rpc('delete_staff', { p_id: x.id })); log('حذف حساب الموظف "' + x.name + '"'); }
      } catch (er) { toast(errMsg(er), true); }
    };
  }
  function staffForm() {
    let photoFile = null;
    modal('<h3>إنشاء حساب موظف</h3><form id="sForm"><label>اسم الموظف<input id="fName" required></label><div><div class="muted" style="font-size:14px;margin-bottom:6px">صورة الموظف (اختيارية)</div><div class="imgfield"><div class="thumb" id="imgPrev">👤</div><button type="button" class="btn line sm" id="imgPick">اختيار صورة</button></div></div>' +
      '<label>اسم المستخدم (إنجليزي، بدون مسافات)<input id="fUser" dir="ltr" required pattern="[A-Za-z0-9._\\-]{3,30}" placeholder="ahmed"></label><label>كلمة المرور (6 أحرف أو أكثر)<input id="fPass" type="text" dir="ltr" minlength="6" required></label><div class="mfoot"><button type="button" class="btn line" data-x>إلغاء</button><button class="btn" id="mSave">حفظ</button></div></form>');
    $('#imgPick').onclick = async () => { const [f] = await pick('image/*'); if (!f) return; photoFile = f; $('#imgPrev').innerHTML = '<img alt="" src="' + HQ.previewURL(f) + '">'; };
    $('#sForm').onsubmit = async (e) => {
      e.preventDefault(); $('#mSave').disabled = true;
      const name = $('#fName').value.trim(), username = $('#fUser').value.trim().toLowerCase(), pass = $('#fPass').value;
      try {
        // عميل ثانوي بلا جلسة محفوظة حتى لا يُسجَّل خروج المدير الحالي
        const sec = supabase.createClient(HQ.cfg.url, HQ.cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const { data, error } = await sec.auth.signUp({ email: emailOf(username), password: pass });
        if (error) throw error;
        if (!data.user || (data.user.identities && !data.user.identities.length)) throw new Error('اسم المستخدم مستخدم من قبل');
        const photo = photoFile ? await HQ.uploadImage(photoFile, 'staff', 300, 0.82) : '';
        must(await sb().from('staff').insert({ id: data.user.id, name, username, photo, role: 'staff', active: true }));
        log('أنشأ حساب موظف جديد "' + name + '"'); closeModal(); toast('تم إنشاء حساب الموظف');
      } catch (er) { toast(errMsg(er), true); $('#mSave').disabled = false; }
    };
  }

  /* ================= سجل النشاط ================= */
  function viewActivity() {
    view.innerHTML = '<div class="head"><h2>سجل النشاط</h2><input id="actQ" placeholder="بحث باسم الموظف أو العملية…" style="max-width:320px"></div><div class="card" id="actList"><p class="empty">جارٍ التحميل…</p></div>';
    let rows = [];
    const draw = () => {
      const q = ($('#actQ').value || '').trim(), l = $('#actList'); if (!l) return;
      const f = rows.filter((r) => !q || (r.name + ' ' + r.action).indexOf(q) > -1);
      l.innerHTML = f.length ? f.map((r) => '<div class="act"><span class="dot"></span><div><span><b>' + esc(r.name) + '</b> قام بـ ' + esc(r.action) + '</span><small>بتاريخ ' + fmtDate(r.ts) + '</small></div></div>').join('') : '<p class="empty">لا يوجد نشاط</p>';
    };
    sub(HQ.live('activity', (q) => q.select('*').order('ts', { ascending: false }).limit(300), (r) => { rows = r; draw(); }));
    $('#actQ').oninput = draw;
  }

  /* ---------- الأحداث العامة ---------- */
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) go(b.dataset.tab); });
  $('#logout').addEventListener('click', async () => { clearSubs(); if (countSub) countSub(); await sb().auth.signOut(); A.user = null; showLogin(); });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginErr').textContent = ''; $('#loginBtn').disabled = true;
    try { must(await sb().auth.signInWithPassword({ email: emailOf($('#lUser').value), password: $('#lPass').value })); }
    catch (er) { $('#loginErr').textContent = errMsg(er); }
    $('#loginBtn').disabled = false;
  });
  $('#setupForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginErr').textContent = ''; A.busy = true;
    const name = $('#sName').value.trim(), username = $('#sUser').value.trim().toLowerCase();
    try {
      const { data, error } = await sb().auth.signUp({ email: emailOf(username), password: $('#sPass').value });
      if (error) throw error;
      if (!data.session) throw new Error('Email not confirmed');
      must(await sb().rpc('claim_first_admin', { p_name: name, p_username: username }));
      A.busy = false; await boot(data.user);
    } catch (er) { A.busy = false; $('#loginErr').textContent = errMsg(er); }
  });

  if (HQ.demo) {
    $('#loginForm').hidden = true; $('#loginHint').textContent = '';
    $('#loginErr').textContent = 'لم يتم ربط Supabase بعد. افتح js/config.js وألصق بيانات مشروعك (راجع ملف الخطوات).';
  } else {
    checkSetup();
    sb().auth.onAuthStateChange((evt, session) => {
      if (A.busy) return;
      const u = session && session.user;
      setTimeout(() => {
        if (u) { if (!A.user || A.user.id !== u.id) boot(u); }
        else if (evt === 'SIGNED_OUT' || evt === 'INITIAL_SESSION') showLogin();
      }, 0);
    });
  }
})();
