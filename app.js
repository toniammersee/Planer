'use strict';

/* =========================================================
   Planer – Aufgaben & Termine für Schule, Arbeit, Lernen,
   Sport und Sonstiges. Alle Daten bleiben im Browser
   (localStorage) und lassen sich als JSON sichern.
   ========================================================= */

const CATEGORIES = [
  { id: 'schule',    name: 'Schule',    icon: '🎒' },
  { id: 'arbeit',    name: 'Arbeit',    icon: '💼' },
  { id: 'lernen',    name: 'Lernen',    icon: '📚' },
  { id: 'sport',     name: 'Sport',     icon: '🏃' },
  { id: 'sonstiges', name: 'Sonstiges', icon: '📌' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const STORAGE_KEY = 'planer.tasks.v1';
const PREFS_KEY = 'planer.prefs.v1';

const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const PRIO_LABEL = { low: 'Niedrig', normal: 'Normal', high: 'Hoch' };
const PRIO_RANK = { high: 0, normal: 1, low: 2 };
const REPEAT_LABEL = { daily: 'täglich', weekdays: 'werktags', weekly: 'wöchentlich' };

/* ---------- Storage ---------- */

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Speicher nicht verfügbar */ }
}

let tasks = safeGet(STORAGE_KEY, []);
let prefs = Object.assign({ view: 'today', filter: 'all', theme: null }, safeGet(PREFS_KEY, {}));
let weekOffset = 0;

function save() { safeSet(STORAGE_KEY, tasks); }
function savePrefs() { safeSet(PREFS_KEY, prefs); }

/* ---------- Date helpers (lokale Zeit, Format YYYY-MM-DD) ---------- */

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function todayKey() { return toKey(new Date()); }
function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Montag = 0
  return addDays(x, -dow);
}
function fmtDate(k, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return fromKey(k).toLocaleDateString('de-DE', opts);
}
function relLabel(k) {
  const t = todayKey();
  if (k === t) return 'Heute';
  if (k === toKey(addDays(new Date(), 1))) return 'Morgen';
  if (k === toKey(addDays(new Date(), -1))) return 'Gestern';
  return fmtDate(k);
}
function durationMin(t) {
  if (!t.start || !t.end) return 0;
  const [h1, m1] = t.start.split(':').map(Number);
  const [h2, m2] = t.end.split(':').map(Number);
  const d = (h2 * 60 + m2) - (h1 * 60 + m1);
  return d > 0 ? d : 0;
}

/* ---------- Task model ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Findet der Eintrag an diesem Tag statt? */
function occursOn(t, key) {
  if (key < t.date) return false;
  if (t.repeat === 'none' || !t.repeat) return key === t.date;
  if (t.repeat === 'daily') return true;
  const dow = fromKey(key).getDay();
  if (t.repeat === 'weekdays') return dow >= 1 && dow <= 5;
  if (t.repeat === 'weekly') return dow === fromKey(t.date).getDay();
  return false;
}
function isDone(t, key) {
  if (!t.repeat || t.repeat === 'none') return !!t.done;
  return (t.doneDates || []).includes(key);
}
function setDone(t, key, value) {
  if (!t.repeat || t.repeat === 'none') { t.done = value; return; }
  const set = new Set(t.doneDates || []);
  value ? set.add(key) : set.delete(key);
  t.doneDates = [...set];
}

/** Alle Vorkommen an einem Tag, sortiert nach Uhrzeit, dann Priorität. */
function occurrencesOn(key) {
  return tasks
    .filter(t => occursOn(t, key) && passesFilter(t))
    .map(t => ({ task: t, key }))
    .sort(compareOcc);
}
function compareOcc(a, b) {
  const da = isDone(a.task, a.key), db = isDone(b.task, b.key);
  if (da !== db) return da ? 1 : -1;
  const sa = a.task.start || '99:99', sb = b.task.start || '99:99';
  if (sa !== sb) return sa < sb ? -1 : 1;
  return (PRIO_RANK[a.task.priority] ?? 1) - (PRIO_RANK[b.task.priority] ?? 1);
}
function passesFilter(t) {
  return prefs.filter === 'all' || t.category === prefs.filter;
}

/* ---------- DOM helpers ---------- */

