/* Exercise Bank — session reference + guided timer.
   Vanilla, no build step, no dependencies. Must still work in four years. */
'use strict';

var DATA = { week: null, sessions: [], byId: {}, movements: {} };
var LOG_KEY = 'eb.log.v1';

/* ── helpers ──────────────────────────────────────────────────────────── */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function el(id) { return document.getElementById(id); }

/* localStorage can throw outright (private mode, blocked site data), so every
   read and write is guarded and the app renders fine with nothing stored. */
function loadLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveLog(log) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) { /* ignore */ }
}
function lastFor(mid) {
  var l = loadLog()[mid];
  return l && l.weight ? l : null;
}
function recordWeight(mid, weight) {
  var log = loadLog();
  if (weight === '' || weight == null) { delete log[mid]; }
  else {
    log[mid] = {
      weight: String(weight),
      at: new Date().toISOString().slice(0, 10)
    };
  }
  saveLog(log);
}
function prettyDate(iso) {
  if (!iso) return '';
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
    'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
}

function kindClass(kind) {
  if (kind === 'strength') return 'k-strength';
  if (kind === 'mobility') return 'k-mobility';
  if (kind === 'steps') return 'k-steps';
  return 'k-steps';
}

/* ── audio: lazily created, and only ever from a user gesture (iOS) ───── */
var actx = null;
function initAudio() {
  if (actx) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  } catch (e) { actx = null; }
}
function beep(freq, ms, vol) {
  if (!actx) return;
  try {
    if (actx.state === 'suspended') actx.resume();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol == null ? 0.18 : vol;
    o.connect(g); g.connect(actx.destination);
    var t = actx.currentTime;
    o.start(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.stop(t + ms / 1000 + 0.02);
  } catch (e) { /* audio is a nicety, never fatal */ }
}
function buzz(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
}

/* ── keep the screen awake during a session, where supported ──────────── */
var wakeLock = null;
function acquireWake() {
  try {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; },
        function () { });
    }
  } catch (e) { }
}
function releaseWake() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) { }
}

/* ── frame markup (the two-photo crossfade that stands in for video) ──── */
function framesHTML(mv, big) {
  var cls = big ? 'g-frames' : 'frames';
  if (!mv.images || mv.images.length < 2) {
    return '<div class="' + cls + ' none">no photo<br>text only</div>';
  }
  return '<div class="' + cls + '">' +
    '<img class="a" src="' + esc(mv.images[0]) + '" alt="' + esc(mv.name) +
    ', start position" loading="lazy" decoding="async">' +
    '<img class="b" src="' + esc(mv.images[1]) + '" alt="' + esc(mv.name) +
    ', end position" loading="lazy" decoding="async">' +
    '</div>';
}

/* ── views ────────────────────────────────────────────────────────────── */

function renderLanding() {
  var w = DATA.week;
  var h = '<div class="week"><h1>Exercise Bank</h1>' +
    '<span class="wk">' + esc(w.label) + ' · ' + esc(w.commencing) + '</span></div>' +
    '<div class="rule"><b>' + esc(w.rule) + '</b><span>' + esc(w.ruleWhy) +
    '</span></div><div class="cards">';

  DATA.sessions.forEach(function (s) {
    var n = s.items.filter(function (i) { return i.movement; }).length;
    var meta = s.duration + (n ? ' · ' + n + ' movements' : '');
    h += '<a class="card ' + kindClass(s.kind) + '" href="#' + esc(s.id) + '">' +
      '<div class="day">' + esc(s.day) + '</div>' +
      '<div class="nm">' + esc(s.name) + '</div>' +
      '<div class="meta">' + esc(meta) + '</div></a>';
  });

  h += '</div><div class="foot">Photos from ' +
    '<a href="https://github.com/yuhonas/free-exercise-db">free-exercise-db</a>' +
    ' (public domain). Works offline once loaded.</div>';
  el('app').innerHTML = h;
  document.title = 'Exercise Bank — ' + w.label;
}

