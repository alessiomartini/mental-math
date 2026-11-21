// Pure logic: question generation, tags, answer check, gap analysis. No DOM.
// Loaded by index.html as a classic script and by test.js through require().
(function (root) {
  'use strict';

  var PRESETS = {
    classica:  { name: 'Classica', dur: 120, dec: 0, add: { on: true, a: [2, 100], b: [2, 100] }, sub: true, mul: { on: true, a: [2, 12], b: [2, 100] }, div: true },
    tabelline: { name: 'Tabelline', dur: 120, dec: 0, add: { on: false, a: [2, 100], b: [2, 100] }, sub: false, mul: { on: true, a: [2, 12], b: [2, 12] }, div: true },
    estese:    { name: 'Tabelline estese', dur: 120, dec: 0, add: { on: false, a: [2, 100], b: [2, 100] }, sub: false, mul: { on: true, a: [2, 20], b: [2, 20] }, div: true },
    decimali:  { name: 'Decimali', dur: 120, dec: 1, add: { on: true, a: [2, 100], b: [2, 100] }, sub: true, mul: { on: true, a: [2, 12], b: [2, 100] }, div: true },
    grandi:    { name: 'Numeri grandi', dur: 120, dec: 0, add: { on: true, a: [10, 999], b: [10, 999] }, sub: true, mul: { on: true, a: [2, 20], b: [10, 999] }, div: true }
  };

  function rnd(lo, hi, r) { return lo + Math.floor((r || Math.random)() * (hi - lo + 1)); }

  // scaled integer -> canonical decimal string ("4.50" -> "4.5", "3.0" -> "3")
  function fmt(n, dec) {
    if (!dec) return String(n);
    var s = String(Math.abs(n)).padStart(dec + 1, '0');
    var out = s.slice(0, -dec) + '.' + s.slice(-dec);
    out = out.replace(/0+$/, '').replace(/\.$/, '');
    return (n < 0 ? '-' : '') + out;
  }

  function carries(x, y) { // column carries of x + y (non-negative ints)
    var c = 0, n = 0;
    while (x > 0 || y > 0) { c = (x % 10 + y % 10 + c) >= 10 ? 1 : 0; n += c; x = Math.floor(x / 10); y = Math.floor(y / 10); }
    return n;
  }

  // One question. Classic rules: '-' is a reversed '+', '÷' a reversed '×'.
  // dec: decimal places on +/- operands and on the non-factor operand of ×/÷.
  function makeQ(cfg, r) {
    var ops = [];
    if (cfg.add.on) ops.push('+');
    if (cfg.sub) ops.push('-');
    if (cfg.mul.on) ops.push('×');
    if (cfg.div) ops.push('÷');
    if (!ops.length) throw new Error('nessuna operazione');
    var op = ops[rnd(0, ops.length - 1, r)], d = cfg.dec || 0, k = Math.pow(10, d), q;
    if (op === '+' || op === '-') {
      var a = rnd(cfg.add.a[0] * k, cfg.add.a[1] * k, r), b = rnd(cfg.add.b[0] * k, cfg.add.b[1] * k, r);
      q = op === '+' ? { op: op, x: fmt(a, d), y: fmt(b, d), ans: fmt(a + b, d), c: carries(a, b) }
                     : { op: op, x: fmt(a + b, d), y: fmt(a, d), ans: fmt(b, d), c: carries(a, b) };
    } else {
      var f = rnd(cfg.mul.a[0], cfg.mul.a[1], r), m = rnd(cfg.mul.b[0] * k, cfg.mul.b[1] * k, r);
      q = op === '×' ? { op: op, x: String(f), y: fmt(m, d), ans: fmt(f * m, d), f: f }
                     : { op: op, x: fmt(f * m, d), y: String(f), ans: fmt(m, d), f: f };
    }
    q.tags = tags(q, d);
    q.al = q.ans.replace('.', '').length;
    return q;
  }

  // Tags compare like with like: ×/÷ by the factor, +/- by number of carries/borrows.
  function tags(q, d) {
    var t = [q.op];
    if (q.op === '+') t.push('+c' + Math.min(q.c, 3));
    if (q.op === '-') t.push('-b' + Math.min(q.c, 3));
    if (q.op === '×' || q.op === '÷') t = t.concat(d ? [q.op + (q.f <= 20 ? q.f : '21+')] : mdTags(q.op, q.f, Number(q.op === '×' ? q.y : q.ans)));
    if (d) t.push(q.op + 'dec');
    t.push(stepOf(q));
    return t;
  }
  // × and ÷ (f = small factor, m = other factor / quotient). Tables (m <= 12) are tagged by factor;
  // beyond tables what makes them slow is the carry from units into tens (Alessio's data, 2026-11-20:
  // 3.4 s without carry, 6-8 s with carry 2-5, while the factor itself barely matters), so they are tagged by carry.
  function mdTags(op, f, m) {
    if (f > 20) return [op + '21+'];
    if (m <= 12) return [op + f];
    var c = Math.floor(f * (m % 10) / 10);
    return [op + 'r' + (c === 0 ? 0 : c < 4 ? 1 : 2)];
  }
  // Tags recomputed from the operands, so old logged questions follow the current tagging.
  function tagsFor(q) {
    if (q.x === undefined) return q.tags;
    var t = (q.tags || [q.op]).filter(function (x) { return x.indexOf(':') < 0; });
    if ((q.op === '×' || q.op === '÷') && !/\./.test(q.x + q.y)) {
      var x = Number(q.x), y = Number(q.y), f = q.op === '×' ? x : y, m = q.op === '×' ? y : x / y;
      t = [q.op].concat(mdTags(q.op, f, m));
    }
    return t.concat(stepOf(q));
  }

  // ---------- the ladder: small steps from what is automatic to what is slow (Alessio's site note, 2026-11-21) ----------
  // Each step fixes the number of digits and the carries, so one step is one kind of difficulty.
  // × and ÷ beyond the tables go by carry size (0, 1-3, 4-8), not by number of carries: in the 2026-11-20 data
  // the size of the carry from units into tens explained the time (3.4 s -> 6-8.5 s).
  // base = time (ms) of someone scoring about 45 in Classica: add/sub/mul from Alessio's sheet, the rest estimated.
  function ccfg(o) { return Object.assign({ dur: 120, dec: 0, add: { on: false, a: [2, 100], b: [2, 100] }, sub: false, mul: { on: false, a: [2, 12], b: [2, 100] }, div: false }, o); }
  var A1 = { on: true, a: [2, 9], b: [2, 9] }, A2 = { on: true, a: [10, 99], b: [10, 99] }, A3 = { on: true, a: [100, 999], b: [100, 999] };
  var ADD1 = { on: false, a: [2, 9], b: [2, 9] }, ADD2 = { on: false, a: [10, 99], b: [10, 99] }, ADD3 = { on: false, a: [100, 999], b: [100, 999] };
  var T = { on: true, a: [2, 12], b: [2, 12] }, M2 = { on: true, a: [2, 12], b: [13, 99] }, M3 = { on: true, a: [2, 9], b: [100, 999] };
  var off = function (m) { return Object.assign({}, m, { on: false }); };
  var CARRY = ['senza riporto', 'riporto piccolo (1–3)', 'riporto grande (4–8)'];
  var STEPS = [
    { id: '×:t', skill: 'tab', name: '× tabelline', base: 1000, cfg: ccfg({ mul: T }) },
    { id: '÷:t', skill: 'tab', name: '÷ tabelline', base: 1100, cfg: ccfg({ mul: off(T), div: true }) },
    { id: '×:0', skill: 'mul', name: '× 1×2 cifre ' + CARRY[0], base: 2000, cfg: ccfg({ mul: M2 }) },
    { id: '×:1', skill: 'mul', name: '× 1×2 cifre ' + CARRY[1], base: 2800, cfg: ccfg({ mul: M2 }) },
    { id: '×:2', skill: 'mul', name: '× 1×2 cifre ' + CARRY[2], base: 3500, cfg: ccfg({ mul: M2 }) },
    { id: '÷:0', skill: 'div', name: '÷ quoziente a 2 cifre ' + CARRY[0], base: 2000, cfg: ccfg({ mul: off(M2), div: true }) },
    { id: '÷:1', skill: 'div', name: '÷ quoziente a 2 cifre ' + CARRY[1], base: 2800, cfg: ccfg({ mul: off(M2), div: true }) },
    { id: '÷:2', skill: 'div', name: '÷ quoziente a 2 cifre ' + CARRY[2], base: 3500, cfg: ccfg({ mul: off(M2), div: true }) },
    { id: '+:f', skill: 'add', name: '+ fra numeri a 1 cifra', base: 800, cfg: ccfg({ add: A1 }) },
    { id: '+:0', skill: 'add', name: '+ 2 cifre senza riporto', base: 1300, cfg: ccfg({ add: A2 }) },
    { id: '+:1', skill: 'add', name: '+ 2 cifre con 1 riporto', base: 1800, cfg: ccfg({ add: A2 }) },
    { id: '+:2', skill: 'add', name: '+ 2 cifre con 2 riporti', base: 2300, cfg: ccfg({ add: A2 }) },
    { id: '-:f', skill: 'sub', name: '− fatti (risultato a 1 cifra)', base: 900, cfg: ccfg({ add: ADD1, sub: true }) },
    { id: '-:0', skill: 'sub', name: '− 2 cifre senza prestito', base: 1400, cfg: ccfg({ add: ADD2, sub: true }) },
    { id: '-:1', skill: 'sub', name: '− 2 cifre con 1 prestito', base: 2000, cfg: ccfg({ add: ADD2, sub: true }) },
    { id: '-:2', skill: 'sub', name: '− 2 cifre con 2 prestiti', base: 2500, cfg: ccfg({ add: ADD2, sub: true }) },
    { id: '+:g', skill: 'big', name: '+ 3 cifre', base: 3500, cfg: ccfg({ add: A3 }) },
    { id: '-:g', skill: 'big', name: '− 3 cifre', base: 4000, cfg: ccfg({ add: ADD3, sub: true }) },
    { id: '×:g', skill: 'big', name: '× numeri grandi (1×3 cifre)', base: 4500, cfg: ccfg({ mul: M3 }) },
    { id: '÷:g', skill: 'big', name: '÷ numeri grandi (quoziente a 3 cifre)', base: 4500, cfg: ccfg({ mul: off(M3), div: true }) },
    { id: 'd:d', skill: 'dec', name: 'decimali (+ − × ÷)', base: 3000, cfg: ccfg({ dec: 1, add: { on: true, a: [2, 100], b: [2, 100] }, sub: true, mul: { on: true, a: [2, 12], b: [2, 100] }, div: true }) }
  ];
  STEPS.forEach(function (s) { s.cfg.focus = s.id; s.cfg.name = 'Allenamento: ' + s.name; });
  var STEP = {}; STEPS.forEach(function (s) { STEP[s.id] = s; });
  // The step of any logged question, recomputed from its operands (also for questions saved before the ladder existed).
  function stepOf(q) {
    if (/\./.test(q.x + q.y)) return 'd:d';
    var x = Number(q.x), y = Number(q.y);
    if (q.op === '+' || q.op === '-') {
      var a = q.op === '+' ? x : y, b = q.op === '+' ? y : x - y; // '-' is a reversed '+': a + b = x
      if (Math.max(a, b) >= 100) return q.op + ':g';
      if (a <= 9 && b <= 9) return q.op + ':f';
      return q.op + ':' + Math.min(carries(a, b), 2);
    }
    var f = q.op === '×' ? Math.min(x, y) : y, m = q.op === '×' ? Math.max(x, y) : x / y;
    if (f > 12 || m > 100) return q.op + ':g'; // 100 = round, no carry
    if (m <= 12) return q.op + ':t';
    var c = Math.floor(f * (m % 10) / 10);
    return q.op + ':' + (c === 0 ? 0 : c < 4 ? 1 : 2);
  }

  // Draws until the question carries cfg.focus (if set) and is not the same as prev.
  // ponytail: rejection sampling, fine for these ranges.
  function nextQ(cfg, r, prev) {
    for (var i = 0; i < 300; i++) {
      var q = makeQ(cfg, r);
      if ((!cfg.focus || q.tags.indexOf(cfg.focus) >= 0) && !(prev && q.op === prev.op && q.x === prev.x && q.y === prev.y)) return q;
    }
    return makeQ(cfg, r);
  }

  function norm(s) { return String(s).trim().replace(',', '.'); }
  function isRight(input, ans) { var s = norm(input); return s !== '' && !/\.$/.test(s) && Number(s) === Number(ans); }
  function isPrefix(input, ans) { var s = norm(input); return ans.indexOf(s) === 0 || (s === '' ) || Number(s) === Number(ans); }

  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  // Gap analysis over the last `last` questions: a tag is a gap when, with n >= MIN,
  // its median time is >= SLOW x its operation's median, or its slip rate is high.
  var MIN = 10, SLOW = 1.25, LAST = 3000;
  function analyse(qs) {
    qs = qs.slice(-LAST);
    // Bigger answers take longer for everyone: first divide each time by the median of questions
    // with the same operation and the same number of answer digits, then compare tags on that ratio.
    var groups = {};
    var gk = function (q) { return q.op + (q.al || 0); };
    qs.forEach(function (q) { (groups[gk(q)] = groups[gk(q)] || []).push(q.ms); });
    var gm = {}; Object.keys(groups).forEach(function (k) { gm[k] = median(groups[k]); });
    var byTag = {};
    qs.forEach(function (q) { tagsFor(q).forEach(function (t) { (byTag[t] = byTag[t] || []).push(q); }); });
    var out = [];
    Object.keys(byTag).forEach(function (t) {
      var op = t.charAt(0), list = byTag[t], base = byTag[op];
      if (t === op || t.indexOf(':') >= 0 || list.length < MIN || !base) return; // ladder steps have their own table
      var mt = median(list.map(function (q) { return q.ms; })), mo = median(base.map(function (q) { return q.ms; }));
      var slip = list.filter(function (q) { return q.slip; }).length / list.length;
      var slipO = base.filter(function (q) { return q.slip; }).length / base.length;
      var ratio = median(list.map(function (q) { return q.ms / gm[gk(q)]; }));
      // slips are rarer and noisier than times: need more questions before flagging on them alone
      var slipGap = list.length >= 20 && slip >= 0.2 && slip >= 2 * slipO;
      if (ratio >= SLOW || slipGap) out.push({ tag: t, n: list.length, ms: mt, opMs: mo, ratio: ratio, slip: slip });
    });
    return out.sort(function (a, b) { return (b.ratio + b.slip) - (a.ratio + a.slip); });
  }

  var OPNAME = { '+': 'addizioni', '-': 'sottrazioni', '×': 'moltiplicazioni', '÷': 'divisioni' };
  function label(t) {
    if (STEP[t]) return STEP[t].name;
    var op = t.charAt(0), rest = t.slice(1);
    if (rest === 'dec') return OPNAME[op] + ' con la virgola';
    if (/^r\d$/.test(rest)) return (op === '×' ? 'moltiplicazioni 1×2 cifre ' : 'divisioni con quoziente a 2 cifre ') +
      ['senza riporto', 'con riporto piccolo (1–3)', 'con riporto grande (4–8)'][rest.charAt(1)];
    if (op === '+') return 'addizioni con ' + rest.slice(1) + (rest.slice(1) === '3' ? '+' : '') + ' riporti';
    if (op === '-') return 'sottrazioni con ' + rest.slice(1) + (rest.slice(1) === '3' ? '+' : '') + ' prestiti';
    return (op === '×' ? 'moltiplicazioni per ' : 'divisioni per ') + rest;
  }

  // Training config for a gap tag.
  function drill(t) {
    if (STEP[t]) return JSON.parse(JSON.stringify(STEP[t].cfg));
    var op = t.charAt(0), rest = t.slice(1);
    var c = { name: 'Allenamento: ' + label(t), dur: 120, dec: 0, add: { on: false, a: [2, 100], b: [2, 100] }, sub: false, mul: { on: false, a: [2, 12], b: [2, 100] }, div: false };
    if (op === '+' || op === '-') {
      if (op === '+') c.add.on = true; else c.sub = true;
      var n = Number(rest.slice(1)) || 0;
      c.add.a = c.add.b = n >= 2 ? [10, 999] : [10, 99];
      if (rest === 'dec') c.dec = 1; else c.focus = t;
    } else {
      if (op === '×') c.mul.on = true; else c.div = true;
      if (rest === 'dec') { c.dec = 1; }
      else if (/^r\d$/.test(rest)) { c.mul.a = [2, 12]; c.mul.b = [13, 99]; c.focus = t; }
      else if (rest === '21+') { c.mul.a = [21, 99]; c.mul.b = [2, 12]; }
      // tables only (b <= 12): the ×N gap tag counts only m <= 12, and with b up to 100 nine questions in ten were 1×2 digits
      else { c.mul.a = [Number(rest), Number(rest)]; c.mul.b = [2, 12]; c.mul.on = true; c.div = true; c.name = 'Allenamento: tabellina del ' + rest + ' (× e ÷)'; }
    }
    return c;
  }

  // Sessions with the same key had the same rules, so their scores are comparable.
  function modeKey(c) {
    if (c.test) return '"test"';
    var as = c.add.on || c.sub, md = c.mul.on || c.div;
    return JSON.stringify([c.dur, c.dec || 0, c.add.on, c.sub, as && c.add.a, as && c.add.b, c.mul.on, c.div, md && c.mul.a, md && c.mul.b, c.focus || '']);
  }

  // ---------- skills (radar axes), levels and the diagnostic test ----------
  // A skill groups ladder steps. base = time (ms) of someone scoring about 45 in Classica (see STEPS).
  var SKILLS = [
    { id: 'add', name: 'Addizioni', base: 1800 },
    { id: 'sub', name: 'Sottrazioni', base: 2000 },
    { id: 'tab', name: 'Tabelline × ÷', base: 1050 },
    { id: 'mul', name: 'Molt. 1×2 cifre', base: 2800 },
    { id: 'div', name: 'Div. quoziente 2 cifre', base: 2800 },
    { id: 'big', name: 'Numeri grandi', base: 4000 },
    { id: 'dec', name: 'Decimali', base: 3000 }
  ];
  // Reference levels: time = base × k. k = 45 / (Classica score of the level), so they mirror the Classica
  // scores 25 / 40 / 55 / 75. Estimates: there are no published norms for these times.
  var LEVELS = [
    { id: 'pri', name: 'Principiante', classica: 25, k: 1.8 },
    { id: 'int', name: 'Intermedio', classica: 40, k: 1.125 },
    { id: 'ava', name: 'Avanzato', classica: 55, k: 0.82 },
    { id: 'pro', name: 'Pro', classica: 75, k: 0.6 }
  ];
  function skillOf(q) { return STEP[stepOf(q)].skill; }

  // Estimate of the typical time: exponentially time-weighted mean of log(ms) (half-life HALF days, so
  // old games fade out instead of being dropped), with ± one standard error from the effective sample size.
  // Skips count as at least SKIP ms; every time is capped at CAP so one distracted question cannot dominate.
  var HALF = 7, SKIP = 10000, CAP = 20000, DAY = 864e5;
  function estimate(list, now, minN) {
    var sw = 0, sw2 = 0, sv = 0, svv = 0;
    list.forEach(function (q) {
      var w = Math.pow(0.5, Math.max(0, now - (q.s || now)) / DAY / HALF);
      var v = Math.log(Math.min(CAP, q.skip ? Math.max(q.ms, SKIP) : q.ms));
      sw += w; sw2 += w * w; sv += w * v; svv += w * v * v;
    });
    if (list.length < (minN || 5)) return { n: list.length, ms: null };
    var m = sv / sw, se = Math.sqrt(Math.max(0, svv / sw - m * m) / (sw * sw / sw2));
    return { n: list.length, ms: Math.exp(m), lo: Math.exp(m - se), hi: Math.exp(m + se) };
  }
  // Highest level reached (index in LEVELS), -1 = below Principiante, null = no estimate.
  function levelOf(ms, base) {
    if (ms == null) return null;
    for (var i = LEVELS.length - 1; i >= 0; i--) if (ms <= base * LEVELS[i].k) return i;
    return -1;
  }
  function scores(groups, key, qs, now) {
    var by = {};
    qs.forEach(function (q) { var k = key(q); (by[k] = by[k] || []).push(q); });
    return groups.map(function (g) {
      var e = estimate(by[g.id] || [], now || Date.now());
      var l = by[g.id] || [];
      return Object.assign({ id: g.id, name: g.name, base: g.base, skill: g.skill, level: levelOf(e.ms, g.base), slip: l.length ? l.filter(function (q) { return q.slip; }).length / l.length : 0 }, e);
    });
  }
  function skillScores(qs, now) { return scores(SKILLS, skillOf, qs, now); }
  function stepScores(qs, now) { return scores(STEPS, stepOf, qs, now); }
  // Next step of each operation's ladder: the first one not yet at Avanzato (or with too few questions).
  var GOAL = 2;
  function nextSteps(st) {
    var out = [];
    ['×', '÷', '+', '-'].forEach(function (op) {
      var s = st.filter(function (x) { return x.id.charAt(0) === op && (x.level == null || x.level < GOAL); })[0];
      if (s) out.push(s);
    });
    return out;
  }
  var PER_STEP = 2;
  // Test: PER_STEP questions per ladder step, shuffled, no time limit.
  function testQueue(r) {
    var q = [];
    STEPS.forEach(function (s) { var p = null; for (var i = 0; i < PER_STEP; i++) q.push(p = nextQ(s.cfg, r, p)); });
    for (var i = q.length - 1; i > 0; i--) { var j = rnd(0, i, r), t = q[i]; q[i] = q[j]; q[j] = t; }
    return q;
  }
  // One number for a test: 100 × geometric mean of base / time over the questions, i.e. 100 ≈ the level of 45 in Classica.
  function testIndex(qs) {
    if (!qs.length) return 0;
    var s = qs.reduce(function (a, q) { return a + Math.log(STEP[stepOf(q)].base / Math.min(CAP, q.skip ? Math.max(q.ms, SKIP) : q.ms)); }, 0);
    return Math.round(100 * Math.exp(s / qs.length));
  }

  var api = { PRESETS: PRESETS, SKILLS: SKILLS, STEPS: STEPS, LEVELS: LEVELS, skillOf: skillOf, stepOf: stepOf, testQueue: testQueue, testIndex: testIndex, skillScores: skillScores, stepScores: stepScores, nextSteps: nextSteps, estimate: estimate, levelOf: levelOf, OPNAME: OPNAME, fmt: fmt, carries: carries, makeQ: makeQ, nextQ: nextQ, isRight: isRight, isPrefix: isPrefix, analyse: analyse, label: label, drill: drill, modeKey: modeKey, median: median, tagsFor: tagsFor };
  if (typeof module !== 'undefined') module.exports = api; else root.MM = api;
})(this);
