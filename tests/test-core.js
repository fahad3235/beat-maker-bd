/* Beat Maker BD — Node unit tests for core.js. Run: node tests/test-core.js */
'use strict';
const assert = require('node:assert');
const C = require('../core.js');

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('ok  - ' + name); }
  catch (e) { console.error('FAIL - ' + name + ': ' + e.message); process.exitCode = 1; }
}

/* emptyPattern / clone */
check('emptyPattern is 4x16 all false', () => {
  const p = C.emptyPattern();
  assert.strictEqual(p.length, 4);
  p.forEach(row => { assert.strictEqual(row.length, 16); assert.ok(row.every(v => v === false)); });
});
check('clonePattern is a deep copy', () => {
  const p = C.emptyPattern(); p[0][0] = true;
  const q = C.clonePattern(p);
  q[0][0] = false;
  assert.strictEqual(p[0][0], true);
});

/* validatePattern */
check('validatePattern accepts a good pattern', () => {
  assert.deepStrictEqual(C.validatePattern(C.emptyPattern()), { ok: true, error: null });
});
check('validatePattern rejects wrong track count', () => {
  assert.strictEqual(C.validatePattern([[], [], []]).ok, false);
});
check('validatePattern rejects wrong step count', () => {
  const p = C.emptyPattern(); p[0] = p[0].slice(0, 15);
  assert.strictEqual(C.validatePattern(p).ok, false);
});
check('validatePattern rejects non-boolean cell', () => {
  const p = C.emptyPattern(); p[1][3] = 1;
  assert.strictEqual(C.validatePattern(p).ok, false);
});
check('validatePattern rejects non-array', () => {
  assert.strictEqual(C.validatePattern('nope').ok, false);
  assert.strictEqual(C.validatePattern(null).ok, false);
});

/* toggleStep */
check('toggleStep flips a cell and leaves the original alone', () => {
  const p = C.emptyPattern();
  const q = C.toggleStep(p, 2, 5);
  assert.strictEqual(q[2][5], true);
  assert.strictEqual(p[2][5], false);
  const r = C.toggleStep(q, 2, 5);
  assert.strictEqual(r[2][5], false);
});
check('toggleStep throws on bad track/step', () => {
  const p = C.emptyPattern();
  assert.throws(() => C.toggleStep(p, 4, 0), /invalid-track/);
  assert.throws(() => C.toggleStep(p, -1, 0), /invalid-track/);
  assert.throws(() => C.toggleStep(p, 0, 16), /invalid-step/);
  assert.throws(() => C.toggleStep(p, 0, 1.5), /invalid-step/);
});

/* countHits */
check('countHits counts set steps', () => {
  const p = C.emptyPattern(); p[0][0] = true; p[3][15] = true; p[1][4] = true;
  assert.strictEqual(C.countHits(p), 3);
  assert.strictEqual(C.countHits(C.emptyPattern()), 0);
});

/* tempo math */
check('bpmToStepMs(120) = 125ms', () => {
  assert.strictEqual(C.bpmToStepMs(120), 125);
});
check('bpmToStepMs(60) = 250ms; (180) = 83.33ms', () => {
  assert.strictEqual(C.bpmToStepMs(60), 250);
  assert.ok(Math.abs(C.bpmToStepMs(180) - 83.3333333) < 0.001);
});
check('bpmToStepMs throws outside 60..180', () => {
  assert.throws(() => C.bpmToStepMs(59), /invalid-bpm/);
  assert.throws(() => C.bpmToStepMs(181), /invalid-bpm/);
  assert.throws(() => C.bpmToStepMs(NaN), /invalid-bpm/);
});

/* swing */
check('swingDelayMs is 0 on even steps', () => {
  assert.strictEqual(C.swingDelayMs(0, 120, 0.5), 0);
  assert.strictEqual(C.swingDelayMs(14, 120, 0.6), 0);
});
check('swingDelayMs(1, 120, 0.5) = 62.5ms', () => {
  assert.strictEqual(C.swingDelayMs(1, 120, 0.5), 62.5);
});
check('swingDelayMs throws on bad swing/step', () => {
  assert.throws(() => C.swingDelayMs(1, 120, 0.61), /invalid-swing/);
  assert.throws(() => C.swingDelayMs(1, 120, -0.1), /invalid-swing/);
  assert.throws(() => C.swingDelayMs(16, 120, 0.2), /invalid-step/);
});

