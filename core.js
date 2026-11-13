/* Beat Maker BD — core.js
 * Pure logic for the 16-step drum sequencer. No DOM, no AudioContext here,
 * so the same code runs in the browser and under Node for unit tests.
 */
(function (root) {
  'use strict';

  var APP_ID = 'beat-maker-bd';
  var VERSION = 1;
  var TRACKS = ['kick', 'snare', 'hihat', 'clap'];
  var STEPS = 16;
  var MIN_BPM = 60;
  var MAX_BPM = 180;
  var MAX_SAVED = 20;

  function emptyPattern() {
    var p = [];
    for (var t = 0; t < TRACKS.length; t++) {
      var row = [];
      for (var s = 0; s < STEPS; s++) row.push(false);
      p.push(row);
    }
    return p;
  }

  function clonePattern(p) {
    return p.map(function (row) { return row.slice(); });
  }

  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  function validatePattern(p) {
    if (!Array.isArray(p)) return { ok: false, error: 'pattern-not-array' };
    if (p.length !== TRACKS.length) return { ok: false, error: 'pattern-track-count' };
    for (var t = 0; t < TRACKS.length; t++) {
      if (!Array.isArray(p[t]) || p[t].length !== STEPS) {
        return { ok: false, error: 'pattern-step-count' };
      }
      for (var s = 0; s < STEPS; s++) {
        if (typeof p[t][s] !== 'boolean') return { ok: false, error: 'pattern-cell-not-boolean' };
      }
    }
    return { ok: true, error: null };
  }

  function toggleStep(p, track, step) {
    var v = validatePattern(p);
    if (!v.ok) throw new Error('invalid-pattern: ' + v.error);
    if (!isInt(track) || track < 0 || track >= TRACKS.length) throw new Error('invalid-track');
    if (!isInt(step) || step < 0 || step >= STEPS) throw new Error('invalid-step');
    var next = clonePattern(p);
    next[track][step] = !next[track][step];
    return next;
  }

  function countHits(p) {
    var n = 0;
    for (var t = 0; t < TRACKS.length; t++) {
      for (var s = 0; s < STEPS; s++) if (p[t][s]) n++;
    }
    return n;
  }

  /* Duration of one 16th-note step in milliseconds. */
  function bpmToStepMs(bpm) {
    if (typeof bpm !== 'number' || !isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) {
      throw new Error('invalid-bpm');
    }
    return 60000 / bpm / 4;
  }

  /* Swing delays odd (off-beat) 16th steps by swing * one step duration.
   * swing is 0..0.6 (0 = straight, 0.6 = heavy swing). Even steps: no delay. */
  function swingDelayMs(step, bpm, swing) {
    if (!isInt(step) || step < 0 || step >= STEPS) throw new Error('invalid-step');
    if (typeof swing !== 'number' || !isFinite(swing) || swing < 0 || swing > 0.6) {
      throw new Error('invalid-swing');
    }
    if (step % 2 === 0) return 0;
    return swing * bpmToStepMs(bpm);
  }

  function nextStep(step) {
    if (!isInt(step) || step < 0 || step >= STEPS) throw new Error('invalid-step');
    return (step + 1) % STEPS;
  }

  function makePattern(spec) {
    var p = emptyPattern();
    Object.keys(spec).forEach(function (name) {
      var t = TRACKS.indexOf(name);
      if (t === -1) throw new Error('unknown-track: ' + name);
      spec[name].forEach(function (s) {
        if (!isInt(s) || s < 0 || s >= STEPS) throw new Error('invalid-step-in-preset');
        p[t][s] = true;
      });
    });
    return p;
  }

  /* Original factory patterns. Step numbers are 0-based 16th notes. */
  var PRESETS = {
    'four-on-floor': makePattern({
      kick: [0, 4, 8, 12], snare: [4, 12],
      hihat: [0, 2, 4, 6, 8, 10, 12, 14], clap: []
    }),
    'boom-bap': makePattern({
      kick: [0, 7, 10], snare: [4, 12],
      hihat: [0, 2, 4, 6, 8, 10, 12, 14], clap: [4, 12]
    }),
    'dhol-groove': makePattern({
      kick: [0, 3, 6, 8, 11, 14], snare: [4, 12],
      hihat: [0, 2, 4, 6, 8, 10, 12, 14], clap: [7, 15]
    }),
    'half-time': makePattern({
      kick: [0, 8], snare: [8],
      hihat: [0, 4, 8, 12], clap: [8]
    })
  };

  /* Random pattern. rng must return a float in [0,1). Density per track
   * keeps results musical; guarantees at least 4 hits overall. */
  function randomPattern(rng) {
    if (typeof rng !== 'function') throw new Error('rng-required');
    var density = { kick: 0.28, snare: 0.18, hihat: 0.55, clap: 0.12 };
    var p = emptyPattern();
    for (var t = 0; t < TRACKS.length; t++) {
      for (var s = 0; s < STEPS; s++) {
        p[t][s] = rng() < density[TRACKS[t]];
      }
    }
    if (countHits(p) < 4) {
      p[0][0] = true; p[1][4] = true; p[2][0] = true; p[2][8] = true;
    }
    return p;
  }

  function validateSavedEntry(e) {
    if (!e || typeof e !== 'object') return { ok: false, error: 'saved-not-object' };
    if (typeof e.name !== 'string' || e.name.trim().length === 0 || e.name.length > 40) {
      return { ok: false, error: 'saved-name' };
    }
    var v = validatePattern(e.pattern);
    if (!v.ok) return { ok: false, error: 'saved-pattern: ' + v.error };
    if (typeof e.createdAt !== 'number' || !isFinite(e.createdAt)) {
      return { ok: false, error: 'saved-createdAt' };
    }
    return { ok: true, error: null };
  }

  /* Strict import envelope. Anything shaped differently is rejected. */
  function validateEnvelope(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'envelope-not-object' };
    if (obj.app !== APP_ID) return { ok: false, error: 'envelope-app' };
    if (obj.version !== VERSION) return { ok: false, error: 'envelope-version' };
    var v = validatePattern(obj.pattern);
    if (!v.ok) return { ok: false, error: 'envelope-pattern: ' + v.error };
    if (typeof obj.bpm !== 'number' || obj.bpm < MIN_BPM || obj.bpm > MAX_BPM) {
      return { ok: false, error: 'envelope-bpm' };
    }
    if (typeof obj.swing !== 'number' || obj.swing < 0 || obj.swing > 0.6) {
      return { ok: false, error: 'envelope-swing' };
    }
    if (obj.saved !== undefined) {
      if (!Array.isArray(obj.saved) || obj.saved.length > MAX_SAVED) {
        return { ok: false, error: 'envelope-saved' };
      }
      for (var i = 0; i < obj.saved.length; i++) {
        var sv = validateSavedEntry(obj.saved[i]);
        if (!sv.ok) return { ok: false, error: 'envelope-saved-entry: ' + sv.error };
      }
    }
    return { ok: true, error: null };
  }

  function buildEnvelope(state) {
    return {
      app: APP_ID,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      bpm: state.bpm,
      swing: state.swing,
      pattern: state.pattern,
      saved: state.saved || []
    };
  }

  var api = {
    APP_ID: APP_ID, VERSION: VERSION, TRACKS: TRACKS, STEPS: STEPS,
    MIN_BPM: MIN_BPM, MAX_BPM: MAX_BPM, MAX_SAVED: MAX_SAVED,
    emptyPattern: emptyPattern, clonePattern: clonePattern,
    validatePattern: validatePattern, toggleStep: toggleStep,
    countHits: countHits, bpmToStepMs: bpmToStepMs,
    swingDelayMs: swingDelayMs, nextStep: nextStep,
    PRESETS: PRESETS, randomPattern: randomPattern,
    validateSavedEntry: validateSavedEntry,
    validateEnvelope: validateEnvelope, buildEnvelope: buildEnvelope
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BeatMakerCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
