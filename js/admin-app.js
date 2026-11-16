/* =====================================================================
 *  Yönetim paneli (admin.html) — sadece site sahibi içindir.
 *  Giriş: Supabase Auth. Supabase ayarlı değilse "yerel mod" çalışır
 *  (taslak tarayıcıda durur, yayınlamak için dataset.json indirilir).
 * ===================================================================== */
(async function () {
  const E = window.M2Engine, D = window.M2Data, U = window.M2UI, h = U.h;
  const app = document.getElementById('app');
  const DRAFT = 'm2admin.draft.v1';
  let ds = null, pane = 'publish', session = null;

  function toast(msg, bad) { const t = h('div', { class: 'toast', style: bad ? { background: '#b91c1c' } : null }, msg); document.body.append(t); setTimeout(() => t.remove(), 2600); }
  const save = U.debounce(() => { try { localStorage.setItem(DRAFT, JSON.stringify(ds)); } catch (e) { toast('Taslak kaydedilemedi (depolama dolu)', true); } }, 300);
  const dirty = () => { save(); };

  /* ---------------- giriş ---------------- */
  async function boot() {
    app.innerHTML = '';
    if (D.hasSupabase()) {
      const sb = D.sb();
      const { data } = await sb.auth.getSession();
      session = data.session;
      if (!session) return loginScreen();
    }
    await openDraft();
  }
  function loginScreen(msg) {
    app.innerHTML = '';
    let email = '', pass = '';
    app.append(h('div', { class: 'card login' }, h('h1', null, 'Yönetim girişi'),
      h('p', { class: 'hint' }, 'Bu panel sadece site sahibi içindir.'),
      msg ? h('div', { class: 'notice' }, msg) : '',
      h('label', null, 'E-posta', U.textInput('', (v) => { email = v; }, { type: 'email', autocomplete: 'username' })),
      h('label', null, 'Şifre', U.textInput('', (v) => { pass = v; }, { type: 'password', autocomplete: 'current-password' })),
      h('button', { class: 'primary', onclick: async () => {
        const { error } = await D.sb().auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) return loginScreen('Giriş başarısız: ' + error.message);
        boot();
      } }, 'Giriş yap')));
  }

  async function openDraft() {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { /* bozuk */ }
    if (draft) { ds = D.normalize(draft); }
    else { ds = (await D.load()).ds; }
    render();
  }

  /* ---------------- iskelet ---------------- */
  const PANES = [['publish', '📤 Yayın / Yedek'], ['profile', '🧮 Formül profili'], ['stats', '📊 Statlar'], ['classes', '🧙 Sınıflar'], ['points', '🎯 Stat puanları'],
    ['slots', '🧩 Slot ve türler'], ['items', '🗡 Eşyalar'], ['enchants', '✨ Efsunlar'], ['skills', '💥 Beceriler'], ['targets', '👹 Hedefler'], ['calib', '🔬 Kalibrasyon']];
  function render() {
    app.innerHTML = '';
    const head = h('header', { class: 'top' }, h('span', { class: 'brand' }, '🛠 Yönetim Paneli'),
      h('span', { class: 'badge ' + (ds.profile.calibrated ? 'ok' : 'warn') }, ds.profile.calibrated ? 'Kalibre edildi' : 'Kalibre edilmedi'),
      h('span', { class: 'badge' }, D.hasSupabase() ? 'Supabase bağlı' : 'Yerel mod (Supabase yok)'),
      h('span', { class: 'grow' }), h('a', { href: 'index.html', target: '_blank' }, 'Simülatörü aç ↗'),
      D.hasSupabase() ? h('button', { onclick: async () => { await D.sb().auth.signOut(); boot(); } }, 'Çıkış') : '');
    const nav = h('nav', null, PANES.map(([k, l]) => h('button', { class: pane === k ? 'on' : '', onclick: () => { pane = k; render(); } }, l)));
    const body = h('section', { class: 'pane' });
    ({ publish: pPublish, profile: pProfile, stats: pStats, classes: pClasses, points: pPoints, slots: pSlots, items: pItems, enchants: pEnchants, skills: pSkills, targets: pTargets, calib: pCalib }[pane])(body);
    app.append(head, h('div', { class: 'admin' }, nav, body));
  }

  /* ---------------- genel bileşenler ---------------- */
  const stOpts = (none) => U.statOptions(ds, none);
  function editTable(cols, rows, mkNew, opt) {
    opt = opt || {};
    const wrap = h('div');
    function draw() {
      wrap.innerHTML = '';
      const t = h('table', { class: 'edit' }, h('thead', null, h('tr', null, cols.map((c) => h('th', { style: c.w ? { width: c.w } : null }, c.label)), h('th'))));
      const tb = h('tbody');
      rows.forEach((r, i) => {
        tb.append(h('tr', null, cols.map((c) => h('td', null, c.cell(r, draw))),
          h('td', null, h('button', { class: 'icon danger', title: 'Sil', onclick: () => { if (opt.confirmDelete === false || confirm('Silinsin mi?')) { rows.splice(i, 1); dirty(); draw(); if (opt.onDelete) opt.onDelete(); } } }, '🗑'))));
      });
      t.append(tb); wrap.append(t);
      wrap.append(h('button', { style: { marginTop: '8px' }, onclick: () => { rows.push(mkNew()); dirty(); draw(); } }, '+ ' + (opt.addLabel || 'Satır ekle')));
    }
    draw(); return wrap;
  }
  const T = (k, ph) => (r) => U.textInput(r[k], (v) => { r[k] = v; dirty(); }, { placeholder: ph || '' });
  const N = (k, step) => (r) => U.numInput(r[k], (v) => { r[k] = v; dirty(); }, step ? { step } : null);
  const S = (k, opts) => (r, redraw) => U.sel(typeof opts === 'function' ? opts(r) : opts, r[k] == null ? '' : r[k], (v) => { r[k] = v; dirty(); });
  const C = (k) => (r) => h('input', { type: 'checkbox', checked: r[k] !== false && !!r[k], onchange: (e) => { r[k] = e.target.checked; dirty(); } });
  function statMapCell(getMap) {
    return (r, redraw) => {
      const map = getMap(r);
      const box = h('div');
      Object.keys(map).forEach((k) => {
        box.append(h('div', { class: 'row' },
          U.sel(stOpts(true), k, (nk) => { if (nk && nk !== k) { const v = map[k]; delete map[k]; map[nk] = v; dirty(); redraw(); } }),
          U.numInput(map[k], (v) => { map[k] = v; dirty(); }),
          h('button', { class: 'icon', onclick: () => { delete map[k]; dirty(); redraw(); } }, '✕')));
      });
      const add = U.sel(stOpts(true), '', (nk) => { if (nk && !(nk in map)) { map[nk] = 0; dirty(); redraw(); } }, { class: 'add-sel' });
      add.options[0].textContent = '+ stat';
      box.append(add); return box;
    };
  }
  const idOf = (name, list) => { let b = (name || 'x').toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, '_').replace(/^_|_$/g, '') || 'x', id = b, n = 2; while (list.some((x) => x.id === id)) id = b + '_' + n++; return id; };
  const help = (t) => h('p', { class: 'hint' }, t);

  /* ---------------- 1) yayın ---------------- */
  function pPublish(box) {
    box.append(h('h1', null, 'Yayın ve yedek'),
      help('Panelde yaptığın her değişiklik bu tarayıcıda otomatik taslak olarak saklanır. Herkese açık siteye yansıması için "Yayınla" gerekir.'));
    const card = h('div', { class: 'card' });
    card.append(h('h2', null, 'Yayınla'));
    if (D.hasSupabase()) {
      card.append(h('button', { class: 'primary', onclick: async () => {
        try { await D.saveRemote(ds); toast('Yayınlandı: herkese açık site güncellendi'); } catch (e) { toast('Hata: ' + (e.message || e), true); }
      } }, '☁ Supabase\'e yayınla'), help('Simülatör sayfası açıldığında en güncel veriyi Supabase\'den okur. Yazma izni sadece admin kullanıcıya aittir (bkz. README).'));
    } else {
      card.append(help('Supabase ayarlı değil (js/config.js). Aşağıdaki "dataset.json indir" ile alıp GitHub\'daki data/dataset.json dosyasının üzerine yükleyerek de yayınlayabilirsin.'));
    }
    card.append(h('button', { style: { marginTop: '8px' }, onclick: () => download('dataset.json', JSON.stringify(ds, null, 2)) }, '⬇ dataset.json indir (GitHub için)'));
    box.append(card);

    const c2 = h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Yedek / geri yükle'));
    const file = h('input', { type: 'file', accept: '.json', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { ds = D.normalize(JSON.parse(await f.text())); dirty(); toast('İçe aktarıldı'); render(); } catch (err) { toast('Dosya okunamadı: ' + err.message, true); }
    } });
    c2.append(h('label', null, 'JSON içe aktar (mevcut taslağın üstüne yazar)', file),
      h('button', { style: { marginTop: '8px' }, onclick: async () => {
        if (!D.hasSupabase()) return toast('Supabase ayarlı değil', true);
        const r = await D.load(); if (r.source !== 'supabase') return toast('Supabase\'de veri bulunamadı', true);
        if (confirm('Taslak, Supabase\'deki yayınlanmış veriyle değiştirilsin mi?')) { ds = r.ds; dirty(); render(); }
      } }, '☁ Yayındaki veriyi taslağa çek'),
      h('button', { class: 'danger', style: { marginTop: '8px', marginLeft: '8px' }, onclick: () => { if (confirm('Tüm taslak ÖRNEK veriye sıfırlansın mı? Geri alınamaz.')) { ds = D.normalize(D.defaultDataset()); dirty(); render(); } } }, 'Örnek veriye sıfırla'));
    box.append(c2);

    box.append(h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Genel'),
      h('div', { class: 'fields' },
        h('label', null, 'Oyun / site adı', U.textInput(ds.meta.name, (v) => { ds.meta.name = v; dirty(); })),
        h('label', null, 'Formül profili adı', U.textInput(ds.profile.name, (v) => { ds.profile.name = v; dirty(); })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!ds.profile.calibrated, onchange: (e) => { ds.profile.calibrated = e.target.checked; dirty(); render(); } }), ' Formülü "kalibre edildi" olarak işaretle (sitedeki uyarı rozetini değiştirir)'))));
  }
  function download(name, text) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    document.body.append(a); a.click(); a.remove();
  }

  /* ---------------- 2) formül profili ---------------- */
  const PF = [
    ['weaponMul', 'Silah zarı çarpanı', 'num', 'Taban hasar = Saldırı + (bu değer × silah min–maks arası zar). Oyunda silah hasarı daha çok/az etkiliyorsa değiştir.'],
    ['defenseMode', 'Savunma modu', ['subtract:Çıkarma (hasar − savunma)', 'ratio:Oran (hasar × K ÷ (K + savunma))'], 'Savunmanın hasarı nasıl düşürdüğü. Kalibrasyonla hangisinin tuttuğunu görebilirsin.'],
    ['defenseK', 'Savunma sabiti K (oran modu)', 'num', 'Sadece "Oran" modunda kullanılır.'],
    ['defMul', 'Savunma genel çarpanı', 'num', 'Savunma değerinin etkisini ölçekler (1 = olduğu gibi).'],
    ['defMulNormal', 'Normal vuruşa savunma etkisi', 'num', ''],
    ['defMulSkill', 'Beceriye savunma etkisi', 'num', 'Becerilerde savunma farklı çalışıyorsa.'],
    ['critBase', 'Kritik çarpanı', 'num', '2 = kritik vuruş 2× vurur. "Kritik Hasar %" bu değere eklenir (+50% → 2.5×).'],
    ['pierceBase', 'Delici vuruş taban çarpanı', 'num', 'Delici vuruşun hasar çarpanı (1 = sadece savunmayı yok sayar).'],
    ['pierceDefIgnore', 'Delici vuruşun yok saydığı savunma %', 'num', '100 = tamamen yok sayar.'],
    ['critBeforeDefense', 'Kritik, savunmadan ÖNCE mi uygulanır', 'bool', 'İşaretliyse: (hasar × kritik) − savunma. İşaretsizse: (hasar − savunma) × kritik.'],
    ['blockReduction', 'Blok başarılı olunca hasar azalması %', 'num', ''],
    ['dmgReduceCap', 'Hasar azaltma üst sınırı %', 'num', ''],
    ['resistCap', 'Direnç üst sınırı %', 'num', ''],
    ['damageFloor', 'Minimum hasar', 'num', 'Savunma ne kadar yüksek olursa olsun en az bu kadar vurur.'],
    ['rounding', 'Yuvarlama', ['floor:Aşağı', 'round:En yakın', 'none:Yok'], 'Oyun tam sayı gösteriyorsa genelde aşağı yuvarlama.'],
    ['baseAttackSpeed', 'Temel saldırı hızı (vuruş/sn)', 'num', 'Saldırı hızı %0 iken saniyede kaç normal vuruş.'],
    ['minActionTime', 'En kısa eylem süresi (sn)', 'num', ''],
    ['horizon', 'DPS hesap süresi (sn)', 'num', 'Rotasyon DPS bu süre boyunca hesaplanır; bekleme süreli beceriler için uzun tut.'],
    ['maxFightTime', 'Savaş zaman aşımı (sn)', 'num', ''],
  ];
  function pProfile(box) {
    box.append(h('h1', null, 'Formül profili'), help('Hasar hesabının nasıl çalıştığını belirleyen parametreler. Gerçek oyun değerleri bilinmediği için bunları "Kalibrasyon" bölümünde oyundan topladığın verilerle ayarlarsın.'));
    const f = h('div', { class: 'fields' });
    PF.forEach(([k, label, type, tip]) => {
      let inp;
      if (type === 'num') inp = U.numInput(ds.profile[k], (v) => { ds.profile[k] = v; dirty(); });
      else if (type === 'bool') inp = h('input', { type: 'checkbox', checked: ds.profile[k] !== false, onchange: (e) => { ds.profile[k] = e.target.checked; dirty(); } });
      else inp = U.sel(type.map((o) => { const [v, l] = o.split(':'); return { value: v, label: l }; }), ds.profile[k], (v) => { ds.profile[k] = v; dirty(); });
      f.append(h('label', null, label, inp, tip ? h('small', null, tip) : ''));
    });
    box.append(h('div', { class: 'card' }, f));
    box.append(h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Üst sınırlar (cap)'), help('Bir rolün toplamı bu değeri geçse bile hesapta bu değer kullanılır; simülatör o statı "gereksiz" olarak işaretler. Oyundaki gerçek sınırı yaz.'),
      h('div', { class: 'fields' }, Object.keys(ds.profile.caps).map((k) => h('label', null, (E.ROLES[k] || { name: k }).name, U.numInput(ds.profile.caps[k], (v) => { ds.profile.caps[k] = v; dirty(); }))))));
  }

  /* ---------------- 3) statlar ---------------- */
  function pStats(box) {
    box.append(h('h1', null, 'Statlar'), help('Oyundaki her bonusun bir kaydı. "Rol", formülün bu statı nasıl kullanacağını belirler. Aynı role bağlı birden çok stat toplanır. "Hedef türü" sadece "karşı hasar" ve "karşı direnç" rollerinde kullanılır. "Adım": duyarlılık analizinde testte kullanılacak artış.'));
    const roleOpts = Object.keys(E.ROLES).map((k) => ({ value: k, label: E.ROLES[k].name }));
    const kindOpts = [{ value: '', label: '(hepsi)' }].concat(ds.kinds.map((k) => ({ value: k.key, label: k.name })));
    box.append(editTable([
      { label: 'Anahtar', w: '120px', cell: (r) => h('code', null, r.key) },
      { label: 'Ad', cell: T('name') },
      { label: 'Rol (formüldeki işlevi)', cell: S('role', roleOpts) },
      { label: 'Hedef türü', w: '130px', cell: (r) => (E.ROLES[r.role] || {}).needsKind ? S('kind', kindOpts)(r) : h('span', { class: 'mut' }, '—') },
      { label: 'Birim', w: '90px', cell: S('unit', [{ value: '%', label: '%' }, { value: 'sabit', label: 'sabit' }]) },
      { label: 'Adım', w: '90px', cell: N('step') },
    ], ds.stats, () => { const k = D.uid('stat'); return { key: k, name: 'Yeni stat', role: 'none', step: 1, unit: '%' }; }, { addLabel: 'Stat ekle', onDelete: () => {} }));
  }

  /* ---------------- 4) sınıflar ---------------- */
  function pClasses(box) {
    box.append(h('h1', null, 'Sınıflar'), help('Her sınıfın seviye 1\'deki taban statları ve her seviyede artışı. Değer = Taban + Seviye başına × (seviye − 1). Örn. Can: taban 800, seviye başına 40.'));
    ds.classes.forEach((c) => {
      const card = h('div', { class: 'card', style: { marginBottom: '10px' } });
      const rows = Object.keys(c.base).map((k) => ({ k }));
      const draw = () => {
        card.innerHTML = '';
        card.append(h('div', { class: 'row' }, h('b', null, 'Ad'), U.textInput(c.name, (v) => { c.name = v; dirty(); }), h('code', null, c.id),
          h('button', { class: 'danger', onclick: () => { if (confirm('Sınıf silinsin mi?')) { ds.classes.splice(ds.classes.indexOf(c), 1); dirty(); render(); } } }, 'Sınıfı sil')));
        const t = h('table', { class: 'edit' }, h('tr', null, h('th', null, 'Stat'), h('th', null, 'Taban'), h('th', null, 'Seviye başına'), h('th')));
        Object.keys(c.base).forEach((k) => {
          const e = c.base[k];
          t.append(h('tr', null, h('td', null, U.sel(stOpts(true), k, (nk) => { if (nk && nk !== k) { c.base[nk] = c.base[k]; delete c.base[k]; dirty(); draw(); } })),
            h('td', null, U.numInput(e.b, (v) => { e.b = v; dirty(); })), h('td', null, U.numInput(e.l, (v) => { e.l = v; dirty(); })),
            h('td', null, h('button', { class: 'icon', onclick: () => { delete c.base[k]; dirty(); draw(); } }, '✕'))));
        });
        card.append(t);
        const add = U.sel(stOpts(true), '', (nk) => { if (nk && !c.base[nk]) { c.base[nk] = { b: 0, l: 0 }; dirty(); draw(); } }, { class: 'add-sel' }); add.options[0].textContent = '+ stat ekle';
        card.append(add);
      };
      draw(); box.append(card);
    });
    box.append(h('button', { onclick: () => { ds.classes.push({ id: idOf('sinif', ds.classes), name: 'Yeni sınıf', base: { atk: { b: 0, l: 0 }, hp: { b: 0, l: 0 } } }); dirty(); render(); } }, '+ Sınıf ekle'));
  }

  /* ---------------- 5) stat puanları ---------------- */
  function pPoints(box) {
    box.append(h('h1', null, 'Stat puanları'), help('Karakterin dağıttığı puanlar (Güç, Dayanıklılık…). Her puanın verdiği bonusları yaz; örn. Güç: 1 puan = +2 Saldırı Değeri.'));
    ds.pointStats.forEach((p) => {
      const card = h('div', { class: 'card', style: { marginBottom: '10px' } });
      const draw = () => {
        card.innerHTML = '';
        card.append(h('div', { class: 'row' }, h('b', null, 'Ad'), U.textInput(p.name, (v) => { p.name = v; dirty(); }), h('code', null, p.key),
          h('button', { class: 'danger', onclick: () => { if (confirm('Silinsin mi?')) { ds.pointStats.splice(ds.pointStats.indexOf(p), 1); dirty(); render(); } } }, 'Sil')));
        (p.effects = p.effects || []).forEach((e, i) => card.append(h('div', { class: 'row' }, h('span', { class: 'mut' }, '1 puan ='),
          U.numInput(e.per, (v) => { e.per = v; dirty(); }), U.sel(stOpts(true), e.stat, (v) => { e.stat = v; dirty(); }),
          h('button', { class: 'icon', onclick: () => { p.effects.splice(i, 1); dirty(); draw(); } }, '✕'))));
        card.append(h('button', { onclick: () => { p.effects.push({ stat: 'atk', per: 1 }); dirty(); draw(); } }, '+ etki ekle'));
      };
      draw(); box.append(card);
    });
    box.append(h('button', { onclick: () => { ds.pointStats.push({ key: idOf('puan', ds.pointStats.map((x) => ({ id: x.key }))), name: 'Yeni puan', effects: [] }); dirty(); render(); } }, '+ Stat puanı ekle'));
  }

  /* ---------------- 6) slot / tür ---------------- */
  function pSlots(box) {
    box.append(h('h1', null, 'Ekipman slotları'), help('Her slotta kaç efsun satırı olduğunu gir. Simülatördeki ekipman formu buna göre oluşur.'));
    box.append(editTable([{ label: 'Anahtar', w: '140px', cell: (r) => h('code', null, r.key) }, { label: 'Ad', cell: T('name') }, { label: 'Efsun satırı', w: '120px', cell: N('enchantSlots') }],
      ds.slots, () => ({ key: D.uid('slot'), name: 'Yeni slot', enchantSlots: 2 }), { addLabel: 'Slot ekle' }));
    box.append(h('h1', { style: { marginTop: '24px' } }, 'Hedef / savaşçı türleri'), help('"Canavara karşı hasar" gibi statların hangi türe uygulanacağını belirler. Anahtarı sonradan değiştirme: statlar ve hedefler bu anahtara bağlıdır.'));
    box.append(editTable([{ label: 'Anahtar', w: '140px', cell: (r) => U.textInput(r.key, (v) => { r.key = v.trim().toLowerCase(); dirty(); }) }, { label: 'Ad', cell: T('name') }],
      ds.kinds, () => ({ key: D.uid('tur'), name: 'Yeni tür' }), { addLabel: 'Tür ekle' }));
  }

  /* ---------------- 7) eşyalar ---------------- */
  function pItems(box) {
    box.append(h('h1', null, 'Eşyalar'), help('Oyundaki gerçek eşyaların temel statları (silah hasarı, savunma, can…). Efsunlar hariç; efsunlar simülatörde eşyanın üzerine ayrıca eklenir.'));
    box.append(editTable([{ label: 'Ad', w: '200px', cell: T('name') }, { label: 'Slot', w: '130px', cell: S('slot', ds.slots.map((s) => ({ value: s.key, label: s.name }))) }, { label: 'Statlar', cell: statMapCell((r) => (r.stats = r.stats || {})) }],
      ds.items, () => ({ id: D.uid('item'), name: 'Yeni eşya', slot: (ds.slots[0] || {}).key, stats: {} }), { addLabel: 'Eşya ekle' }));
  }

  /* ---------------- 8) efsunlar ---------------- */
  function pEnchants(box) {
    box.append(h('h1', null, 'Efsun kütüphanesi'), help('Eşyalara gelebilen bonusların min–maks değer aralığı. Optimizasyon ve sıralama bu listeyi kullanır. "Slotlar" boşsa her slotta çıkabilir; kısıtlamak için anahtarları virgülle yaz (örn. weapon,armor). "Üst sınır": bir build\'de en fazla kaç kez seçilebilir.'));
    box.append(editTable([
      { label: 'Ad', w: '180px', cell: T('name') }, { label: 'Stat', cell: S('stat', stOpts(true)) },
      { label: 'Min', w: '90px', cell: N('min') }, { label: 'Maks', w: '90px', cell: N('max') },
      { label: 'Slotlar', w: '170px', cell: (r) => U.textInput((r.slots || []).join(','), (v) => { r.slots = v.split(',').map((x) => x.trim()).filter(Boolean); dirty(); }, { placeholder: 'boş = hepsi' }) },
      { label: 'Üst sınır', w: '80px', cell: (r) => U.numInput(r.maxTotal || 0, (v) => { r.maxTotal = v > 0 ? v : undefined; dirty(); }, { placeholder: '∞' }) },
    ], ds.enchants, () => ({ id: D.uid('en'), name: 'Yeni efsun', stat: 'atk_pct', min: 1, max: 5, slots: [] }), { addLabel: 'Efsun ekle' }));
  }

  /* ---------------- 9) beceriler ---------------- */
  function pSkills(box) {
    box.append(h('h1', null, 'Beceriler'), help('Beceri hasarı = (Saldırı + silah zarı) × katsayı + sabit; katsayı = "Katsayı" + "Seviye başı" × (seviye − 1). Katsayıları ve seviye artışını oyundan topladığın hasarlarla Kalibrasyon bölümünde otomatik buldurabilirsin. "Silah kullanır" kapalıysa silah hasarı eklenmez (büyü gibi).'));
    const clsOpts = [{ value: '', label: '(tüm sınıflar)' }].concat(ds.classes.map((c) => ({ value: c.id, label: c.name })));
    box.append(editTable([
      { label: 'Ad', w: '180px', cell: T('name') }, { label: 'Sınıf', w: '120px', cell: S('classId', clsOpts) },
      { label: 'Katsayı', w: '80px', cell: N('coefBase') }, { label: 'Seviye başı', w: '80px', cell: N('coefPerLevel') },
      { label: 'Sabit', w: '70px', cell: N('flatBase') }, { label: 'Sabit/sv', w: '70px', cell: N('flatPerLevel') },
      { label: 'Vuruş', w: '60px', cell: N('hits') }, { label: 'Süre sn', w: '70px', cell: N('cast') }, { label: 'Bekleme sn', w: '80px', cell: N('cooldown') },
      { label: 'Maks sv', w: '70px', cell: N('maxLevel') }, { label: 'Ek hasar %', w: '80px', cell: N('dmgPct') },
      { label: 'Silah kullanır', w: '70px', cell: (r) => h('input', { type: 'checkbox', checked: r.usesWeapon !== false, onchange: (e) => { r.usesWeapon = e.target.checked; dirty(); } }) },
    ], ds.skills, () => ({ id: D.uid('sk'), classId: '', name: 'Yeni beceri', coefBase: 1, coefPerLevel: 0.1, flatBase: 0, flatPerLevel: 0, hits: 1, cast: 1, cooldown: 5, maxLevel: 20, usesWeapon: true, dmgPct: 0 }), { addLabel: 'Beceri ekle' }));
  }

  /* ---------------- 10) hedefler ---------------- */
  function pTargets(box) {
    box.append(h('h1', null, 'Hedefler (canavar / boss / metin)'), help('Karşı tarafın statları. Hedefin saldırısı da varsa saldırı değeri ve silah min–maks yaz. "Normal vuruş" kapalıysa (metin taşı gibi) hedef saldırmaz.'));
    box.append(editTable([
      { label: 'Ad', w: '170px', cell: T('name') }, { label: 'Tür', w: '110px', cell: S('kind', ds.kinds.map((k) => ({ value: k.key, label: k.name }))) },
      { label: 'Seviye', w: '70px', cell: N('level') }, { label: 'Statlar', cell: statMapCell((r) => (r.stats = r.stats || {})) },
      { label: 'Normal vuruş', w: '70px', cell: (r) => h('input', { type: 'checkbox', checked: r.basic !== false, onchange: (e) => { r.basic = e.target.checked; dirty(); } }) },
    ], ds.targets, () => ({ id: D.uid('tg'), name: 'Yeni hedef', kind: (ds.kinds[1] || ds.kinds[0] || {}).key, level: 1, stats: { hp: 1000, def: 0 }, rotation: [], basic: true }), { addLabel: 'Hedef ekle' }));
  }

  /* ---------------- 11) kalibrasyon ---------------- */
  const HT = [['normal', 'Normal'], ['crit', 'Kritik'], ['pierce', 'Delici'], ['critpierce', 'Kritik + Delici']];
  function parseNums(s) { return String(s || '').split(/[\s,;]+/).map((x) => parseFloat(x.replace(',', '.'))).filter((x) => isFinite(x) && x > 0); }
  function pCalib(box) {
    box.append(h('h1', null, 'Kalibrasyon'));
    box.append(h('div', { class: 'card' }, h('h2', null, 'Nasıl yapılır?'), h('ol', null,
      h('li', null, 'Oyunda sabit bir hedef seç (aynı canavar/manken). Tek bir değişkeni değiştir (örn. sadece bir silah tak).'),
      h('li', null, '"Yeni test kaydı" aç. A tarafına karakterinin gerçek statlarını (sınıf, seviye, eşya, efsun, ek statlar) gir; B tarafına hedefi gir.'),
      h('li', null, 'Oyunda aynı vuruşu en az 10–20 kez yap; çıkan hasarları vuruş türüne göre (renklerine bakarak) aşağıdaki kutulara yaz.'),
      h('li', null, 'Tablo "tahmin" ile "gözlenen" arasındaki farkı gösterir. Fark büyükse "Otomatik ayarla" ile formül parametrelerini buldur ya da profili elle düzelt.'),
      h('li', null, 'Önce normal vuruşla başla (silah çarpanı, savunma modu). Sonra beceriler: aynı becerinin farklı seviyelerinden kayıt aç.')),
      help('Not: Kaçınma (ıska) ve blok olan vuruşları listeye ekleme; yalnızca normal gerçekleşen hasarları gir.')));
    ds.calibration = ds.calibration || [];
    const list = h('div', { style: { marginTop: '12px' } });
    const totalBox = h('div', { class: 'verdict', style: { marginTop: '12px' } });
    function totals() {
      const L = E.totalLoss(ds, ds.calibration);
      totalBox.innerHTML = '';
      totalBox.append(h('b', null, 'Toplam uyum hatası: '), ds.calibration.length ? '≈ %' + (Math.sqrt(L) * 100).toFixed(1) + ' ortalama sapma (kayıp ' + L.toFixed(5) + ')' : 'kayıt yok', h('span', { class: 'hint' }, '  — hedef: %2–3 altı.'));
    }
    function drawList() {
      list.innerHTML = '';
      ds.calibration.forEach((rec) => list.append(recordCard(rec)));
      totals();
    }
    function recordCard(rec) {
      rec.observed = rec.observed || {}; rec.hit = rec.hit || { type: 'normal' };
      const card = h('div', { class: 'card', style: { marginBottom: '10px' } });
      const rep = h('div');
      const updateRep = () => {
        rep.innerHTML = '';
        const r = E.recordReport(ds, rec);
        if (r.error) { rep.append(h('p', { class: 'hint' }, r.error)); totals(); return; }
        rep.append(h('table', { class: 'mini' }, h('tr', null, ['Tür', 'Gözlem sayısı', 'Gözlenen (ort · min–maks)', 'Tahmin (ort · min–maks)', 'Sapma'].map((t) => h('th', null, t))),
          r.rows.map((x) => h('tr', null, h('td', null, U.chip(x.type)), h('td', null, x.n), h('td', null, U.fmt(x.obsMean, 1) + ' · ' + U.fmt(x.obsMin, 0) + '–' + U.fmt(x.obsMax, 0)),
            h('td', null, U.fmt(x.predAvg, 1) + ' · ' + U.fmt(x.predMin, 0) + '–' + U.fmt(x.predMax, 0)),
            h('td', { class: Math.abs(x.errPct) < 2 ? 'up' : Math.abs(x.errPct) < 8 ? '' : 'down' }, U.pct(x.errPct, 1)))),
          !r.rows.length ? h('tr', null, h('td', { colspan: 5, class: 'hint' }, 'Henüz gözlenen hasar girilmedi.')) : ''));
        totals();
      };
      const onC = () => { dirty(); updateRep(); };
      const skillOpts = ds.skills.map((s) => ({ value: s.id, label: s.name }));
      const hitSel = U.sel([{ value: 'normal', label: 'Normal vuruş' }, { value: 'skill', label: 'Beceri' }], rec.hit.type, (v) => { rec.hit.type = v; if (v === 'skill' && !rec.hit.skillId) rec.hit.skillId = (ds.skills[0] || {}).id; dirty(); drawList(); });
      card.append(h('div', { class: 'row' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: rec.enabled !== false, onchange: (e) => { rec.enabled = e.target.checked; dirty(); totals(); } }), ' Dahil'),
        U.textInput(rec.label || '', (v) => { rec.label = v; dirty(); }, { placeholder: 'Kayıt adı (örn. Kılıç +0, Boss, normal vuruş)', style: 'flex:1' }), hitSel,
        rec.hit.type === 'skill' ? [U.sel(skillOpts, rec.hit.skillId, (v) => { rec.hit.skillId = v; onC(); }), h('span', { class: 'unit' }, 'Sv.'), U.numInput(rec.hit.level || 1, (v) => { rec.hit.level = Math.max(1, Math.round(v)); onC(); }, { min: 1 })] : '',
        h('button', { class: 'danger', onclick: () => { if (confirm('Kayıt silinsin mi?')) { ds.calibration.splice(ds.calibration.indexOf(rec), 1); dirty(); drawList(); } } }, 'Sil')));
      const sides = h('div', { class: 'two' });
      const e1 = U.SideEditor(ds, rec.attacker, { onChange: onC }), e2 = U.SideEditor(ds, rec.defender, { onChange: onC });
      sides.append(h('details', { class: 'box' }, h('summary', null, 'Saldıran (senin karakterin)'), e1.el), h('details', { class: 'box' }, h('summary', null, 'Savunan (hedef)'), e2.el));
      card.append(sides);
      const obs = h('div', { class: 'grid4' });
      HT.forEach(([k, l]) => obs.append(h('label', null, h('span', { class: 't-' + k }, l + ' hasarlar'),
        h('textarea', { rows: 3, placeholder: '1520 1534 1498 …', oninput: (e) => { rec.observed[k] = parseNums(e.target.value); onC(); } }, (rec.observed[k] || []).join(' ')))));
      card.append(obs, rep); updateRep(); return card;
    }
    box.append(h('button', { class: 'primary', onclick: () => {
      ds.calibration.push({ id: D.uid('cal'), label: '', enabled: true, attacker: D.newSide(ds, 'build'), defender: D.newSide(ds, 'target'), hit: { type: 'normal' }, observed: {} });
      dirty(); drawList();
    } }, '+ Yeni test kaydı'), list, totalBox);
    drawList();

    /* otomatik ayar */
    const fitBox = h('div', { class: 'card', style: { marginTop: '14px' } }, h('h2', null, 'Otomatik ayarla'));
    const cands = [
      ['profile.weaponMul', 'Silah zarı çarpanı', 0.1, 10], ['profile.defMul', 'Savunma genel çarpanı', 0.05, 5], ['profile.defenseK', 'Savunma sabiti K (oran modu)', 1, 3000],
      ['profile.critBase', 'Kritik çarpanı', 1, 5], ['profile.pierceBase', 'Delici taban çarpanı', 0.5, 3], ['profile.blockReduction', 'Blok azalması %', 0, 100],
    ];
    const used = [...new Set(ds.calibration.filter((r) => r.hit && r.hit.type === 'skill').map((r) => r.hit.skillId))];
    used.forEach((id) => { const s = ds.skills.find((x) => x.id === id); if (s) { cands.push(['skill.' + id + '.coefBase', s.name + ' — katsayı', 0.05, 15]); cands.push(['skill.' + id + '.coefPerLevel', s.name + ' — seviye başı', 0, 3]); } });
    const picked = new Set(['profile.weaponMul']);
    const out = h('div');
    fitBox.append(help('Seçtiğin parametreleri, yukarıdaki gözlemlere en iyi uyacak şekilde otomatik arar. Aynı anda çok parametre seçmek yerine kayıtların kapsadığı birkaçını seç (örn. sadece normal vuruş kayıtlarıyla silah çarpanı ve savunma).'),
      h('div', { class: 'tag-row' }, cands.map(([p, l]) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: picked.has(p), onchange: (e) => { e.target.checked ? picked.add(p) : picked.delete(p); } }), ' ' + l))),
      h('button', { class: 'primary', onclick: () => {
        const params = cands.filter((c) => picked.has(c[0])).map((c) => ({ path: c[0], min: c[2], max: c[3] }));
        out.innerHTML = '';
        if (!params.length || !ds.calibration.length) { out.append(h('p', { class: 'hint' }, 'Parametre seç ve en az bir kayıt gir.')); return; }
        const r = E.fitParams(ds, ds.calibration.filter((x) => x.enabled !== false), params, { passes: 4 });
        out.append(h('p', null, 'Hata: ≈%' + (Math.sqrt(r.before) * 100).toFixed(1) + ' → ', h('b', null, '≈%' + (Math.sqrt(r.after) * 100).toFixed(1))),
          h('table', { class: 'mini' }, h('tr', null, h('th', null, 'Parametre'), h('th', { class: 'r' }, 'Şimdi'), h('th', { class: 'r' }, 'Bulunan')),
            Object.keys(r.values).map((p) => h('tr', null, h('td', null, (cands.find((c) => c[0] === p) || [p, p])[1]), h('td', { class: 'r' }, U.fmt(r.values[p].from, 3)), h('td', { class: 'r' }, h('b', null, U.fmt(r.values[p].to, 3)))))),
          h('button', { style: { marginTop: '6px' }, onclick: () => { Object.keys(r.values).forEach((p) => E.setPath(ds, p, r.values[p].to)); dirty(); toast('Değerler uygulandı'); render(); } }, 'Bulunan değerleri uygula'),
          help('Uyarı: Az veriyle çok parametre aynı anda ayarlanırsa gerçek dışı değerler çıkabilir. Hata düşük ama değerler mantıksızsa daha çeşitli kayıt (farklı savunma, farklı seviye) ekle.'));
      } }, 'Ayarla'), out);
    box.append(fitBox);
  }

  boot();
})();
