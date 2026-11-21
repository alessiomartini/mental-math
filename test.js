// node test.js  -> prints "ok" or throws
const assert = require('assert');
const M = require('./core.js');

assert.strictEqual(M.fmt(450, 2), '4.5');
assert.strictEqual(M.fmt(300, 2), '3');
assert.strictEqual(M.fmt(5, 1), '0.5');
assert.strictEqual(M.carries(58, 67), 2);
assert.strictEqual(M.carries(12, 31), 0);

assert.ok(M.isRight('4,5', '4.5'));
assert.ok(!M.isRight('4.', '4'));
assert.ok(!M.isRight('', '0'));
assert.ok(M.isPrefix('4,', '4.52'));
assert.ok(!M.isPrefix('5', '4.52'));

// every generated answer is consistent and non-negative, for every preset
for (const k of Object.keys(M.PRESETS)) {
  const c = M.PRESETS[k];
  for (let i = 0; i < 2000; i++) {
    const q = M.nextQ(c), x = Number(q.x), y = Number(q.y), a = Number(q.ans);
    const exp = { '+': x + y, '-': x - y, '×': x * y, '÷': x / y }[q.op];
    assert.ok(Math.abs(exp - a) < 1e-9, k + ' ' + JSON.stringify(q));
    assert.ok(a >= 0);
  }
}

// focus is honoured
const d7 = M.drill('×7');
for (let i = 0; i < 200; i++) assert.ok(M.nextQ(d7).f === 7);
const c2 = M.drill('+c2');
for (let i = 0; i < 200; i++) assert.ok(M.nextQ(c2).tags.includes('+c2'));

// analysis finds a slow ×7 and nothing else
const qs = [];
for (let f = 2; f <= 12; f++) for (let i = 0; i < 20; i++) qs.push({ op: '×', tags: ['×', '×' + f], ms: f === 7 ? 4000 : 1500, slip: false });
const gaps = M.analyse(qs);
assert.deepStrictEqual(gaps.map(g => g.tag), ['×7']);
// time that depends only on answer length (Classica + Numeri grandi mixed) is not a gap
const big = [];
for (const k of ['classica', 'grandi', 'estese']) for (let i = 0; i < 3000; i++) {
  const q = M.nextQ(M.PRESETS[k]);
  big.push({ op: q.op, tags: q.tags, al: q.al, ms: 500 * q.al, slip: false });
}
assert.deepStrictEqual(M.analyse(big).map(g => g.tag), []);
// ladder: every step's drill produces only questions of that step, never the same question twice in a row
assert.strictEqual(M.testQueue().length, M.STEPS.length * 2);
for (const s of M.STEPS) { let p = null; for (let i = 0; i < 300; i++) { const q = M.nextQ(M.drill(s.id), null, p); assert.strictEqual(M.stepOf(q), s.id, s.id); assert.ok(!p || q.x + q.op + q.y !== p.x + p.op + p.y); p = q; } }
// every preset's questions land on a step with a skill
for (const k of Object.keys(M.PRESETS)) for (let i = 0; i < 300; i++) { const q = M.nextQ(M.PRESETS[k]); assert.ok(M.SKILLS.some(s => s.id === M.skillOf(q)), k + JSON.stringify(q) + M.skillOf(q)); }
// old saved questions (no step tag) get the step from their operands: 58+67 has 2 carries, 7×86 carries 4, 96÷8 is a table
assert.ok(M.tagsFor({ op: '+', x: '58', y: '67', tags: ['+', '+c2'] }).includes('+:2'));
assert.ok(M.tagsFor({ op: '×', x: '7', y: '86', tags: ['×', '×7'] }).includes('×:2'));
assert.strictEqual(M.stepOf({ op: '÷', x: '96', y: '8' }), '÷:t');
assert.strictEqual(M.stepOf({ op: '-', x: '15', y: '7' }), '-:f');
// estimate: same times -> that time with no spread; old questions weigh less; too few -> null
const now = Date.now(), day = 864e5;
const e1 = M.estimate([...Array(10)].map(() => ({ ms: 2000, s: now })), now);
assert.ok(Math.abs(e1.ms - 2000) < 1e-6 && Math.abs(e1.hi - e1.lo) < 1e-6);
const e2 = M.estimate([...Array(10)].map(() => ({ ms: 4000, s: now - 70 * day })).concat([...Array(10)].map(() => ({ ms: 1000, s: now }))), now);
assert.ok(e2.ms < 1100, e2.ms);
assert.strictEqual(M.estimate([{ ms: 1, s: now }], now).ms, null);
// levels: tables at 1 s = Intermedio (base 1000 × 1.125), at 0.5 s = Pro, at 3 s = below Principiante
assert.strictEqual(M.levelOf(1000, 1000), 1);
assert.strictEqual(M.levelOf(500, 1000), 3);
assert.strictEqual(M.levelOf(3000, 1000), -1);
// carry tags for 1-digit x 2-digit: 7×86 (7×6=42 -> carry 4), 3×21 (no carry), tables tagged by factor
const r2 = M.drill('×r2');
for (let i = 0; i < 200; i++) { const q = M.nextQ(r2); assert.ok(Math.floor(Number(q.x) * (Number(q.y) % 10) / 10) >= 4, q.x + 'x' + q.y); }
const r0d = M.drill('÷r0');
for (let i = 0; i < 100; i++) { const q = M.nextQ(r0d); assert.strictEqual(q.op, '÷'); assert.ok(q.tags.includes('÷r0')); }
assert.ok(M.nextQ(M.PRESETS.tabelline).tags.some(t => /^[×÷]\d+$/.test(t)));
console.log('ok');
