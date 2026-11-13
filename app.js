/* Beat Maker BD — app.js : UI wiring + Web Audio engine + persistence. */
(function () {
  'use strict';

  var C = window.BeatMakerCore;
  var I18N = window.BeatMakerI18n;
  var STORE_KEY = 'beat-maker-bd:v1';

  /* ---------------- state ---------------- */
  var state = {
    lang: 'en',
    bpm: 120,
    swing: 0,
    pattern: C.emptyPattern(),
    volumes: { kick: 0.9, snare: 0.8, hihat: 0.6, clap: 0.8 },
    mutes: { kick: false, snare: false, hihat: false, clap: false },
    saved: []
  };
  var playing = false;
  var currentStep = 0;
  var audioCtx = null;
  var trackGain = {};
  var noiseBuf = null;
  var timerId = null;
  var nextNoteTime = 0;

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function t(key) { return I18N.STRINGS[state.lang][key]; }
  function trackName(track) { return I18N.STRINGS[state.lang].tracks[track]; }
  function presetName(key) { return I18N.STRINGS[state.lang].presetNames[key]; }
  function fmt(n) { return I18N.fmtNum(n, state.lang); }
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---------------- persistence ---------------- */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        app: C.APP_ID, version: C.VERSION, lang: state.lang, bpm: state.bpm,
        swing: state.swing, pattern: state.pattern, volumes: state.volumes,
        mutes: state.mutes, saved: state.saved
      }));
    } catch (e) { /* storage full / private mode: app still works in-memory */ }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!data || data.app !== C.APP_ID || data.version !== C.VERSION) return;
    if (C.validatePattern(data.pattern).ok) state.pattern = data.pattern;
    if (typeof data.bpm === 'number' && data.bpm >= C.MIN_BPM && data.bpm <= C.MAX_BPM) state.bpm = data.bpm;
    if (typeof data.swing === 'number' && data.swing >= 0 && data.swing <= 0.6) state.swing = data.swing;
    if (data.lang === 'en' || data.lang === 'bn') state.lang = data.lang;
    if (data.volumes) C.TRACKS.forEach(function (tr) {
      if (typeof data.volumes[tr] === 'number' && data.volumes[tr] >= 0 && data.volumes[tr] <= 1) state.volumes[tr] = data.volumes[tr];
    });
    if (data.mutes) C.TRACKS.forEach(function (tr) {
      if (typeof data.mutes[tr] === 'boolean') state.mutes[tr] = data.mutes[tr];
    });
    if (Array.isArray(data.saved)) {
      state.saved = data.saved.filter(function (e) { return C.validateSavedEntry(e).ok; }).slice(0, C.MAX_SAVED);
    }
  }

  /* ---------------- audio engine ---------------- */
  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1, audioCtx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    C.TRACKS.forEach(function (tr) {
      var g = audioCtx.createGain();
      g.gain.value = state.mutes[tr] ? 0 : state.volumes[tr];
      g.connect(audioCtx.destination);
      trackGain[tr] = g;
    });
    return audioCtx;
  }

  function playKick(when, out) {
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    g.gain.setValueAtTime(1, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
    o.connect(g); g.connect(out);
    o.start(when); o.stop(when + 0.26);
  }

  function playSnare(when, out) {
    var n = audioCtx.createBufferSource();
    n.buffer = noiseBuf;
    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.9, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    n.connect(bp); bp.connect(g); g.connect(out);
    n.start(when); n.stop(when + 0.2);
    var o = audioCtx.createOscillator();
    o.type = 'triangle'; o.frequency.value = 190;
    var g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.5, when);
    g2.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    o.connect(g2); g2.connect(out);
    o.start(when); o.stop(when + 0.12);
  }

  function playHihat(when, out) {
    var n = audioCtx.createBufferSource();
    n.buffer = noiseBuf;
    var hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7500;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.6, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    n.connect(hp); hp.connect(g); g.connect(out);
    n.start(when); n.stop(when + 0.06);
  }

  function playClap(when, out) {
    [0, 0.02, 0.04].forEach(function (off, i) {
      var n = audioCtx.createBufferSource();
      n.buffer = noiseBuf;
      var bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
      var g = audioCtx.createGain();
      var peak = i === 2 ? 0.9 : 0.5;
      g.gain.setValueAtTime(peak, when + off);
      g.gain.exponentialRampToValueAtTime(0.001, when + off + (i === 2 ? 0.16 : 0.03));
      n.connect(bp); bp.connect(g); g.connect(out);
      n.start(when + off); n.stop(when + off + 0.2);
    });
  }

  var PLAYERS = { kick: playKick, snare: playSnare, hihat: playHihat, clap: playClap };

  function scheduleStep(step, when) {
    C.TRACKS.forEach(function (tr, ti) {
      if (state.pattern[ti][step]) PLAYERS[tr](when, trackGain[tr]);
    });
    var delayMs = Math.max(0, (when - audioCtx.currentTime) * 1000);
    setTimeout(function () { if (playing) highlightStep(step); }, delayMs);
  }

  function schedulerTick() {
    var stepMs = C.bpmToStepMs(state.bpm);
    while (nextNoteTime < audioCtx.currentTime + 0.12) {
      var when = nextNoteTime + C.swingDelayMs(currentStep, state.bpm, state.swing) / 1000;
      scheduleStep(currentStep, when);
      nextNoteTime += stepMs / 1000;
      currentStep = C.nextStep(currentStep);
    }
  }

  function startPlayback() {
    ensureAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playing = true;
    currentStep = 0;
    nextNoteTime = audioCtx.currentTime + 0.06;
    timerId = setInterval(schedulerTick, 25);
    updateTransport();
  }

  function stopPlayback() {
    playing = false;
    if (timerId) { clearInterval(timerId); timerId = null; }
    clearHighlight();
    updateTransport();
  }

  /* ---------------- rendering ---------------- */
  function buildGrid() {
    var grid = $('grid');
    grid.innerHTML = '';
    C.TRACKS.forEach(function (tr, ti) {
      var row = document.createElement('div');
      row.className = 'track-row';
      row.dataset.track = tr;

      var head = document.createElement('div');
      head.className = 'track-head';
      var nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'track-name';
      nameBtn.textContent = trackName(tr);
      nameBtn.title = t('mute') + ' / ' + t('unmute');
      nameBtn.setAttribute('aria-pressed', state.mutes[tr] ? 'true' : 'false');
      nameBtn.classList.toggle('muted', state.mutes[tr]);
      nameBtn.addEventListener('click', function () {
        state.mutes[tr] = !state.mutes[tr];
        if (audioCtx && trackGain[tr]) {
          trackGain[tr].gain.value = state.mutes[tr] ? 0 : state.volumes[tr];
        }
        nameBtn.classList.toggle('muted', state.mutes[tr]);
        nameBtn.setAttribute('aria-pressed', state.mutes[tr] ? 'true' : 'false');
        save();
      });
      var vol = document.createElement('input');
      vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.step = '5';
      vol.value = String(Math.round(state.volumes[tr] * 100));
      vol.className = 'track-vol';
      vol.setAttribute('aria-label', trackName(tr) + ' ' + t('volume'));
      vol.addEventListener('input', function () {
        state.volumes[tr] = vol.value / 100;
        if (audioCtx && trackGain[tr] && !state.mutes[tr]) trackGain[tr].gain.value = state.volumes[tr];
        save();
      });
      head.appendChild(nameBtn);
      head.appendChild(vol);
      row.appendChild(head);

      for (var s = 0; s < C.STEPS; s++) {
        (function (step) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'step beat-' + (Math.floor(step / 4) % 2);
          b.dataset.track = String(ti);
          b.dataset.step = String(step);
          b.setAttribute('aria-pressed', state.pattern[ti][step] ? 'true' : 'false');
          b.setAttribute('aria-label', trackName(tr) + ' ' + t('stepLabel') + ' ' + (step + 1));
          if (state.pattern[ti][step]) b.classList.add('on');
          b.addEventListener('click', function () {
            state.pattern = C.toggleStep(state.pattern, ti, step);
            b.classList.toggle('on', state.pattern[ti][step]);
            b.setAttribute('aria-pressed', state.pattern[ti][step] ? 'true' : 'false');
            updateStats();
            save();
          });
          row.appendChild(b);
        })(s);
      }
      grid.appendChild(row);
    });
  }

  function refreshGridStates() {
    document.querySelectorAll('#grid .step').forEach(function (b) {
      var ti = +b.dataset.track, s = +b.dataset.step;
      b.classList.toggle('on', state.pattern[ti][s]);
      b.setAttribute('aria-pressed', state.pattern[ti][s] ? 'true' : 'false');
    });
  }

  function highlightStep(step) {
    clearHighlight();
    document.querySelectorAll('#grid .step').forEach(function (b) {
      if (+b.dataset.step === step) b.classList.add('now');
    });
    $('stepNow').textContent = fmt(step + 1);
    $('beatNow').textContent = fmt(Math.floor(step / 4) + 1);
  }

  function clearHighlight() {
    document.querySelectorAll('#grid .step.now').forEach(function (b) { b.classList.remove('now'); });
    $('stepNow').textContent = '–';
    $('beatNow').textContent = '–';
  }

  function updateTransport() {
    var btn = $('playBtn');
    btn.textContent = playing ? t('stop') : t('play');
    btn.classList.toggle('playing', playing);
    $('playState').textContent = playing ? t('playing') : t('stopped');
    $('bpmVal').textContent = fmt(state.bpm) + ' ' + t('bpmUnit');
    $('swingVal').textContent = fmt(Math.round(state.swing * 100)) + '%';
    $('bpmSlider').value = String(state.bpm);
    $('swingSlider').value = String(Math.round(state.swing * 100));
  }

  function updateStats() {
    $('hitCount').textContent = fmt(C.countHits(state.pattern)) + ' ' + t('hits');
    $('savedCount').textContent = fmt(state.saved.length) + ' ' + t('savedCount');
  }

  function renderSaved() {
    var list = $('savedList');
    list.innerHTML = '';
    if (state.saved.length === 0) {
      var p = document.createElement('p');
      p.className = 'empty-note';
      p.textContent = t('noSaved');
      list.appendChild(p);
      return;
    }
    state.saved.forEach(function (entry, idx) {
      var item = document.createElement('div');
      item.className = 'saved-item';
      var name = document.createElement('span');
      name.className = 'saved-name';
      name.textContent = entry.name;
      var hits = document.createElement('span');
      hits.className = 'saved-hits';
      hits.textContent = fmt(C.countHits(entry.pattern)) + ' ' + t('hits');
      var loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'btn small';
      loadBtn.textContent = t('load');
      loadBtn.addEventListener('click', function () {
        state.pattern = C.clonePattern(entry.pattern);
        refreshGridStates(); updateStats(); save();
        toast(t('loadedPattern'));
      });
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn small danger';
      delBtn.textContent = t('delete');
      delBtn.addEventListener('click', function () {
        state.saved.splice(idx, 1);
        renderSaved(); updateStats(); save();
        toast(t('deletedPattern'));
      });
      item.appendChild(name); item.appendChild(hits);
      item.appendChild(loadBtn); item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    var s = I18N.STRINGS[state.lang];
    $('appTitle').textContent = s.title;
    $('appSubtitle').textContent = s.subtitle;
    $('langBtn').textContent = s.langToggle;
    $('bpmLabel').textContent = s.bpm;
    $('swingLabel').textContent = s.swing;
    $('stepLabelText').textContent = s.stepLabel;
    $('beatLabelText').textContent = s.beatLabel;
    $('presetsTitle').textContent = s.presets;
    $('myPatternsTitle').textContent = s.myPatterns;
    $('patternNameInput').placeholder = s.patternName;
    $('savePatternBtn').textContent = s.savePattern;
    $('toolsTitle').textContent = s.tools;
    $('clearBtn').textContent = s.clear;
    $('randomBtn').textContent = s.randomize;
    $('exportBtn').textContent = s.exportJson;
    $('importLabel').textContent = s.importJson;
    $('eraseBtn').textContent = s.eraseAll;
    $('eraseHint').textContent = s.eraseHint;
    $('exportNote').textContent = s.exportNote;
    $('offlineNote').textContent = s.offlineNote;
    $('synthNote').textContent = s.synthNote;
    $('howTitle').textContent = s.howTitle;
    $('howBody').textContent = s.howBody;
    document.querySelectorAll('#presetList .preset-btn').forEach(function (b) {
      b.textContent = presetName(b.dataset.preset);
    });
    document.querySelectorAll('#grid .track-name').forEach(function (b, i) {
      b.textContent = trackName(C.TRACKS[i]);
    });
    updateTransport(); updateStats(); renderSaved();
  }

  function setLang(lang) {
    state.lang = lang;
    applyLang();
    save();
  }

  /* ---------------- actions ---------------- */
  function bindEvents() {
    $('playBtn').addEventListener('click', function () {
      if (playing) stopPlayback(); else startPlayback();
    });
    $('bpmSlider').addEventListener('input', function (e) {
      state.bpm = +e.target.value;
      updateTransport(); save();
    });
    $('swingSlider').addEventListener('input', function (e) {
      state.swing = (+e.target.value) / 100;
      updateTransport(); save();
    });
    $('langBtn').addEventListener('click', function () {
      setLang(state.lang === 'en' ? 'bn' : 'en');
    });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
        e.preventDefault();
        if (playing) stopPlayback(); else startPlayback();
      }
    });

    document.querySelectorAll('#presetList .preset-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.pattern = C.clonePattern(C.PRESETS[b.dataset.preset]);
        refreshGridStates(); updateStats(); save();
        toast(t('presetLoaded'));
      });
    });

    $('savePatternBtn').addEventListener('click', function () {
      var name = $('patternNameInput').value.trim();
      if (!name) { toast(t('patternNameNeeded')); return; }
      if (state.saved.some(function (e) { return e.name === name; })) { toast(t('patternExists')); return; }
      if (state.saved.length >= C.MAX_SAVED) { toast(t('patternLimit')); return; }
      state.saved.push({ name: name, pattern: C.clonePattern(state.pattern), createdAt: Date.now() });
      $('patternNameInput').value = '';
      renderSaved(); updateStats(); save();
      toast(t('patternSaved'));
    });

    $('clearBtn').addEventListener('click', function () {
      state.pattern = C.emptyPattern();
      refreshGridStates(); updateStats(); save();
      toast(t('cleared'));
    });
    $('randomBtn').addEventListener('click', function () {
      state.pattern = C.randomPattern(Math.random);
      refreshGridStates(); updateStats(); save();
      toast(t('randomized'));
    });

    $('exportBtn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(C.buildEnvelope(state), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'beat-maker-bd-export.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });

    $('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var data;
        try { data = JSON.parse(String(reader.result)); } catch (err) { toast(t('importBad')); return; }
        var v = C.validateEnvelope(data);
        if (!v.ok) { toast(t('importBad')); return; }
        state.pattern = data.pattern;
        state.bpm = data.bpm;
        state.swing = data.swing;
        if (Array.isArray(data.saved)) state.saved = data.saved.slice(0, C.MAX_SAVED);
        refreshGridStates(); updateTransport(); updateStats(); renderSaved(); save();
        toast(t('importOk'));
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('eraseInput').addEventListener('input', function (e) {
      $('eraseBtn').disabled = e.target.value.trim() !== 'DELETE';
    });
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseInput').value.trim() !== 'DELETE') return;
      stopPlayback();
      state.pattern = C.emptyPattern();
      state.saved = [];
      state.bpm = 120; state.swing = 0;
      state.volumes = { kick: 0.9, snare: 0.8, hihat: 0.6, clap: 0.8 };
      state.mutes = { kick: false, snare: false, hihat: false, clap: false };
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      $('eraseInput').value = '';
      $('eraseBtn').disabled = true;
      buildGrid(); applyLang();
      toast(t('eraseDone'));
    });
  }

  /* ---------------- boot ---------------- */
  load();
  buildGrid();
  bindEvents();
  applyLang();
})();
