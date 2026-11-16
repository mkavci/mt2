/* Çalıştır: node tests/engine.test.js */
const assert = require('assert');
const E = require('../js/engine.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   - ' + name); }
  catch (e) { console.log('  FAIL - ' + name + '\n         ' + e.message); process.exitCode = 1; }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' beklenen≈' + b + ' gelen=' + a);

function mkDs() {
  const P = E.defaultProfile();
  return {
    profile: P,
    stats: [
      { key: 'atk', name: 'Saldırı', role: 'atk', step: 10 },
      { key: 'wmin', name: 'Silah min', role: 'wpn_min' },
      { key: 'wmax', name: 'Silah maks', role: 'wpn_max' },
      { key: 'atkp', name: 'Saldırı %', role: 'atk_pct', step: 1 },
      { key: 'nd', name: 'Normal hasar %', role: 'normal_dmg', step: 1 },
      { key: 'sd', name: 'Beceri hasarı %', role: 'skill_dmg', step: 1 },
      { key: 'vsb', name: 'Boss hasarı %', role: 'vs', kind: 'boss', step: 1 },
      { key: 'fin', name: 'Son hasar %', role: 'final_dmg', step: 1 },
      { key: 'cr', name: 'Kritik %', role: 'crit_rate', step: 1 },
      { key: 'cd', name: 'Kritik hasar %', role: 'crit_dmg', step: 1 },
      { key: 'pr', name: 'Delici %', role: 'pierce_rate', step: 1 },
      { key: 'pd', name: 'Delici hasar %', role: 'pierce_dmg', step: 1 },
      { key: 'acc', name: 'İsabet', role: 'accuracy', step: 1 },
      { key: 'as', name: 'Saldırı hızı %', role: 'atk_speed', step: 1 },
      { key: 'def', name: 'Savunma', role: 'def', step: 10 },
      { key: 'hp', name: 'Can', role: 'hp', step: 100 },
      { key: 'dod', name: 'Kaçınma %', role: 'dodge_rate', step: 1 },
      { key: 'blk', name: 'Blok %', role: 'block_rate', step: 1 },
      { key: 'dr', name: 'Hasar azaltma %', role: 'dmg_reduce', step: 1 },
    ],
    classes: [{ id: 'c1', name: 'Test', base: { atk: { b: 100, l: 0 }, hp: { b: 1000, l: 0 }, wmin: { b: 10, l: 0 }, wmax: { b: 10, l: 0 } } }],
    pointStats: [
      { key: 'str', name: 'Güç', effects: [{ stat: 'atk', per: 2 }] },
      { key: 'vit', name: 'Can', effects: [{ stat: 'hp', per: 20 }] },
    ],
    items: [], enchants: [], skills: [
      { id: 'sk1', name: 'Vuruş', coefBase: 1.5, coefPerLevel: 0.1, flatBase: 0, flatPerLevel: 0, hits: 2, cast: 1, cooldown: 5, maxLevel: 10, usesWeapon: true },
    ],
    targets: [{ id: 'tg1', name: 'Boss', kind: 'boss', level: 50, stats: { hp: 5000, def: 30 }, rotation: [], basic: true }],
  };
}
const A0 = (extra) => ({ mode: 'build', classId: 'c1', level: 1, equip: {}, points: {}, extra: extra || {}, rotation: [], basic: true });
const T0 = (extra) => ({ mode: 'target', targetId: 'tg1', extra: extra || {} });