const $ = sel => document.querySelector(sel);
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
const catVar = id => `--cat: var(--c-${id})`;

/* ---------- Rendering ---------- */

const main = $('#main');

function render() {
  document.querySelectorAll('.tab').forEach(b =>
    b.classList.toggle('active', b.dataset.view === prefs.view));
  renderFilters();
  main.replaceChildren();
  ({ today: renderToday, week: renderWeek, all: renderAll, stats: renderStats })[prefs.view]();
}

function renderFilters() {
  const box = $('#filters');
  box.replaceChildren(
    el('button', {
      class: 'chip all' + (prefs.filter === 'all' ? ' active' : ''),
      onclick: () => { prefs.filter = 'all'; savePrefs(); render(); },
    }, 'Alle'),
    ...CATEGORIES.map(c => el('button', {
      class: 'chip' + (prefs.filter === c.id ? ' active' : ''),
      style: catVar(c.id),
      onclick: () => { prefs.filter = prefs.filter === c.id ? 'all' : c.id; savePrefs(); render(); },
    }, el('span', { class: 'dot' }), `${c.icon} ${c.name}`)),
  );
}

function itemNode(occ) {
  const { task: t, key } = occ;
  const done = isDone(t, key);
  const c = CAT[t.category] || CAT.sonstiges;
  const time = t.start ? (t.end ? `${t.start}–${t.end}` : t.start) : null;
  return el('article', { class: 'item' + (done ? ' done' : ''), style: catVar(c.id) },
    el('button', {
      class: 'check',
      'aria-label': done ? 'Als offen markieren' : 'Als erledigt markieren',
      onclick: () => toggle(t, key),
    }),
    el('div', { class: 'item-body', onclick: () => openEditor(t) },
      el('div', { class: 'item-title' }, t.title),
      el('div', { class: 'item-meta' },
        el('span', { class: 'tag' }, `${c.icon} ${c.name}`),
        time && el('span', {}, '🕒 ' + time),
        t.repeat && t.repeat !== 'none' && el('span', {}, '🔁 ' + REPEAT_LABEL[t.repeat]),
        t.priority === 'high' && el('span', { class: 'prio-high' }, '‼ Hoch'),
        t.priority === 'low' && el('span', {}, 'niedrig'),
      ),
      t.notes && el('div', { class: 'item-notes' }, t.notes),
    ),
  );
}

function emptyNode(title, text) {
  return el('div', { class: 'empty' }, el('strong', {}, title), text);
}

function sectionTitle(title, sub, extra) {
  return el('div', { class: 'section-title' },
    el('div', {}, el('h2', {}, title), sub && el('div', { class: 'sub' }, sub)),
    extra || null);
}

/* Heute: überfällige Einzel-Aufgaben + heute + die nächsten Tage */
function renderToday() {
  const tk = todayKey();
  const todays = occurrencesOn(tk);
  const doneCount = todays.filter(o => isDone(o.task, o.key)).length;

  main.append(sectionTitle('Heute', fmtDate(tk, { weekday: 'long', day: 'numeric', month: 'long' }),
    el('span', { class: 'sub' }, todays.length ? `${doneCount}/${todays.length} erledigt` : '')));

  if (todays.length) {
    main.append(el('div', { class: 'progress' },
      el('span', { style: `width:${Math.round(doneCount / todays.length * 100)}%` })));
  }

  const overdue = tasks
    .filter(t => (!t.repeat || t.repeat === 'none') && !t.done && t.date < tk && passesFilter(t))
    .sort((a, b) => a.date < b.date ? -1 : 1)
    .map(t => ({ task: t, key: t.date }));

  if (overdue.length) {
    main.append(el('div', { class: 'group-label overdue' }, `Überfällig (${overdue.length})`));
    main.append(el('div', { class: 'list' }, overdue.map(o => {
      const n = itemNode(o);
      n.querySelector('.item-meta').prepend(el('span', { class: 'prio-high' }, '📅 ' + fmtDate(o.key)));
      return n;
    })));
  }

  main.append(el('div', { class: 'group-label' }, 'Heute'));
  main.append(todays.length
    ? el('div', { class: 'list' }, todays.map(itemNode))
    : emptyNode('Nichts geplant 🎉', 'Tippe auf + um etwas für heute einzutragen.'));

  // Ausblick auf die nächsten 6 Tage
  for (let i = 1; i <= 6; i++) {
    const k = toKey(addDays(new Date(), i));
    const occ = occurrencesOn(k);
    if (!occ.length) continue;
    main.append(el('div', { class: 'group-label' }, relLabel(k)));
    main.append(el('div', { class: 'list' }, occ.map(itemNode)));
  }
}

