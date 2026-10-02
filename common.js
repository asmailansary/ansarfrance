/* وظائف مشتركة بين الموقع ولوحة التحكم (Supabase) */
(function () {
  const cfg = window.HQ_SUPABASE || {};
  const demo = !cfg.url || String(cfg.url).indexOf('PASTE') === 0 || !cfg.anonKey || typeof supabase === 'undefined';
  const HQ = (window.HQ = { demo, cfg });
  const BUCKET = 'media';

  if (!demo) HQ.sb = supabase.createClient(cfg.url, cfg.anonKey);

  /* قراءة مباشرة + اشتراك في التغييرات اللحظية. تُرجع دالة لإلغاء الاشتراك */
  HQ.live = function (table, build, cb) {
    let dead = false;
    const run = async () => {
      const { data, error } = await build(HQ.sb.from(table));
      if (dead) return;
      if (error) console.warn(table, error.message); else cb(data || []);
    };
    run();
    const ch = HQ.sb.channel('rt-' + table + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table }, run).subscribe();
    return () => { dead = true; HQ.sb.removeChannel(ch); };
  };

  /* مفاتيح الإعدادات (site_kv) */
  HQ.kvGet = async function (key) {
    const { data, error } = await HQ.sb.from('site_kv').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return (data && data.value) || {};
  };
  HQ.kvSet = async function (key, value) {
    const { error } = await HQ.sb.from('site_kv').upsert({ key, value });
    if (error) throw error;
  };

  /* رفع ملف إلى التخزين وإرجاع الرابط العام */
  HQ.upload = async function (blobOrFile, folder, ext) {
    const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const { error } = await HQ.sb.storage.from(BUCKET).upload(path, blobOrFile, { cacheControl: '31536000', upsert: false, contentType: blobOrFile.type || undefined });
    if (error) throw error;
    return HQ.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  };

  /* تصغير صورة ثم رفعها. keepAlpha للشعارات الشفافة (PNG) */
  HQ.uploadImage = async function (file, folder, maxDim, quality, keepAlpha) {
    const blob = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
        img.onload = () => {
          const k = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * k), h = Math.round(img.height * k);
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error('تعذّر معالجة الصورة'))), keepAlpha ? 'image/png' : 'image/jpeg', quality || 0.82);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
    return HQ.upload(blob, folder, keepAlpha ? 'png' : 'jpg');
  };

  /* معاينة محلية قبل الرفع */
  HQ.previewURL = (file) => URL.createObjectURL(file);

  /* تطبيق خط مخصص (ملف خط مرفوع من لوحة التحكم) */
  HQ.applyCustomFont = function (font) {
    let st = document.getElementById('hq-custom-font');
    if (!font || !font.url) { if (st) st.remove(); document.documentElement.style.removeProperty('--font-custom'); return; }
    if (!st) { st = document.createElement('style'); st.id = 'hq-custom-font'; document.head.appendChild(st); }
    st.textContent = "@font-face{font-family:'HQCustom';src:url(" + font.url + ");font-display:swap}";
    document.documentElement.style.setProperty('--font-custom', "'HQCustom',");
  };

  HQ.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
})();