function movementCardHTML(it) {
  var mv = DATA.movements[it.movement];
  if (!mv) return '';
  var pres = it.sets ? (it.sets + ' × ' + it.reps) : (it.prescription || '');
  var last = lastFor(mv.id);

  var h = '<div class="mv"><div class="mv-top">' + framesHTML(mv, false) +
    '<div class="mv-body"><h3>' + esc(mv.name) + '</h3>';
  if (pres) {
    h += '<div class="pres">' + esc(pres) +
      (it.holdSec ? ' <span class="timed">timed</span>' : '') + '</div>';
  }
  if (it.load) h += '<div class="load">' + esc(it.load) + '</div>';
  if (it.restSec) h += '<div class="load">rest ' + it.restSec + 's</div>';
  h += '<div class="cue">' + esc(mv.cue) + '</div>';
  if (last) {
    h += '<div class="last">Last: ' + esc(last.weight) + ' kg · ' +
      esc(prettyDate(last.at)) + '</div>';
  }
  if (mv.note) h += '<div class="badge">' + esc(mv.note) + '</div>';
  h += '</div></div>';

  /* an alternative movement, for when the prescribed one isn't available today.
     Guided mode ignores `alt` — it only ever walks `movement`. */
  var alt = it.alt ? DATA.movements[it.alt] : null;
  if (alt) {
    h += '<div class="alt"><div class="alt-h">Can\'t do this today? Swap for:</div>' +
      '<div class="alt-row">' + framesHTML(alt, false) +
      '<div class="mv-body"><h3>' + esc(alt.name) + '</h3>' +
      '<div class="cue">' + esc(alt.cue) + '</div></div></div></div>';
  }

  if (mv.instructions && mv.instructions.length) {
    h += '<details class="how"><summary>Full instructions</summary><ol>';
    mv.instructions.forEach(function (s) { h += '<li>' + esc(s) + '</li>'; });
    h += '</ol></details>';
  }
  return h + '</div>';
}

function stepHTML(it) {
  var h = '<div class="step"><span class="lbl">' + esc(it.label) + '</span>';
  if (it.duration) h += ' <span class="dur">' + esc(it.duration) + '</span>';
  if (it.detail) h += '<div class="det">' + esc(it.detail) + '</div>';
  return h + '</div>';
}

function renderSession(id) {
  var s = DATA.byId[id];
  if (!s) { location.hash = ''; return; }

  var h = '<a class="back" href="#">← all sessions</a>' +
    '<div class="' + kindClass(s.kind) + '">' +
    '<div class="shead"><h1>' + esc(s.name) + '</h1>' +
    '<div class="sub">' + esc(s.day) + ' · ' + esc(s.duration) + '</div></div>' +
    '<div class="startbar"><button class="primary" id="go">Start guided session</button>' +
    '</div>';

  if (s.summary) h += '<div class="step"><div class="det">' + esc(s.summary) +
    '</div></div>';

  s.items.forEach(function (it) {
    h += it.movement ? movementCardHTML(it) : stepHTML(it);
  });

  h += '<div class="foot"><a href="#">← all sessions</a></div></div>';
  el('app').innerHTML = h;
  document.title = s.name + ' — Exercise Bank';

  el('go').addEventListener('click', function () {
    initAudio();          // must happen inside the gesture
    startGuided(s);
  });
  window.scrollTo(0, 0);
}

/* ── guided mode ──────────────────────────────────────────────────────── */

var G = null;
var RING_C = 2 * Math.PI * 45;

function startGuided(s) {
  G = {
    s: s, idx: 0, set: 1, side: 1, phase: 'work',
    startedAt: Date.now(), setsDone: 0,
    cdEnd: 0, cdTotal: 0, cdNext: null, timer: null, lastWhole: -1
  };
  el('guided').hidden = false;
  document.body.style.overflow = 'hidden';
  acquireWake();
  drawGuided();
}

