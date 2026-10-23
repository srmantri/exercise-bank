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
const CHILD_IDS = ['x', 'x2', 'done', 'skip', 'bk', 'sk', 'wt', 'go'];

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
    if (done) {
      if (els.wt && els.wt.value === '') els.wt.value = '12';   // log a weight
      done.click();
      setsClicked++;
    } else if (skip) {
      skip.click();                 // rest screen -> skip straight through
      restsSeen++;
    } else {
      break;
    }
    steps++;
  }
  ok(setsClicked === expectedSets,
    'clicked every set/step (' + setsClicked + ' of ' + expectedSets + ')');
  ok(restsSeen > 0, 'rest screens appeared between sets (' + restsSeen + ')');

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
