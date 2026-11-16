/* =====================================================================
 *  Veri katmanı: varsayılan (ÖRNEK) veri seti, yükleme ve kaydetme.
 *  Yükleme sırası: Supabase → data/dataset.json → gömülü örnek.
 * ===================================================================== */
(function () {
  const E = window.M2Engine;

  function S(key, name, role, step, extra) {
    return Object.assign({ key, name, role, step: step || 1, unit: '%' }, extra || {});
  }
  function defaultDataset() {
    const stats = [
      S('atk', 'Saldırı Değeri', 'atk', 10, { unit: 'sabit' }),
      S('wpn_min', 'Silah Hasarı (Min)', 'wpn_min', 5, { unit: 'sabit' }),
      S('wpn_max', 'Silah Hasarı (Maks)', 'wpn_max', 5, { unit: 'sabit' }),
      S('atk_pct', 'Saldırı %', 'atk_pct', 1),
      S('normal_dmg', 'Normal Vuruş Hasarı %', 'normal_dmg', 1),
      S('skill_dmg', 'Beceri Hasarı %', 'skill_dmg', 1),
      S('vs_monster', 'Canavarlara Karşı Hasar %', 'vs', 1, { kind: 'monster' }),
      S('vs_boss', 'Boss\'lara Karşı Hasar %', 'vs', 1, { kind: 'boss' }),
      S('vs_stone', 'Metin Taşlarına Karşı Hasar %', 'vs', 1, { kind: 'stone' }),
      S('vs_player', 'İnsanlara Karşı Hasar %', 'vs', 1, { kind: 'player' }),
      S('final_dmg', 'Son Hasar % (çarpan)', 'final_dmg', 1),
      S('crit_rate', 'Kritik Vuruş Şansı %', 'crit_rate', 1),
      S('crit_dmg', 'Kritik Hasar %', 'crit_dmg', 5),
      S('pierce_rate', 'Delici Vuruş Şansı %', 'pierce_rate', 1),
      S('pierce_dmg', 'Delici Vuruş Hasarı %', 'pierce_dmg', 5),
      S('def_ignore', 'Savunma Yok Sayma %', 'def_ignore', 1),
      S('accuracy', 'İsabet', 'accuracy', 1, { unit: 'sabit' }),
      S('atk_speed', 'Saldırı Hızı %', 'atk_speed', 1),
      S('cast_speed', 'Büyü/Beceri Hızı %', 'cast_speed', 1),
      S('cd_reduce', 'Bekleme Süresi Azaltma %', 'cd_reduce', 1),
      S('lifesteal', 'Can Çalma %', 'lifesteal', 1),
      S('def', 'Savunma', 'def', 10, { unit: 'sabit' }),
      S('def_pct', 'Savunma %', 'def_pct', 1),
      S('hp', 'Can (HP)', 'hp', 100, { unit: 'sabit' }),
      S('hp_pct', 'Can %', 'hp_pct', 1),
      S('dmg_reduce', 'Hasar Azaltma %', 'dmg_reduce', 1),
      S('normal_resist', 'Normal Vuruş Direnci %', 'normal_resist', 1),
      S('skill_resist', 'Beceri Direnci %', 'skill_resist', 1),
      S('res_monster', 'Canavar Saldırısına Direnç %', 'res', 1, { kind: 'monster' }),
      S('res_boss', 'Boss Saldırısına Direnç %', 'res', 1, { kind: 'boss' }),
      S('res_stone', 'Metin Saldırısına Direnç %', 'res', 1, { kind: 'stone' }),
      S('res_player', 'İnsan Saldırısına Direnç %', 'res', 1, { kind: 'player' }),
      S('block_rate', 'Blok Şansı %', 'block_rate', 1),
      S('block_amount', 'Blok Miktarı (ek %)', 'block_amount', 1),
      S('dodge_rate', 'Kaçınma %', 'dodge_rate', 1),
      S('crit_resist', 'Kritik Şansı Direnci', 'crit_resist', 1),
      S('crit_dmg_resist', 'Kritik Hasar Direnci %', 'crit_dmg_resist', 5),
      S('pierce_resist', 'Delici Şansı Direnci', 'pierce_resist', 1),
      S('pierce_dmg_resist', 'Delici Hasar Direnci %', 'pierce_dmg_resist', 5),
      S('hp_regen', 'Can Yenilenmesi / sn', 'hp_regen', 5, { unit: 'sabit' }),
    ];
    const base = (atk, wmin, wmax, hp, def, lv) => ({
      atk: { b: atk, l: lv[0] }, wpn_min: { b: wmin, l: 0 }, wpn_max: { b: wmax, l: 0 },
      hp: { b: hp, l: lv[1] }, def: { b: def, l: lv[2] },
      crit_rate: { b: 5, l: 0 }, pierce_rate: { b: 5, l: 0 },
    });
    return {
      meta: { name: 'Mobile2 Global', version: 1, note: 'ÖRNEK VERİ — gerçek oyun değerleri değildir. Yönetim panelinden kendi değerlerinle değiştir.' },
      profile: E.defaultProfile(),
      kinds: [{ key: 'player', name: 'Oyuncu' }, { key: 'monster', name: 'Canavar' }, { key: 'boss', name: 'Boss' }, { key: 'stone', name: 'Metin Taşı' }],
      stats,
      classes: [
        { id: 'warrior', name: 'Savaşçı', base: base(40, 20, 30, 800, 20, [3, 40, 2]) },
        { id: 'ninja', name: 'Ninja', base: base(38, 18, 28, 650, 15, [3.2, 32, 1.6]) },
        { id: 'sura', name: 'Sura', base: base(36, 18, 28, 700, 18, [3, 35, 1.8]) },
        { id: 'shaman', name: 'Şaman', base: base(34, 16, 26, 600, 12, [2.8, 30, 1.4]) },
      ],
      pointStats: [
        { key: 'str', name: 'Güç', effects: [{ stat: 'atk', per: 2 }] },
        { key: 'vit', name: 'Dayanıklılık', effects: [{ stat: 'hp', per: 30 }, { stat: 'def', per: 1 }] },
        { key: 'dex', name: 'Çeviklik', effects: [{ stat: 'dodge_rate', per: 0.1 }, { stat: 'atk', per: 1 }] },
        { key: 'int', name: 'Zeka', effects: [{ stat: 'skill_dmg', per: 0.2 }] },
      ],
      slots: [
        { key: 'weapon', name: 'Silah', enchantSlots: 5 },
        { key: 'helmet', name: 'Kask', enchantSlots: 3 },
        { key: 'armor', name: 'Zırh', enchantSlots: 3 },
        { key: 'shield', name: 'Kalkan', enchantSlots: 2 },
        { key: 'boots', name: 'Ayakkabı', enchantSlots: 2 },
        { key: 'bracelet', name: 'Bilezik', enchantSlots: 2 },
        { key: 'necklace', name: 'Kolye', enchantSlots: 2 },
        { key: 'earring', name: 'Küpe', enchantSlots: 2 },
      ],
      items: [
        { id: 'sample_sword', name: 'Örnek Kılıç', slot: 'weapon', stats: { wpn_min: 60, wpn_max: 90, atk: 20 } },
        { id: 'sample_armor', name: 'Örnek Zırh', slot: 'armor', stats: { def: 80, hp: 400 } },
        { id: 'sample_helmet', name: 'Örnek Kask', slot: 'helmet', stats: { def: 30, hp: 150 } },
      ],
      enchants: [
        { id: 'en_atk_pct', name: 'Saldırı %', stat: 'atk_pct', min: 3, max: 8, slots: [] },
        { id: 'en_crit', name: 'Kritik Vuruş', stat: 'crit_rate', min: 3, max: 9, slots: [] },
        { id: 'en_crit_dmg', name: 'Kritik Hasar', stat: 'crit_dmg', min: 5, max: 20, slots: [] },
        { id: 'en_pierce', name: 'Delici Vuruş', stat: 'pierce_rate', min: 3, max: 9, slots: [] },
        { id: 'en_pierce_dmg', name: 'Delici Hasar', stat: 'pierce_dmg', min: 5, max: 20, slots: [] },
        { id: 'en_normal', name: 'Normal Vuruş Hasarı', stat: 'normal_dmg', min: 4, max: 12, slots: [] },
        { id: 'en_skill', name: 'Beceri Hasarı', stat: 'skill_dmg', min: 4, max: 12, slots: [] },
        { id: 'en_boss', name: 'Boss Hasarı', stat: 'vs_boss', min: 4, max: 12, slots: [] },
        { id: 'en_monster', name: 'Canavar Hasarı', stat: 'vs_monster', min: 4, max: 12, slots: [] },
        { id: 'en_final', name: 'Son Hasar', stat: 'final_dmg', min: 1, max: 4, slots: [] },
        { id: 'en_def_ignore', name: 'Savunma Delme', stat: 'def_ignore', min: 2, max: 6, slots: [] },
        { id: 'en_as', name: 'Saldırı Hızı', stat: 'atk_speed', min: 2, max: 6, slots: [] },
        { id: 'en_hp', name: 'Can', stat: 'hp', min: 100, max: 400, slots: [] },
        { id: 'en_def', name: 'Savunma', stat: 'def', min: 10, max: 40, slots: [] },
        { id: 'en_dr', name: 'Hasar Azaltma', stat: 'dmg_reduce', min: 1, max: 4, slots: [] },
        { id: 'en_dodge', name: 'Kaçınma', stat: 'dodge_rate', min: 2, max: 6, slots: [] },
        { id: 'en_block', name: 'Blok', stat: 'block_rate', min: 2, max: 6, slots: [] },
        { id: 'en_crit_res', name: 'Kritik Direnci', stat: 'crit_resist', min: 2, max: 6, slots: [] },
        { id: 'en_res_boss', name: 'Boss Direnci', stat: 'res_boss', min: 3, max: 10, slots: [] },
      ],
      skills: [
        { id: 'w1', classId: 'warrior', name: 'Örnek Savaşçı Becerisi 1', coefBase: 1.6, coefPerLevel: 0.12, flatBase: 0, flatPerLevel: 0, hits: 1, cast: 1.0, cooldown: 6, maxLevel: 20, usesWeapon: true, dmgPct: 0 },
        { id: 'w2', classId: 'warrior', name: 'Örnek Savaşçı Becerisi 2', coefBase: 0.9, coefPerLevel: 0.07, flatBase: 0, flatPerLevel: 0, hits: 3, cast: 1.4, cooldown: 10, maxLevel: 20, usesWeapon: true, dmgPct: 0 },
        { id: 'n1', classId: 'ninja', name: 'Örnek Ninja Becerisi 1', coefBase: 1.5, coefPerLevel: 0.11, flatBase: 0, flatPerLevel: 0, hits: 1, cast: 0.9, cooldown: 5, maxLevel: 20, usesWeapon: true, dmgPct: 0 },
        { id: 'n2', classId: 'ninja', name: 'Örnek Ninja Becerisi 2', coefBase: 0.8, coefPerLevel: 0.06, flatBase: 0, flatPerLevel: 0, hits: 4, cast: 1.5, cooldown: 11, maxLevel: 20, usesWeapon: true, dmgPct: 0 },
        { id: 's1', classId: 'sura', name: 'Örnek Sura Becerisi 1', coefBase: 1.7, coefPerLevel: 0.12, flatBase: 0, flatPerLevel: 0, hits: 1, cast: 1.1, cooldown: 6, maxLevel: 20, usesWeapon: true, dmgPct: 0 },
        { id: 's2', classId: 'sura', name: 'Örnek Sura Becerisi 2', coefBase: 1.0, coefPerLevel: 0.08, flatBase: 0, flatPerLevel: 0, hits: 2, cast: 1.3, cooldown: 9, maxLevel: 20, usesWeapon: true, dmgPct: 0 },
        { id: 'c1', classId: 'shaman', name: 'Örnek Şaman Becerisi 1', coefBase: 1.8, coefPerLevel: 0.13, flatBase: 0, flatPerLevel: 0, hits: 1, cast: 1.2, cooldown: 6, maxLevel: 20, usesWeapon: false, dmgPct: 0 },
        { id: 'c2', classId: 'shaman', name: 'Örnek Şaman Becerisi 2', coefBase: 1.1, coefPerLevel: 0.08, flatBase: 0, flatPerLevel: 0, hits: 2, cast: 1.4, cooldown: 9, maxLevel: 20, usesWeapon: false, dmgPct: 0 },
      ],
      targets: [
        { id: 't_monster', name: 'Örnek Canavar', kind: 'monster', level: 50, stats: { hp: 6000, def: 60, atk: 60, wpn_min: 10, wpn_max: 20 }, rotation: [], basic: true },
        { id: 't_boss', name: 'Örnek Boss', kind: 'boss', level: 60, stats: { hp: 90000, def: 220, atk: 180, wpn_min: 40, wpn_max: 70, crit_rate: 10 }, rotation: [], basic: true },
        { id: 't_stone', name: 'Örnek Metin Taşı', kind: 'stone', level: 55, stats: { hp: 40000, def: 150 }, rotation: [], basic: false },
      ],
      calibration: [],
    };
  }

  function normalize(ds) {
    const d = ds || {};
    const def = defaultDataset();
    d.meta = d.meta || def.meta;
    d.profile = Object.assign(E.defaultProfile(), d.profile || {});
    d.profile.caps = Object.assign(E.defaultProfile().caps, (d.profile || {}).caps || {});
    ['kinds', 'stats', 'classes', 'pointStats', 'slots', 'items', 'enchants', 'skills', 'targets', 'calibration'].forEach((k) => {
      if (!Array.isArray(d[k])) d[k] = k === 'calibration' ? [] : def[k];
    });
    return d;
  }

  /* ---------------- Supabase ---------------- */
  let client = null;
  function cfg() { return window.M2_CONFIG || {}; }
  function hasSupabase() { return !!(cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient); }
  function sb() {
    if (!client && hasSupabase()) client = window.supabase.createClient(cfg().SUPABASE_URL, cfg().SUPABASE_ANON_KEY);
    return client;
  }

  async function load() {
    if (hasSupabase()) {
      try {
        const { data, error } = await sb().from('datasets').select('data,updated_at').eq('id', cfg().DATASET_ID || 'main').maybeSingle();
        if (!error && data && data.data) return { ds: normalize(data.data), source: 'supabase', updatedAt: data.updated_at };
      } catch (e) { console.warn('Supabase okunamadı:', e); }
    }
    try {
      const r = await fetch('data/dataset.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) return { ds: normalize(await r.json()), source: 'json', updatedAt: null };
    } catch (e) { /* dosya yok */ }
    return { ds: normalize(defaultDataset()), source: 'sample', updatedAt: null };
  }

  async function saveRemote(ds) {
    const c = sb();
    if (!c) throw new Error('Supabase ayarlı değil (js/config.js)');
    const { error } = await c.from('datasets').upsert({ id: cfg().DATASET_ID || 'main', data: ds, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  /* ---------------- yardımcılar ---------------- */
  function uid(prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8); }

  function newSide(ds, kind) {
    if (kind === 'target') return { mode: 'target', targetId: (ds.targets[0] || {}).id, extra: {}, level: 1 };
    const cls = ds.classes[0] || {};
    const skills = ds.skills.filter((s) => !s.classId || s.classId === cls.id).slice(0, 2);
    return {
      mode: 'build', classId: cls.id, level: 50, kind: 'player', points: {}, equip: {}, extra: {},
      rotation: skills.map((s) => ({ skillId: s.id, level: Math.min(10, s.maxLevel || 10) })), basic: true,
    };
  }

  window.M2Data = { defaultDataset, normalize, load, saveRemote, hasSupabase, sb, uid, newSide, cfg };
})();
