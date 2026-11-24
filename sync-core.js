/* Zusammenführen von Planer-Daten zweier Geräte.
   Jeder Eintrag trägt einen Zeitstempel `updated`; gelöschte Einträge
   werden als "Grabstein" { id: zeitpunkt } in `deleted` gemerkt, damit
   ein Löschen auf Gerät A nicht durch Gerät B rückgängig gemacht wird. */
(function (root) {
  'use strict';

  const TOMBSTONE_TTL = 120 * 24 * 60 * 60 * 1000; // 120 Tage

  function normalize(data) {
    if (Array.isArray(data)) return { tasks: data, deleted: {} };
    const tasks = data && Array.isArray(data.tasks) ? data.tasks : [];
    const deleted = data && data.deleted && typeof data.deleted === 'object' ? data.deleted : {};
    return { tasks, deleted };
  }

  function merge(a, b, now = Date.now()) {
    a = normalize(a);
    b = normalize(b);

    const best = new Map();
    for (const t of [...a.tasks, ...b.tasks]) {
      if (!t || typeof t.id !== 'string') continue;
      const cur = best.get(t.id);
      if (!cur || (t.updated || 0) > (cur.updated || 0)) best.set(t.id, t);
    }

    const deleted = {};
    for (const [id, ts] of [...Object.entries(a.deleted), ...Object.entries(b.deleted)]) {
      if (typeof ts !== 'number' || now - ts > TOMBSTONE_TTL) continue;
      deleted[id] = Math.max(deleted[id] || 0, ts);
    }

    const tasks = [];
    for (const [id, t] of best) {
      if (id in deleted) {
        if (deleted[id] >= (t.updated || 0)) continue; // Löschen ist neuer
        delete deleted[id]; // nach dem Löschen wiederhergestellt
      }
      tasks.push(t);
    }
    tasks.sort((x, y) => (x.created || 0) - (y.created || 0) || (x.id < y.id ? -1 : 1));
    return { tasks, deleted };
  }

  function canonical(data) {
    const d = normalize(data);
    const tasks = d.tasks.slice().sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    const deleted = Object.keys(d.deleted).sort().map(k => [k, d.deleted[k]]);
    return JSON.stringify({ tasks, deleted });
  }

  function same(a, b) { return canonical(a) === canonical(b); }

  const api = { merge, same, normalize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SyncCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
