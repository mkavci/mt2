/* =====================================================================
 *  Herkese açık simülatör (index.html)
 * ===================================================================== */
(async function () {
  const E = window.M2Engine, D = window.M2Data, U = window.M2UI, h = U.h;
  const app = document.getElementById('app');
  app.append(h('p', { class: 'hint', style: { padding: '20px' } }, 'Veriler yükleniyor…'));
  const { ds, source, updatedAt } = await D.load();

  /* ---------------- durum ---------------- */
  const LS = 'm2sim.state.v1';
  const OBJ = [
    { value: 'dps', label: 'Saldırı gücü (DPS)' },
    { value: 'ehp', label: 'Dayanıklılık (daha geç ölmek)' },
    { value: 'balanced', label: 'Dengeli (hayatta kalma ÷ öldürme süresi)' },
  ];
  function b64enc(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(decodeURIComponent(escape(atob(s)))); }
  function validSide(s) {
    if (!s || typeof s !== 'object') return false;
    if (s.mode === 'target') return !!ds.targets.find((t) => t.id === s.targetId);
    return !!ds.classes.find((c) => c.id === s.classId);
  }
  function restore() {
    let st = null;
    try { const m = location.hash.match(/#s=([^&]+)/); if (m) st = b64dec(m[1]); } catch (e) { /* bozuk link */ }
    if (!st) { try { st = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { /* yok */ } }
    const out = { A: D.newSide(ds, 'build'), B: D.newSide(ds, 'target'), scen: [], baselineId: null, tab: 'analysis' };
    if (st) {
      if (validSide(st.A)) out.A = st.A;
      if (validSide(st.B)) out.B = st.B;
      if (Array.isArray(st.scen)) out.scen = st.scen.filter((s) => validSide(s.A) && validSide(s.B));
      out.baselineId = st.baselineId || null;
    }
    return out;
  }
  const state = restore();
  const persist = U.debounce(() => { try { localStorage.setItem(LS, JSON.stringify({ A: state.A, B: state.B, scen: state.scen, baselineId: state.baselineId })); } catch (e) { /* dolu */ } }, 300);

  function toast(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2200); }

  /* ---------------- iskelet ---------------- */
  app.innerHTML = '';
  const profile = ds.profile;
  const header = h('header', { class: 'top' },
    h('span', { class: 'brand' }, '⚔ ' + ((ds.meta && ds.meta.name) || 'Mobile2') + ' Savaş Simülatörü'),
    h('span', { class: 'badge ' + (profile.calibrated ? 'ok' : 'warn') }, profile.calibrated ? 'Formül kalibre edildi' : 'Formül kalibre edilmedi · sonuçlar tahmini'),
    h('span', { class: 'badge' }, 'Veri: ' + ({ supabase: 'canlı (Supabase)', json: 'dataset.json', sample: 'ÖRNEK veri' }[source])),
    h('span', { class: 'grow' }),
    h('button', { onclick: copyLink }, '🔗 Bağlantıyı kopyala'),
    h('button', { class: 'danger', onclick: () => { if (confirm('Tüm kayıtlı kurulumlar ve senaryolar silinsin mi?')) { localStorage.removeItem(LS); location.hash = ''; location.reload(); } } }, 'Sıfırla'));
  const main = h('main', { class: 'wrap' });
  app.append(header, main);
  if (source === 'sample') main.append(h('div', { class: 'notice' }, 'Bu site şu an ÖRNEK verilerle çalışıyor. Gerçek oyun değerleri yönetim panelinden girilip yayınlandığında burası otomatik güncellenir.'));

  const colA = h('div', { class: 'card sideA' }), colB = h('div', { class: 'card sideB' });
  const swap = h('button', { title: 'Tarafları değiştir', onclick: () => { const t = state.A; state.A = state.B; state.B = t; mountEditors(); onChange(); } }, '⇄');
  main.append(h('div', { class: 'duel' }, colA, h('div', { class: 'swapcol' }, swap), colB));
  const tabsEl = h('div', { class: 'tabs' }), body = h('div', { id: 'tabbody' });
  main.append(tabsEl, body);
  main.append(h('footer', null, 'Hasarlar ' + ds.profile.name + ' formül profiline göre hesaplanır. ' + (updatedAt ? 'Veri güncelleme: ' + new Date(updatedAt).toLocaleString('tr-TR') : '')));

  let edA, edB;
  function mountEditors() {
    colA.innerHTML = ''; colB.innerHTML = '';
    edA = U.SideEditor(ds, state.A, { onChange });
    edB = U.SideEditor(ds, state.B, { onChange });
    colA.append(h('h2', null, h('span', { class: 'tag' }, 'A'), 'Saldıran / 1. savaşçı'), edA.el);
    colB.append(h('h2', null, h('span', { class: 'tag' }, 'B'), 'Savunan / 2. savaşçı'), edB.el);
  }
  const TABS = [['analysis', 'Hasar analizi'], ['battle', 'Savaş simülasyonu'], ['optimize', 'Efsun / stat optimizasyonu'], ['sens', 'Hangi değer değerli?'], ['scen', 'Senaryolar']];
  function renderTabs() {
    tabsEl.innerHTML = '';
    TABS.forEach(([k, l]) => tabsEl.append(h('button', { class: state.tab === k ? 'on' : '', onclick: () => { state.tab = k; renderTabs(); renderBody(); } }, l)));
  }
  const live = U.debounce(() => { if (state.tab === 'analysis' || state.tab === 'sens' || state.tab === 'scen') renderBody(); }, 60);
  function onChange() { persist(); live(); }
  function renderBody() {
    body.innerHTML = '';
    ({ analysis: renderAnalysis, battle: renderBattle, optimize: renderOptimize, sens: renderSens, scen: renderScen }[state.tab])(body);
  }
  function copyLink() {
    const url = location.href.split('#')[0] + '#s=' + b64enc({ A: state.A, B: state.B });
    history.replaceState(null, '', '#s=' + b64enc({ A: state.A, B: state.B }));
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Bağlantı kopyalandı'), () => { prompt('Bağlantıyı kopyala:', url); });
  }

  const field = (label, el) => h('label', null, label, el);
  const solve = () => { const A = E.resolveSide(ds, state.A), B = E.resolveSide(ds, state.B); return { A, B, duel: E.evalDuel(ds, A, B) }; };
  const metricsOf = (sc) => { const A = E.resolveSide(ds, sc.A), B = E.resolveSide(ds, sc.B), d = E.evalDuel(ds, A, B); return { aDps: d.aDps, bDps: d.bDps, ttk: d.ttk, survive: d.survive, ratio: d.ratio }; };
  const delta = (cur, base, invert) => {
    if (base == null || !isFinite(base) || base === 0 || !isFinite(cur)) return null;
    const p = ((cur - base) / base) * 100, good = invert ? p < 0 : p > 0;
    return h('span', { class: 'd ' + (Math.abs(p) < 0.005 ? '' : good ? 'up' : 'down') }, U.pct(p));
  };

  /* ---------------- 1) hasar analizi ---------------- */
  function actionCard(m, share, accent) {
    const rows = ['normal', 'crit', 'pierce', 'critpierce'].map((t) => {
      const x = m.types[t];
      return h('tr', null, h('td', null, U.chip(t)), h('td', { class: 'r' }, U.perc(x.p)),
        h('td', { class: 'r' }, U.fmt(x.min, 0)), h('td', { class: 'r dmg t-' + t }, U.fmt(x.avg, 0)), h('td', { class: 'r' }, U.fmt(x.max, 0)));
    });
    const meta = [m.isSkill ? 'bekleme ' + U.fmt(m.cooldown, 1) + ' sn' : null, 'süre ' + U.fmt(m.duration, 2) + ' sn', m.hits > 1 ? m.hits + ' vuruş' : null,
      m.pDodge > 0 ? 'kaçınma ' + U.perc(m.pDodge) : null, m.pBlock > 0 ? 'blok ' + U.perc(m.pBlock) : null].filter(Boolean).join(' · ');
    const trace = (c, p) => h('ol', null, m.trace(c, p).map((s) => h('li', null, s.label + ' → ', h('b', null, U.fmt(s.value, 1)))));
    return h('div', { class: 'action' },
      h('h4', null, m.label, h('span', { class: 'meta' }, meta)),
      h('table', { class: 'mini' }, h('tr', null, h('th', null, 'Vuruş'), h('th', { class: 'r' }, 'Olasılık'), h('th', { class: 'r' }, 'Min'), h('th', { class: 'r' }, 'Ort'), h('th', { class: 'r' }, 'Maks')), rows),
      h('div', { class: 'hint' }, 'Beklenen vuruş başına: ', h('b', null, U.fmt(m.perHit, 1)), m.hits > 1 ? ' · kullanım başına: ' + U.fmt(m.perUse, 1) : '', share != null ? ' · rotasyon payı: ' + U.perc(share) : ''),
      h('details', { class: 'trace' }, h('summary', null, 'Hesap adımlarını göster'),
        h('div', null, h('b', null, 'Normal vuruş'), trace(0, 0)), h('div', null, h('b', null, 'Kritik vuruş'), trace(1, 0))));
  }
  function dirPanel(title, att, res, cls) {
    const models = [].concat(res.models.basic ? [res.models.basic] : [], res.models.skills);
    const shareOf = (m) => { const b = res.breakdown.find((x) => x.id === m.id); return b ? b.share : 0; };
    const box = h('div', { class: 'card ' + cls }, h('h2', null, title),
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'Rotasyon DPS'), h('div', { class: 'v' }, U.fmt(res.dps, 1))),
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'Azami can'), h('div', { class: 'v' }, U.fmt(att.maxHp, 0)))));
    if (res.breakdown.length) box.append(U.stackBar(res.breakdown.map((b) => ({ label: b.label + ' ×' + b.uses, share: b.share }))));
    models.forEach((m) => box.append(actionCard(m, shareOf(m))));
    if (!models.length) box.append(h('p', { class: 'hint' }, 'Bu tarafın saldırı eylemi yok (rotasyon boş ve normal vuruş kapalı).'));
    return box;
  }
  function renderAnalysis(box) {
    const { A, B, duel } = solve();
    const base = state.scen.find((s) => s.id === state.baselineId);
    const bm = base ? metricsOf(base) : null;
    const kpi = (l, v, d, hint) => h('div', { class: 'kpi' }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, v), d || '', hint ? h('div', { class: 'hint' }, hint) : '');
    box.append(h('div', { class: 'kpis' },
      kpi('A — DPS', U.fmt(duel.aDps, 1), bm && delta(duel.aDps, bm.aDps)),
      kpi('B — DPS', U.fmt(duel.bDps, 1), bm && delta(duel.bDps, bm.bDps, true)),
      kpi('A, B\'yi öldürür', U.secs(duel.ttk), bm && delta(duel.ttk, bm.ttk, true), 'B canı: ' + U.fmt(B.maxHp, 0)),
      kpi('B, A\'yı öldürür', U.secs(duel.survive), bm && delta(duel.survive, bm.survive), 'A canı: ' + U.fmt(A.maxHp, 0)),
      kpi('Üstünlük oranı', U.fmt(duel.ratio, 2) + '×', bm && delta(duel.ratio, bm.ratio), '>1 ise A önde')));
    const win = duel.ratio >= 1 ? 'A' : 'B';
    const left = duel.ratio >= 1 ? 1 - duel.ttk / duel.survive : 1 - duel.survive / duel.ttk;
    box.append(h('div', { class: 'verdict ' + win.toLowerCase() }, h('b', null, 'Analitik tahmin: ' + win + ' önde. '),
      'Ortalama değerlerle ' + (win === 'A' ? 'A, B\'yi ' + U.secs(duel.ttk) + 'de indirir; B, A\'yı ' + U.secs(duel.survive) + 'de indirirdi' : 'B, A\'yı ' + U.secs(duel.survive) + 'de indirir; A, B\'yi ' + U.secs(duel.ttk) + 'de indirirdi')
      + ' (kazananın yaklaşık %' + Math.round(Math.max(0, left) * 100) + ' canı kalır). Kritik/kaçınma gibi şans etkili sonuç için "Savaş simülasyonu" sekmesini kullan.'));
    if (base) box.append(h('p', { class: 'hint' }, 'Yüzdeler "' + base.name + '" senaryosuna göre farkı gösterir (Senaryolar sekmesinden değiştirilir).'));
    box.append(h('div', { class: 'two' }, dirPanel('A → B   (A\'nın B\'ye vurdukları)', A, duel.a, 'sideA'), dirPanel('B → A   (B\'nin A\'ya vurdukları)', B, duel.b, 'sideB')));
  }

  /* ---------------- 2) savaş simülasyonu ---------------- */
  let battleUI = { runs: 1000, seed: 12345, speed: 3, timer: null };
  function renderBattle(box) {
    if (battleUI.timer) { clearTimeout(battleUI.timer); battleUI.timer = null; }
    const out = h('div');
    const tb = h('div', { class: 'toolbar' },
      field('Tekrar sayısı', U.numInput(battleUI.runs, (v) => { battleUI.runs = Math.min(20000, Math.max(1, Math.round(v))); }, { min: 1, max: 20000 })),
      field('Tohum (aynı sonuç için)', U.numInput(battleUI.seed, (v) => { battleUI.seed = Math.round(v); })),
      h('button', { class: 'primary', onclick: () => run(false) }, '⚔ Savaştır'),
      h('button', { onclick: () => run(true) }, '🎲 Yeni rastgele maç'));
    box.append(tb, out);
    function run(randomSeed) {
      const A = E.resolveSide(ds, state.A), B = E.resolveSide(ds, state.B);
      out.innerHTML = ''; out.append(h('p', { class: 'hint' }, 'Hesaplanıyor…'));
      setTimeout(() => {
        const t0 = performance.now();
        const seed = randomSeed ? Math.floor(Math.random() * 1e9) : battleUI.seed;
        const r = E.simulateDuel(ds, A, B, { runs: randomSeed ? 1 : battleUI.runs, seed });
        showBattle(out, r, A, B, randomSeed, performance.now() - t0);
      }, 20);
    }
    run(false);
  }
  function showBattle(out, r, A, B, single, ms) {
    out.innerHTML = '';
    if (!single) {
      out.append(h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'A kazanma'), h('div', { class: 'v up' }, U.perc(r.winRateA)), h('div', { class: 'hint' }, 'ort. süre ' + U.secs(r.avgTimeA) + ' · kalan can ' + U.fmt(r.avgHpLeftA, 0))),
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'B kazanma'), h('div', { class: 'v', style: { color: 'var(--b)' } }, U.perc(r.winRateB)), h('div', { class: 'hint' }, 'ort. süre ' + U.secs(r.avgTimeB) + ' · kalan can ' + U.fmt(r.avgHpLeftB, 0))),
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'Beraberlik (süre doldu)'), h('div', { class: 'v' }, U.perc(r.drawRate))),
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'Maç süresi'), h('div', { class: 'v' }, U.secs(r.avgTime)), h('div', { class: 'hint' }, '%10–%90: ' + U.secs(r.timeP10) + ' – ' + U.secs(r.timeP90))),
        h('div', { class: 'kpi' }, h('div', { class: 'l' }, 'Maç başına verilen hasar'), h('div', { class: 'v' }, 'A ' + U.fmt(r.avgDealtA, 0)), h('div', { class: 'hint' }, 'B ' + U.fmt(r.avgDealtB, 0)))));
      out.append(h('div', { class: 'two' },
        h('div', { class: 'card' }, h('h3', null, 'Maç süresi dağılımı (' + r.runs + ' maç)'), U.histogram(r.allTimes, { color: '#60a5fa' })),
        h('div', { class: 'card' }, h('h3', null, 'Vuruş türü dağılımı'),
          h('table', { class: 'mini' }, h('tr', null, h('th', null, 'Tür'), h('th', { class: 'r' }, 'A'), h('th', { class: 'r' }, 'B')),
            ['normal', 'crit', 'pierce', 'critpierce', 'miss'].map((t) => h('tr', null, h('td', null, U.chip(t)), h('td', { class: 'r' }, U.fmt(r.cnt[0][t] || 0, 0)), h('td', { class: 'r' }, U.fmt(r.cnt[1][t] || 0, 0))))),
          h('p', { class: 'hint' }, 'Hesap süresi: ' + Math.round(ms) + ' ms'))));
    }
    const rep = h('div', { class: 'card', style: { marginTop: '12px' } }, h('h3', null, single ? 'Maç' : 'Örnek maç (ilk tekrar)'));
    out.append(rep);
    replay(rep, r.firstLog, A, B);
  }
  function replay(box, res, A, B) {
    const log = res.log;
    const mk = (name, color) => { const i = h('i', { style: { background: color, width: '100%' } }); const s = h('span'); return { i, s, el: h('div', { class: 'hpbar' }, i, s), name }; };
    const bA = mk('A', 'var(--a)'), bB = mk('B', 'var(--b)');
    const setBars = (hpA, hpB) => {
      bA.i.style.width = (hpA / A.maxHp * 100) + '%'; bA.s.textContent = 'A  ' + U.fmt(hpA, 0) + ' / ' + U.fmt(A.maxHp, 0);
      bB.i.style.width = (hpB / B.maxHp * 100) + '%'; bB.s.textContent = 'B  ' + U.fmt(hpB, 0) + ' / ' + U.fmt(B.maxHp, 0);
    };
    setBars(A.maxHp, B.maxHp);
    const pts = [[[0, A.maxHp]], [[0, B.maxHp]]];
    log.forEach((e) => { pts[0].push([e.t, e.hpA]); pts[1].push([e.t, e.hpB]); });
    const tbody = h('tbody'), wrap = h('div', { class: 'log' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Süre'), h('th', null, 'Kim'), h('th', null, 'Eylem'), h('th', null, 'Tür'), h('th', { class: 'r' }, 'Hasar'), h('th', { class: 'r' }, 'A can'), h('th', { class: 'r' }, 'B can'))), tbody));
    const res$ = h('div', { class: 'verdict ' + (res.winner === 'A' ? 'a' : res.winner === 'B' ? 'b' : '') }, res.winner === 'draw' ? 'Süre doldu, kimse kazanamadı.' : res.winner + ' kazandı — ' + U.secs(res.time) + ' sürdü.');
    const speedSel = U.sel([{ value: 1, label: '1× gerçek zaman' }, { value: 3, label: '3×' }, { value: 10, label: '10×' }, { value: 0, label: 'Anında' }], battleUI.speed, (v) => { battleUI.speed = +v; });
    const addRow = (e) => {
      const tr = h('tr', null, h('td', null, U.fmt(e.t, 2)), h('td', { style: { color: e.who ? 'var(--b)' : 'var(--a)' } }, e.who ? 'B' : 'A'), h('td', null, e.label),
        h('td', null, U.chip(e.type), e.blocked ? h('span', { class: 'chip t-block', style: { marginLeft: '4px' } }, 'Blok') : ''),
        h('td', { class: 'r dmg t-' + e.type }, e.type === 'miss' ? '—' : U.fmt(e.dmg, 0)), h('td', { class: 'r' }, U.fmt(e.hpA, 0)), h('td', { class: 'r' }, U.fmt(e.hpB, 0)));
      tbody.append(tr); wrap.scrollTop = wrap.scrollHeight; setBars(e.hpA, e.hpB);
    };
    const play = () => {
      if (battleUI.timer) clearTimeout(battleUI.timer);
      tbody.innerHTML = ''; setBars(A.maxHp, B.maxHp);
      let i = 0;
      const step = () => {
        if (i >= log.length) { battleUI.timer = null; return; }
        addRow(log[i]); i++;
        if (i >= log.length) return;
        const dt = (log[i].t - log[i - 1].t) * 1000, sp = +battleUI.speed;
        battleUI.timer = sp === 0 ? setTimeout(step, 0) : setTimeout(step, Math.min(500, dt / sp));
      };
      step();
    };
    box.append(h('div', { class: 'toolbar' }, h('button', { onclick: play }, '▶ Oynat'), field('Hız', speedSel)),
      h('div', { class: 'hpbars' }, bA.el, bB.el), res$, U.lineChart([{ name: 'A', color: '#f97316', points: pts[0] }, { name: 'B', color: '#38bdf8', points: pts[1] }]), h('div', { style: { height: '8px' } }), wrap);
    log.slice(0, 80).forEach((e) => addRow(e));
    setBars(log.length ? log[Math.min(79, log.length - 1)].hpA : A.maxHp, log.length ? log[Math.min(79, log.length - 1)].hpB : B.maxHp);
    if (log.length > 80) tbody.append(h('tr', null, h('td', { colspan: 7, class: 'hint' }, '… ilk 80 vuruş gösterildi. Tamamını görmek için ▶ Oynat.')));
  }

  /* ---------------- 3) optimizasyon ---------------- */
  const optUI = { who: 'A', objective: 'dps', tier: 'max', beam: 20, lines: {}, total: 100, last: null, lastPts: null };
  function renderOptimize(box) {
    ds.slots.forEach((s) => { if (optUI.lines[s.key] == null) optUI.lines[s.key] = s.enchantSlots || 0; });
    const whoSel = U.sel([{ value: 'A', label: 'A (sol taraf)' }, { value: 'B', label: 'B (sağ taraf)' }], optUI.who, (v) => { optUI.who = v; });
    const objSel = U.sel(OBJ, optUI.objective, (v) => { optUI.objective = v; });
    const tierSel = U.sel([{ value: 'max', label: 'En yüksek değer' }, { value: 'avg', label: 'Ortalama' }, { value: 'min', label: 'En düşük' }], optUI.tier, (v) => { optUI.tier = v; });
    const res = h('div'), res2 = h('div');
    const lines = h('div', { class: 'grid4' }, ds.slots.map((s) => field(s.name + ' — efsun hattı', U.numInput(optUI.lines[s.key], (v) => { optUI.lines[s.key] = Math.max(0, Math.round(v)); }, { min: 0 }))));
    box.append(h('div', { class: 'card' }, h('h2', null, 'Efsun optimizasyonu'),
      h('p', { class: 'hint' }, 'Efsun kütüphanesindeki (yönetim paneli) seçeneklerden, seçtiğin hedefe göre en iyi kombinasyonu bulur. Aynı eşyada aynı bonus tekrar etmez. Seçilen slotlardaki mevcut efsunlar sonuçla değiştirilir. Karşı taraf (diğer savaşçı) olduğu gibi sabit kalır.'),
      h('div', { class: 'toolbar' }, field('Kimi optimize edeyim', whoSel), field('Amaç', objSel), field('Efsun değeri', tierSel),
        field('Arama genişliği', U.numInput(optUI.beam, (v) => { optUI.beam = Math.min(80, Math.max(3, Math.round(v))); }, { min: 3, max: 80 }))),
      h('details', { class: 'box', open: true }, h('summary', null, 'Kaç hat optimize edilsin? (0 = o slota dokunma)'), lines),
      h('button', { class: 'primary', onclick: runEnchant }, '✨ En iyi efsunları bul'), res));
    box.append(h('div', { class: 'card', style: { marginTop: '12px' } }, h('h2', null, 'Stat puanı dağılımı'),
      h('p', { class: 'hint' }, 'Toplam stat puanını (Güç/Dayanıklılık vb.) seçtiğin amaca göre en verimli şekilde dağıtır. Puan etkileri yönetim panelinde tanımlıdır.'),
      h('div', { class: 'toolbar' }, field('Toplam puan', U.numInput(optUI.total, (v) => { optUI.total = Math.max(0, Math.round(v)); }, { min: 0 })), h('button', { class: 'primary', onclick: runPoints }, 'Puanları dağıt')), res2));

    function runEnchant() {
      const side = optUI.who === 'A' ? state.A : state.B;
      if (side.mode === 'target') { res.innerHTML = ''; res.append(h('p', { class: 'hint' }, 'Hedef (canavar/boss) üzerinde efsun yoktur; bir oyuncu tarafını seç.')); return; }
      const slotLines = {}; Object.keys(optUI.lines).forEach((k) => { if (optUI.lines[k] > 0) slotLines[k] = optUI.lines[k]; });
      if (!Object.keys(slotLines).length) { res.innerHTML = ''; res.append(h('p', { class: 'hint' }, 'En az bir slot için hat sayısı gir.')); return; }
      res.innerHTML = ''; res.append(h('p', { class: 'hint' }, 'Hesaplanıyor…'));
      setTimeout(() => {
        const t0 = performance.now();
        const r = E.optimizeEnchants(ds, state.A, state.B, { objective: optUI.objective, who: optUI.who, tier: optUI.tier, beam: optUI.beam, slotLines, pool: ds.enchants, top: 5 });
        res.innerHTML = '';
        if (!r.results.length) { res.append(h('p', { class: 'hint' }, 'Sonuç yok. Efsun kütüphanesi boş olabilir.')); return; }
        res.append(h('p', { class: 'hint' }, 'Mevcut kurulum skoru: ' + U.fmt(r.baseline, 2) + ' · ' + Math.round(performance.now() - t0) + ' ms'));
        r.results.forEach((x, i) => {
          const card = h('div', { class: 'optres' }, h('b', null, '#' + (i + 1) + '  skor ' + U.fmt(x.score, 2) + '  '), h('span', { class: x.gainPct >= 0 ? 'up' : 'down' }, U.pct(x.gainPct) + ' mevcuda göre'));
          Object.keys(slotLines).forEach((slot) => {
            const nm = (ds.slots.find((s) => s.key === slot) || {}).name || slot;
            card.append(h('div', null, h('span', { class: 'mut' }, nm + ': '), (x.assign[slot] || []).map((l) => h('span', { class: 'pill' }, (l.name || U.statName(ds, l.stat)) + ' +' + U.fmt(l.value, 1))), !(x.assign[slot] || []).length ? '—' : ''));
          });
          card.append(h('button', { style: { marginTop: '6px' }, onclick: () => {
            Object.keys(slotLines).forEach((slot) => { side.equip = side.equip || {}; const e = side.equip[slot] || (side.equip[slot] = { itemId: null, enchants: [] }); e.enchants = (x.assign[slot] || []).map((l) => ({ stat: l.stat, value: l.value })); });
            mountEditors(); onChange(); toast('Efsunlar ' + optUI.who + ' tarafına uygulandı');
          } }, 'Bu kombinasyonu uygula'));
          res.append(card);
        });
      }, 20);
    }
    function runPoints() {
      const side = optUI.who === 'A' ? state.A : state.B;
      res2.innerHTML = '';
      if (side.mode === 'target') { res2.append(h('p', { class: 'hint' }, 'Hedeflerde stat puanı yoktur; bir oyuncu tarafını seç (yukarıdaki "Kimi optimize edeyim").')); return; }
      const r = E.optimizePoints(ds, state.A, state.B, { objective: optUI.objective, who: optUI.who, total: optUI.total });
      const cur = side.points || {};
      res2.append(h('p', { class: 'hint' }, 'Mevcut skor ' + U.fmt(r.baseline, 2) + ' → yeni skor ' + U.fmt(r.score, 2) + ' (' + U.pct(r.gainPct) + ')'),
        h('table', { class: 'mini' }, h('tr', null, h('th', null, 'Stat'), h('th', { class: 'r' }, 'Şimdiki'), h('th', { class: 'r' }, 'Önerilen')),
          ds.pointStats.map((p) => h('tr', null, h('td', null, p.name), h('td', { class: 'r' }, cur[p.key] || 0), h('td', { class: 'r' }, h('b', null, r.points[p.key] || 0))))),
        h('button', { style: { marginTop: '6px' }, onclick: () => { side.points = Object.assign({}, r.points); mountEditors(); onChange(); toast('Puanlar uygulandı'); } }, 'Önerilen dağılımı uygula'));
    }
  }

  /* ---------------- 4) duyarlılık ---------------- */
  const sensUI = { who: 'A', objective: 'dps', tier: 'max' };
  const VERD = { great: 'Çok değerli', good: 'Değerli', ok: 'Orta', weak: 'Zayıf', none: 'Etkisiz / gereksiz', cap: 'Sınırda — gereksiz' };
  function renderSens(box) {
    const out = h('div');
    const draw = () => {
      out.innerHTML = '';
      const s = E.sensitivity(ds, state.A, state.B, sensUI.objective, sensUI.who);
      const maxAbs = Math.max(1e-9, ...s.rows.map((r) => Math.abs(r.pct)));
      out.append(h('p', { class: 'hint' }, 'Her satır: o statı tek başına "+adım" artırmanın sonuca etkisi. Karşı taraf sabit. Etki % olarak mevcut skora göredir.'));
      out.append(h('table', null, h('thead', null, h('tr', null, h('th', null, 'Stat'), h('th', { class: 'r' }, 'Adım'), h('th', { class: 'r' }, 'Etki'), h('th', null, ''), h('th', { class: 'r' }, 'Birim başı'), h('th', null, 'Değerlendirme'))),
        h('tbody', null, s.rows.map((r) => h('tr', null, h('td', null, r.name), h('td', { class: 'r' }, '+' + r.step), h('td', { class: 'r ' + (r.pct > 0 ? 'up' : r.pct < 0 ? 'down' : '') }, U.pct(r.pct, 3)),
          h('td', null, h('div', { class: 'bar' }, h('i', { class: r.pct < 0 ? 'neg' : '', style: { width: Math.min(100, Math.abs(r.pct) / maxAbs * 100) + '%' } }))),
          h('td', { class: 'r' }, U.pct(r.perUnit, 4)), h('td', null, h('span', { class: 'verd ' + r.verdict }, VERD[r.verdict])))))));
      const useless = s.rows.filter((r) => r.verdict === 'none' || r.verdict === 'cap').map((r) => r.name);
      out.append(h('div', { class: 'verdict', style: { marginTop: '10px' } }, h('b', null, 'Bu kurulum ve rakip için gereksiz / etkisiz statlar: '), useless.join(', ') || '—'));
      const er = E.rankEnchants(ds, state.A, state.B, { objective: sensUI.objective, who: sensUI.who, tier: sensUI.tier });
      out.append(h('h3', { style: { marginTop: '16px' } }, 'Efsun kütüphanesi sıralaması (her biri tek başına eklenirse)'),
        h('div', { class: 'toolbar' }, field('Efsun değeri', U.sel([{ value: 'max', label: 'En yüksek' }, { value: 'avg', label: 'Ortalama' }, { value: 'min', label: 'En düşük' }], sensUI.tier, (v) => { sensUI.tier = v; draw(); }))),
        h('table', null, h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Efsun'), h('th', { class: 'r' }, 'Değer'), h('th', { class: 'r' }, 'Etki'))),
          h('tbody', null, er.rows.map((r, i) => h('tr', null, h('td', null, i + 1), h('td', null, r.name), h('td', { class: 'r' }, '+' + U.fmt(r.value, 1) + U.statUnit(ds, r.stat)), h('td', { class: 'r ' + (r.pct > 0 ? 'up' : '') }, U.pct(r.pct, 3)))))));
    };
    box.append(h('div', { class: 'toolbar' }, field('Kimin için', U.sel([{ value: 'A', label: 'A (sol taraf)' }, { value: 'B', label: 'B (sağ taraf)' }], sensUI.who, (v) => { sensUI.who = v; draw(); })),
      field('Amaç', U.sel(OBJ, sensUI.objective, (v) => { sensUI.objective = v; draw(); }))), out);
    draw();
  }

  /* ---------------- 5) senaryolar ---------------- */
  function renderScen(box) {
    let nm = '';
    const list = h('div');
    const draw = () => {
      list.innerHTML = '';
      if (!state.scen.length) { list.append(h('p', { class: 'hint' }, 'Henüz senaryo yok. Bir kurulum hazırla, ad ver ve kaydet; sonra değişiklik yapıp farkı bu tabloda gör.')); return; }
      const base = state.scen.find((s) => s.id === state.baselineId);
      const bm = base ? metricsOf(base) : null;
      list.append(h('table', null, h('thead', null, h('tr', null, ['Senaryo', 'A DPS', 'B DPS', 'A öldürür', 'B öldürür', 'Üstünlük', ''].map((t, i) => h('th', { class: i > 0 && i < 6 ? 'r' : '' }, t)))),
        h('tbody', null, state.scen.map((s) => {
          const m = metricsOf(s), isBase = s.id === state.baselineId;
          const cell = (v, b, inv, d) => h('td', { class: 'r' }, d == null ? U.fmt(v, 1) : U.secs(v), bm && !isBase ? h('div', null, delta(v, b, inv)) : '');
          return h('tr', null, h('td', null, h('b', null, s.name), isBase ? h('span', { class: 'badge ok', style: { marginLeft: '6px' } }, 'baz') : ''),
            cell(m.aDps, bm && bm.aDps), cell(m.bDps, bm && bm.bDps, true), cell(m.ttk, bm && bm.ttk, true, 1), cell(m.survive, bm && bm.survive, false, 1),
            h('td', { class: 'r' }, U.fmt(m.ratio, 2) + '×', bm && !isBase ? h('div', null, delta(m.ratio, bm.ratio)) : ''),
            h('td', null, h('button', { onclick: () => { state.A = E.clone(s.A); state.B = E.clone(s.B); mountEditors(); onChange(); toast('"' + s.name + '" yüklendi'); } }, 'Yükle'),
              h('button', { onclick: () => { state.baselineId = isBase ? null : s.id; persist(); draw(); } }, isBase ? 'Baz kaldır' : 'Baz yap'),
              h('button', { class: 'danger', onclick: () => { state.scen = state.scen.filter((x) => x.id !== s.id); if (state.baselineId === s.id) state.baselineId = null; persist(); draw(); } }, 'Sil')));
        }))));
    };
    box.append(h('div', { class: 'card' }, h('h2', null, 'Senaryolar (A/B karşılaştırma)'),
      h('p', { class: 'hint' }, 'Mevcut A ve B kurulumunu kaydet. "Baz yap" dediğin senaryoya göre diğerlerinin farkı (%) ve Hasar analizi sekmesindeki göstergeler renklenir. Kayıtlar bu tarayıcıda saklanır.'),
      h('div', { class: 'toolbar' }, field('Senaryo adı', U.textInput('', (v) => { nm = v; }, { placeholder: 'örn. Kritik build, +5 efsunlu' })),
        h('button', { class: 'primary', onclick: () => { state.scen.push({ id: D.uid('sc'), name: nm.trim() || 'Senaryo ' + (state.scen.length + 1), A: E.clone(state.A), B: E.clone(state.B) }); persist(); draw(); toast('Senaryo kaydedildi'); } }, 'Mevcut kurulumu kaydet')), list));
    draw();
  }

  mountEditors(); renderTabs(); renderBody();
})();