/* Woche: 7 Spalten Mo–So */
function renderWeek() {
  const start = addDays(startOfWeek(new Date()), weekOffset * 7);
  const end = addDays(start, 6);
  const tk = todayKey();
  const range = `${start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  main.append(sectionTitle(weekOffset === 0 ? 'Diese Woche' : `KW ${isoWeek(start)}`, range,
    el('div', { class: 'week-nav' },
      el('button', { onclick: () => { weekOffset--; render(); }, 'aria-label': 'Vorige Woche' }, '‹'),
      el('button', { onclick: () => { weekOffset = 0; render(); } }, 'Heute'),
      el('button', { onclick: () => { weekOffset++; render(); }, 'aria-label': 'Nächste Woche' }, '›'),
    )));

  const grid = el('div', { class: 'week' });
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const k = toKey(d);
    const occ = occurrencesOn(k);
    grid.append(el('div', { class: 'day' + (k === tk ? ' today' : '') },
      el('div', { class: 'day-head' },
        el('b', {}, WEEKDAYS_SHORT[d.getDay()]),
        el('span', {}, d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }))),
      occ.map(({ task: t }) => el('div', {
        class: 'mini' + (isDone(t, k) ? ' done' : ''),
        style: catVar(CAT[t.category] ? t.category : 'sonstiges'),
        title: 'Klicken zum Bearbeiten, Doppelklick zum Abhaken',
        onclick: () => openEditor(t),
        ondblclick: e => { e.preventDefault(); toggle(t, k); },
      }, t.start && el('time', {}, t.start + (t.end ? '–' + t.end : '')), t.title)),
      el('button', { class: 'day-add', onclick: () => openEditor(null, k) }, '+ Eintrag'),
    ));
  }
  main.append(grid);
}

function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
}

/* Alle: komplette Liste nach Datum gruppiert */
function renderAll() {
  const list = tasks.filter(passesFilter).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.start || '99') < (b.start || '99') ? -1 : 1;
  });

  const open = list.filter(t => t.repeat !== 'none' || !t.done);
  const done = list.filter(t => t.repeat === 'none' && t.done);
  const recurring = open.filter(t => t.repeat && t.repeat !== 'none');
  const single = open.filter(t => !t.repeat || t.repeat === 'none');

  main.append(sectionTitle('Alle Einträge', `${single.length} offen · ${recurring.length} wiederkehrend · ${done.length} erledigt`));

  if (!list.length) {
    main.append(emptyNode('Noch keine Einträge', 'Lege mit + deine erste Aufgabe oder deinen ersten Termin an.'));
    return;
  }

  let lastKey = null;
  let box = null;
  for (const t of single) {
    if (t.date !== lastKey) {
      lastKey = t.date;
      const overdue = t.date < todayKey();
      main.append(el('div', { class: 'group-label' + (overdue ? ' overdue' : '') },
        relLabel(t.date) + (overdue ? ' · überfällig' : '')));
      box = el('div', { class: 'list' });
      main.append(box);
    }
    box.append(itemNode({ task: t, key: t.date }));
  }

  if (recurring.length) {
    main.append(el('div', { class: 'group-label' }, 'Wiederkehrend'));
    main.append(el('div', { class: 'list' }, recurring.map(t => itemNode({ task: t, key: todayKey() }))));
  }
  if (done.length) {
    main.append(el('div', { class: 'group-label' }, `Erledigt (${done.length})`));
    main.append(el('div', { class: 'list' }, done.slice().reverse().map(t => itemNode({ task: t, key: t.date }))));
  }
}

/* Statistik: diese Woche je Kategorie */
function renderStats() {
  const start = startOfWeek(new Date());
  const keys = Array.from({ length: 7 }, (_, i) => toKey(addDays(start, i)));
  const stats = Object.fromEntries(CATEGORIES.map(c => [c.id, { total: 0, done: 0, min: 0 }]));

  for (const k of keys) {
    for (const t of tasks) {
      if (!occursOn(t, k)) continue;
      const s = stats[t.category] || stats.sonstiges;
      s.total++;
      if (isDone(t, k)) s.done++;
      s.min += durationMin(t);
    }
  }
  const all = Object.values(stats).reduce((a, s) => ({
    total: a.total + s.total, done: a.done + s.done, min: a.min + s.min,
  }), { total: 0, done: 0, min: 0 });

  main.append(sectionTitle('Statistik', 'Diese Woche (Mo–So)'));

  const grid = el('div', { class: 'stats-grid' });
  grid.append(statCard('Gesamt', '📊', all, null));
  CATEGORIES.forEach(c => grid.append(statCard(c.name, c.icon, stats[c.id], c.id)));
  main.append(grid);

  const maxMin = Math.max(1, ...Object.values(stats).map(s => s.min));
  main.append(el('div', { class: 'hours-chart' },
    el('h3', {}, 'Geplante Zeit pro Kategorie'),
    CATEGORIES.map(c => el('div', { class: 'bar-row', style: catVar(c.id) },
      el('span', {}, `${c.icon} ${c.name}`),
      el('div', { class: 'bar' }, el('span', { style: `width:${stats[c.id].min / maxMin * 100}%` })),
      el('span', { class: 'val' }, fmtHours(stats[c.id].min)))),
    el('p', { class: 'sub', style: 'color:var(--muted);font-size:.82rem;margin:10px 0 0' },
      'Zählt nur Einträge mit Start- und Endzeit.'),
  ));
}
function statCard(name, icon, s, catId) {
  const pct = s.total ? Math.round(s.done / s.total * 100) : 0;
  return el('div', { class: 'stat', style: catId ? catVar(catId) : null },
    el('h3', {}, icon, ' ', name),
    el('div', { class: 'big' }, `${s.done}/${s.total}`),
    el('div', { class: 'muted' }, `${pct}% erledigt · ${fmtHours(s.min)} geplant`),
    el('div', { class: 'progress' }, el('span', { style: `width:${pct}%` })));
}
function fmtHours(min) {
  if (!min) return '0 h';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ---------- Actions ---------- */

function toggle(t, key) {
  const nowDone = !isDone(t, key);
  setDone(t, key, nowDone);
  save();
  render();
  if (nowDone) toast('Erledigt ✓', 'Rückgängig', () => { setDone(t, key, false); save(); render(); });
}

let toastTimer;
function toast(msg, actionLabel, action) {
  const box = $('#toast');
  box.replaceChildren(el('span', {}, msg));
  if (actionLabel) {
    box.append(el('button', { onclick: () => { action(); box.classList.add('hidden'); } }, actionLabel));
  }
  box.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add('hidden'), actionLabel ? 5000 : 1800);
}

/* ---------- Editor ---------- */

const dialog = $('#editor');
const form = $('#editorForm');
let editingId = null;
const F = form.elements;

$('#catPick').append(...CATEGORIES.map(c =>
  el('label', {},
    el('input', { type: 'radio', name: 'category', value: c.id }),
    el('span', { class: 'chip', style: catVar(c.id) }, el('span', { class: 'dot' }), `${c.icon} ${c.name}`))));

function openEditor(task, dateKey) {
  editingId = task ? task.id : null;
  form.reset();
  $('#editorTitle').textContent = task ? 'Eintrag bearbeiten' : 'Neuer Eintrag';
  $('#deleteBtn').classList.toggle('hidden', !task);

  const t = task || {
    title: '', date: dateKey || todayKey(), start: '', end: '', notes: '',
    priority: 'normal', repeat: 'none',
    category: prefs.filter !== 'all' ? prefs.filter : 'schule',
  };
  F.title.value = t.title;
  F.date.value = t.date;
  F.start.value = t.start || '';
  F.end.value = t.end || '';
  F.notes.value = t.notes || '';
  F.priority.value = t.priority || 'normal';
  F.repeat.value = t.repeat || 'none';
  const radio = form.querySelector(`input[name=category][value="${t.category}"]`)
    || form.querySelector('input[name=category]');
  radio.checked = true;

  dialog.showModal();
  if (!task) F.title.focus();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const data = {
    title: F.title.value.trim(),
    category: F.category.value,
    date: F.date.value,
    start: F.start.value,
    end: F.end.value,
    priority: F.priority.value,
    repeat: F.repeat.value,
    notes: F.notes.value.trim(),
  };
  if (!data.title || !data.date) return;
  if (data.start && data.end && data.end <= data.start) {
    F.end.setCustomValidity('Endzeit muss nach der Startzeit liegen');
    F.end.reportValidity();
    return;
  }

  if (editingId) {
    const t = tasks.find(x => x.id === editingId);
    const wasRecurring = t.repeat && t.repeat !== 'none';
    Object.assign(t, data);
    if (wasRecurring && data.repeat === 'none') { t.done = false; delete t.doneDates; }
    if (!wasRecurring && data.repeat !== 'none') { t.doneDates = []; delete t.done; }
    toast('Gespeichert');
  } else {
    tasks.push({
      id: uid(), created: Date.now(), ...data,
      ...(data.repeat === 'none' ? { done: false } : { doneDates: [] }),
    });
    toast('Hinzugefügt');
  }
  save();
  dialog.close();
  render();
});
F.end.addEventListener('input', () => F.end.setCustomValidity(''));
F.start.addEventListener('input', () => F.end.setCustomValidity(''));

$('#cancelBtn').addEventListener('click', () => dialog.close());
$('#deleteBtn').addEventListener('click', () => {
  const idx = tasks.findIndex(x => x.id === editingId);
  if (idx < 0) return;
  const [removed] = tasks.splice(idx, 1);
  save();
  dialog.close();
  render();
  toast('Gelöscht', 'Rückgängig', () => { tasks.splice(idx, 0, removed); save(); render(); });
});
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

/* ---------- Menü: Export / Import / Theme ---------- */

const menu = $('#menu');
$('#menuBtn').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.add('hidden'); });

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, exported: new Date().toISOString(), tasks }, null, 2)],
    { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `planer-${todayKey()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  menu.classList.add('hidden');
});

