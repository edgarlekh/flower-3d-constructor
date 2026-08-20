const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../assets/js/plan-geometry.js');

// ---- физическая вместимость прямой стороны (пункты 1-3 регрессионного набора ТЗ) ----
test('180x90: максимум 4 стула на сторону при chairWidth=40, minGap=5', () => {
  assert.equal(G.getMaxLinearSeats(180), 4);
});
test('240x90: максимум 5 стульев на сторону', () => {
  assert.equal(G.getMaxLinearSeats(240), 5);
});
test('300x90: максимум 6 стульев на сторону', () => {
  assert.equal(G.getMaxLinearSeats(300), 6);
});
test('canAddLinearSeat запрещает 5-й стул на стороне 180 см', () => {
  assert.equal(G.canAddLinearSeat(180, 4), false);
  assert.equal(G.canAddLinearSeat(180, 3), true);
});

// ---- круглый стол: хорда (пункты 4-5) ----
test('⌀150: хорда между соседними местами ограничивает вместимость', () => {
  const max = G.getMaxRoundSeats(150);
  assert.ok(max >= 1 && max < 16, 'вместимость должна быть меньше жёсткого лимита 16, получили ' + max);
  const chord = 2 * (150 / 2 + 22) * Math.sin(Math.PI / max);
  assert.ok(chord >= G.CHAIR_WIDTH + G.MIN_SEAT_GAP - 1e-9);
});
test('⌀150 при 16 местах — ошибка вместимости (16-е место запрещено)', () => {
  const max = G.getMaxRoundSeats(150);
  assert.ok(max < 16);
  assert.equal(G.canAddRoundSeat(150, 15), max > 15);
  assert.equal(G.canAddRoundSeat(150, max), false);
});

// ---- нормализация gaps (пункт 10) ----
test('повреждённые gaps [0,0,99,-1] при 4 слотах нормализуются в [0]', () => {
  assert.deepEqual(G.normalizeGaps(4, [0, 0, 99, -1]), [0]);
});
test('normalizeGaps сортирует и убирает дубликаты в валидном диапазоне', () => {
  assert.deepEqual(G.normalizeGaps(6, [3, 1, 3, 5, 1]), [1, 3, 5]);
});
test('normalizeGaps на не-массиве возвращает []', () => {
  assert.deepEqual(G.normalizeGaps(4, null), []);
  assert.deepEqual(G.normalizeGaps(4, undefined), []);
});

// ---- измерение зазоров (пункт 11: "Перекрытие N см", не "0 см") ----
test('пересекающиеся прямоугольники дают отрицательное value и overlap:true', () => {
  const a = { id: 'a', x: 0, z: 0, rot: 0, hx: 20, hy: 20 };
  const b = { id: 'b', x: 30, z: 0, rot: 0, hx: 20, hy: 20 }; // пересечение на 10 по X
  const r = G.measureTableToTable(a, b);
  assert.ok(r.overlap);
  assert.equal(r.severity, 'overlap');
  assert.ok(r.value < 0);
  assert.equal(G.formatClearance(r), 'Перекрытие 10 см');
});
test('раздельные прямоугольники дают положительное расстояние, severity ok при большом зазоре', () => {
  const a = { id: 'a', x: 0, z: 0, rot: 0, hx: 20, hy: 20 };
  const b = { id: 'b', x: 100, z: 0, rot: 0, hx: 20, hy: 20 }; // зазор 60
  const r = G.measureTableToTable(a, b);
  assert.equal(r.overlap, false);
  assert.equal(r.value, 60);
  assert.equal(r.severity, 'ok');
});
test('касающиеся торцами прямоугольники (зазор 0) — не перекрытие', () => {
  const a = { id: 'a', x: 0, z: 0, rot: 0, hx: 20, hy: 20 };
  const b = { id: 'b', x: 40, z: 0, rot: 0, hx: 20, hy: 20 };
  const r = G.measureTableToTable(a, b);
  assert.equal(r.overlap, false);
  assert.equal(r.value, 0);
});
test('measureChairToChair: тесный, но не пересекающийся зазор помечается tight', () => {
  const a = { id: 'c1', x: 0, z: 0, rot: 0, hx: 18, hy: 18 };
  const b = { id: 'c2', x: 50, z: 0, rot: 0, hx: 18, hy: 18 }; // зазор 14 < 50
  const r = G.measureChairToChair(a, b);
  assert.equal(r.overlap, false);
  assert.equal(r.severity, 'tight');
});
test('измерение работает и для повёрнутых прямоугольников (не только AABB)', () => {
  const a = { id: 'a', x: 0, z: 0, rot: 0, hx: 20, hy: 20 };
  const b = { id: 'b', x: 0, z: 60, rot: Math.PI / 4, hx: 20, hy: 20 };
  const r = G.measureTableToTable(a, b);
  assert.ok(r.value > 0 && r.value < 60);
});

// ---- rectPushVector: точное SAT-выталкивание повёрнутых столов (фикс бага "повернул на 45° — всё сломалось") ----
test('rectPushVector: непересекающиеся прямоугольники — null', () => {
  const a = { x: 0, z: 0, rot: 0, hx: 20, hy: 20 };
  const b = { x: 100, z: 0, rot: 0, hx: 20, hy: 20 };
  assert.equal(G.rectPushVector(a, b), null);
});
test('rectPushVector: стол 240x90 повёрнутый на 45° не считается пересекающим соседа, который его настоящая (не AABB) форма не задевает', () => {
  // AABB стола 240x90 (hl=120,hw=45) при повороте 45° раздувается до ~117x117 —
  // сосед на расстоянии 130 см ложно попадал бы в АABB-коллизию, хотя реальный
  // повёрнутый прямоугольник (ромб) его не касается.
  const a = { x: 0, z: 0, rot: Math.PI / 4, hx: 120, hy: 45 };
  const b = { x: 130, z: 0, rot: 0, hx: 20, hy: 20 };
  assert.equal(G.rectPushVector(a, b), null);
});
test('rectPushVector: пересекающиеся прямоугольники выталкиваются ровно на глубину проникновения', () => {
  const a = { x: 0, z: 0, rot: 0, hx: 20, hy: 20 };
  const b = { x: 30, z: 0, rot: 0, hx: 20, hy: 20 }; // пересечение на 10 по X
  const push = G.rectPushVector(a, b);
  assert.ok(push);
  assert.equal(Math.round(push.x), 10);
  assert.equal(Math.round(push.z), 0);
  // после выталкивания больше не пересекаются
  const moved = { x: b.x + push.x, z: b.z + push.z, rot: b.rot, hx: b.hx, hy: b.hy };
  assert.equal(G.rectPushVector(a, moved), null);
});
