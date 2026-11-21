// UI: views, game loop, storage (localStorage), stats. Logic lives in core.js (window.MM).
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var KEY = 'mm-data';

  // ---------- storage ----------
  // ponytail: everything in one localStorage key (~80 B/question, ~5 MB cap = ~50k questions); move to IndexedDB if that ever fills.
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { v: 1, sessions: [], qs: [] }; } catch (e) { return { v: 1, sessions: [], qs: [] }; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Spazio pieno: esporta i dati e cancella i più vecchi.'); } }
  var db = load();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

  // ---------- theme ----------
  var sysDark = function () { return matchMedia('(prefers-color-scheme: dark)').matches; };
  function paintTheme() {
    var t = document.documentElement.dataset.theme, dark = t ? t === 'dark' : sysDark();
    document.querySelectorAll('.theme-btn').forEach(function (b) { b.textContent = dark ? '☀ Chiaro' : '☾ Scuro'; });
  }
  document.querySelectorAll('.theme-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = document.documentElement.dataset.theme, dark = t ? t === 'dark' : sysDark(), n = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = n; try { localStorage.setItem('mm-theme', n); } catch (e) {}
      paintTheme();
    });
  });
  paintTheme();

  // ---------- views ----------
  function show(id) {
    if (id !== 'play') game = null; // leaving mid-game (header buttons) discards it
    ['home', 'play', 'result', 'stats'].forEach(function (v) { $('#' + v).hidden = v !== id; });
    if (id === 'home') renderHome();
    if (id === 'stats') renderStats();
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { show(g.dataset.go); return; }
    var d = e.target.closest('[data-drill]'); if (d) { setForm(MM.drill(d.dataset.drill)); show('home'); $('#cfg button[type=submit]').focus(); }
  });
  $('#home-link').addEventListener('click', function (e) { e.preventDefault(); show('home'); });

  // ---------- config form ----------
  var form = $('#cfg'), current = MM.PRESETS.classica;
  function setForm(c) {
    current = c;
    var f = form.elements;
    f.add.checked = c.add.on; f.sub.checked = c.sub; f.mul.checked = c.mul.on; f.div.checked = c.div;
    f.addA0.value = c.add.a[0]; f.addA1.value = c.add.a[1]; f.addB0.value = c.add.b[0]; f.addB1.value = c.add.b[1];
    f.mulA0.value = c.mul.a[0]; f.mulA1.value = c.mul.a[1]; f.mulB0.value = c.mul.b[0]; f.mulB1.value = c.mul.b[1];
    f.dec.value = c.dec || 0; f.dur.value = c.dur;
    $('#focus-note').textContent = /^Allenamento/.test(c.name) ? c.name + (c.focus ? ' (solo domande di questo tipo)' : '') + '.' : '';
    document.querySelectorAll('#presets button').forEach(function (b) { b.classList.toggle('on', b.textContent === c.name); });
  }
  function readForm() {
    var f = form.elements, n = function (x) { return Math.max(0, Math.round(Number(x.value) || 0)); };
    var pair = function (a, b) { var x = n(a), y = n(b); return x <= y ? [x, y] : [y, x]; };
    var c = { dur: Number(f.dur.value), dec: Number(f.dec.value),
      add: { on: f.add.checked, a: pair(f.addA0, f.addA1), b: pair(f.addB0, f.addB1) }, sub: f.sub.checked,
      mul: { on: f.mul.checked, a: pair(f.mulA0, f.mulA1), b: pair(f.mulB0, f.mulB1) }, div: f.div.checked };
    if (c.mul.a[0] < 1) c.mul.a[0] = 1; // no ÷0
    if (current.focus) c.focus = current.focus;
    var base = current.name.replace(/ \(\d+ s\)$/, '');
    var same = MM.modeKey(Object.assign({}, c, { dur: current.dur })) === MM.modeKey(current);
    c.name = !same ? 'Personalizzata' : c.dur === 120 ? base : base + ' (' + c.dur + ' s)';
    return c;
  }
  form.addEventListener('change', function () { var c = readForm(); if (c.name === 'Personalizzata') { delete c.focus; current = c; setForm(c); } });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = readForm();
    if (!c.add.on && !c.sub && !c.mul.on && !c.div) { alert('Scegli almeno un\'operazione.'); return; }
    start(c);
  });
  Object.keys(MM.PRESETS).forEach(function (k) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = MM.PRESETS[k].name;
    b.addEventListener('click', function () { setForm(MM.PRESETS[k]); });
    $('#presets').appendChild(b);
  });
  setForm(MM.PRESETS.classica);

  // ---------- game ----------
  var game = null, input = $('#answer');
  function start(cfg) {
    game = { cfg: cfg, score: 0, qs: [], end: Date.now() + cfg.dur * 1000, q: null, shown: 0, slip: false };
    if (cfg.test) { game.queue = MM.testQueue(); game.total = game.queue.length; }
    show('play'); input.value = ''; input.focus();
    $('#score').textContent = 0;
    $('#tlabel').textContent = cfg.test ? 'Domanda' : 'Tempo:';
    $('#skip-row').hidden = !cfg.test;
    next(); tick();
  }
  function next() {
    if (game.queue) {
      if (!game.queue.length) return finish();
      game.q = game.queue.shift();
      $('#time').textContent = (game.total - game.queue.length) + '/' + game.total;
    } else game.q = MM.nextQ(game.cfg, null, game.q);
    game.shown = performance.now(); game.slip = false;
    $('#question').textContent = game.q.x + ' ' + (game.q.op === '-' ? '−' : game.q.op) + ' ' + game.q.y;
    input.value = '';
  }
  function tick() {
    if (!game || game.queue) return; // the test has no time limit
    var left = Math.max(0, Math.ceil((game.end - Date.now()) / 1000));
    $('#time').textContent = left;
    if (left <= 0) return finish();
    setTimeout(tick, 200);
  }
  input.addEventListener('input', function () {
    if (!game) return;
    var q = game.q;
    if (MM.isRight(input.value, q.ans)) record(false);
    else if (!MM.isPrefix(input.value, q.ans)) game.slip = true;
  });
  function record(skip) {
    var q = game.q, r = { op: q.op, x: q.x, y: q.y, al: q.al, ms: Math.round(performance.now() - game.shown), slip: game.slip || skip, tags: q.tags };
    if (q.skill) r.skill = q.skill;
    if (skip) r.skip = true; else { game.score++; $('#score').textContent = game.score; }
    game.qs.push(r);
    next();
  }
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && game) { game = null; show('home'); }
    if (e.key === 'Enter' && game && game.queue) record(true);
  });
  $('#skip').addEventListener('click', function () { if (game && game.queue) { record(true); input.focus(); } });
  $('#start-test').addEventListener('click', function () { start({ test: true, name: 'Test delle abilità', dur: 0 }); });
  function finish() {
    var g = game; game = null;
    if (g.cfg.test) g.score = MM.testIndex(g.qs);
    var key = MM.modeKey(g.cfg), prev = db.sessions.filter(function (s) { return s.key === key; });
    var best = prev.reduce(function (m, s) { return Math.max(m, s.score); }, 0);
    var id = Date.now();
    db.sessions.push({ id: id, t: new Date().toISOString(), name: g.cfg.name, key: key, cfg: g.cfg, score: g.score });
    g.qs.forEach(function (q) { q.s = id; db.qs.push(q); });
    save();
    lastCfg = g.cfg;
    $('#res-radar').innerHTML = g.cfg.test ? radarSvg(MM.skillScores(db.qs)) + stepTable(MM.stepScores(db.qs)) : '';
    $('#res-score').textContent = g.cfg.test ? 'Indice delle abilità: ' + g.score + ' (100 ≈ chi fa 45 nella Classica)' : 'Punteggio: ' + g.score;
    var slips = g.qs.filter(function (q) { return q.slip; }).length;
    $('#res-detail').textContent = g.cfg.name + '. ' + (prev.length ? (g.score > best ? 'Nuovo record (prima ' + best + ').' : 'Record: ' + best + '.') : 'Prima partita in questa modalità.') +
      (g.qs.length ? ' Tempo mediano ' + (MM.median(g.qs.map(function (q) { return q.ms; })) / 1000).toFixed(1) + ' s per domanda, ' + slips + ' con errori di battitura.' : '');
    show('result');
    $('#again').focus();
  }
  var lastCfg = null;
  $('#again').addEventListener('click', function () { if (lastCfg) start(lastCfg); });

  // ---------- stats ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function gapsHtml(max) {
    var seen = {}; // ×7 and ÷7 lead to the same drill: show it once
    var g = MM.analyse(db.qs).filter(function (x) { var n = MM.drill(x.tag).name; return seen[n] ? false : (seen[n] = 1); }).slice(0, max);
    if (!g.length) return '';
    return g.map(function (x) {
      return '<div class="gap"><span><b>' + esc(MM.label(x.tag)) + '</b><br><small>' + (x.ms / 1000).toFixed(1) + ' s (mediana), ' + Math.round((x.ratio - 1) * 100) + '% più lento di ' + MM.OPNAME[x.tag.charAt(0)] + ' con risultati della stessa lunghezza' + (x.slip >= 0.2 ? ', ' + Math.round(x.slip * 100) + '% con errori' : '') + ' · ' + x.n + ' domande</small></span>' +
        '<button class="primary" data-drill="' + esc(x.tag) + '">Allenati</button></div>';
    }).join('');
  }
  // Radar (spider) chart on one absolute axis: seconds per question on a log scale, 15 s at the centre, 0.5 s
  // on the edge, so faster = further out and every skill shares the same scale (Alessio's site note, 2026-11-21).
  // Outlined polygons = reference levels (one hue, light -> dark); filled polygon = you, with ± 1 SE bars.
  var TMAX = 15000, TMIN = 500;
  var sec = function (ms) { return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + ' s'; };
  function lvName(i) { return i == null ? 'pochi dati' : i < 0 ? 'sotto Principiante' : MM.LEVELS[i].name; }
  function radarSvg(sk) {
    var S = 360, C = S / 2, R = 120, n = sk.length;
    var rad = function (ms) { return Math.max(0, Math.min(1, Math.log(TMAX / ms) / Math.log(TMAX / TMIN))); };
    var pt = function (i, f) { var a = -Math.PI / 2 + 2 * Math.PI * i / n; return [C + R * f * Math.cos(a), C + R * f * Math.sin(a)]; };
    var xy = function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); };
    var poly = function (f) { return sk.map(function (s, i) { return xy(pt(i, f(s))); }).join(' '); };
    var g = [10000, 5000, 2000, 1000, 500].map(function (ms) {
      var f = rad(ms);
      return '<polygon class="ring" points="' + poly(function () { return f; }) + '"/>' + (ms > TMIN ? '<text class="tick" x="' + (C + 3) + '" y="' + (C - R * f - 2).toFixed(1) + '">' + sec(ms) + '</text>' : ''); // edge ring unlabelled: it would hit the top label
    }).join('') + sk.map(function (s, i) { var p = pt(i, 1); return '<line class="ax" x1="' + C + '" y1="' + C + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; }).join('');
    var lv = MM.LEVELS.map(function (L, j) { return '<polygon class="lv lv' + j + '" points="' + poly(function (s) { return rad(s.base * L.k); }) + '"><title>' + L.name + '</title></polygon>'; }).join('');
    var has = sk.filter(function (s) { return s.ms != null; }).length;
    var area = has >= 3 ? '<polygon class="area" points="' + poly(function (s) { return s.ms ? rad(s.ms) : 0; }) + '"/>' : '';
    var marks = sk.map(function (s, i) {
      if (s.ms == null) return '';
      var p = pt(i, rad(s.ms)), a = pt(i, rad(s.hi)), b = pt(i, rad(s.lo));
      return '<line class="err" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>' +
        '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5"><title>' + esc(s.name) + ': ' + sec(s.ms) + ' (' + sec(s.lo) + '–' + sec(s.hi) + '), ' + lvName(s.level) + ', ' + s.n + ' domande</title></circle>';
    }).join('');
    var labels = sk.map(function (s, i) {
      var p = pt(i, 1.07), anchor = Math.abs(p[0] - C) < 5 ? 'middle' : p[0] > C ? 'start' : 'end';
      return '<text class="lbl' + (s.ms == null ? ' nd' : '') + '" x="' + p[0].toFixed(1) + '" y="' + (p[1] + (p[1] < C ? -2 : 10)).toFixed(1) + '" text-anchor="' + anchor + '">' +
        esc(s.name) + ' ' + (s.ms == null ? 'n/d' : sec(s.ms)) + '</text>';
    }).join('');
    var legend = '<div class="legend"><span><i class="sw you"></i>Tu (± errore standard)</span>' + MM.LEVELS.map(function (L, j) {
      return '<span><i class="sw lv' + j + '"></i>' + L.name + ' <small>(≈' + L.classica + ' nella Classica)</small></span>';
    }).join('') + '</div>';
    return '<svg class="radar" viewBox="-90 0 ' + (S + 180) + ' ' + S + '" role="img" aria-label="Tempo per domanda per abilità, con i livelli di riferimento">' + g + lv + area + marks + labels + '</svg>' + legend +
      '<p class="muted"><small>Più lontano dal centro = più veloce. Il tuo tempo è una media pesata: ogni settimana i dati vecchi contano la metà. I livelli sono stime, non norme pubblicate.</small></p>';
  }
  // Table view: every ladder step with its time, level and a drill. ★ = next step of that operation.
  function stepTable(st) {
    var nxt = MM.nextSteps(st).map(function (s) { return s.id; });
    var rows = '', last = null;
    st.forEach(function (s) {
      if (s.skill !== last) { last = s.skill; rows += '<tr class="grp"><th colspan="6">' + esc(MM.SKILLS.filter(function (k) { return k.id === s.skill; })[0].name) + '</th></tr>'; }
      rows += '<tr' + (nxt.indexOf(s.id) >= 0 ? ' class="next"' : '') + '><td>' + (nxt.indexOf(s.id) >= 0 ? '★ ' : '') + esc(s.name) + '</td><td>' +
        (s.ms == null ? '' : sec(s.ms) + ' <small>(' + sec(s.lo) + '–' + sec(s.hi) + ')</small>') + '</td><td>' + s.n + '</td><td>' + (s.n ? Math.round(100 * s.slip) + '%' : '') + '</td><td>' + lvName(s.level) +
        '</td><td><button' + (nxt.indexOf(s.id) >= 0 ? ' class="primary"' : '') + ' data-drill="' + esc(s.id) + '">Allenati</button></td></tr>';
    });
    return '<div class="scroll"><table class="skills"><tr><th>Passo</th><th>Tempo</th><th>N</th><th title="Domande con almeno un errore di battitura">Errori</th><th>Livello</th><th></th></tr>' + rows + '</table></div>' +
      '<p class="muted"><small>★ = prossimo passo: il primo di ogni operazione non ancora ad Avanzato. Livello Avanzato di un passo = ' + MM.LEVELS[2].k + ' × il suo tempo di riferimento.</small></p>';
  }
  function nextHtml() {
    if (!db.qs.length) return '';
    return MM.nextSteps(MM.stepScores(db.qs)).map(function (s) {
      return '<div class="gap step"><span><b>' + esc(s.name) + '</b><br><small>' + (s.ms == null ? 'pochi dati: prova questo passo' : sec(s.ms) + ' ora, ' + lvName(s.level) + '; Avanzato = ' + sec(s.base * MM.LEVELS[2].k)) + '</small></span>' +
        '<button class="primary" data-drill="' + esc(s.id) + '">Allenati</button></div>';
    }).join('');
  }
  function renderHome() {
    var h = gapsHtml(3), p = nextHtml();
    $('#gaps-short').innerHTML = (p ? '<h2>Prossimi passi</h2>' + p : '') + (h ? '<h2>Da migliorare</h2>' + h : '') + (db.sessions.length ? '' : '<p class="muted">Gioca qualche partita: il sito trova da solo dove sei più lento e ti propone esercizi mirati.</p>');
  }
  // Stats are built on questions, not games: every answered question is one data point, grouped by what it is
  // (its ladder step, or its table fact), never by the mode it came from (a mode mixes several kinds of question).
  function renderStats() {
    var sk = MM.skillScores(db.qs), st = MM.stepScores(db.qs);
    $('#radar').innerHTML = sk.some(function (s) { return s.ms != null; }) ? radarSvg(sk) + stepTable(st) : '<p class="muted">Ancora pochi dati: fai il test delle abilità.</p>';
    $('#steps').innerHTML = stepCharts(st);
    $('#facts').innerHTML = factsHtml();
    $('#gaps-full').innerHTML = gapsHtml(20) || '<p class="muted">Nessuna lacuna trovata (o pochi dati: gioca ancora).</p>';
    // summary of every mode (also imported games, which have scores only): the launcher for "Gioca"
    var keys = [], last = {};
    db.sessions.slice().reverse().forEach(function (s) { if (keys.indexOf(s.key) < 0) { keys.push(s.key); last[s.key] = s; } });
    var count = function (k) { return db.sessions.filter(function (s) { return s.key === k; }).length; };
    keys.sort(function (a, b) { return count(b) - count(a); }); // most played first
    playCfgs = keys.map(function (k) { return last[k].cfg; });
    var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    var rows = keys.map(function (k, i) {
      var sc = db.sessions.filter(function (s) { return s.key === k; }).map(function (s) { return s.score; });
      return '<tr><td>' + esc(last[k].name) + '</td><td>' + sc.length + '</td><td>' + sc[sc.length - 1] + '</td><td>' +
        mean(sc.slice(-10)).toFixed(1) + '</td><td>' + Math.max.apply(null, sc) + '</td><td><button data-play="' + i + '">Gioca</button></td></tr>';
    }).join('');
    $('#summary').innerHTML = rows ? '<div class="scroll"><table><tr><th>Modalità</th><th>Partite</th><th>Ultima</th><th title="Media delle ultime 10 partite">Media 10</th><th>Record</th><th></th></tr>' + rows + '</table></div>' : '<p class="muted">Ancora nessuna partita.</p>';
    $('#classic').innerHTML = classicHtml();
  }
  var playCfgs = [];
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-play]'); if (b) start(playCfgs[b.dataset.play]); });
  var dd = function (t) { return new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }); };

  // Small multiples, one per ladder step: a dot per question, the median of the last 25 as the line, the step's
  // 4 level times as dashed lines. Same log time axis on every panel (0.5-20 s), so panels compare.
  var YMIN = 500, YMAX = 20000;
  function stepCharts(st) {
    var by = {};
    db.qs.forEach(function (q) { if (q.ms) { var k = MM.stepOf(q); (by[k] = by[k] || []).push(q); } });
    var panels = st.filter(function (s) { return (by[s.id] || []).length >= 5; }).map(function (s) {
      var l = by[s.id], n = l.length, W = 320, H = 150, L = 34, R = 8, T = 8, B = 18;
      var x = function (i) { return L + (n === 1 ? 0 : i * (W - L - R) / (n - 1)); };
      var y = function (ms) { return T + (H - T - B) * (1 - Math.log(Math.min(YMAX, Math.max(YMIN, ms)) / YMIN) / Math.log(YMAX / YMIN)); };
      var hl = function (ms, cls, tip) { return '<line class="' + cls + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(ms).toFixed(1) + '" y2="' + y(ms).toFixed(1) + '">' + (tip ? '<title>' + tip + '</title>' : '') + '</line>'; };
      var g = [1000, 2000, 5000, 10000].map(function (ms) { return hl(ms, 'grid') + '<text x="' + (L - 4) + '" y="' + (y(ms) + 3).toFixed(1) + '" text-anchor="end">' + ms / 1000 + ' s</text>'; }).join('');
      // day boundaries (faint) with a date label when there is room
      var days = '', lastX = -99;
      l.forEach(function (q, i) {
        if (i && dd(q.s) === dd(l[i - 1].s)) return;
        var xx = x(i);
        if (i) days += '<line class="day" x1="' + xx.toFixed(1) + '" x2="' + xx.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
        if (xx - lastX > 40 && xx < W - R - 20) { days += '<text x="' + xx.toFixed(1) + '" y="' + (H - 5) + '">' + dd(q.s) + '</text>'; lastX = xx; }
      });
      var lv = MM.LEVELS.map(function (Lv, j) { return hl(s.base * Lv.k, 'lv lv' + j, Lv.name + ': ' + sec(s.base * Lv.k)); }).join('');
      var dots = l.map(function (q, i) {
        return '<circle' + (q.skip ? ' class="skip"' : '') + ' cx="' + x(i).toFixed(1) + '" cy="' + y(q.ms).toFixed(1) + '" r="2.2"><title>' + dd(q.s) + ': ' + esc(q.x + ' ' + (q.op === '-' ? '−' : q.op) + ' ' + q.y) + ', ' + sec(q.ms) + (q.skip ? ' (saltata)' : q.slip ? ' (con errore)' : '') + '</title></circle>';
      }).join('');
      var w = Math.min(25, n), line = n < 10 ? '' : '<path d="M' + l.slice(w - 1).map(function (q, k) {
        var i = k + w - 1; return x(i).toFixed(1) + ',' + y(MM.median(l.slice(i - w + 1, i + 1).map(function (z) { return z.ms; }))).toFixed(1);
      }).join('L') + '"/>';
      return '<div class="panel"><h3>' + esc(s.name) + '</h3><small class="muted">' + (s.ms ? 'ora ' + sec(s.ms) + ', ' + lvName(s.level) + ' · ' : '') + n + ' domande</small>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tempo per domanda: ' + esc(s.name) + '">' + g + days + lv + dots + line + '</svg></div>';
    });
    if (!panels.length) return '<p class="muted">Ancora pochi dati.</p>';
    return '<div class="legend"><span><i class="sw dot"></i>una domanda</span><span><i class="sw med"></i>mediana delle ultime 25</span>' +
      MM.LEVELS.map(function (Lv, j) { return '<span><i class="sw lv' + j + '"></i>' + Lv.name + '</span>'; }).join('') + '</div><div class="charts">' + panels.join('') + '</div>';
  }

  // Heatmap of the table facts: one cell per fact (7×8 and 8×7 together; for ÷, divisor × quotient), colour = time,
  // one hue on a log scale from 0.8 s to 3 s, shared by × and ÷. Grey = fewer than 3 questions.
  var FMIN = 800, FMAX = 3000;
  function factsHtml() {
    var now = Date.now(), grids = ['×', '÷'].map(function (op) {
      var f = {};
      db.qs.forEach(function (q) {
        if (!q.ms || q.op !== op || MM.stepOf(q) !== op + ':t') return;
        var a = op === '×' ? [+q.x, +q.y] : [+q.y, +q.x / +q.y], k = Math.min(a[0], a[1]) + '×' + Math.max(a[0], a[1]);
        (f[k] = f[k] || []).push(q);
      });
      if (!Object.keys(f).length) return '';
      var head = '<tr><th>' + op + '</th>' + [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (j) { return '<th>' + j + '</th>'; }).join('') + '</tr>';
      var rows = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (i) {
        return '<tr><th>' + i + '</th>' + [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (j) {
          var l = f[Math.min(i, j) + '×' + Math.max(i, j)] || [], e = MM.estimate(l, now, 3), fact = op === '×' ? i + ' × ' + j : (i * j) + ' ÷ ' + i;
          if (e.ms == null) return '<td class="na" title="' + fact + ': ' + l.length + ' domande"></td>';
          var p = Math.max(0, Math.min(1, Math.log(e.ms / FMIN) / Math.log(FMAX / FMIN))), mix = Math.round(8 + 92 * p);
          return '<td style="background:color-mix(in oklab, var(--accent) ' + mix + '%, var(--card))' + (mix > 55 ? ';color:var(--bg)' : '') + '" title="' + fact + ': ' + sec(e.ms) + ', ' + l.length + ' domande">' + (e.ms / 1000).toFixed(1) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      return '<div class="scroll"><table class="heat">' + head + rows + '</table></div>';
    }).filter(Boolean);
    if (!grids.length) return '<p class="muted">Ancora nessuna tabellina.</p>';
    return '<div class="facts">' + grids.join('') + '</div><div class="legend"><span>' + sec(FMIN) + ' <i class="ramp"></i> ' + sec(FMAX) + ' o più</span><span><i class="sw na"></i>meno di 3 domande</span></div>';
  }

  // Classica: score per game (dots) and mean of each day (line); the only per-mode chart, comparable with the past.
  function classicHtml() {
    var ss = db.sessions.filter(function (s) { return s.key === MM.modeKey(MM.PRESETS.classica); });
    if (!ss.length) return '<p class="muted">Ancora nessuna partita Classica.</p>';
    var W = 640, H = 180, L = 34, B = 22, T = 14, max = Math.max.apply(null, ss.map(function (s) { return s.score; })) || 1;
    var x = function (i) { return L + (ss.length === 1 ? (W - L - 10) / 2 : i * (W - L - 10) / (ss.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var days = [], cur = null;
    ss.forEach(function (s, i) { var d = s.t.slice(0, 10); if (!cur || cur.d !== d) days.push(cur = { d: d, i: [], sum: 0 }); cur.i.push(i); cur.sum += s.score; });
    var line = days.map(function (d) { return x((d.i[0] + d.i[d.i.length - 1]) / 2).toFixed(1) + ',' + y(d.sum / d.i.length).toFixed(1); });
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Punti a partita nella Classica">' +
      '<line class="ax" x1="' + L + '" x2="' + (W - 10) + '" y1="' + y(0) + '" y2="' + y(0) + '"/><line class="ax" x1="' + L + '" x2="' + (W - 10) + '" y1="' + y(max) + '" y2="' + y(max) + '"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(0) + 4) + '" text-anchor="end">0</text><text x="' + (L - 6) + '" y="' + (y(max) + 4) + '" text-anchor="end">' + max + '</text>' +
      '<text x="' + L + '" y="' + (H - 4) + '">partita 1</text><text x="' + (W - 10) + '" y="' + (H - 4) + '" text-anchor="end">partita ' + ss.length + '</text>' +
      ss.map(function (s, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(s.score).toFixed(1) + '" r="3"><title>' + s.t.slice(0, 10) + ': ' + s.score + '</title></circle>'; }).join('') +
      (line.length > 1 ? '<path d="M' + line.join('L') + '"/>' : '') + '</svg>';
    var list = '<details><summary>Tutte le partite (' + ss.length + ')</summary><table><tr><th>Data</th><th>Punti</th></tr>' + ss.slice().reverse().map(function (s) {
      // imported games have no real time of day: date only
      return '<tr><td>' + esc(new Date(s.t).toLocaleString('it-IT', s.src ? { dateStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' })) + (s.src ? ' <small>(importata)</small>' : '') + '</td><td>' + s.score + '</td></tr>';
    }).join('') + '</table></details>';
    return '<div class="mode">' + svg + list + '</div>';
  }

  $('#export').addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: 'application/json' }));
    a.download = 'mental-math-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  });
  $('#import').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (txt) {
      var d = JSON.parse(txt);
      if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.qs)) throw new Error('formato');
      // merge, skipping sessions already present
      var have = {}; db.sessions.forEach(function (s) { have[s.id] = 1; });
      d.sessions.forEach(function (s) { if (!have[s.id]) db.sessions.push(s); });
      d.qs.forEach(function (q) { if (!have[q.s]) db.qs.push(q); });
      db.sessions.sort(function (a, b) { return a.id - b.id; });
      save(); renderStats();
    }).catch(function () { alert('File non valido.'); });
    e.target.value = '';
  });
  $('#wipe').addEventListener('click', function () {
    if (confirm('Cancellare tutte le statistiche di questo browser? Non si può annullare (esporta prima, se vuoi tenerle).')) { db = { v: 1, sessions: [], qs: [] }; save(); renderStats(); }
  });

  addEventListener('load', function () { if (window.SiteNotes && SiteNotes.setContext) SiteNotes.setContext(function () { return { view: ['home', 'play', 'result', 'stats'].filter(function (v) { return !$('#' + v).hidden; })[0], mode: current && current.name }; }); });
  show('home');
})();
