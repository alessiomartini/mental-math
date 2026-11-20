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
// test questions: every skill's generator produces questions classified as that skill
const tq = M.testQueue();
assert.strictEqual(tq.length, M.SKILLS.length * 6);
for (const s of M.SKILLS) for (let i = 0; i < 500; i++) assert.strictEqual(M.skillOf(M.nextQ(s.cfg)), s.id, s.id);
// classic questions all get a skill too
for (let i = 0; i < 500; i++) { const k = M.skillOf(M.nextQ(M.PRESETS.classica)); assert.ok(M.SKILLS.some(s => s.id === k)); }
// scores: at target -> 100, twice the target -> 50, too few -> null
const sc = M.skillScores([...Array(10)].map(() => ({ skill: 'add', ms: 1800 })).concat([...Array(10)].map(() => ({ skill: 'tab', ms: 2000 }))));
assert.strictEqual(sc.find(s => s.id === 'add').score, 100);
assert.strictEqual(sc.find(s => s.id === 'tab').score, 50);
assert.strictEqual(sc.find(s => s.id === 'dec').score, null);
// carry tags for 1-digit x 2-digit: 7×86 (7×6=42 -> carry 4), 3×21 (no carry), tables tagged by factor
const r2 = M.drill('×r2');
for (let i = 0; i < 200; i++) { const q = M.nextQ(r2); assert.ok(Math.floor(Number(q.x) * (Number(q.y) % 10) / 10) >= 4, q.x + 'x' + q.y); }
const r0d = M.drill('÷r0');
for (let i = 0; i < 100; i++) { const q = M.nextQ(r0d); assert.strictEqual(q.op, '÷'); assert.ok(q.tags.includes('÷r0')); }
assert.ok(M.nextQ(M.PRESETS.tabelline).tags.some(t => /^[×÷]\d+$/.test(t)));
console.log('ok');