function endGuided() {
  if (G && G.timer) clearInterval(G.timer);
  G = null;
  el('guided').hidden = true;
  el('guided').innerHTML = '';
  document.body.style.overflow = '';
  releaseWake();
}

function curItem() { return G.s.items[G.idx]; }
function setsOf(it) { return it && it.sets ? it.sets : 1; }

function isLastThing() {
  var it = curItem();
  return G.idx >= G.s.items.length - 1 && G.set >= setsOf(it);
}

/* a timed work interval (plank hold, stretch) vs a rep-counted one (squats).
   Only items carrying holdSec get a work timer. */
function holdOf(it) { return it && it.holdSec ? it.holdSec : 0; }
function sidesOf(it) { return (it && it.sides) || 1; }

/* advance after a completed set / acknowledged step */
function advance() {
  var it = curItem();
  if (G.set < setsOf(it)) { G.set++; }
  else { G.idx++; G.set = 1; }

  G.side = 1;
  if (G.idx >= G.s.items.length) { G.phase = 'done'; drawGuided(); return; }
  G.phase = 'work';
  drawGuided();
}

function doneSet() {
  G.setsDone++;
  G.side = 1;
  var it = curItem();
  if (it.restSec && !isLastThing()) { startRest(it.restSec); }
  else { advance(); }
}

/* ── one countdown engine, shared by rest and work holds ──────────────── */

function startCountdown(sec, next) {
  G.cdTotal = sec;
  /* remaining is always derived from a wall-clock deadline, never by
     accumulating interval ticks — that is what keeps it from drifting. */
  G.cdEnd = Date.now() + sec * 1000;
  G.cdNext = next;
  G.lastWhole = -1;
  if (G.timer) clearInterval(G.timer);
  G.timer = setInterval(tickCountdown, 100);
  drawGuided();
}

function stopCountdown() {
  if (G && G.timer) { clearInterval(G.timer); G.timer = null; }
}

function tickCountdown() {
  if (!G || !G.timer) return;
  var leftMs = G.cdEnd - Date.now();
  var left = Math.max(0, Math.ceil(leftMs / 1000));

  if (left !== G.lastWhole) {
    G.lastWhole = left;
    if (left === 3 || left === 2 || left === 1) { beep(880, 90); }
    paintCount(left, leftMs);
  } else {
    paintRing(leftMs);
  }

  if (leftMs <= 0) {
    stopCountdown();
    beep(1320, 260, 0.22); buzz(180);
    var next = G.cdNext; G.cdNext = null;
    if (next) next();
  }
}

function paintRing(leftMs) {
  var bar = document.querySelector('#guided .bar');
  if (!bar) return;
  var frac = G.cdTotal > 0
    ? Math.max(0, Math.min(1, (leftMs / 1000) / G.cdTotal)) : 0;
  bar.setAttribute('stroke-dashoffset', String(RING_C * (1 - frac)));
}

function paintCount(left, leftMs) {
  var n = document.querySelector('#guided .num');
  if (n) n.textContent = String(left);
  paintRing(leftMs);
}

/* ── rest ─────────────────────────────────────────────────────────────── */

function startRest(sec) { G.phase = 'rest'; startCountdown(sec, advance); }
function skipRest() { stopCountdown(); advance(); }

/* ── timed work hold ──────────────────────────────────────────────────── */

function beginHold() {
  G.phase = 'hold';
  startCountdown(holdOf(curItem()), holdComplete);
}

function holdComplete() {
  if (G.side < sidesOf(curItem())) {
    G.side++;
    G.phase = 'switch';
    drawGuided();
  } else {
    doneSet();
  }
}

/* a plank ends when the hips sag, not when the clock says so */
function endHoldEarly() { stopCountdown(); holdComplete(); }

