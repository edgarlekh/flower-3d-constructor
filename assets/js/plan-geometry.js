// Чистый геометрический модуль плана зала: физическая вместимость мест, нормализация
// дырок (gaps) и измерение реальных зазоров между стульями/столами/объектами.
// Никакого DOM — используется и из plan.html/hall.html (как window.PlanGeometry),
// и из тестов на Node (module.exports). Единицы измерения — сантиметры.
(function (root) {
  'use strict';

  // ---- константы посадочного места ----
  var CHAIR_WIDTH = 40;   // физическая ширина footprint стула, см
  var MIN_SEAT_GAP = 5;   // минимальный зазор между соседними стульями, см
  var MIN_PITCH = CHAIR_WIDTH + MIN_SEAT_GAP; // 45 см — шаг между центрами мест

  function getSeatFootprint(config) {
    return (config && config.chairWidth) || CHAIR_WIDTH;
  }
  function getSeatPitch(config) {
    var w = getSeatFootprint(config);
    var gap = (config && config.minSeatGap != null) ? config.minSeatGap : MIN_SEAT_GAP;
    return w + gap;
  }

  // Сколько мест физически влезает на прямую сторону длиной sideLength.
  function getMaxLinearSeats(sideLength, config) {
    var pitch = getSeatPitch(config);
    if (!(sideLength > 0) || pitch <= 0) return 0;
    return Math.max(0, Math.floor(sideLength / pitch));
  }

  // Сколько мест физически влезает по окружности диаметром diameter (места стоят
  // с выносом CH от кромки стола — центр стула на радиусе diameter/2 + CH).
  function getMaxRoundSeats(diameter, config) {
    var overhang = (config && config.chairOverhang != null) ? config.chairOverhang : 22;
    var centerRadius = diameter / 2 + overhang;
    var w = getSeatFootprint(config);
    var gap = (config && config.minSeatGap != null) ? config.minSeatGap : MIN_SEAT_GAP;
    var need = w + gap;
    if (centerRadius <= 0) return 0;
    // ищем максимальное n, при котором хорда между соседними местами >= need
    var n = 1;
    for (var k = 2; k <= 200; k++) {
      var chord = 2 * centerRadius * Math.sin(Math.PI / k);
      if (chord >= need) n = k; else break;
    }
    return n;
  }

  // Хватит ли места для ещё одного стула на прямой стороне длиной sideLength,
  // если сейчас occupied мест уже стоит.
  function canAddLinearSeat(sideLength, occupied, config) {
    return occupied < getMaxLinearSeats(sideLength, config);
  }
  // То же для круглого стола.
  function canAddRoundSeat(diameter, occupied, config) {
    return occupied < getMaxRoundSeats(diameter, config);
  }

  // Единая проверка "можно ли добавить место" + причина отказа.
  // table: {shape:'rect', sideLength, occupied} | {shape:'round', diameter, occupied}
  function canAddSeat(table, config) {
    if (table.shape === 'round') return canAddRoundSeat(table.diameter, table.occupied, config);
    return canAddLinearSeat(table.sideLength, table.occupied, config);
  }

  function getSeatCapacityWarning(table, config) {
    if (canAddSeat(table, config)) return null;
    if (table.shape === 'round') {
      var maxR = getMaxRoundSeats(table.diameter, config);
      return 'Больше нельзя: за столом ⌀' + Math.round(table.diameter) + ' см помещается максимум ' + maxR + ' ' + placesWord(maxR) + ' при текущем размере стула.';
    }
    var maxL = getMaxLinearSeats(table.sideLength, config);
    return 'Больше нельзя: на стороне ' + Math.round(table.sideLength) + ' см помещается максимум ' + maxL + ' ' + placesWord(maxL) + ' при текущем размере стула.';
  }
  function placesWord(n) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return 'стул';
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'стула';
    return 'стульев';
  }

  // ---- нормализация gaps: убрать мусор, дубликаты, отсортировать ----
  function normalizeGaps(slotCount, rawGaps) {
    if (!Array.isArray(rawGaps)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < rawGaps.length; i++) {
      var v = rawGaps[i];
      if (typeof v !== 'number' || !isFinite(v)) continue;
      v = Math.trunc(v);
      if (v < 0 || v >= slotCount) continue;
      if (seen[v]) continue;
      seen[v] = true;
      out.push(v);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  // ---- измерение зазоров: прямоугольники (возможно повёрнутые) ----
  // rect: {x,z,rot,hx,hy} — центр, поворот (рад), полу-размеры по локальным осям.
  function rectCorners(r) {
    var c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0);
    var pts = [[-r.hx, -r.hy], [r.hx, -r.hy], [r.hx, r.hy], [-r.hx, r.hy]];
    return pts.map(function (p) {
      return { x: r.x + c * p[0] + s * p[1], z: r.z - s * p[0] + c * p[1] };
    });
  }
  function rectAxes(r) {
    var c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0);
    return [{ x: c, z: -s }, { x: s, z: c }];
  }
  function project(corners, axis) {
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < corners.length; i++) {
      var d = corners[i].x * axis.x + corners[i].z * axis.z;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return { min: min, max: max };
  }
  // SAT: минимальное расстояние между двумя (возможно повёрнутыми) прямоугольниками.
  // Возвращает отрицательное значение (глубину проникновения со знаком минус), если они пересекаются.
  function rectRectDistance(a, b) {
    var ca = rectCorners(a), cb = rectCorners(b);
    var axes = rectAxes(a).concat(rectAxes(b));
    var minGap = Infinity;   // минимальный положительный зазор по всем осям (если не пересекаются)
    var minOverlap = Infinity; // минимальная глубина проникновения (если пересекаются по всем осям)
    var separated = false;
    for (var i = 0; i < axes.length; i++) {
      var pa = project(ca, axes[i]), pb = project(cb, axes[i]);
      var gap = Math.max(pa.min, pb.min) > Math.min(pa.max, pb.max)
        ? Math.max(pa.min, pb.min) - Math.min(pa.max, pb.max)
        : -1;
      if (gap >= 0) {
        separated = true;
        if (gap < minGap) minGap = gap;
      } else {
        var overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
        if (overlap < minOverlap) minOverlap = overlap;
      }
    }
    return separated ? minGap : -minOverlap;
  }

  // SAT-выталкивание: на сколько и в какую сторону сдвинуть b, чтобы он больше не пересекал a
  // (по оси минимального проникновения — стандартное разрешение столкновения повёрнутых
  // прямоугольников). Возвращает null, если a и b не пересекаются вовсе.
  // Именно этой функции не хватало в plan.html: коллизия столов считалась по AABB
  // (halfExt) — для стола, повёрнутого на 45°, эта коробка сильно больше самого стола
  // (вписанный в квадрат ромб), из-за чего resolve() после поворота либо ложно считал
  // соседние столы пересекающимися и расталкивал их не туда, либо расталкивал неточно.
  function rectPushVector(a, b) {
    var ca = rectCorners(a), cb = rectCorners(b);
    var axes = rectAxes(a).concat(rectAxes(b));
    var minOverlap = Infinity, minAxis = null;
    for (var i = 0; i < axes.length; i++) {
      var pa = project(ca, axes[i]), pb = project(cb, axes[i]);
      var overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (overlap <= 0) return null; // разделены хотя бы по одной оси — не пересекаются
      if (overlap < minOverlap) { minOverlap = overlap; minAxis = axes[i]; }
    }
    var dx = b.x - a.x, dz = b.z - a.z;
    var sign = (dx * minAxis.x + dz * minAxis.z) < 0 ? -1 : 1;
    var px = minAxis.x * sign * minOverlap, pz = minAxis.z * sign * minOverlap;
    return { x: px === 0 ? 0 : px, z: pz === 0 ? 0 : pz }; // нормализуем -0 в 0
  }

  function severityFor(value, tightThreshold) {
    if (value < 0) return 'overlap';
    if (value < tightThreshold) return 'tight';
    return 'ok';
  }

  function makeResult(type, value, sourceA, sourceB, tightThreshold) {
    tightThreshold = tightThreshold == null ? 50 : tightThreshold;
    var rounded = Math.round(value * 10) / 10;
    if (rounded === 0) rounded = 0; // нормализуем -0 в 0
    return {
      type: type,
      value: rounded,
      overlap: value < 0,
      severity: severityFor(value, tightThreshold),
      sourceA: sourceA,
      sourceB: sourceB
    };
  }

  // Обобщённая проверка зазора между двумя прямоугольными "отпечатками".
  // itemA/itemB: {id, x, z, rot, hx, hy}
  function measureClearance(itemA, itemB, type, tightThreshold) {
    var d = rectRectDistance(itemA, itemB);
    return makeResult(type || 'clearance', d, itemA.id, itemB.id, tightThreshold);
  }
  function measureChairToChair(a, b) {
    return measureClearance(a, b, 'chair-chair', 50);
  }
  function measureTableToTable(a, b) {
    return measureClearance(a, b, 'table-table', 0);
  }
  function measureChairToObstacle(chair, obstacle) {
    return measureClearance(chair, obstacle, 'chair-obstacle', 20);
  }
  function measureTableToWall(table, wall) {
    return measureClearance(table, wall, 'table-wall', 20);
  }

  // Человекочитаемая подпись для отображения на плане.
  function formatClearance(result) {
    if (result.overlap) return 'Перекрытие ' + Math.round(-result.value) + ' см';
    return (result.severity === 'tight' ? 'Проход ' : '') + Math.round(result.value) + ' см';
  }

  var PlanGeometry = {
    CHAIR_WIDTH: CHAIR_WIDTH,
    MIN_SEAT_GAP: MIN_SEAT_GAP,
    MIN_PITCH: MIN_PITCH,
    getSeatFootprint: getSeatFootprint,
    getSeatPitch: getSeatPitch,
    getMaxLinearSeats: getMaxLinearSeats,
    getMaxRoundSeats: getMaxRoundSeats,
    canAddLinearSeat: canAddLinearSeat,
    canAddRoundSeat: canAddRoundSeat,
    canAddSeat: canAddSeat,
    getSeatCapacityWarning: getSeatCapacityWarning,
    normalizeGaps: normalizeGaps,
    rectRectDistance: rectRectDistance,
    rectPushVector: rectPushVector,
    measureClearance: measureClearance,
    measureChairToChair: measureChairToChair,
    measureTableToTable: measureTableToTable,
    measureChairToObstacle: measureChairToObstacle,
    measureTableToWall: measureTableToWall,
    formatClearance: formatClearance
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlanGeometry;
  } else {
    root.PlanGeometry = PlanGeometry;
  }
})(typeof window !== 'undefined' ? window : globalThis);