/* nextStep */
check('nextStep wraps 15 -> 0', () => {
  assert.strictEqual(C.nextStep(15), 0);
  assert.strictEqual(C.nextStep(0), 1);
  assert.throws(() => C.nextStep(16), /invalid-step/);
});

/* presets */
check('all presets are valid, non-empty, and distinct', () => {
  const names = Object.keys(C.PRESETS);
  assert.strictEqual(names.length, 4);
  const seen = new Set();
  names.forEach(n => {
    const p = C.PRESETS[n];
    assert.strictEqual(C.validatePattern(p).ok, true, n);
    assert.ok(C.countHits(p) > 0, n + ' has hits');
    seen.add(JSON.stringify(p));
  });
  assert.strictEqual(seen.size, 4, 'presets are distinct');
});
check('four-on-floor kick is on 0,4,8,12 only', () => {
  const p = C.PRESETS['four-on-floor'];
  assert.deepStrictEqual(p[0].map((v, i) => (v ? i : -1)).filter(i => i >= 0), [0, 4, 8, 12]);
});

/* randomPattern */
check('randomPattern is valid and deterministic for a seeded rng', () => {
  let seed = 42;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const a = C.randomPattern(rng);
  seed = 42;
  const b = C.randomPattern(rng);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(C.validatePattern(a).ok, true);
  assert.ok(C.countHits(a) >= 4);
});
check('randomPattern guarantees >= 4 hits even for an all-zero rng', () => {
  const p = C.randomPattern(() => 0.999999);
  assert.ok(C.countHits(p) >= 4);
  assert.strictEqual(C.validatePattern(p).ok, true);
});
check('randomPattern throws without an rng', () => {
  assert.throws(() => C.randomPattern(), /rng-required/);
});

/* envelope */
function goodEnvelope() {
  return {
    app: 'beat-maker-bd', version: 1, bpm: 120, swing: 0.2,
    pattern: C.PRESETS['boom-bap'],
    saved: [{ name: 'My beat', pattern: C.emptyPattern(), createdAt: 1700000000000 }]
  };
}
check('validateEnvelope accepts a good envelope', () => {
  assert.strictEqual(C.validateEnvelope(goodEnvelope()).ok, true);
});
check('validateEnvelope accepts an envelope without saved', () => {
  const e = goodEnvelope(); delete e.saved;
  assert.strictEqual(C.validateEnvelope(e).ok, true);
});
check('validateEnvelope rejects wrong app/version', () => {
  const a = goodEnvelope(); a.app = 'other-app';
  assert.strictEqual(C.validateEnvelope(a).ok, false);
  const b = goodEnvelope(); b.version = 2;
  assert.strictEqual(C.validateEnvelope(b).ok, false);
});
check('validateEnvelope rejects bad pattern/bpm/swing', () => {
  const a = goodEnvelope(); a.pattern = [[true]];
  assert.strictEqual(C.validateEnvelope(a).ok, false);
  const b = goodEnvelope(); b.bpm = 300;
  assert.strictEqual(C.validateEnvelope(b).ok, false);
  const c = goodEnvelope(); c.swing = 0.9;
  assert.strictEqual(C.validateEnvelope(c).ok, false);
});
check('validateEnvelope rejects a bad saved entry', () => {
  const a = goodEnvelope(); a.saved = [{ name: '', pattern: C.emptyPattern(), createdAt: 1 }];
  assert.strictEqual(C.validateEnvelope(a).ok, false);
  const b = goodEnvelope(); b.saved = [{ name: 'x'.repeat(41), pattern: C.emptyPattern(), createdAt: 1 }];
  assert.strictEqual(C.validateEnvelope(b).ok, false);
});
check('validateEnvelope rejects non-objects', () => {
  assert.strictEqual(C.validateEnvelope(null).ok, false);
  assert.strictEqual(C.validateEnvelope('json').ok, false);
});
check('buildEnvelope round-trips through validateEnvelope', () => {
  const env = C.buildEnvelope({ bpm: 140, swing: 0.3, pattern: C.PRESETS['dhol-groove'], saved: [] });
  assert.strictEqual(C.validateEnvelope(env).ok, true);
  assert.strictEqual(env.app, 'beat-maker-bd');
  assert.strictEqual(env.version, 1);
  assert.strictEqual(env.bpm, 140);
});

console.log(passed + ' unit tests passed');