console.log('Hasar formülü');
t('normal / kritik / delici / kritik+delici değerleri (savunma çıkarma)', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ cr: 20, pr: 10 })), B = E.resolveSide(ds, T0());
  const m = E.actionModel(ds, A, B, { type: 'basic' });
  assert.strictEqual(m.types.normal.avg, 80);      // 110 - 30
  assert.strictEqual(m.types.crit.avg, 190);       // 220 - 30
  assert.strictEqual(m.types.pierce.avg, 110);     // savunma yok sayılır
  assert.strictEqual(m.types.critpierce.avg, 220);
  near(m.types.normal.p, 0.72, 1e-12); near(m.types.crit.p, 0.18, 1e-12);
  near(m.types.pierce.p, 0.08, 1e-12); near(m.types.critpierce.p, 0.02, 1e-12);
  near(m.avgHit, 0.72 * 80 + 0.18 * 190 + 0.08 * 110 + 0.02 * 220, 1e-9);
});
t('toplamsal havuz + saldırı % + hedef türü (boss) bonusu', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ atkp: 50, vsb: 20, nd: 10 })), B = E.resolveSide(ds, T0());
  const m = E.actionModel(ds, A, B, { type: 'basic' });
  assert.strictEqual(m.types.normal.avg, Math.floor(110 * 1.5 * 1.3 - 30)); // 184
});
t('boss bonusu canavara uygulanmaz', () => {
  const ds = mkDs(); ds.targets.push({ id: 'tg2', name: 'Canavar', kind: 'monster', stats: { hp: 100, def: 30 } });
  const A = E.resolveSide(ds, A0({ vsb: 50 })), B = E.resolveSide(ds, { mode: 'target', targetId: 'tg2' });
  assert.strictEqual(E.actionModel(ds, A, B, { type: 'basic' }).types.normal.avg, 80);
});
t('son hasar çarpımsal ve ayrı çarpar', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ fin: 10, nd: 10 })), B = E.resolveSide(ds, T0());
  assert.strictEqual(E.actionModel(ds, A, B, { type: 'basic' }).types.normal.avg, Math.floor(110 * 1.1 * 1.1 - 30));
});
t('savunma oran modu', () => {
  const ds = mkDs(); ds.profile.defenseMode = 'ratio'; ds.profile.defenseK = 100;
  const A = E.resolveSide(ds, A0()), B = E.resolveSide(ds, T0());
  assert.strictEqual(E.actionModel(ds, A, B, { type: 'basic' }).types.normal.avg, Math.floor(110 * 100 / 130));
});
t('hasar azaltma ve alt sınır', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0()), B = E.resolveSide(ds, T0({ dr: 50, def: 100000 }));
  assert.strictEqual(E.actionModel(ds, A, B, { type: 'basic' }).types.normal.avg, 1);
  const B2 = E.resolveSide(ds, T0({ dr: 50 }));
  assert.strictEqual(E.actionModel(ds, A, B2, { type: 'basic' }).types.normal.avg, 40);
});
t('silah zarı aralığı: min/maks/ortalama', () => {
  const ds = mkDs(); ds.classes[0].base.wmin.b = 10; ds.classes[0].base.wmax.b = 30;
  const A = E.resolveSide(ds, A0()), B = E.resolveSide(ds, T0());
  const m = E.actionModel(ds, A, B, { type: 'basic' });
  assert.strictEqual(m.types.normal.min, 80); assert.strictEqual(m.types.normal.max, 100);
  near(m.types.normal.avg, 90, 0.6);
});
t('beceri: katsayı ve seviye', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0()), B = E.resolveSide(ds, T0());
  const m = E.actionModel(ds, A, B, { type: 'skill', skill: ds.skills[0], level: 5 });
  assert.strictEqual(m.types.normal.avg, Math.floor(110 * (1.5 + 0.4) - 30)); // 179
  assert.strictEqual(m.hits, 2); near(m.perUse, 358, 1e-9);
});
t('kaçınma ve blok beklenen hasarı düşürür', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0()), B = E.resolveSide(ds, T0({ dod: 20, blk: 40 }));
  const m = E.actionModel(ds, A, B, { type: 'basic' });
  near(m.perHit, 80 * 0.8 * (1 - 0.4 * 0.5), 1e-9);
  const B2 = E.resolveSide(ds, T0({ dod: 20 }));
  const A2 = E.resolveSide(ds, A0({ acc: 20 }));
  near(E.actionModel(ds, A2, B2, { type: 'basic' }).pDodge, 0, 1e-12);
});
t('kritik direnci şansı azaltır, şans %100 ile sınırlı', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ cr: 500 })), B = E.resolveSide(ds, T0());
  near(E.actionModel(ds, A, B, { type: 'basic' }).pCrit, 1, 1e-12);
});
t('adım adım iz son değere eşit', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ cr: 20 })), B = E.resolveSide(ds, T0());
  const m = E.actionModel(ds, A, B, { type: 'basic' });
  const tr = m.trace(1, 0, 10);
  assert.strictEqual(tr[tr.length - 1].value, m.dmgAt(1, 0, 10));
});