$('#importInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  menu.classList.add('hidden');
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.tasks;
    if (!Array.isArray(list)) throw new Error('format');
    const valid = list.filter(t => t && typeof t.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
    const byId = new Map(tasks.map(t => [t.id, t]));
    for (const t of valid) byId.set(t.id || uid(), { id: t.id || uid(), ...t });
    tasks = [...byId.values()];
    save(); render();
    toast(`${valid.length} Einträge importiert`);
  } catch {
    toast('Datei konnte nicht gelesen werden');
  }
});

$('#clearDoneBtn').addEventListener('click', () => {
  const before = tasks.slice();
  tasks = tasks.filter(t => !(t.repeat === 'none' && t.done));
  const n = before.length - tasks.length;
  save(); render(); menu.classList.add('hidden');
  toast(`${n} erledigte gelöscht`, n ? 'Rückgängig' : null, () => { tasks = before; save(); render(); });
});

function applyTheme() {
  if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
  else delete document.documentElement.dataset.theme;
}
$('#themeBtn').addEventListener('click', () => {
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const current = prefs.theme || (sysDark ? 'dark' : 'light');
  prefs.theme = current === 'dark' ? 'light' : 'dark';
  savePrefs(); applyTheme(); menu.classList.add('hidden');
});

/* ---------- Navigation ---------- */

document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  prefs.view = b.dataset.view;
  if (prefs.view === 'week') weekOffset = 0;
  savePrefs(); render();
}));
$('#addBtn').addEventListener('click', () => openEditor(null));
document.addEventListener('keydown', e => {
  if (e.key === 'n' && !dialog.open && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault(); openEditor(null);
  }
});

/* ---------- Start ---------- */

if (!['today', 'week', 'all', 'stats'].includes(prefs.view)) prefs.view = 'today';
applyTheme();
render();

// Um Mitternacht / beim Zurückkehren neu zeichnen, damit "Heute" stimmt
let lastDay = todayKey();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && todayKey() !== lastDay) { lastDay = todayKey(); render(); }
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
