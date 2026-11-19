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
    if (q.op === '×' || q.op === '÷') t.push(q.op + (q.f <= 20 ? q.f : '21+'));
    if (d) t.push(q.op + 'dec');
    return t;
  }

  // Draws until the question carries cfg.focus (if set). ponytail: rejection sampling, fine for these ranges.
  function nextQ(cfg, r) {
    for (var i = 0; i < 200; i++) {
      var q = makeQ(cfg, r);
      if (!cfg.focus || q.tags.indexOf(cfg.focus) >= 0) return q;
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
    qs.forEach(function (q) { q.tags.forEach(function (t) { (byTag[t] = byTag[t] || []).push(q); }); });
    var out = [];
    Object.keys(byTag).forEach(function (t) {
      var op = t.charAt(0), list = byTag[t], base = byTag[op];
      if (t === op || list.length < MIN || !base) return;
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
    var op = t.charAt(0), rest = t.slice(1);
    if (rest === 'dec') return OPNAME[op] + ' con la virgola';
    if (op === '+') return 'addizioni con ' + rest.slice(1) + (rest.slice(1) === '3' ? '+' : '') + ' riporti';
    if (op === '-') return 'sottrazioni con ' + rest.slice(1) + (rest.slice(1) === '3' ? '+' : '') + ' prestiti';
    return (op === '×' ? 'moltiplicazioni per ' : 'divisioni per ') + rest;
  }

  // Training config for a gap tag.
  function drill(t) {
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
      else if (rest === '21+') { c.mul.a = [21, 99]; c.mul.b = [2, 12]; }
      else { c.mul.a = [Number(rest), Number(rest)]; c.mul.b = [2, 100]; c.mul.on = true; c.div = true; c.name = 'Allenamento: tabellina del ' + rest + ' (× e ÷)'; }
    }
    return c;
  }

  // Sessions with the same key had the same rules, so their scores are comparable.
  function modeKey(c) {
    var as = c.add.on || c.sub, md = c.mul.on || c.div;
    return JSON.stringify([c.dur, c.dec || 0, c.add.on, c.sub, as && c.add.a, as && c.add.b, c.mul.on, c.div, md && c.mul.a, md && c.mul.b, c.focus || '']);
  }

  var api = { PRESETS: PRESETS, OPNAME: OPNAME, fmt: fmt, carries: carries, makeQ: makeQ, nextQ: nextQ, isRight: isRight, isPrefix: isPrefix, analyse: analyse, label: label, drill: drill, modeKey: modeKey, median: median };
  if (typeof module !== 'undefined') module.exports = api; else root.MM = api;
})(this);
