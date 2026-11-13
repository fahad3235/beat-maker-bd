/* Beat Maker BD — headless-Chrome smoke tests (raw CDP, no deps).
 * Usage: node tests/smoke.mjs [width] [height]
 * Exits non-zero if any check fails or any console/page error appears. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PAGE_URL = 'file://' + process.cwd() + '/index.html';
const WIDTH = parseInt(process.argv[2] || '1280', 10);
const HEIGHT = parseInt(process.argv[3] || '800', 10);
const PORT = 9333 + (WIDTH === 390 ? 1 : 0);

const errors = [];
let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('ok  - ' + name); }
  else { console.error('FAIL - ' + name); process.exitCode = 1; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('DevTools endpoint never came up');
}

const child = spawn(SHELL, [
  '--headless', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  '--autoplay-policy=no-user-gesture-required',
  `--window-size=${WIDTH},${HEIGHT}`,
  PAGE_URL
], { stdio: 'ignore' });

let ws;
try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 500));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    } else if (msg.method === 'Network.loadingFailed') {
      errors.push('network failed: ' + JSON.stringify(msg.params).slice(0, 300));
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push('log error: ' + (msg.params.entry.text || '').slice(0, 300));
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evl = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page eval threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Log.enable');

  for (let i = 0; i < 50; i++) {
    if ((await evl('document.readyState')) === 'complete') break;
    await sleep(200);
  }
  await sleep(400);

  check('title mentions Beat Maker', (await evl('document.title')).includes('Beat Maker'));
  check('64 step buttons render', (await evl(`document.querySelectorAll('#grid .step').length`)) === 64);
  check('4 track rows render', (await evl(`document.querySelectorAll('#grid .track-row').length`)) === 4);
  check('4 preset buttons render', (await evl(`document.querySelectorAll('#presetList .preset-btn').length`)) === 4);
  check('starts with 0 hits', (await evl(`document.getElementById('hitCount').textContent`)).includes('0'));

  // Toggle a step on, then off.
  await evl(`document.querySelector('.step[data-track="0"][data-step="0"]').click()`);
  check('step toggle turns on (aria-pressed + class)', await evl(
    `(() => { const b = document.querySelector('.step[data-track="0"][data-step="0"]');
       return b.getAttribute('aria-pressed') === 'true' && b.classList.contains('on'); })()`));
  check('hit count becomes 1', (await evl(`document.getElementById('hitCount').textContent`)).includes('1'));
  await evl(`document.querySelector('.step[data-track="0"][data-step="0"]').click()`);
  check('step toggle turns off again', await evl(
    `document.querySelector('.step[data-track="0"][data-step="0"]').getAttribute('aria-pressed') === 'false'`));

  // Preset loads a real pattern.
  await evl(`document.querySelector('.preset-btn[data-preset="boom-bap"]').click()`);
  check('boom-bap preset loads hits', (await evl(`document.querySelectorAll('#grid .step.on').length`)) > 10);
  check('boom-bap kick on steps 0,7,10', await evl(
    `(() => { const on = [...document.querySelectorAll('.step[data-track="0"].on')].map(b => +b.dataset.step);
       return JSON.stringify(on) === JSON.stringify([0,7,10]); })()`));

  // BPM slider updates the readout.
  await evl(`(() => { const s = document.getElementById('bpmSlider'); s.value = '140';
    s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  check('BPM readout shows 140', (await evl(`document.getElementById('bpmVal').textContent`)).includes('140'));

  // Playback starts, advances steps, stops cleanly.
  await evl(`document.getElementById('playBtn').click()`);
  await sleep(800);
  check('play button switches to Stop', (await evl(`document.getElementById('playBtn').textContent`)).includes('Stop'));
  check('play state reads Playing', (await evl(`document.getElementById('playState').textContent`)).length > 0 &&
    (await evl(`document.getElementById('playState').textContent`)) !== 'Stopped');
  check('step indicator advances while playing', await evl(
    `document.getElementById('stepNow').textContent !== '–'`));
  check('a current-step cell is highlighted', (await evl(`document.querySelectorAll('#grid .step.now').length`)) >= 1);
  await evl(`document.getElementById('playBtn').click()`);
  check('stop returns to Stopped', (await evl(`document.getElementById('playState').textContent`)) === 'Stopped');

  // Save a pattern, then reload and confirm persistence.
  await evl(`(() => { const i = document.getElementById('patternNameInput'); i.value = 'Test Beat';
    document.getElementById('savePatternBtn').click(); })()`);
  await sleep(200);
  check('saved pattern appears in list', (await evl(`document.querySelectorAll('#savedList .saved-item').length`)) === 1);
  check('saved pattern name shown', (await evl(`document.querySelector('#savedList .saved-name').textContent`)) === 'Test Beat');
  check('localStorage holds the app state', await evl(
    `(() => { const raw = localStorage.getItem('beat-maker-bd:v1');
       return raw && JSON.parse(raw).app === 'beat-maker-bd'; })()`));
  await send('Page.reload', { ignoreCache: true });
  await sleep(800);
  check('saved pattern survives reload', (await evl(`document.querySelectorAll('#savedList .saved-item').length`)) === 1);
  check('pattern survives reload (boom-bap still loaded)', (await evl(`document.querySelectorAll('#grid .step.on').length`)) > 10);

  // Language toggle.
  await evl(`document.getElementById('langBtn').click()`);
  check('BN toggle changes title', (await evl(`document.getElementById('appTitle').textContent`)) === 'বিট মেকার বিডি');
  check('BN toggle changes play button', (await evl(`document.getElementById('playBtn').textContent`)).includes('বাজান'));
  await evl(`document.getElementById('langBtn').click()`);
  check('toggle back to English', (await evl(`document.getElementById('appTitle').textContent`)) === 'Beat Maker BD');

  // Randomize + clear.
  await evl(`document.getElementById('randomBtn').click()`);
  check('randomize fills the grid', (await evl(`document.querySelectorAll('#grid .step.on').length`)) >= 4);
  await evl(`document.getElementById('clearBtn').click()`);
  check('clear empties the grid', (await evl(`document.querySelectorAll('#grid .step.on').length`)) === 0);

  // Mute toggle.
  await evl(`document.querySelector('.track-name').click()`);
  check('track mute toggles class', await evl(
    `document.querySelector('.track-name').classList.contains('muted')`));

  // Erase-all guard: button disabled until DELETE typed.
  check('erase button starts disabled', await evl(`document.getElementById('eraseBtn').disabled`) === true);
  await evl(`(() => { const i = document.getElementById('eraseInput'); i.value = 'DELETE';
    i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  check('erase button enables after typing DELETE', await evl(`document.getElementById('eraseBtn').disabled`) === false);

  if (WIDTH === 390) {
    check('390px: no page-level horizontal overflow',
      (await evl(`document.documentElement.scrollWidth`)) <= 391);
    check('390px: grid scrolls internally', await evl(
      `(() => { const g = document.querySelector('.grid-scroll');
         return getComputedStyle(g).overflowX === 'auto' || g.scrollWidth > g.clientWidth; })()`));
  }

  if (errors.length) {
    console.error('PAGE ERRORS (' + errors.length + '):');
    errors.forEach((e) => console.error('  - ' + e));
    process.exitCode = 1;
  } else {
    console.log('ok  - zero console/page/network errors');
  }
  console.log(passed + ' smoke checks passed');
} catch (e) {
  console.error('SMOKE HARNESS ERROR: ' + (e && e.message));
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch { /* ignore */ }
  try { child.kill('SIGKILL'); } catch { /* ignore */ }
}