function back() {
  stopCountdown();
  G.side = 1;
  if (G.set > 1) { G.set--; }
  else if (G.idx > 0) { G.idx--; G.set = setsOf(G.s.items[G.idx]); }
  G.phase = 'work';
  drawGuided();
}

function progressLabel() {
  var movables = G.s.items.length;
  return 'Step ' + Math.min(G.idx + 1, movables) + ' of ' + movables;
}

function nextUpLabel() {
  var it = curItem();
  if (G.set < setsOf(it)) {
    return 'Next: set ' + (G.set + 1) + ' of ' + setsOf(it);
  }
  var nxt = G.s.items[G.idx + 1];
  if (!nxt) return 'Next: finish';
  var nm = nxt.movement ? (DATA.movements[nxt.movement] || {}).name : nxt.label;
  return 'Next: ' + nm;
}

function drawGuided() {
  var g = el('guided');
  var cls = kindClass(G.s.kind);

  if (G.phase === 'done') {
    var mins = Math.max(1, Math.round((Date.now() - G.startedAt) / 60000));
    g.className = 'guided ' + cls;
    g.innerHTML =
      '<div class="g-top"><span class="g-prog">' + esc(G.s.name) + '</span>' +
      '<button class="ghost" id="x">Close</button></div>' +
      '<div class="g-main"><div class="done-wrap">' +
      '<h2>Session done</h2>' +
      '<div class="done-stats">' + G.setsDone + ' sets · about ' + mins + ' min</div>' +
      '<div class="done-note">Log it Sunday: Weekly Log row <b>w/c 26-Oct</b> — ' +
      'column D = 4 (or 5 with Saturday), column E = 2. That is a complete week, ' +
      'not a shortfall.</div>' +
      '<button class="primary" id="x2">Back to session</button>' +
      '</div></div>';
    el('x').onclick = el('x2').onclick = endGuided;
    return;
  }

  var it = curItem();
  var mv = it.movement ? DATA.movements[it.movement] : null;
  var hold = holdOf(it);
  var sides = sidesOf(it);
  var topBar = '<div class="g-top"><span class="g-prog">' + esc(progressLabel()) +
    '</span><button class="ghost" id="x">Close</button></div>';

  /* rest and a timed work hold are the same countdown; only labels and the
     action button differ */
  if (G.phase === 'rest' || G.phase === 'hold') {
    var left = Math.max(0, Math.ceil((G.cdEnd - Date.now()) / 1000));
    var resting = G.phase === 'rest';
    var sideTxt = (!resting && sides > 1)
      ? (G.side === 1 ? 'First side' : 'Second side') : '';

    g.className = 'guided ' + (resting ? 'resting ' : 'holding ') + cls;
    g.innerHTML = topBar + '<div class="g-main">' + ringHTML(left) +
      '<h2 class="g-name">' + esc(resting ? 'Rest' : (mv ? mv.name : it.label)) +
      '</h2>' +
      (!resting && it.sets
        ? '<div class="g-set">Set ' + G.set + ' of ' + it.sets + '</div>' : '') +
      (sideTxt ? '<div class="g-set">' + sideTxt + '</div>' : '') +
      '<div class="g-cue">' +
      esc(resting ? nextUpLabel() : (mv ? mv.cue : '')) + '</div></div>' +
      '<div class="g-actions"><button class="primary" id="skip">' +
      (resting ? 'Skip rest' : 'Done early') + '</button></div>';

    el('x').onclick = endGuided;
    el('skip').onclick = resting ? skipRest : endHoldEarly;
    paintRing(G.cdEnd - Date.now());
    return;
  }

  /* between the two sides of a per-side hold */
  if (G.phase === 'switch') {
    g.className = 'guided ' + cls;
    g.innerHTML = topBar + '<div class="g-main">' +
      (mv ? framesHTML(mv, true) : '') +
      '<h2 class="g-name">Switch sides</h2>' +
      '<div class="g-reps">' + hold + ' s</div>' +
      '<div class="g-cue">' + esc(mv ? mv.cue : '') + '</div></div>' +
      '<div class="g-actions">' +
      '<button class="primary" id="start">Start second side</button>' +
      '<div class="g-row"><button class="ghost" id="sk">Skip</button></div></div>';
    el('x').onclick = endGuided;
    el('start').onclick = beginHold;
    el('sk').onclick = function () { G.side = 1; doneSet(); };
    return;
  }

  /* work phase */
  var pres = it.sets ? it.reps : (it.prescription || it.duration || '');
  var name = mv ? mv.name : it.label;
  var cue = mv ? mv.cue : (it.detail || '');
  var last = mv ? lastFor(mv.id) : null;
  /* a kg field only makes sense for loaded, rep-counted work */
  var bodyweight = /bodyweight/i.test(it.load || '');
  var wantWeight = mv && it.sets && !hold && !bodyweight;

  var h = topBar + '<div class="g-main">';

  if (mv) h += framesHTML(mv, true);
  h += '<h2 class="g-name">' + esc(name) + '</h2>';
  if (it.sets) h += '<div class="g-set">Set ' + G.set + ' of ' + it.sets + '</div>';
  if (pres) h += '<div class="g-reps">' + esc(pres) + '</div>';
  if (cue) h += '<div class="g-cue">' + esc(cue) + '</div>';
  if (it.load) h += '<div class="g-load">' + esc(it.load) + '</div>';

  if (wantWeight) {
    h += '<div class="wt"><label for="wt">kg</label>' +
      '<input id="wt" type="number" inputmode="decimal" step="0.5" min="0" ' +
      'value="' + esc(last ? last.weight : '') + '" aria-label="weight used"></div>';
  }

  var primary = hold
    ? ('Start ' + hold + ' s' + (sides > 1 ? ' — first side' : ''))
    : (it.sets ? 'Set done' : 'Done');

  h += '</div><div class="g-actions">' +
    '<button class="primary" id="done">' + esc(primary) + '</button>' +
    '<div class="g-row"><button class="ghost" id="bk">Back</button>' +
    '<button class="ghost" id="sk">Skip</button></div></div>';

  g.className = 'guided ' + cls;
  g.innerHTML = h;

  el('x').onclick = endGuided;
  el('bk').onclick = back;
  el('sk').onclick = advance;
  el('done').onclick = hold ? beginHold : function () {
    var w = el('wt');
    if (w && mv) recordWeight(mv.id, w.value);
    doneSet();
  };
}

