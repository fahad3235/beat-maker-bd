# Beat Maker BD 🥁

An offline, bilingual (English / বাংলা) **16-step drum machine** for Bangladesh — tap the grid, press play, make your beat. No network, no account, no uploads. Everything runs in the browser and your beats stay on your device.

**Live demo:** https://fahad3235.github.io/beat-maker-bd/
**Status:** Complete MVP — published and verified.

## The problem

Making a beat usually means installing a heavy app, signing up, or paying. A student, a school cultural programme, or a bedroom producer in Bangladesh should be able to open a page and start tapping out a rhythm in seconds — in Bangla or English, on a phone, with no internet at all.

## Features

- **16-step sequencer** — one bar of 16th notes across 4 drum tracks: Kick, Snare, Hi-Hat, Clap. Shaded groups of 4 mark the beats.
- **Live synthesized drums** — every sound is generated with the Web Audio API (kick pitch-drop, noise snare, high-passed hi-hat, triple-burst clap). No audio files.
- **Transport** — Play / Stop (or Space bar), tempo 60–180 BPM, swing 0–60%, live step + beat readout with a moving highlight.
- **4 original preset patterns** — Four-on-Floor, Boom Bap, Dhol Groove, Half-Time. One tap loads them.
- **Per-track controls** — tap a track name to mute it; per-track volume sliders.
- **My Patterns** — save named beats (up to 20), load or delete them; they persist in `localStorage`.
- **Randomize + Clear** — one-tap random beat (seedable logic) or a fresh empty grid.
- **JSON export / import** — strict envelope validation (`app`, `version`, pattern shape, tempo and swing ranges). Bad files are rejected, never half-applied.
- **Erase everything** — typed-`DELETE` confirmation wipes all patterns and settings.
- **Bilingual UI** — full English / বাংলা toggle, persisted, with Bengali digits.
- **Mobile-ready** — verified at 390px; the grid scrolls horizontally inside its card, the page never overflows.

## Stack

- Plain HTML + CSS + JavaScript — no framework, no build step, no dependencies.
- Web Audio API for sound; `localStorage` for persistence.
- Tests: Node unit tests for the sequencer logic + headless-Chrome (CDP) smoke tests for the UI.

## Prerequisites

Any modern browser (Chrome, Firefox, Safari, Edge). No server, no install, no API keys.

## Install & run

```bash
# Clone and open — that's it.
git clone https://github.com/fahad3235/beat-maker-bd.git
cd beat-maker-bd
# Open index.html in your browser, or serve it:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Testing

```bash
# Unit tests (sequencer logic: patterns, tempo/swing math, envelopes)
node tests/test-core.js        # 29 tests

# Headless-Chrome smoke tests (desktop 1280px, then mobile 390px)
node tests/smoke.mjs 1280 800  # 29 checks
node tests/smoke.mjs 390 844   # 31 checks (incl. no page overflow)
```

The smoke tests drive the real page over CDP: step toggling, preset loading, playback start/stop with live step advance, BPM changes, save + reload persistence, EN/বাংলা toggle, randomize/clear, mute, and the typed-DELETE erase guard — with zero console, page, or network errors.

## How it works

- `core.js` — pure sequencer logic (patterns, validation, tempo/swing math, presets, export envelopes). No DOM, no audio — unit-testable in Node.
- `i18n.js` — English/Bengali strings and Bengali digit formatting.
- `app.js` — UI wiring, persistence, and the audio engine: a 25 ms lookahead scheduler (0.12 s lookahead) that schedules each 16th step, applying swing delay to off-beat steps.
- `index.html` / `styles.css` — layout and the dark studio theme.

## Limitations

- Sound needs a user gesture first (browser autoplay policy) — press Play; the button is the gesture.
- Audio timing is best-effort in the browser: the lookahead scheduler keeps drift low, but a busy tab can still jitter steps.
- Patterns are stored per browser/device; export JSON to move them.
- Four drum voices only (kick, snare, hi-hat, clap) — no samples, no recording.
- Swing range is capped at 60% so off-beat steps never collide with the next beat.

## Deployment

Static site — any static host works. This repo is deployed with GitHub Pages (main branch, root).

## Licence

MIT — see `LICENSE` if present. Built by the Muse Project Factory (run #328).