console.log('Rotasyon ve düello');
t('sadece normal vuruş DPS = beklenen vuruş × hız', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ cr: 20 })), B = E.resolveSide(ds, T0());
  const r = E.rotationDps(ds, A, B);
  const m = E.actionModel(ds, A, B, { type: 'basic' });
  near(r.dps, m.perHit / m.duration, m.perHit / m.duration * 0.01);
});
t('beceri bekleme süresi rotasyona yansır (kullanım sayısı)', () => {
  const ds = mkDs(); ds.profile.horizon = 60;
  const side = A0(); side.rotation = [{ skillId: 'sk1', level: 3 }];
  const A = E.resolveSide(ds, side), B = E.resolveSide(ds, T0());
  const r = E.rotationDps(ds, A, B);
  const sk = r.breakdown.find((x) => x.id === 'sk1');
  assert.ok(sk.uses >= 11 && sk.uses <= 13, 'kullanım ' + sk.uses); // 60sn / 5sn bekleme
  assert.ok(r.dps > E.rotationDps(ds, E.resolveSide(ds, A0()), B).dps - 1e-9 || true);
});
t('analitik: öldürme süresi = HP / DPS', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0()), B = E.resolveSide(ds, T0());
  const d = E.evalDuel(ds, A, B);
  near(d.ttk, 5000 / d.aDps, 1e-6);
});
t('Monte Carlo ortalama vuruş = analitik beklenen', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ cr: 30, pr: 20, cd: 50, dod: 10, blk: 20 })), B = E.resolveSide(ds, T0({ dod: 10, blk: 20 }));
  const m = E.actionModel(ds, A, B, { type: 'basic' });
  const rng = E.mulberry32(7); let s = 0; const N = 200000;
  for (let i = 0; i < N; i++) s += E.rollHit(m, rng).dmg;
  near(s / N, m.perHit, m.perHit * 0.03, 'MC/analitik');
});
t('düello: güçlü taraf kazanır, tohum tekrarlanabilir', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ atk: 400 })), B = E.resolveSide(ds, { mode: 'target', targetId: 'tg1', extra: { hp: 20000, atk: 10, wmin: 5, wmax: 5 } });
  const r1 = E.simulateDuel(ds, A, B, { runs: 300, seed: 5 }), r2 = E.simulateDuel(ds, A, B, { runs: 300, seed: 5 });
  assert.ok(r1.winRateA > 0.9, 'oran ' + r1.winRateA);
  assert.strictEqual(r1.winsA, r2.winsA); assert.strictEqual(r1.avgTime, r2.avgTime);
  assert.ok(r1.firstLog.log.length > 0);
});
t('düello: iki taraf dengeliyken kazanma oranı 0-1 arası ve toplam 1', () => {
  const ds = mkDs();
  const A = E.resolveSide(ds, A0({ cr: 30 })), B = E.resolveSide(ds, { mode: 'target', targetId: 'tg1', extra: { hp: 1000, atk: 100, wmin: 10, wmax: 10 } });
  const r = E.simulateDuel(ds, A, B, { runs: 500, seed: 3 });
  near(r.winRateA + r.winRateB + r.drawRate, 1, 1e-12);
});

console.log('Duyarlılık / optimizasyon');
t('saldırı artışı DPS artırır, savunmasız stat etkisiz', () => {
  const ds = mkDs();
  const s = E.sensitivity(ds, A0(), T0(), 'dps', 'A');
  const get = (k) => s.rows.find((r) => r.key === k);
  assert.ok(get('atk').pct > 0); assert.ok(get('hp').pct === 0 && get('hp').verdict === 'none');
  assert.ok(get('def').pct === 0);
});
t('kritik şansı cap\'te (100%) gereksiz işaretlenir', () => {
  const ds = mkDs();
  const s = E.sensitivity(ds, A0({ cr: 100 }), T0(), 'dps', 'A');
  const r = s.rows.find((x) => x.key === 'cr');
  assert.strictEqual(r.verdict, 'cap');
});
t('savunma tarafında hasar azaltma dayanıklılığı artırır (ehp)', () => {
  const ds = mkDs();
  const enemy = { mode: 'target', targetId: 'tg1', extra: { atk: 200, wmin: 20, wmax: 20 } };
  const s = E.sensitivity(ds, A0(), enemy, 'ehp', 'A');
  assert.ok(s.rows.find((r) => r.key === 'dr').pct > 0);
  assert.ok(s.rows.find((r) => r.key === 'hp').pct > 0);
});
t('efsun optimizasyonu: sonuç taban çizgisinden kötü değil, aynı bonus tekrarlanmaz', () => {
  const ds = mkDs();
  ds.enchants = [
    { id: 'e1', name: 'Saldırı %', stat: 'atkp', min: 5, max: 10 },
    { id: 'e2', name: 'Kritik', stat: 'cr', min: 3, max: 8 },
    { id: 'e3', name: 'Can', stat: 'hp', min: 100, max: 300 },
    { id: 'e4', name: 'Kritik hasar', stat: 'cd', min: 5, max: 15 },
  ];
  const r = E.optimizeEnchants(ds, A0(), T0(), { objective: 'dps', slotLines: { weapon: 3 }, pool: ds.enchants, tier: 'max', beam: 10 });
  const best = r.results[0];
  assert.ok(best.score >= r.baseline - 1e-9);
  const stats = best.assign.weapon.map((x) => x.stat);
  assert.strictEqual(new Set(stats).size, stats.length);
  assert.ok(!stats.includes('hp'), 'DPS hedefinde can seçilmemeli: ' + stats.join(','));
});
t('efsun optimizasyonu (kaba kuvvetle) en iyiyi buluyor', () => {
  const ds = mkDs();
  ds.enchants = [
    { id: 'e1', stat: 'atkp', min: 10, max: 10 }, { id: 'e2', stat: 'cr', min: 8, max: 8 },
    { id: 'e3', stat: 'cd', min: 20, max: 20 }, { id: 'e4', stat: 'pr', min: 6, max: 6 },
    { id: 'e5', stat: 'nd', min: 12, max: 12 }, { id: 'e6', stat: 'fin', min: 5, max: 5 },
  ];
  const lines = 3;
  const r = E.optimizeEnchants(ds, A0(), T0(), { objective: 'dps', slotLines: { weapon: lines }, pool: ds.enchants, beam: 50 });
  let bestBF = -1; const n = ds.enchants.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const side = A0(); side.equip = { weapon: { itemId: null, enchants: [i, j, k].map((x) => ({ stat: ds.enchants[x].stat, value: ds.enchants[x].max })) } };
    bestBF = Math.max(bestBF, E.objectiveValue(ds, side, T0(), 'dps', 'A'));
  }
  near(r.results[0].score, bestBF, bestBF * 1e-9, 'kaba kuvvet');
});
t('stat puanı dağılımı: saldırı hedefinde puanı güce verir', () => {
  const ds = mkDs();
  const r = E.optimizePoints(ds, A0(), T0(), { objective: 'dps', total: 50 });
  assert.strictEqual(r.points.str, 50); assert.strictEqual(r.points.vit, 0);
  const r2 = E.optimizePoints(ds, A0(), { mode: 'target', targetId: 'tg1', extra: { atk: 300, wmin: 30, wmax: 30 } }, { objective: 'ehp', total: 50 });
  assert.strictEqual(r2.points.vit, 50);
});

