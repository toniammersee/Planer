// Ausführen mit: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const { merge, same } = require('../sync-core.js');

const T = (id, updated, extra = {}) => ({ id, title: id, date: '2026-11-24', updated, created: 1, ...extra });
const now = Date.UTC(2026, 10, 24);

test('neuere Version gewinnt', () => {
  const m = merge({ tasks: [T('a', now - 10, { title: 'alt' })] }, { tasks: [T('a', now - 5, { title: 'neu' })] }, now);
  assert.strictEqual(m.tasks[0].title, 'neu');
});

test('Einträge beider Geräte werden vereint', () => {
  const m = merge({ tasks: [T('a', now)] }, { tasks: [T('b', now)] }, now);
  assert.deepStrictEqual(m.tasks.map(t => t.id).sort(), ['a', 'b']);
});

test('Löschen auf einem Gerät gewinnt gegen ältere Kopie', () => {
  const m = merge({ tasks: [], deleted: { a: now - 1 } }, { tasks: [T('a', now - 100)] }, now);
  assert.strictEqual(m.tasks.length, 0);
  assert.ok('a' in m.deleted);
});

test('Nach dem Löschen bearbeitet = wiederhergestellt', () => {
  const m = merge({ tasks: [], deleted: { a: now - 100 } }, { tasks: [T('a', now - 1)] }, now);
  assert.strictEqual(m.tasks.length, 1);
  assert.ok(!('a' in m.deleted));
});

test('alte Grabsteine werden aufgeräumt', () => {
  const m = merge({ tasks: [], deleted: { a: now - 200 * 864e5 } }, {}, now);
  assert.deepStrictEqual(m.deleted, {});
});

test('altes Format (reines Array) und leere/kaputte Daten', () => {
  const m = merge([T('a', 0)], null, now);
  assert.strictEqual(m.tasks.length, 1);
  assert.strictEqual(merge({}, { tasks: [null, { title: 'ohne id' }] }, now).tasks.length, 0);
});

test('same() ignoriert Reihenfolge', () => {
  assert.ok(same({ tasks: [T('a', 1), T('b', 2)], deleted: { x: 1, y: 2 } },
                 { tasks: [T('b', 2), T('a', 1)], deleted: { y: 2, x: 1 } }));
  assert.ok(!same({ tasks: [T('a', 1)] }, { tasks: [T('a', 2)] }));
});
