/* Headless smoke test for app.js — renders every view and walks a guided session
   against a minimal DOM stub. Catches runtime errors that a syntax check cannot.

   Run from the repo root:  node tools/smoke_test.js
*/
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.dirname(__dirname);
let failures = [];
let checks = 0;

function ok(cond, label) {
  checks++;
  if (!cond) failures.push(label);
}
function has(hay, needle, label) {
  ok(String(hay).indexOf(needle) !== -1, label + ' [missing: ' + needle + ']');
}

/* ── minimal DOM ──────────────────────────────────────────────────────── */
/* ids that app.js looks up *inside* a container it has just re-rendered.
   Assigning innerHTML in a real browser destroys those nodes and their
   handlers, so the stub must do the same or clicks fire stale callbacks. */
const CHILD_IDS = ['x', 'x2', 'done', 'skip', 'bk', 'sk', 'wt', 'go', 'start'];

function makeEl(id) {
  return {
    id, className: '', hidden: false, textContent: '',
    style: {}, value: '',
    _html: '',
    _handlers: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = v;
      CHILD_IDS.forEach(k => { delete els[k]; });
      // the real markup contains the weight input, so make it exist
      if (String(v).indexOf('id="wt"') !== -1) {
        const m = /id="wt"[^>]*value="([^"]*)"/.exec(String(v));
        const wt = makeEl('wt');
        wt.value = m ? m[1] : '';
        els.wt = wt;
      }
    },
    addEventListener(ev, fn) { this._handlers[ev] = fn; },
    setAttribute() { }, getAttribute() { return null; },
    set onclick(fn) { this._handlers.click = fn; },
    get onclick() { return this._handlers.click; },
    click() { if (this._handlers.click) this._handlers.click(); }
  };
}

const els = {};
const doc = {
  title: '',
  body: { style: {} },
  getElementById(id) {
    if (!els[id]) els[id] = makeEl(id);
    return els[id];
  },
  querySelector() { return null; }   // ring/num lookups must tolerate null
};

const listeners = {};
const win = {
  addEventListener(ev, fn) { listeners[ev] = fn; },
  scrollTo() { },
  console
};

const loc = { hash: '' };

const store = {};
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

function fetchStub(url) {
  const rel = String(url).replace(/^\.\//, '');
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) {
    return Promise.reject(new Error('404 ' + rel));
  }
  const text = fs.readFileSync(fp, 'utf8');
  return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(text)) });
}

const sandbox = {
  document: doc, window: win, location: loc,
  localStorage: localStorageStub,
  fetch: fetchStub,
  navigator: {},                      // no serviceWorker, no vibrate, no wakeLock
  console, Promise, Date, Math, JSON, String, Number, Array, Object, isNaN,
  setInterval: () => 0, clearInterval: () => { },
  setTimeout, clearTimeout
};
sandbox.window.console = console;

const code = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
vm.createContext(sandbox);

try {
  vm.runInContext(code, sandbox, { filename: 'app.js' });
} catch (e) {
  console.error('FATAL: app.js threw on load:', e.message);
  process.exit(1);
}

/* boot() is async — let its promises settle before asserting */
setTimeout(runAssertions, 150);