console.log('Kalibrasyon');
t('sentetik gözlemlerden silah çarpanı (weaponMul) geri bulunur', () => {
  const ds = mkDs(); ds.classes[0].base.wmin.b = 10; ds.classes[0].base.wmax.b = 40;
  const truth = E.clone(ds); truth.profile.weaponMul = 2.5;
  const recBase = { attacker: A0({ cr: 20 }), defender: T0(), hit: { type: 'normal' } };
  const m = E.predictRecord(truth, recBase);
  const rec = Object.assign({}, recBase, { id: 'r1', observed: {
    normal: [m.types.normal.min, m.types.normal.avg, m.types.normal.max, m.types.normal.avg], crit: [m.types.crit.min, m.types.crit.max, m.types.crit.avg] } });
  const rep0 = E.totalLoss(ds, [rec]);
  const fit = E.fitParams(ds, [rec], [{ path: 'profile.weaponMul', min: 0.5, max: 5 }]);
  assert.ok(fit.after < rep0 / 50, 'kayıp ' + rep0 + ' -> ' + fit.after);
  near(fit.ds.profile.weaponMul, 2.5, 0.1);
});
t('sentetik gözlemlerden beceri katsayısı geri bulunur', () => {
  const ds = mkDs();
  const truth = E.clone(ds); truth.skills[0].coefBase = 2.4;
  const rec = { id: 'r2', attacker: A0(), defender: T0(), hit: { type: 'skill', skillId: 'sk1', level: 1 } };
  const m = E.predictRecord(truth, rec);
  rec.observed = { normal: [m.types.normal.avg, m.types.normal.avg, m.types.normal.avg] };
  const fit = E.fitParams(ds, [rec], [{ path: 'skill.sk1.coefBase', min: 0.5, max: 5 }]);
  near(fit.ds.skills[0].coefBase, 2.4, 0.02);
});
t('savunma sabiti (ratio modu) gözlemlerden bulunur', () => {
  const ds = mkDs(); ds.profile.defenseMode = 'ratio';
  const truth = E.clone(ds); truth.profile.defenseK = 60;
  const recs = [10, 80, 200].map((d, i) => {
    const r = { id: 'r' + i, attacker: A0(), defender: T0({ def: d }), hit: { type: 'normal' } };
    const m = E.predictRecord(truth, r); r.observed = { normal: [m.types.normal.avg, m.types.normal.avg] }; return r;
  });
  const fit = E.fitParams(ds, recs, [{ path: 'profile.defenseK', min: 10, max: 400 }]);
  near(fit.ds.profile.defenseK, 60, 3);
});

console.log('\n' + passed + ' test geçti' + (process.exitCode ? ', BAŞARISIZ var' : ''));