function ringHTML(left) {
  return '<div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle class="trk" cx="50" cy="50" r="45"></circle>' +
    '<circle class="bar" cx="50" cy="50" r="45" stroke-dasharray="' + RING_C +
    '" stroke-dashoffset="0"></circle></svg>' +
    '<div class="num">' + left + '</div></div>';
}

/* ── routing + boot ───────────────────────────────────────────────────── */

function route() {
  if (G) endGuided();
  var id = location.hash.replace(/^#\/?/, '');
  if (id && DATA.byId[id]) renderSession(id);
  else renderLanding();
}

function boot() {
  Promise.all([
    fetch('./data/sessions.json').then(function (r) { return r.json(); }),
    fetch('./data/movements.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    DATA.week = res[0].week;
    DATA.sessions = res[0].sessions;
    res[0].sessions.forEach(function (s) { DATA.byId[s.id] = s; });
    res[1].movements.forEach(function (m) { DATA.movements[m.id] = m; });
    window.addEventListener('hashchange', route);
    route();
  }).catch(function (e) {
    el('app').innerHTML = '<div class="rule"><b>Could not load the session data.</b>' +
      '<span>Check your connection and reload. The full session text is also in ' +
      'the calendar event description.</span></div>';
    if (window.console) console.error(e);
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { });
    });
  }
}

boot();
