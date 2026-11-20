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
    } else game.q = MM.nextQ(game.cfg);
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
    var sk = g.cfg.test && MM.skillScores(g.qs, 99);
    // test score = mean of the 7 skill scores (0-100)
    if (sk) g.score = Math.round(sk.reduce(function (a, s) { return a + (s.score || 0); }, 0) / sk.length);
    $('#res-radar').innerHTML = sk ? radarSvg(sk) + skillTable(sk) : '';
    var key = MM.modeKey(g.cfg), prev = db.sessions.filter(function (s) { return s.key === key; });
    var best = prev.reduce(function (m, s) { return Math.max(m, s.score); }, 0);
    var id = Date.now();
    db.sessions.push({ id: id, t: new Date().toISOString(), name: g.cfg.name, key: key, cfg: g.cfg, score: g.score });
    g.qs.forEach(function (q) { q.s = id; db.qs.push(q); });
    save();
    lastCfg = g.cfg;
    $('#res-score').textContent = g.cfg.test ? 'Indice delle abilità: ' + g.score + '/100' : 'Punteggio: ' + g.score;
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
  // Radar (spider) chart: one axis per skill, 0 at the centre, 100 on the outer ring.
  // Single series: no legend; grid rings at 25/50/75/100; skills without data get a muted "n/d" label.
  function radarSvg(sk) {
    var S = 360, C = S / 2, R = 120, n = sk.length;
    var pt = function (i, v) { var a = -Math.PI / 2 + 2 * Math.PI * i / n; return [C + R * v / 100 * Math.cos(a), C + R * v / 100 * Math.sin(a)]; };
    var poly = function (vals) { return vals.map(function (v, i) { var p = pt(i, v); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); };
    var g = [25, 50, 75, 100].map(function (v) { return '<polygon class="ring" points="' + poly(sk.map(function () { return v; })) + '"/>'; }).join('') +
      sk.map(function (s, i) { var p = pt(i, 100); return '<line class="ax" x1="' + C + '" y1="' + C + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; }).join('') +
      '<text class="tick" x="' + (C + 3) + '" y="' + (C - R / 2 + 4) + '">50</text><text class="tick" x="' + (C + 3) + '" y="' + (C - R + 4) + '">100</text>';
    var has = sk.filter(function (s) { return s.score != null; }).length;
    var area = has >= 3 ? '<polygon class="area" points="' + poly(sk.map(function (s) { return s.score || 0; })) + '"/>' : '';
    var dots = sk.map(function (s, i) {
      if (s.score == null) return '';
      var p = pt(i, s.score); return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"><title>' + esc(s.name) + ': ' + s.score + '</title></circle>';
    }).join('');
    var labels = sk.map(function (s, i) {
      var p = pt(i, 128), anchor = Math.abs(p[0] - C) < 5 ? 'middle' : p[0] > C ? 'start' : 'end';
      return '<text class="lbl' + (s.score == null ? ' nd' : '') + '" x="' + p[0].toFixed(1) + '" y="' + (p[1] + (p[1] < C ? -2 : 10)).toFixed(1) + '" text-anchor="' + anchor + '">' +
        esc(s.name) + ' ' + (s.score == null ? 'n/d' : s.score) + '</text>';
    }).join('');
    return '<svg class="radar" viewBox="-90 0 ' + (S + 180) + ' ' + S + '" role="img" aria-label="Abilità">' + g + area + dots + labels + '</svg>';
  }
  // Table view of the same numbers, with a drill for the weakest skills.
  function skillTable(sk) {
    var weak = sk.filter(function (s) { return s.score != null && s.score < 100; }).sort(function (a, b) { return a.score - b.score; }).slice(0, 2).map(function (s) { return s.id; });
    return '<div class="scroll"><table class="skills"><tr><th>Abilità</th><th>Punti</th><th>Mediana</th><th>N</th><th></th></tr>' + sk.map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td><td>' + (s.score == null ? 'n/d' : s.score) + '</td><td>' + (s.ms ? (s.ms / 1000).toFixed(1) + ' s' : '') + '</td><td>' + s.n + '</td><td>' +
        (weak.indexOf(s.id) >= 0 ? '<button class="primary" data-skill="' + s.id + '">Allenati</button>' : '') + '</td></tr>';
    }).join('') + '</table></div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-skill]'); if (!b) return;
    var s = MM.SKILLS.filter(function (x) { return x.id === b.dataset.skill; })[0];
    var c = JSON.parse(JSON.stringify(s.cfg)); c.dur = 120; c.name = 'Allenamento: ' + s.name.toLowerCase();
    setForm(c); show('home'); $('#cfg button[type=submit]').focus();
  });
  function renderHome() {
    var h = gapsHtml(3);
    $('#gaps-short').innerHTML = h ? '<h2>Da migliorare</h2>' + h : (db.sessions.length ? '' : '<p class="muted">Gioca qualche partita: il sito trova da solo dove sei più lento e ti propone esercizi mirati.</p>');
  }
  function renderStats() {
    var sk = MM.skillScores(db.qs, 40);
    $('#radar').innerHTML = sk.some(function (s) { return s.score != null; }) ? radarSvg(sk) + skillTable(sk) : '<p class="muted">Ancora pochi dati: fai il test delle abilità.</p>';
    $('#gaps-full').innerHTML = gapsHtml(20) || '<p class="muted">Nessuna lacuna trovata (o pochi dati: gioca ancora).</p>';
    // every mode on one page, most recent first: summary table, then one chart + game list per mode
    var keys = [], last = {};
    db.sessions.slice().reverse().forEach(function (s) { if (keys.indexOf(s.key) < 0) { keys.push(s.key); last[s.key] = s; } });
    var count = function (k) { return db.sessions.filter(function (s) { return s.key === k; }).length; };
    keys.sort(function (a, b) { return count(b) - count(a); }); // most played first
    playCfgs = keys.map(function (k) { return last[k].cfg; });
    var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    var rows = keys.map(function (k, i) {
      var sc = db.sessions.filter(function (s) { return s.key === k; }).map(function (s) { return s.score; });
      return '<tr><td><a href="#m' + i + '">' + esc(last[k].name) + '</a></td><td>' + sc.length + '</td><td>' + sc[sc.length - 1] + '</td><td>' +
        mean(sc.slice(-10)).toFixed(1) + '</td><td>' + Math.max.apply(null, sc) + '</td><td><button data-play="' + i + '">Gioca</button></td></tr>';
    }).join('');
    $('#summary').innerHTML = rows ? '<table><tr><th>Modalità</th><th>Partite</th><th>Ultima</th><th title="Media delle ultime 10 partite">Media 10</th><th>Record</th><th></th></tr>' + rows + '</table>' : '<p class="muted">Ancora nessuna partita.</p>';
    $('#modes').innerHTML = keys.map(function (k, i) { return modeHtml(k, i, last[k].name); }).join('');
    // per operation
    var ops = ['+', '-', '×', '÷'].map(function (op) {
      var l = db.qs.filter(function (q) { return q.op === op; }).slice(-1000);
      if (!l.length) return '';
      return '<tr><td>' + op + '</td><td>' + l.length + '</td><td>' + (MM.median(l.map(function (q) { return q.ms; })) / 1000).toFixed(2) + ' s</td><td>' +
        Math.round(100 * l.filter(function (q) { return q.slip; }).length / l.length) + '%</td></tr>';
    }).join('');
    $('#ops').innerHTML = ops ? '<table><tr><th>Op.</th><th>Domande (ultime 1000)</th><th>Tempo mediano</th><th>Con errori</th></tr>' + ops + '</table>' : '<p class="muted">Ancora nessun dato.</p>';
  }
  var playCfgs = [];
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-play]'); if (b) start(playCfgs[b.dataset.play]); });
  // series of {t, v, lab?} in order, one dot each. unit 'partita': line = mean of each day.
  // unit 'domanda': line = median of the last 25 questions, y axis capped at the 95th percentile (slower ones sit on the top line).
  function chartSvg(ss, title, fmtV, unit) {
    var W = 640, H = ss.length > 10 ? 180 : 120, L = 40, B = 22, T = 14, vs = ss.map(function (s) { return s.v; });
    var max = (unit === 'domanda' ? vs.slice().sort(function (a, b) { return a - b; })[Math.floor(0.95 * (vs.length - 1))] : Math.max.apply(null, vs)) || 1;
    var x = function (i) { return L + (ss.length === 1 ? (W - L - 10) / 2 : i * (W - L - 10) / (ss.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - Math.min(v, max) / max); };
    var line;
    if (unit === 'domanda') line = ss.length < 25 ? [] : ss.map(function (s, i) { return [x(i), y(MM.median(vs.slice(Math.max(0, i - 24), i + 1)))]; }).slice(24);
    else {
      var days = [], cur = null;
      ss.forEach(function (s, i) { var d = s.t.slice(0, 10); if (!cur || cur.d !== d) days.push(cur = { d: d, i: [], sum: 0 }); cur.i.push(i); cur.sum += s.v; });
      line = days.map(function (d) { return [x((d.i[0] + d.i[d.i.length - 1]) / 2), y(d.sum / d.i.length)]; });
    }
    return '<p class="muted">' + title + '</p><svg' + (line.length > 1 ? '' : ' class="solo"') + ' viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + title + '">' +
      '<line class="ax" x1="' + L + '" x2="' + (W - 10) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' +
      '<line class="ax" x1="' + L + '" x2="' + (W - 10) + '" y1="' + y(max) + '" y2="' + y(max) + '"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(0) + 4) + '" text-anchor="end">0</text><text x="' + (L - 6) + '" y="' + (y(max) + 4) + '" text-anchor="end">' + fmtV(max) + '</text>' +
      '<text x="' + L + '" y="' + (H - 4) + '">' + unit + ' 1</text><text x="' + (W - 10) + '" y="' + (H - 4) + '" text-anchor="end">' + unit + ' ' + ss.length + '</text>' +
      ss.map(function (s, i) { return '<circle class="game" cx="' + x(i).toFixed(1) + '" cy="' + y(s.v).toFixed(1) + '" r="' + (unit === 'domanda' ? 2 : 3) + '"><title>' + s.t.slice(0, 10) + ': ' + (s.lab ? esc(s.lab) + ', ' : '') + fmtV(s.v) + '</title></circle>'; }).join('') +
      (line.length > 1 ? '<path d="M' + line.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + '"/>' : '') +
      '</svg>';
  }
  function modeHtml(k, idx, name) {
    var ss = db.sessions.filter(function (s) { return s.key === k; });
    // one dot per question answered: many more data points than one per game (Alessio, site note 2026-11-20)
    var tOf = {};
    ss.forEach(function (s) { tOf[s.id] = s.t; });
    var tm = db.qs.filter(function (q) { return tOf[q.s] && !q.skip && q.ms; }).map(function (q) { return { t: tOf[q.s], v: q.ms / 1000, lab: q.x + ' ' + q.op + ' ' + q.y }; });
    var sec = function (v) { return v.toFixed(1) + ' s'; };
    var svg = (tm.length ? chartSvg(tm, 'Tempo per domanda; linea = mediana delle ultime 25 (più basso è meglio)', sec, 'domanda') : '') +
      (k === MM.modeKey(MM.PRESETS.classica) || !tm.length ? chartSvg(ss.map(function (s) { return { t: s.t, v: s.score }; }), 'Punti a partita', String, 'partita') : '');
    var list = '<details><summary>Tutte le partite (' + ss.length + ')</summary><table><tr><th>Data</th><th>Punti</th></tr>' + ss.slice().reverse().map(function (s) {
      // imported games have no real time of day: date only
      return '<tr><td>' + esc(new Date(s.t).toLocaleString('it-IT', s.src ? { dateStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' })) + (s.src ? ' <small>(importata)</small>' : '') + '</td><td>' + s.score + '</td></tr>';
    }).join('') + '</table></details>';
    return '<div class="mode" id="m' + idx + '"><h3>' + esc(name) + '</h3>' + svg + list + '</div>';
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