function runAssertions() {
  const app = doc.getElementById('app');
  const guided = doc.getElementById('guided');
  const sessions = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'sessions.json'), 'utf8'));
  const movements = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'movements.json'), 'utf8'));
  const M = {};
  movements.movements.forEach(m => { M[m.id] = m; });

  /* ── landing ── */
  ok(app.innerHTML.length > 500, 'landing rendered something substantial');
  has(app.innerHTML, sessions.week.rule, 'landing shows the week rule');
  sessions.sessions.forEach(s => {
    has(app.innerHTML, s.name, 'landing lists session ' + s.id);
  });

  /* ── every session view ── */
  sessions.sessions.forEach(s => {
    loc.hash = '#' + s.id;
    listeners.hashchange();
    const html = app.innerHTML;
    ok(html.length > 300, s.id + ': rendered');
    has(html, s.name, s.id + ': title');

    s.items.forEach(it => {
      if (it.movement) {
        const mv = M[it.movement];
        has(html, mv.name, s.id + ': movement ' + mv.id);
        has(html, mv.cue, s.id + ': cue for ' + mv.id);
        if (mv.note) has(html, mv.note, s.id + ': substitution badge for ' + mv.id);
        if (mv.images.length === 0) has(html, 'text only', s.id + ': text-only card');
      } else {
        has(html, it.label, s.id + ': step ' + it.label);
      }
    });
  });

  /* ── the alternative movement must surface in strength-b ── */
  loc.hash = '#strength-b';
  listeners.hashchange();
  has(app.innerHTML, 'Swap for', 'strength-b: alternative block present');
  has(app.innerHTML, M['db-incline-press'].name, 'strength-b: alt movement named');

  /* ── guided mode: walk a full strength session ── */
  loc.hash = '#strength-a';
  listeners.hashchange();
  const go = doc.getElementById('go');
  ok(!!go._handlers.click, 'start button wired');
  go.click();
  ok(guided.hidden === false, 'guided overlay opened');
  has(guided.innerHTML, 'Warm-up', 'guided starts on the warm-up step');

  const strengthA = sessions.sessions.find(s => s.id === 'strength-a');
  const expectedSets = strengthA.items.reduce((n, it) => n + (it.sets || 1), 0);

  let steps = 0, restsSeen = 0, setsClicked = 0;
  const LIMIT = 200;
  while (steps < LIMIT) {
    if (guided.innerHTML.indexOf('Session done') !== -1) break;
    const done = els.done && els.done._handlers.click ? els.done : null;
    const skip = els.skip && els.skip._handlers.click ? els.skip : null;
    const start = els.start && els.start._handlers.click ? els.start : null;
    if (done) {
      if (els.wt && els.wt.value === '') els.wt.value = '12';   // log a weight
      done.click();
      setsClicked++;
    } else if (start) {
      start.click();                // "switch sides" screen
    } else if (skip) {
      skip.click();                 // rest, or ending a hold early
      restsSeen++;
    } else {
      break;
    }
    steps++;
  }
  ok(setsClicked === expectedSets,
    'clicked every set/step (' + setsClicked + ' of ' + expectedSets + ')');
  ok(restsSeen > 0, 'rest/hold screens appeared between sets (' + restsSeen + ')');

  /* ── timed work holds ──────────────────────────────────────────────────
     setInterval is a no-op in this harness, so a countdown never completes on
     its own; the hold is ended via "Done early", which is also the real
     behaviour for a plank that fails before the clock runs out. */
  function jumpTo(sessionId, movementId) {
    const s = sessions.sessions.find(x => x.id === sessionId);
    const idx = s.items.findIndex(i => i.movement === movementId);
    ok(idx >= 0, 'found ' + movementId + ' in ' + sessionId);
    loc.hash = '#' + sessionId;
    listeners.hashchange();
    doc.getElementById('go').click();
    sandbox.G.idx = idx;
    sandbox.G.set = 1;
    sandbox.G.side = 1;
    sandbox.G.phase = 'work';
    sandbox.drawGuided();
    return s.items[idx];
  }

  // a rep-counted lift: no timer, and it does take a weight
  jumpTo('strength-a', 'goblet-squat');
  has(guided.innerHTML, 'Set done', 'goblet squat: rep-counted, no work timer');
  ok(guided.innerHTML.indexOf('Start ') === -1, 'goblet squat: no Start button');
  ok(!!els.wt, 'goblet squat: offers a kg field');

  // a timed hold: timer, and no weight field (bodyweight)
  const plank = jumpTo('strength-a', 'plank');
  ok(plank.holdSec === 30, 'plank carries holdSec=30');
  has(guided.innerHTML, 'Start 30 s', 'plank: offers a 30 s work timer');
  ok(!els.wt, 'plank: no kg field (bodyweight)');
  els.done.click();
  ok(sandbox.G.phase === 'hold', 'plank: entered the hold phase');
  has(guided.innerHTML, 'class="ring"', 'plank: hold screen shows the ring');
  has(guided.innerHTML, 'Done early', 'plank: can end the hold early');
  ok(sandbox.G.cdTotal === 30, 'plank: countdown armed for 30 s');
  ok(sandbox.G.cdEnd > Date.now() + 28000, 'plank: deadline ~30 s out');
  els.skip.click();
  ok(sandbox.G.phase === 'rest', 'plank: hold -> rest (it has restSec)');

  // a per-side hold runs once per side with a switch screen between
  const ham = jumpTo('mobility', 'hamstring-stretch');
  ok(ham.holdSec === 45 && ham.sides === 2, 'hamstring stretch: 45 s, 2 sides');
  has(guided.innerHTML, 'first side', 'hamstring: names the first side');
  els.done.click();
  ok(sandbox.G.phase === 'hold' && sandbox.G.side === 1, 'hamstring: side 1 holding');
  ok(sandbox.G.cdTotal === 45, 'hamstring: countdown armed for 45 s');
  els.skip.click();
  ok(sandbox.G.phase === 'switch', 'hamstring: goes to the switch screen');
  has(guided.innerHTML, 'Switch sides', 'hamstring: prompts to switch');
  els.start.click();
  ok(sandbox.G.phase === 'hold' && sandbox.G.side === 2, 'hamstring: side 2 holding');
  els.skip.click();
  ok(sandbox.G.phase !== 'hold' && sandbox.G.phase !== 'switch',
    'hamstring: both sides done, moved on');

  /* every holdSec in the data agrees with the number shown on the card */
  sessions.sessions.forEach(s => {
    s.items.forEach(it => {
      if (!it.holdSec) return;
      const shown = it.reps || it.prescription || '';
      ok(String(shown).indexOf(String(it.holdSec)) !== -1,
        s.id + '/' + it.movement + ': holdSec matches the displayed "' + shown + '"');
    });
  });

  has(guided.innerHTML, 'Session done', 'guided reached the summary');
  has(guided.innerHTML, 'w/c 26-Oct', 'summary names the Weekly Log row');
  ok(steps < LIMIT, 'guided session terminated (no infinite loop)');

  /* ── weight persistence ── */
  const log = JSON.parse(store['eb.log.v1'] || '{}');
  ok(Object.keys(log).length > 0, 'a working weight was persisted');
  const anyW = Object.values(log)[0];
  ok(anyW && anyW.weight === '12', 'persisted weight value is correct');
  ok(anyW && /^\d{4}-\d{2}-\d{2}$/.test(anyW.at), 'persisted date is ISO yyyy-mm-dd');

  /* ── renders fine with storage unavailable ── */
  sandbox.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  let threw = false;
  try {
    loc.hash = '#strength-a';
    listeners.hashchange();
  } catch (e) { threw = true; }
  ok(!threw, 'session view survives localStorage throwing');
  ok(app.innerHTML.indexOf('Goblet squat') !== -1,
    'session still renders with storage blocked');

  /* ── report ── */
  console.log('checks run: ' + checks);
  if (failures.length) {
    console.log('\nFAILURES (' + failures.length + '):');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('all passed');
}
