/* =====================================================================
 *  Ortak arayüz yardımcıları: DOM, biçimlendirme, grafikler, yan editörü
 * ===================================================================== */
(function () {
  const E = window.M2Engine;

  /* ---------------- DOM ---------------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => append(el, x));
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function sel(options, value, onchange, attrs) {
    const s = h('select', attrs || {});
    options.forEach((o) => {
      const op = h('option', { value: o.value }, o.label);
      if (String(o.value) === String(value)) op.selected = true;
      s.append(op);
    });
    if (onchange) s.addEventListener('change', () => onchange(s.value));
    return s;
  }
  function numInput(value, onchange, attrs) {
    const i = h('input', Object.assign({ type: 'number', step: 'any', value: value == null ? '' : value, class: 'num' }, attrs || {}));
    i.addEventListener('input', () => { const v = i.value === '' ? 0 : parseFloat(i.value); onchange(isFinite(v) ? v : 0); });
    return i;
  }
  function textInput(value, onchange, attrs) {
    const i = h('input', Object.assign({ type: 'text', value: value == null ? '' : value }, attrs || {}));
    i.addEventListener('input', () => onchange(i.value));
    return i;
  }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; }

  /* ---------------- biçimlendirme ---------------- */
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '—';
    if (!isFinite(n) || Math.abs(n) >= 1e6) return n > 0 ? '∞' : '-∞';
    d = d == null ? 1 : d;
    const a = Math.abs(n);
    if (a >= 1000) return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    if (a >= 100) return n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
    return n.toLocaleString('tr-TR', { maximumFractionDigits: a < 1 ? 3 : d });
  }
  function pct(n, d) { if (n == null || !isFinite(n)) return '—'; return (n > 0 ? '+' : '') + n.toFixed(d == null ? 2 : d) + '%'; }
  function perc(p) { return (p * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%'; }
  function secs(s) { return !isFinite(s) || s >= 1e6 ? '∞' : s < 60 ? fmt(s, 1) + ' sn' : Math.floor(s / 60) + ' dk ' + Math.round(s % 60) + ' sn'; }
  const TYPE_NAME = { normal: 'Normal', crit: 'Kritik', pierce: 'Delici', critpierce: 'Kritik + Delici', miss: 'Iska', block: 'Blok' };
  function chip(type) { return h('span', { class: 'chip t-' + type }, TYPE_NAME[type] || type); }
  function statName(ds, key) { const s = (ds.stats || []).find((x) => x.key === key); return s ? s.name : key; }
  function statUnit(ds, key) { const s = (ds.stats || []).find((x) => x.key === key); return s && s.unit === '%' ? '%' : ''; }

  function statOptions(ds, withNone) {
    const o = withNone ? [{ value: '', label: '— seç —' }] : [];
    const groups = { atk: 'Saldırı', def: 'Savunma', none: 'Diğer' };
    ['atk', 'def', 'none'].forEach((g) => {
      (ds.stats || []).forEach((s) => {
        const side = (E.ROLES[s.role] || { side: 'none' }).side;
        if (side === g) o.push({ value: s.key, label: s.name });
      });
    });
    return o;
  }

  /* ---------------- SVG grafikler ---------------- */
  const NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function lineChart(series, o) {
    o = o || {};
    const W = o.w || 640, H = o.h || 200, p = { l: 46, r: 12, t: 10, b: 24 };
    const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', role: 'img' });
    let xmax = 0, ymax = o.yMax || 0;
    series.forEach((s) => s.points.forEach((pt) => { xmax = Math.max(xmax, pt[0]); ymax = Math.max(ymax, pt[1]); }));
    xmax = xmax || 1; ymax = ymax || 1;
    const X = (x) => p.l + (x / xmax) * (W - p.l - p.r), Y = (y) => H - p.b - (y / ymax) * (H - p.t - p.b);
    for (let i = 0; i <= 4; i++) {
      const y = (ymax * i) / 4;
      root.append(svg('line', { x1: p.l, x2: W - p.r, y1: Y(y), y2: Y(y), class: 'grid' }));
      root.append(svg('text', { x: p.l - 6, y: Y(y) + 4, class: 'axis', 'text-anchor': 'end' }, fmt(y, 0)));
    }
    for (let i = 0; i <= 5; i++) {
      const x = (xmax * i) / 5;
      root.append(svg('text', { x: X(x), y: H - 6, class: 'axis', 'text-anchor': 'middle' }, fmt(x, 1) + ' sn'));
    }
    series.forEach((s) => {
      if (!s.points.length) return;
      let d = '';
      s.points.forEach((pt, i) => { d += (i ? 'L' : 'M') + X(pt[0]).toFixed(1) + ' ' + Y(pt[1]).toFixed(1); });
      root.append(svg('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    });
    return root;
  }
  function histogram(values, o) {
    o = o || {};
    const W = o.w || 640, H = o.h || 160, p = { l: 36, r: 10, t: 8, b: 24 };
    const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart' });
    if (!values.length) return root;
    const mn = Math.min.apply(null, values), mx = Math.max.apply(null, values), B = o.bins || 24;
    const span = mx - mn || 1, bins = new Array(B).fill(0);
    values.forEach((v) => { bins[Math.min(B - 1, Math.floor(((v - mn) / span) * B))]++; });
    const top = Math.max.apply(null, bins), bw = (W - p.l - p.r) / B;
    bins.forEach((c, i) => {
      const hgt = (c / top) * (H - p.t - p.b);
      root.append(svg('rect', { x: p.l + i * bw + 1, y: H - p.b - hgt, width: Math.max(1, bw - 2), height: hgt, fill: o.color || '#60a5fa', opacity: 0.85 }));
    });
    root.append(svg('text', { x: p.l, y: H - 6, class: 'axis' }, fmt(mn, 1) + ' sn'));
    root.append(svg('text', { x: W - p.r, y: H - 6, class: 'axis', 'text-anchor': 'end' }, fmt(mx, 1) + ' sn'));
    root.append(svg('text', { x: p.l - 4, y: p.t + 8, class: 'axis', 'text-anchor': 'end' }, String(top)));
    return root;
  }
  function stackBar(items) {
    const bar = h('div', { class: 'stackbar' });
    const colors = ['#f59e0b', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb7185', '#22d3ee'];
    const legend = h('div', { class: 'legend' });
    items.forEach((it, i) => {
      const c = colors[i % colors.length];
      bar.append(h('div', { style: { width: (it.share * 100).toFixed(2) + '%', background: c }, title: it.label + ' ' + perc(it.share) }));
      legend.append(h('span', { class: 'lg' }, h('i', { style: { background: c } }), it.label + ' ' + perc(it.share)));
    });
    return h('div', null, bar, legend);
  }

  /* ---------------- Yan editörü (saldıran / savunan) ---------------- */
  /**
   * ds: veri seti, side: düzenlenecek durum nesnesi (yerinde değişir)
   * opt.onChange: her değişimde çağrılır
   */
  function SideEditor(ds, side, opt) {
    opt = opt || {};
    const root = h('div', { class: 'side-editor' });
    const summaryBox = h('div', { class: 'summary-box' });
    const changed = () => { refreshSummary(); if (opt.onChange) opt.onChange(); };

    function ensureEquip(slotKey) {
      side.equip = side.equip || {};
      return (side.equip[slotKey] = side.equip[slotKey] || { itemId: null, enchants: [] });
    }

    function statRows(map, onStructure, title) {
      const box = h('div', { class: 'rows' });
      const keys = Object.keys(map);
      keys.forEach((k) => {
        const row = h('div', { class: 'row' });
        row.append(sel(statOptions(ds, true), k, (nk) => {
          if (!nk || nk === k) return; const v = map[k]; delete map[k]; map[nk] = v; onStructure();
        }));
        row.append(numInput(map[k], (v) => { map[k] = v; changed(); }));
        row.append(h('span', { class: 'unit' }, statUnit(ds, k)));
        row.append(h('button', { class: 'icon', title: 'Sil', onclick: () => { delete map[k]; onStructure(); } }, '✕'));
        box.append(row);
      });
      const add = sel(statOptions(ds, true), '', (nk) => { if (nk && !(nk in map)) { map[nk] = 0; onStructure(); } }, { class: 'add-sel' });
      add.options[0].textContent = '+ ' + (title || 'stat ekle');
      box.append(add);
      return box;
    }

    function renderPlayer() {
      const cls = ds.classes.find((c) => c.id === side.classId) || ds.classes[0] || {};
      const top = h('div', { class: 'grid2' });
      top.append(h('label', null, 'Sınıf', sel(ds.classes.map((c) => ({ value: c.id, label: c.name })), side.classId, (v) => {
        side.classId = v;
        const sk = ds.skills.filter((s) => !s.classId || s.classId === v);
        side.rotation = (side.rotation || []).filter((r) => sk.some((s) => s.id === r.skillId));
        render(); changed();
      })));
      top.append(h('label', null, 'Seviye', numInput(side.level, (v) => { side.level = Math.max(1, Math.round(v)); changed(); }, { min: 1 })));
      top.append(h('label', null, 'Tür', sel(ds.kinds.map((k) => ({ value: k.key, label: k.name })), side.kind || 'player', (v) => { side.kind = v; changed(); })));
      root.append(top);

      if ((ds.pointStats || []).length) {
        const box = h('details', { class: 'box', open: true }, h('summary', null, 'Stat puanları'));
        const g = h('div', { class: 'grid4' });
        side.points = side.points || {};
        ds.pointStats.forEach((ps) => g.append(h('label', null, ps.name, numInput(side.points[ps.key] || 0, (v) => { side.points[ps.key] = Math.max(0, Math.round(v)); changed(); }, { min: 0 }))));
        box.append(g); root.append(box);
      }

      const eq = h('details', { class: 'box' }, h('summary', null, 'Ekipman ve efsunlar'));
      ds.slots.forEach((slot) => {
        const e = ensureEquip(slot.key);
        const items = ds.items.filter((i) => i.slot === slot.key);
        const wrap = h('div', { class: 'slot' });
        const head = h('div', { class: 'slot-head' }, h('b', null, slot.name),
          sel([{ value: '', label: '— boş —' }].concat(items.map((i) => ({ value: i.id, label: i.name }))), e.itemId || '', (v) => { e.itemId = v || null; changed(); }));
        wrap.append(head);
        const n = Math.max(slot.enchantSlots || 0, (e.enchants || []).length);
        e.enchants = e.enchants || [];
        const lines = h('div', { class: 'enchant-lines' });
        for (let i = 0; i < n; i++) {
          const ln = e.enchants[i] || (e.enchants[i] = { stat: '', value: 0 });
          const row = h('div', { class: 'row' });
          const preset = sel([{ value: '', label: 'hazır' }].concat((ds.enchants || []).filter((x) => !x.slots || !x.slots.length || x.slots.indexOf(slot.key) >= 0).map((x) => ({ value: x.id, label: x.name + ' (' + x.min + '–' + x.max + ')' }))), '', (v) => {
            const en = ds.enchants.find((x) => x.id === v); if (!en) return;
            ln.stat = en.stat; ln.value = en.max; render(); changed();
          }, { class: 'preset' });
          row.append(preset);
          row.append(sel(statOptions(ds, true), ln.stat || '', (v) => { ln.stat = v; changed(); }));
          row.append(numInput(ln.value, (v) => { ln.value = v; changed(); }));
          row.append(h('span', { class: 'unit' }, statUnit(ds, ln.stat)));
          lines.append(row);
        }
        wrap.append(lines); eq.append(wrap);
      });
      root.append(eq);

      /* rotasyon */
      const rot = h('details', { class: 'box', open: true }, h('summary', null, 'Beceri rotasyonu (öncelik sırasıyla)'));
      side.rotation = side.rotation || [];
      const avail = ds.skills.filter((s) => !s.classId || s.classId === side.classId);
      side.rotation.forEach((r, i) => {
        const sk = ds.skills.find((s) => s.id === r.skillId);
        const row = h('div', { class: 'row' });
        row.append(h('span', { class: 'idx' }, i + 1 + '.'));
        row.append(sel(avail.map((s) => ({ value: s.id, label: s.name })), r.skillId, (v) => { r.skillId = v; changed(); }));
        row.append(h('span', { class: 'unit' }, 'Sv.'));
        row.append(numInput(r.level, (v) => { r.level = Math.max(1, Math.round(v)); changed(); }, { min: 1, max: sk ? sk.maxLevel || 99 : 99 }));
        row.append(h('button', { class: 'icon', title: 'Yukarı', onclick: () => { if (i > 0) { const t = side.rotation[i - 1]; side.rotation[i - 1] = r; side.rotation[i] = t; render(); changed(); } } }, '↑'));
        row.append(h('button', { class: 'icon', title: 'Sil', onclick: () => { side.rotation.splice(i, 1); render(); changed(); } }, '✕'));
        rot.append(row);
      });
      const addSk = sel([{ value: '', label: '+ beceri ekle' }].concat(avail.map((s) => ({ value: s.id, label: s.name }))), '', (v) => {
        if (!v) return; const s = ds.skills.find((x) => x.id === v);
        side.rotation.push({ skillId: v, level: Math.min(10, s.maxLevel || 10) }); render(); changed();
      }, { class: 'add-sel' });
      rot.append(addSk);
      rot.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: side.basic !== false, onchange: (ev) => { side.basic = ev.target.checked; changed(); } }), ' Beceri hazır değilken normal vuruş yap'));
      root.append(rot);
    }

    function renderTarget() {
      const t = ds.targets.find((x) => x.id === side.targetId) || ds.targets[0];
      const top = h('div', { class: 'grid2' });
      top.append(h('label', null, 'Hedef', sel(ds.targets.map((x) => ({ value: x.id, label: x.name })), side.targetId, (v) => { side.targetId = v; render(); changed(); })));
      top.append(h('label', null, 'Tür', h('div', { class: 'static' }, (ds.kinds.find((k) => k.key === (t && t.kind)) || {}).name || '—')));
      root.append(top);
    }

    function renderExtra() {
      side.extra = side.extra || {};
      const box = h('details', { class: 'box' }, h('summary', null, 'Ek statlar / buff / geçersiz kılma'));
      box.append(h('p', { class: 'hint' }, 'Buraya girilen değerler toplam statların üzerine eklenir (negatif de girebilirsin).'));
      box.append(statRows(side.extra, () => { render(); changed(); }, 'stat ekle'));
      root.append(box);
    }

    function refreshSummary() {
      const R = E.resolveSide(ds, side);
      summaryBox.innerHTML = '';
      const rows = (ds.stats || []).filter((s) => R.stats[s.key]);
      const t = h('table', { class: 'mini' });
      t.append(h('tr', null, h('th', null, 'Toplam stat'), h('th', { class: 'r' }, 'Değer')));
      t.append(h('tr', { class: 'hpline' }, h('td', null, 'Azami Can'), h('td', { class: 'r' }, fmt(R.maxHp, 0))));
      const roleSum = E.roleTotals(ds, R.stats).roles;
      rows.forEach((s) => {
        const v = R.stats[s.key];
        const cap = (ds.profile.caps || {})[s.role];
        const atCap = cap != null && roleSum[s.role] >= cap;
        t.append(h('tr', null, h('td', null, s.name),
          h('td', { class: 'r' }, fmt(v, 2) + (s.unit === '%' ? '%' : ''), atCap ? h('em', { class: 'capmark', title: 'Sınıra ulaştı (' + cap + ')' }, ' ▲sınır') : '')));
      });
      if (!rows.length) t.append(h('tr', null, h('td', { colspan: 2, class: 'hint' }, 'Stat yok')));
      summaryBox.append(t);
    }

    function render() {
      root.innerHTML = '';
      if (opt.allowTarget !== false) {
        const toggle = h('div', { class: 'seg' },
          h('button', { class: side.mode !== 'target' ? 'on' : '', onclick: () => { if (side.mode !== 'target') { side.mode = 'build'; render(); changed(); } } }, 'Oyuncu'),
          h('button', { class: side.mode === 'target' ? 'on' : '', onclick: () => { side.mode = 'target'; side.targetId = side.targetId || (ds.targets[0] || {}).id; render(); changed(); } }, 'Hedef (canavar/boss)'));
        root.append(toggle);
      }
      if (side.mode === 'target') renderTarget(); else renderPlayer();
      renderExtra();
      root.append(h('details', { class: 'box', open: false }, h('summary', null, 'Toplam statlar'), summaryBox));
      refreshSummary();
    }
    render();
    return { el: root, render, refreshSummary };
  }

  window.M2UI = { h, sel, numInput, textInput, debounce, fmt, pct, perc, secs, chip, TYPE_NAME, statName, statUnit, statOptions, lineChart, histogram, stackBar, SideEditor, svg };
})();
