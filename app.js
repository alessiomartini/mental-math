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
    show('play'); input.value = ''; input.focus();
    $('#score').textContent = 0;
    next(); tick();
  }
  function next() {
    game.q = MM.nextQ(game.cfg); game.shown = performance.now(); game.slip = false;
    $('#question').textContent = game.q.x + ' ' + (game.q.op === '-' ? '−' : game.q.op) + ' ' + game.q.y;
    input.value = '';
  }
  function tick() {
    if (!game) return;
    var left = Math.max(0, Math.ceil((game.end - Date.now()) / 1000));
    $('#time').textContent = left;
    if (left <= 0) return finish();
    setTimeout(tick, 200);
  }
  input.addEventListener('input', function () {
    if (!game) return;
    var q = game.q;
    if (MM.isRight(input.value, q.ans)) {
      game.qs.push({ op: q.op, x: q.x, y: q.y, ms: Math.round(performance.now() - game.shown), slip: game.slip, tags: q.tags });
      game.score++; $('#score').textContent = game.score;
      next();
    } else if (!MM.isPrefix(input.value, q.ans)) game.slip = true;
  });
  input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && game) { game = null; show('home'); } });
  function finish() {
    var g = game; game = null;
    var key = MM.modeKey(g.cfg), prev = db.sessions.filter(function (s) { return s.key === key; });
    var best = prev.reduce(function (m, s) { return Math.max(m, s.score); }, 0);
    var id = Date.now();
    db.sessions.push({ id: id, t: new Date().toISOString(), name: g.cfg.name, key: key, cfg: g.cfg, score: g.score });
    g.qs.forEach(function (q) { q.s = id; db.qs.push(q); });
    save();
    lastCfg = g.cfg;
    $('#res-score').textContent = 'Punteggio: ' + g.score;
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
      return '<div class="gap"><span><b>' + esc(MM.label(x.tag)) + '</b><br><small>' + (x.ms / 1000).toFixed(1) + ' s (mediana) contro ' + (x.opMs / 1000).toFixed(1) +
        ' s per le ' + MM.OPNAME[x.tag.charAt(0)] + ' in generale' + (x.slip >= 0.2 ? ', ' + Math.round(x.slip * 100) + '% con errori' : '') + ' · ' + x.n + ' domande</small></span>' +
        '<button class="primary" data-drill="' + esc(x.tag) + '">Allenati</button></div>';
    }).join('');
  }
  function renderHome() {
    var h = gapsHtml(3);
    $('#gaps-short').innerHTML = h ? '<h2>Da migliorare</h2>' + h : (db.sessions.length ? '' : '<p class="muted">Gioca qualche partita: il sito trova da solo dove sei più lento e ti propone esercizi mirati.</p>');
  }
  function renderStats() {
    $('#gaps-full').innerHTML = gapsHtml(20) || '<p class="muted">Nessuna lacuna trovata (o pochi dati: gioca ancora).</p>';
    // modes, most recent first
    var keys = [], names = {};
    db.sessions.slice().reverse().forEach(function (s) { if (keys.indexOf(s.key) < 0) { keys.push(s.key); names[s.key] = s.name; } });
    var pick = $('#mode-pick'), was = pick.value;
    pick.innerHTML = keys.map(function (k) { return '<option value="' + esc(k) + '">' + esc(names[k]) + ' (' + db.sessions.filter(function (s) { return s.key === k; }).length + ')</option>'; }).join('');
    if (keys.indexOf(was) >= 0) pick.value = was;
    renderMode();
    // per operation
    var ops = ['+', '-', '×', '÷'].map(function (op) {
      var l = db.qs.filter(function (q) { return q.op === op; }).slice(-1000);
      if (!l.length) return '';
      return '<tr><td>' + op + '</td><td>' + l.length + '</td><td>' + (MM.median(l.map(function (q) { return q.ms; })) / 1000).toFixed(2) + ' s</td><td>' +
        Math.round(100 * l.filter(function (q) { return q.slip; }).length / l.length) + '%</td></tr>';
    }).join('');
    $('#ops').innerHTML = ops ? '<table><tr><th>Op.</th><th>Domande (ultime 1000)</th><th>Tempo mediano</th><th>Con errori</th></tr>' + ops + '</table>' : '<p class="muted">Ancora nessun dato.</p>';
  }
  function renderMode() {
    var k = $('#mode-pick').value, ss = db.sessions.filter(function (s) { return s.key === k; });
    if (!ss.length) { $('#chart').innerHTML = ''; $('#sessions').innerHTML = '<p class="muted">Ancora nessuna partita.</p>'; return; }
    // single series: score per game, in order. One axis, thin line, markers with native tooltip.
    var W = 640, H = 200, L = 34, B = 22, T = 10, max = Math.max.apply(null, ss.map(function (s) { return s.score; })) || 1;
    var x = function (i) { return L + (ss.length === 1 ? (W - L - 10) / 2 : i * (W - L - 10) / (ss.length - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var pts = ss.map(function (s, i) { return [x(i), y(s.score), s]; });
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Punteggi nel tempo">' +
      '<line class="ax" x1="' + L + '" x2="' + (W - 10) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' +
      '<line class="ax" x1="' + L + '" x2="' + (W - 10) + '" y1="' + y(max) + '" y2="' + y(max) + '"/>' +
      '<text x="' + (L - 6) + '" y="' + (y(0) + 4) + '" text-anchor="end">0</text><text x="' + (L - 6) + '" y="' + (y(max) + 4) + '" text-anchor="end">' + max + '</text>' +
      '<text x="' + L + '" y="' + (H - 4) + '">partita 1</text><text x="' + (W - 10) + '" y="' + (H - 4) + '" text-anchor="end">partita ' + ss.length + '</text>' +
      (pts.length > 1 ? '<path d="M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + '"/>' : '') +
      pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"><title>' + p[2].t.slice(0, 16).replace('T', ' ') + ': ' + p[2].score + '</title></circle>'; }).join('') +
      '</svg>';
    $('#chart').innerHTML = svg;
    $('#sessions').innerHTML = '<table><tr><th>Data</th><th>Punti</th></tr>' + ss.slice().reverse().slice(0, 30).map(function (s) {
      return '<tr><td>' + esc(new Date(s.t).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })) + '</td><td>' + s.score + '</td></tr>';
    }).join('') + '</table>';
  }
  $('#mode-pick').addEventListener('change', renderMode);

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
