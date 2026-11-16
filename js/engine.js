/* =====================================================================
 *  Mobile2 Savaş Simülatörü — Hesaplama Motoru (engine.js)
 *  Saf JS: tarayıcıda (window.M2Engine) ve Node'da (require) çalışır.
 *
 *  Bu dosyadaki formüller "profil" (ds.profile) parametreleriyle
 *  ayarlanır. Gerçek oyun formülü bilinmediği için varsayılan değerler
 *  yalnızca BAŞLANGIÇ noktasıdır; yönetim panelinde kalibre edilir.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.M2Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------- yardımcılar ------------------------- */
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : (d === undefined ? 0 : d));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------- roller ------------------------------
   * Her stat kaydının bir "rolü" vardır. Formül yalnızca rolleri bilir;
   * böylece panelden istediğin kadar özel stat ekleyip bir role bağlarsın.
   */
  const ROLES = {
    atk: { name: 'Saldırı değeri', side: 'atk' },
    wpn_min: { name: 'Silah hasarı (min)', side: 'atk' },
    wpn_max: { name: 'Silah hasarı (maks)', side: 'atk' },
    atk_pct: { name: 'Saldırı %', side: 'atk' },
    normal_dmg: { name: 'Normal vuruş hasarı %', side: 'atk' },
    skill_dmg: { name: 'Beceri hasarı %', side: 'atk' },
    vs: { name: 'Hedef türüne karşı hasar %', side: 'atk', needsKind: true },
    dmg_add: { name: 'Ek hasar % (toplamsal havuz)', side: 'atk' },
    final_dmg: { name: 'Son hasar % (çarpan)', side: 'atk' },
    dmg_mul: { name: 'Ek çarpan % (çarpımsal)', side: 'atk' },
    crit_rate: { name: 'Kritik şansı %', side: 'atk' },
    crit_dmg: { name: 'Kritik hasar %', side: 'atk' },
    pierce_rate: { name: 'Delici vuruş şansı %', side: 'atk' },
    pierce_dmg: { name: 'Delici vuruş hasarı %', side: 'atk' },
    def_ignore: { name: 'Savunma yok sayma %', side: 'atk' },
    accuracy: { name: 'İsabet (kaçınmayı azaltır)', side: 'atk' },
    atk_speed: { name: 'Saldırı hızı %', side: 'atk' },
    cast_speed: { name: 'Beceri/büyü hızı %', side: 'atk' },
    cd_reduce: { name: 'Bekleme süresi azaltma %', side: 'atk' },
    lifesteal: { name: 'Can çalma %', side: 'atk' },
    def: { name: 'Savunma', side: 'def' },
    def_pct: { name: 'Savunma %', side: 'def' },
    hp: { name: 'Can (HP)', side: 'def' },
    hp_pct: { name: 'Can %', side: 'def' },
    dmg_reduce: { name: 'Hasar azaltma %', side: 'def' },
    normal_resist: { name: 'Normal vuruş direnci %', side: 'def' },
    skill_resist: { name: 'Beceri direnci %', side: 'def' },
    res: { name: 'Saldıran türüne karşı direnç %', side: 'def', needsKind: true },
    block_rate: { name: 'Blok şansı %', side: 'def' },
    block_amount: { name: 'Blok miktarı (ek %)', side: 'def' },
    dodge_rate: { name: 'Kaçınma %', side: 'def' },
    crit_resist: { name: 'Kritik şansı direnci', side: 'def' },
    crit_dmg_resist: { name: 'Kritik hasar direnci %', side: 'def' },
    pierce_resist: { name: 'Delici şansı direnci', side: 'def' },
    pierce_dmg_resist: { name: 'Delici hasar direnci %', side: 'def' },
    hp_regen: { name: 'Can yenilenmesi / sn', side: 'def' },
    none: { name: 'Bilgi (hesaba katılmaz)', side: 'none' },
  };

  /* ------------------------- varsayılan profil ------------------- */
  function defaultProfile() {
    return {
      name: 'Varsayılan profil (KALİBRE EDİLMEDİ)',
      calibrated: false,
      weaponMul: 1,            // taban = saldırı + weaponMul × silah_zarı
      defenseMode: 'subtract', // 'subtract' (hasar − savunma) | 'ratio' (hasar × K/(K+savunma))
      defenseK: 100,           // ratio modunda sabit
      defMul: 1,               // savunma değerinin genel çarpanı
      defMulNormal: 1,         // normal vuruşa savunma etkisi
      defMulSkill: 1,          // beceriye savunma etkisi
      critBase: 2,             // kritik çarpanı (2 = 2×)
      pierceBase: 1,           // delici vuruş taban çarpanı
      pierceDefIgnore: 100,    // delici vuruş savunmanın % kaçını yok sayar
      critBeforeDefense: true, // kritik çarpanı savunmadan önce mi uygulanır
      blockReduction: 50,      // blok başarılı olunca hasar azalması %
      dmgReduceCap: 90,
      resistCap: 90,
      damageFloor: 1,
      rounding: 'floor',       // 'floor' | 'round' | 'none'
      baseAttackSpeed: 1.5,    // %0 hızda saniyedeki normal vuruş
      minActionTime: 0.2,
      horizon: 60,             // DPS hesabı için saniye
      maxFightTime: 300,
      caps: {
        crit_rate: 100, pierce_rate: 100, dodge_rate: 100, block_rate: 100,
        crit_resist: 100, pierce_resist: 100, def_ignore: 100,
        atk_speed: 300, cast_speed: 300, cd_reduce: 80, lifesteal: 100,
      },
    };
  }

  /* ------------------------- stat toplama ------------------------ */
  function regMap(ds) {
    const m = {};
    (ds.stats || []).forEach((s) => { m[s.key] = s; });
    return m;
  }

  function sumStats(ds, side) {
    const out = {};
    const add = (k, v) => { v = +v; if (!k || !isFinite(v) || !v) return; out[k] = (out[k] || 0) + v; };
    if (side.mode === 'target') {
      const t = (ds.targets || []).find((x) => x.id === side.targetId) || (ds.targets || [])[0];
      if (t) for (const k in t.stats || {}) add(k, t.stats[k]);
    } else {
      const cls = (ds.classes || []).find((c) => c.id === side.classId);
      const lv = Math.max(1, num(side.level, 1));
      if (cls) for (const k in cls.base || {}) {
        const e = cls.base[k] || {};
        add(k, num(e.b) + num(e.l) * (lv - 1));
      }
      for (const ps of ds.pointStats || []) {
        const pts = num((side.points || {})[ps.key]);
        if (pts) for (const e of ps.effects || []) add(e.stat, pts * num(e.per));
      }
      const equip = side.equip || {};
      for (const slot in equip) {
        const eq = equip[slot];
        if (!eq) continue;
        const it = eq.itemId ? (ds.items || []).find((i) => i.id === eq.itemId) : null;
        if (it) for (const k in it.stats || {}) add(k, it.stats[k]);
        for (const en of eq.enchants || []) if (en && en.stat) add(en.stat, en.value);
      }
    }
    for (const k in side.extra || {}) add(k, side.extra[k]);
    return out;
  }

  function roleTotals(ds, stats) {
    const reg = regMap(ds);
    const roles = {}, vs = {}, res = {};
    for (const k in stats) {
      const d = reg[k];
      if (!d || d.role === 'none') continue;
      const v = stats[k];
      if (d.role === 'vs') { const kk = d.kind || '*'; vs[kk] = (vs[kk] || 0) + v; }
      else if (d.role === 'res') { const kk = d.kind || '*'; res[kk] = (res[kk] || 0) + v; }
      else roles[d.role] = (roles[d.role] || 0) + v;
    }
    return { roles, vs, res };
  }

  function resolveSide(ds, side) {
    side = side || {};
    const stats = sumStats(ds, side);
    const { roles, vs, res } = roleTotals(ds, stats);
    let name, kind = 'player', level = num(side.level, 1), rotation = side.rotation || [], basic = side.basic !== false;
    if (side.mode === 'target') {
      const t = (ds.targets || []).find((x) => x.id === side.targetId) || (ds.targets || [])[0] || {};
      name = t.name || 'Hedef'; kind = t.kind || 'monster'; level = num(t.level, 1);
      rotation = t.rotation || []; basic = t.basic !== false;
    } else {
      const cls = (ds.classes || []).find((c) => c.id === side.classId);
      name = side.name || (cls ? cls.name : 'Oyuncu');
      kind = side.kind || 'player';
    }
    const P = ds.profile;
    const maxHp = Math.max(1, num(roles.hp) * (1 + num(roles.hp_pct) / 100));
    const skills = [];
    for (const r of rotation) {
      const sk = (ds.skills || []).find((s) => s.id === r.skillId);
      if (sk) skills.push({ type: 'skill', skill: sk, level: clamp(Math.round(num(r.level, 1)), 1, sk.maxLevel || 99) });
    }
    return { name, kind, level, stats, roles, vs, res, maxHp, skills, basic, regen: num(roles.hp_regen), profile: P };
  }

  /* ------------------------- vuruş modeli ------------------------ */
  function actionModel(ds, att, def, action) {
    const P = ds.profile, R = att.roles, D = def.roles, caps = P.caps || {};
    const cp = (v, k) => clamp(num(v), 0, caps[k] != null ? caps[k] : 1e9);
    const isSkill = action.type === 'skill';
    const sk = action.skill || null;
    const lvl = action.level || 1;

    const pCrit = clamp(cp(R.crit_rate, 'crit_rate') - cp(D.crit_resist, 'crit_resist'), 0, 100) / 100;
    const pPierce = clamp(cp(R.pierce_rate, 'pierce_rate') - cp(D.pierce_resist, 'pierce_resist'), 0, 100) / 100;
    const pDodge = clamp(cp(D.dodge_rate, 'dodge_rate') - num(R.accuracy), 0, 100) / 100;
    const pBlock = cp(D.block_rate, 'block_rate') / 100;
    const blockRed = clamp(num(P.blockReduction) + num(D.block_amount), 0, 100) / 100;

    const wMin = Math.max(0, num(R.wpn_min));
    const wMax = Math.max(wMin, num(R.wpn_max));
    const atkPct = Math.max(0, 1 + num(R.atk_pct) / 100);
    const addPool = num(R.dmg_add) + (isSkill ? num(R.skill_dmg) + num(sk && sk.dmgPct) : num(R.normal_dmg))
      + num(att.vs[def.kind]) + num(att.vs['*']);
    const poolMult = Math.max(0, 1 + addPool / 100);
    const mulMult = Math.max(0, 1 + num(R.final_dmg) / 100) * Math.max(0, 1 + num(R.dmg_mul) / 100);
    const critMul = Math.max(1, num(P.critBase, 2) + (num(R.crit_dmg) - num(D.crit_dmg_resist)) / 100);
    const pierceMul = Math.max(0, num(P.pierceBase, 1) + (num(R.pierce_dmg) - num(D.pierce_dmg_resist)) / 100);
    const defTotal = Math.max(0, num(D.def) * (1 + num(D.def_pct) / 100)) * num(P.defMul, 1)
      * (isSkill ? num(P.defMulSkill, 1) : num(P.defMulNormal, 1));
    const ignore = cp(R.def_ignore, 'def_ignore') / 100;
    const rc = num(P.resistCap, 90);
    const rDmg = clamp(num(D.dmg_reduce), 0, num(P.dmgReduceCap, 90));
    const rKind = clamp(isSkill ? num(D.skill_resist) : num(D.normal_resist), 0, rc);
    const rVs = clamp(num(def.res[att.kind]) + num(def.res['*']), 0, rc);
    const reduce = (1 - rDmg / 100) * (1 - rKind / 100) * (1 - rVs / 100);
    const coef = isSkill ? num(sk.coefBase, 1) + num(sk.coefPerLevel) * (lvl - 1) : 1;
    const flat = isSkill ? num(sk.flatBase) + num(sk.flatPerLevel) * (lvl - 1) : 0;
    const useW = !(isSkill && sk.usesWeapon === false);
    const wMul = num(P.weaponMul, 1);
    const floorV = num(P.damageFloor, 1);
    const rnd = P.rounding === 'none' ? (x) => x : P.rounding === 'round' ? Math.round : Math.floor;

    function dmgAt(c, p, r, trace) {
      const T = (label, value) => { if (trace) trace.push({ label, value }); };
      let base = num(R.atk) + (useW ? wMul * r : 0);
      T('Taban (saldırı + silah zarı × çarpan)', base);
      if (isSkill) { base = base * coef + flat; T('Beceri: taban × katsayı(' + round2(coef) + ') + sabit(' + round2(flat) + ')', base); }
      base *= atkPct; T('Saldırı % uygulandı', base);
      let raw = base * poolMult; T('Toplamsal hasar havuzu ×' + round2(poolMult), raw);
      raw *= mulMult; T('Çarpımsal bonuslar ×' + round2(mulMult), raw);
      if (p) { raw *= pierceMul; T('Delici vuruş ×' + round2(pierceMul), raw); }
      if (c && P.critBeforeDefense !== false) { raw *= critMul; T('Kritik ×' + round2(critMul), raw); }
      let dEff = defTotal * (1 - ignore);
      if (p) dEff *= 1 - clamp(num(P.pierceDefIgnore, 100), 0, 100) / 100;
      let d;
      if (P.defenseMode === 'ratio') {
        const K = Math.max(1e-9, num(P.defenseK, 100));
        d = (raw * K) / (K + dEff);
        T('Savunma (oran) etkin ' + round2(dEff), d);
      } else { d = raw - dEff; T('Savunma (çıkarma) etkin ' + round2(dEff), d); }
      if (c && P.critBeforeDefense === false) { d *= critMul; T('Kritik ×' + round2(critMul) + ' (savunmadan sonra)', d); }
      d *= reduce; T('Savunan azaltmaları ×' + round2(reduce), d);
      d = Math.max(floorV, d);
      d = rnd(d); T('Son hasar (yuvarlanmış, alt sınır ' + floorV + ')', d);
      return d;
    }

    const N = Math.min(Math.round(wMax - wMin) + 1, 41);
    function summ(c, p) {
      const min = dmgAt(c, p, wMin), max = dmgAt(c, p, wMax);
      let sum = 0;
      for (let i = 0; i < N; i++) sum += dmgAt(c, p, N === 1 ? wMin : wMin + ((wMax - wMin) * i) / (N - 1));
      return { min, max, avg: sum / N };
    }
    const types = {
      normal: Object.assign({ p: (1 - pCrit) * (1 - pPierce) }, summ(0, 0)),
      crit: Object.assign({ p: pCrit * (1 - pPierce) }, summ(1, 0)),
      pierce: Object.assign({ p: (1 - pCrit) * pPierce }, summ(0, 1)),
      critpierce: Object.assign({ p: pCrit * pPierce }, summ(1, 1)),
    };
    const avgHit = types.normal.p * types.normal.avg + types.crit.p * types.crit.avg
      + types.pierce.p * types.pierce.avg + types.critpierce.p * types.critpierce.avg;
    const perHit = avgHit * (1 - pDodge) * (1 - pBlock * blockRed);

    const hits = isSkill ? Math.max(1, Math.round(num(sk.hits, 1))) : 1;
    let duration, cooldown = 0;
    const minT = num(P.minActionTime, 0.2);
    if (isSkill) {
      duration = Math.max(minT, num(sk.cast, 1) / (1 + cp(R.cast_speed, 'cast_speed') / 100));
      cooldown = Math.max(duration, num(sk.cooldown) * (1 - cp(R.cd_reduce, 'cd_reduce') / 100));
    } else {
      duration = Math.max(minT, 1 / (num(P.baseAttackSpeed, 1.5) * (1 + cp(R.atk_speed, 'atk_speed') / 100)));
    }
    return {
      id: isSkill ? sk.id : 'basic', label: isSkill ? sk.name + ' (Sv.' + lvl + ')' : 'Normal vuruş',
      isSkill, level: lvl, types, avgHit, perHit, hits, perUse: perHit * hits, duration, cooldown,
      pCrit, pPierce, pDodge, pBlock, blockRed, wMin, wMax, dmgAt,
      trace(c, p, r) { const t = []; dmgAt(c, p, r === undefined ? (wMin + wMax) / 2 : r, t); return t; },
    };
  }
  function round2(x) { return Math.round(x * 100) / 100; }

  function modelsFor(ds, att, def) {
    const out = [];
    if (att.basic) out.push(actionModel(ds, att, def, { type: 'basic' }));
    att.skills.forEach((s) => out.push(actionModel(ds, att, def, s)));
    return out;
  }

  /* ------------------------- rotasyon DPS ------------------------ */
  function rotationDps(ds, att, def) {
    const P = ds.profile, T = Math.max(5, num(P.horizon, 60));
    const basic = att.basic ? actionModel(ds, att, def, { type: 'basic' }) : null;
    const sks = att.skills.map((s) => actionModel(ds, att, def, s));
    const ready = sks.map(() => 0);
    const stat = {};
    const note = (m, d) => { const e = stat[m.id] || (stat[m.id] = { id: m.id, label: m.label, uses: 0, damage: 0, time: 0 }); e.uses++; e.damage += d; e.time += m.duration; };
    let t = 0, total = 0, guard = 0;
    while (t < T && guard++ < 100000) {
      let idx = -1;
      for (let i = 0; i < sks.length; i++) if (ready[i] <= t + 1e-9) { idx = i; break; }
      if (idx >= 0) {
        const m = sks[idx]; total += m.perUse; note(m, m.perUse);
        ready[idx] = t + m.cooldown; t += m.duration;
      } else if (basic) {
        total += basic.perHit; note(basic, basic.perHit); t += basic.duration;
      } else {
        const nxt = Math.min.apply(null, ready);
        if (!isFinite(nxt) || sks.length === 0) break;
        t = Math.max(t + 0.01, nxt);
      }
    }
    const dps = t > 0 ? total / t : 0;
    const breakdown = Object.keys(stat).map((k) => stat[k]);
    breakdown.forEach((b) => { b.share = total > 0 ? b.damage / total : 0; });
    return { dps, total, time: t, breakdown, models: { basic, skills: sks } };
  }

  /* ------------------------- analitik düello --------------------- */
  const BIG = 1e6;
  function evalDuel(ds, A, B) {
    const a = rotationDps(ds, A, B), b = rotationDps(ds, B, A);
    const lsA = clamp(num(A.roles.lifesteal), 0, 100) / 100, lsB = clamp(num(B.roles.lifesteal), 0, 100) / 100;
    const netB = a.dps - B.regen - lsB * b.dps;   // B'nin canına A'nın net etkisi
    const netA = b.dps - A.regen - lsA * a.dps;
    const ttk = netB > 1e-9 ? Math.min(BIG, B.maxHp / netB) : BIG;
    const survive = netA > 1e-9 ? Math.min(BIG, A.maxHp / netA) : BIG;
    return { aDps: a.dps, bDps: b.dps, a, b, ttk, survive, ratio: survive / ttk, aMaxHp: A.maxHp, bMaxHp: B.maxHp };
  }

  function objectiveValue(ds, sideA, sideB, objective, who) {
    const A = resolveSide(ds, sideA), B = resolveSide(ds, sideB);
    const r = who === 'B' ? evalDuel(ds, B, A) : evalDuel(ds, A, B);
    return pickObjective(r, objective);
  }
  function pickObjective(r, objective) {
    if (objective === 'ehp') return r.survive;
    if (objective === 'balanced') return r.ratio;
    return r.aDps;
  }

  /* ------------------------- Monte Carlo düello ------------------ */
  function rollHit(m, rng) {
    if (rng() < m.pDodge) return { dmg: 0, type: 'miss', blocked: false };
    const c = rng() < m.pCrit ? 1 : 0, p = rng() < m.pPierce ? 1 : 0;
    const r = m.wMax > m.wMin ? m.wMin + Math.floor(rng() * (m.wMax - m.wMin + 1)) : m.wMin;
    let d = m.dmgAt(c, p, r), blocked = false;
    if (rng() < m.pBlock) { d = Math.max(1, Math.floor(d * (1 - m.blockRed))); blocked = true; }
    return { dmg: d, type: c && p ? 'critpierce' : c ? 'crit' : p ? 'pierce' : 'normal', blocked };
  }

  function runOnce(ds, A, B, M, rng, wantLog) {
    const sides = [A, B];
    const maxHp = [A.maxHp, B.maxHp];
    const hp = [A.maxHp, B.maxHp];
    const regen = [A.regen, B.regen];
    const ls = [clamp(num(A.roles.lifesteal), 0, 100) / 100, clamp(num(B.roles.lifesteal), 0, 100) / 100];
    const cds = [M[0].skills.map(() => 0), M[1].skills.map(() => 0)];
    const q = [{ t: 0, k: 's', w: 0 }, { t: 0, k: 's', w: 1 }];
    const maxT = num(ds.profile.maxFightTime, 300);
    const dealt = [0, 0], cnt = [{}, {}], log = [];
    let now = 0, winner = 'draw';
    while (q.length) {
      let mi = 0;
      for (let i = 1; i < q.length; i++) if (q[i].t < q[mi].t) mi = i;
      const ev = q.splice(mi, 1)[0];
      if (ev.t > maxT) { now = maxT; break; }
      const dt = ev.t - now; now = ev.t;
      if (dt > 0) for (let i = 0; i < 2; i++) hp[i] = Math.min(maxHp[i], hp[i] + regen[i] * dt);
      const w = ev.w, o = 1 - w;
      if (ev.k === 's') {
        const set = M[w];
        let pick = null, pi = -1;
        for (let i = 0; i < set.skills.length; i++) if (cds[w][i] <= now + 1e-9) { pick = set.skills[i]; pi = i; break; }
        if (!pick && set.basic) pick = set.basic;
        if (!pick) {
          const nxt = cds[w].length ? Math.min.apply(null, cds[w]) : Infinity;
          if (isFinite(nxt)) q.push({ t: Math.max(now + 0.01, nxt), k: 's', w });
          continue;
        }
        if (pi >= 0) cds[w][pi] = now + pick.cooldown;
        for (let h = 0; h < pick.hits; h++) q.push({ t: now + (pick.duration * (h + 1)) / pick.hits, k: 'h', w, m: pick });
        q.push({ t: now + pick.duration, k: 's', w });
      } else {
        const r = rollHit(ev.m, rng);
        const real = Math.min(r.dmg, hp[o]);
        hp[o] -= r.dmg; dealt[w] += real;
        cnt[w][r.type] = (cnt[w][r.type] || 0) + 1;
        if (ls[w] > 0 && r.dmg > 0) hp[w] = Math.min(maxHp[w], hp[w] + r.dmg * ls[w]);
        if (wantLog && log.length < 800) log.push({ t: now, who: w, label: ev.m.label, type: r.type, dmg: r.dmg, blocked: r.blocked, hpA: Math.max(0, hp[0]), hpB: Math.max(0, hp[1]) });
        if (hp[o] <= 0) { winner = w === 0 ? 'A' : 'B'; break; }
      }
    }
    return { winner, time: now, hpA: Math.max(0, hp[0]), hpB: Math.max(0, hp[1]), dealt, cnt, log };
  }

  function simulateDuel(ds, A, B, opt) {
    opt = opt || {};
    const runs = Math.max(1, opt.runs || 1000);
    const rng = mulberry32(opt.seed == null ? 12345 : opt.seed);
    const M = [modelsFor(ds, A, B), modelsFor(ds, B, A)].map((arr, i) => ({
      basic: arr.find((m) => !m.isSkill) || null, skills: arr.filter((m) => m.isSkill),
    }));
    const res = { runs, winsA: 0, winsB: 0, draws: 0, timesA: [], timesB: [], hpLeftA: [], hpLeftB: [], allTimes: [], dealtA: 0, dealtB: 0, firstLog: null, cnt: [{}, {}] };
    for (let i = 0; i < runs; i++) {
      const r = runOnce(ds, A, B, M, rng, i === 0);
      if (i === 0) res.firstLog = r;
      res.allTimes.push(r.time);
      if (r.winner === 'A') { res.winsA++; res.timesA.push(r.time); res.hpLeftA.push(r.hpA); }
      else if (r.winner === 'B') { res.winsB++; res.timesB.push(r.time); res.hpLeftB.push(r.hpB); }
      else res.draws++;
      res.dealtA += r.dealt[0]; res.dealtB += r.dealt[1];
      for (let s = 0; s < 2; s++) for (const k in r.cnt[s]) res.cnt[s][k] = (res.cnt[s][k] || 0) + r.cnt[s][k];
    }
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    res.winRateA = res.winsA / runs; res.winRateB = res.winsB / runs; res.drawRate = res.draws / runs;
    res.avgTimeA = avg(res.timesA); res.avgTimeB = avg(res.timesB); res.avgTime = avg(res.allTimes);
    res.avgHpLeftA = avg(res.hpLeftA); res.avgHpLeftB = avg(res.hpLeftB);
    res.p10HpLeftA = pct(res.hpLeftA, 0.1); res.p10HpLeftB = pct(res.hpLeftB, 0.1);
    res.avgDealtA = res.dealtA / runs; res.avgDealtB = res.dealtB / runs;
    res.timeP10 = pct(res.allTimes, 0.1); res.timeP90 = pct(res.allTimes, 0.9);
    return res;
  }

  /* ------------------------- duyarlılık -------------------------- */
  function sensitivity(ds, sideA, sideB, objective, who) {
    who = who || 'A';
    const base = objectiveValue(ds, sideA, sideB, objective, who);
    const target = who === 'B' ? sideB : sideA;
    const rows = [];
    for (const st of ds.stats || []) {
      if (!st.role || st.role === 'none') continue;
      const step = num(st.step, 1) || 1;
      const tweak = clone(target); tweak.extra = tweak.extra || {};
      tweak.extra[st.key] = num(tweak.extra[st.key]) + step;
      const v = who === 'B' ? objectiveValue(ds, sideA, tweak, objective, who) : objectiveValue(ds, tweak, sideB, objective, who);
      const delta = v - base;
      const pctv = base > 0 && base < BIG ? (delta / base) * 100 : 0;
      rows.push({ key: st.key, name: st.name, role: st.role, unit: st.unit, step, delta, pct: pctv, perUnit: pctv / step });
    }
    const best = Math.max(1e-12, ...rows.map((r) => Math.abs(r.pct)));
    const resolved = resolveSide(ds, target);
    rows.forEach((r) => {
      const cap = (ds.profile.caps || {})[r.role];
      const total = num(resolved.roles[r.role]);
      r.atCap = cap != null && total >= cap && r.pct < 0.0005;
      const rel = Math.abs(r.pct) / best;
      r.verdict = r.atCap ? 'cap' : Math.abs(r.pct) < 0.005 ? 'none' : rel >= 0.6 ? 'great' : rel >= 0.25 ? 'good' : rel >= 0.08 ? 'ok' : 'weak';
    });
    rows.sort((x, y) => y.pct - x.pct);
    return { base, rows };
  }

  /* ------------------------- efsun optimizasyonu ----------------- */
  function enchantValue(e, tier) {
    return tier === 'min' ? e.min : tier === 'avg' ? (num(e.min) + num(e.max)) / 2 : e.max;
  }
  function withEnchants(side, slotLines, assign) {
    const s = clone(side); s.equip = s.equip || {};
    Object.keys(slotLines).forEach((slot) => {
      const cur = s.equip[slot] || { itemId: null, enchants: [] };
      cur.enchants = (assign[slot] || []).map((x) => ({ stat: x.stat, value: x.value }));
      s.equip[slot] = cur;
    });
    return s;
  }
  /**
   * slotLines: {slotKey: hatSayısı}
   * pool: [{id, stat, min, max, slots:[...]}]
   */
  function optimizeEnchants(ds, sideA, sideB, opt) {
    const objective = opt.objective || 'dps', who = opt.who || 'A', tier = opt.tier || 'max';
    const beam = Math.max(3, opt.beam || 20), slotLines = opt.slotLines, pool = opt.pool || [];
    const mySide = who === 'B' ? sideB : sideA;
    const score = (assign) => {
      const t = withEnchants(mySide, slotLines, assign);
      return who === 'B' ? objectiveValue(ds, sideA, t, objective, 'B') : objectiveValue(ds, t, sideB, objective, 'A');
    };
    const baseline = objectiveValue(ds, sideA, sideB, objective, who);
    const lines = [];
    Object.keys(slotLines).forEach((slot) => { for (let i = 0; i < slotLines[slot]; i++) lines.push({ slot, i }); });
    let states = [{ assign: {}, picks: {}, score: score({}), counts: {} }];
    const cands = (slot) => pool.map((e, idx) => ({ e, idx })).filter((x) => !x.e.slots || !x.e.slots.length || x.e.slots.indexOf(slot) >= 0);
    for (const ln of lines) {
      const next = [];
      for (const st of states) {
        const lastIdx = st.picks[ln.slot] != null ? st.picks[ln.slot] : -1;
        for (const { e, idx } of cands(ln.slot)) {
          if (idx <= lastIdx) continue;                        // aynı eşyada permütasyon tekrarı yok
          if ((st.assign[ln.slot] || []).some((x) => x.stat === e.stat)) continue; // aynı eşyada aynı bonus tekrarı yok
          const maxTotal = e.maxTotal || 99;
          if ((st.counts[e.id] || 0) >= maxTotal) continue;
          const a2 = Object.assign({}, st.assign);
          a2[ln.slot] = (a2[ln.slot] || []).concat([{ stat: e.stat, value: enchantValue(e, tier), id: e.id, name: e.name }]);
          const c2 = Object.assign({}, st.counts); c2[e.id] = (c2[e.id] || 0) + 1;
          next.push({ assign: a2, picks: Object.assign({}, st.picks, { [ln.slot]: idx }), counts: c2, score: score(a2) });
        }
        next.push({ assign: st.assign, picks: st.picks, counts: st.counts, score: st.score, skipped: true }); // boş bırakma seçeneği
      }
      next.sort((x, y) => y.score - x.score);
      const seen = new Set(), kept = [];
      for (const s of next) {
        const sig = Object.keys(s.assign).sort().map((k) => k + ':' + s.assign[k].map((x) => x.id).sort().join(',')).join('|');
        if (seen.has(sig)) continue; seen.add(sig); kept.push(s);
        if (kept.length >= beam) break;
      }
      states = kept;
      if (opt.onProgress) opt.onProgress(lines.indexOf(ln) + 1, lines.length);
    }
    states.sort((x, y) => y.score - x.score);
    return { baseline, results: states.slice(0, opt.top || 5).map((s) => ({ score: s.score, gainPct: baseline > 0 && baseline < BIG ? ((s.score - baseline) / baseline) * 100 : 0, assign: s.assign })) };
  }

  /** Kütüphanedeki her efsunu tek tek ekleyince hedefe etkisi */
  function rankEnchants(ds, sideA, sideB, opt) {
    const objective = opt.objective || 'dps', who = opt.who || 'A', tier = opt.tier || 'max';
    const base = objectiveValue(ds, sideA, sideB, objective, who);
    const my = who === 'B' ? sideB : sideA;
    const rows = (ds.enchants || []).map((e) => {
      const t = clone(my); t.extra = t.extra || {};
      t.extra[e.stat] = num(t.extra[e.stat]) + num(enchantValue(e, tier));
      const v = who === 'B' ? objectiveValue(ds, sideA, t, objective, 'B') : objectiveValue(ds, t, sideB, objective, 'A');
      return { id: e.id, name: e.name || e.stat, stat: e.stat, value: enchantValue(e, tier), delta: v - base, pct: base > 0 && base < BIG ? ((v - base) / base) * 100 : 0 };
    });
    rows.sort((x, y) => y.pct - x.pct);
    return { base, rows };
  }

  /* ------------------------- stat puanı dağılımı ----------------- */
  function optimizePoints(ds, sideA, sideB, opt) {
    const objective = opt.objective || 'dps', who = opt.who || 'A', total = Math.max(0, Math.round(opt.total || 0));
    const keys = (ds.pointStats || []).map((p) => p.key);
    const my = who === 'B' ? sideB : sideA;
    const mins = opt.mins || {}, maxs = opt.maxs || {};
    const sc = (pts) => {
      const t = clone(my); t.points = Object.assign({}, pts);
      return who === 'B' ? objectiveValue(ds, sideA, t, objective, 'B') : objectiveValue(ds, t, sideB, objective, 'A');
    };
    const cur = Object.assign({}, my.points || {});
    const baseline = sc(cur);
    const pts = {}; let used = 0;
    keys.forEach((k) => { pts[k] = Math.max(0, mins[k] || 0); used += pts[k]; });
    let best = sc(pts);
    while (used < total) {
      let bk = null, bs = -Infinity;
      for (const k of keys) {
        if (maxs[k] != null && pts[k] >= maxs[k]) continue;
        pts[k]++; const s = sc(pts); pts[k]--;
        if (s > bs) { bs = s; bk = k; }
      }
      if (!bk) break;
      pts[bk]++; used++; best = bs;
    }
    // yerel iyileştirme: puan taşı
    let improved = true, guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (const i of keys) for (const j of keys) {
        if (i === j) continue;
        for (const k of [10, 5, 2, 1]) {
          if (pts[i] - k < (mins[i] || 0)) continue;
          if (maxs[j] != null && pts[j] + k > maxs[j]) continue;
          pts[i] -= k; pts[j] += k;
          const s = sc(pts);
          if (s > best + 1e-9) { best = s; improved = true; } else { pts[i] += k; pts[j] -= k; }
        }
      }
    }
    return { baseline, score: best, points: pts, gainPct: baseline > 0 && baseline < BIG ? ((best - baseline) / baseline) * 100 : 0 };
  }

  /* ------------------------- kalibrasyon ------------------------- */
  const HIT_TYPES = ['normal', 'crit', 'pierce', 'critpierce'];
  function recordAction(ds, rec, A) {
    const h = rec.hit || { type: 'normal' };
    if (h.type === 'skill') {
      const sk = (ds.skills || []).find((s) => s.id === h.skillId);
      if (!sk) return null;
      return { type: 'skill', skill: sk, level: clamp(Math.round(num(h.level, 1)), 1, sk.maxLevel || 99) };
    }
    return { type: 'basic' };
  }
  function predictRecord(ds, rec) {
    const A = resolveSide(ds, rec.attacker), B = resolveSide(ds, rec.defender);
    const act = recordAction(ds, rec, A);
    if (!act) return null;
    return actionModel(ds, A, B, act);
  }
  function recordReport(ds, rec) {
    const m = predictRecord(ds, rec);
    const rows = []; let loss = 0, used = 0;
    if (!m) return { rows, loss: 0, used: 0, error: 'Beceri bulunamadı' };
    for (const t of HIT_TYPES) {
      const obs = ((rec.observed || {})[t] || []).map(Number).filter((x) => isFinite(x) && x > 0);
      if (!obs.length) continue;
      const mean = obs.reduce((a, b) => a + b, 0) / obs.length;
      const mn = Math.min.apply(null, obs), mx = Math.max.apply(null, obs);
      const pr = m.types[t];
      const lr = (a, b) => Math.log(Math.max(1e-9, a) / Math.max(1e-9, b));
      let l = Math.pow(lr(pr.avg, mean), 2);
      if (obs.length >= 3) l += 0.5 * (Math.pow(lr(pr.min, mn), 2) + Math.pow(lr(pr.max, mx), 2));
      loss += l; used++;
      rows.push({ type: t, n: obs.length, obsMean: mean, obsMin: mn, obsMax: mx, predAvg: pr.avg, predMin: pr.min, predMax: pr.max, errPct: ((pr.avg - mean) / mean) * 100, loss: l });
    }
    return { rows, loss, used };
  }
  function totalLoss(ds, records) {
    let L = 0, n = 0;
    for (const r of records) { if (r.enabled === false) continue; const rep = recordReport(ds, r); L += rep.loss; n += rep.used; }
    return n ? L / n : 0;
  }
  function getPath(ds, path) {
    const p = path.split('.');
    if (p[0] === 'profile') return ds.profile[p[1]];
    if (p[0] === 'skill') return (ds.skills.find((s) => s.id === p[1]) || {})[p[2]];
    if (p[0] === 'class') { const c = ds.classes.find((x) => x.id === p[1]); return c && c.base[p[2]] ? c.base[p[2]][p[3]] : undefined; }
    if (p[0] === 'item') { const it = ds.items.find((x) => x.id === p[1]); return it && it.stats ? it.stats[p[2]] : undefined; }
  }
  function setPath(ds, path, val) {
    const p = path.split('.');
    if (p[0] === 'profile') ds.profile[p[1]] = val;
    else if (p[0] === 'skill') { const s = ds.skills.find((x) => x.id === p[1]); if (s) s[p[2]] = val; }
    else if (p[0] === 'class') { const c = ds.classes.find((x) => x.id === p[1]); if (c) { c.base[p[2]] = c.base[p[2]] || { b: 0, l: 0 }; c.base[p[2]][p[3]] = val; } }
    else if (p[0] === 'item') { const it = ds.items.find((x) => x.id === p[1]); if (it) { it.stats = it.stats || {}; it.stats[p[2]] = val; } }
  }
  /** params: [{path, min, max}] — koordinat arama (kaba ızgara + altın oran) */
  function fitParams(ds, records, params, opt) {
    opt = opt || {};
    const work = clone(ds);
    const before = totalLoss(work, records);
    const passes = opt.passes || 5;
    for (let pass = 0; pass < passes; pass++) {
      for (const pr of params) {
        const f = (x) => { setPath(work, pr.path, x); return totalLoss(work, records); };
        const G = 24; let bx = getPath(work, pr.path), bf = f(bx);
        const cx = bx;
        for (let i = 0; i <= G; i++) { const x = pr.min + ((pr.max - pr.min) * i) / G; const v = f(x); if (v < bf) { bf = v; bx = x; } }
        const w = (pr.max - pr.min) / G;
        let lo = Math.max(pr.min, bx - w), hi = Math.min(pr.max, bx + w);
        const phi = (Math.sqrt(5) - 1) / 2;
        let a = hi - phi * (hi - lo), b = lo + phi * (hi - lo), fa = f(a), fb = f(b);
        for (let it = 0; it < 40; it++) {
          if (fa < fb) { hi = b; b = a; fb = fa; a = hi - phi * (hi - lo); fa = f(a); }
          else { lo = a; a = b; fa = fb; b = lo + phi * (hi - lo); fb = f(b); }
        }
        const xr = (lo + hi) / 2;
        const opts = [[cx, f(cx)], [bx, bf], [xr, f(xr)]].sort((p, q) => p[1] - q[1]);
        setPath(work, pr.path, opts[0][0]);
      }
    }
    const after = totalLoss(work, records);
    const values = {};
    params.forEach((p) => { values[p.path] = { from: getPath(ds, p.path), to: getPath(work, p.path) }; });
    return { before, after, values, ds: work };
  }

  /* ------------------------- dışa aktarım ------------------------ */
  return {
    ROLES, HIT_TYPES, clamp, num, clone, mulberry32, defaultProfile,
    sumStats, roleTotals, resolveSide, actionModel, modelsFor, rotationDps, evalDuel, objectiveValue, pickObjective,
    simulateDuel, runOnce, rollHit, sensitivity, optimizeEnchants, rankEnchants, enchantValue, withEnchants,
    optimizePoints, predictRecord, recordReport, totalLoss, fitParams, getPath, setPath,
  };
});
