import test from "node:test";
import assert from "node:assert/strict";
import { RoadIndex } from "../src/engine/road-index.js";
import { AdaptiveQuality, FixedStepClock } from "../src/engine/performance.js";

test("spatial road queries match an exhaustive projection inside and outside the grid", () => {
  const points = Array.from({ length: 320 }, (_, i) => {
    const a = (i / 320) * Math.PI * 2;
    return {
      x: Math.sin(a) * (325 + 32 * Math.cos(3 * a)),
      y: 4 + 3 * Math.sin(a),
      z: Math.cos(a) * (248 + 25 * Math.sin(2 * a)),
    };
  });
  const road = new RoadIndex(points);
  let seed = 77;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let k = 0; k < 5000; k++) {
    const p = { x: (random() - 0.5) * 1800, z: (random() - 0.5) * 1600 };
    let min = Infinity,
      expected;
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length],
        dx = b.x - a.x,
        dz = b.z - a.z,
        t = Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz),
          ),
        ),
        x = a.x + dx * t,
        z = a.z + dz * t,
        d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < min) {
        min = d;
        expected = { index: i, t, ground: a.y + (b.y - a.y) * t };
      }
    });
    const actual = road.nearest(p);
    assert.equal(actual.index, expected.index);
    assert(Math.abs(actual.ground - expected.ground) < 1e-9);
    assert(Math.abs(actual.dist - Math.sqrt(min)) < 1e-9);
  }
});

test("fixed simulation produces the same number of steps at 30, 60 and 144 Hz", () => {
  for (const hz of [30, 60, 144]) {
    const clock = new FixedStepClock();
    let steps = 0;
    for (let i = 0; i < hz * 5; i++) clock.advance(1 / hz, () => steps++);
    assert.equal(steps, 300);
  }
  const clock = new FixedStepClock();
  let steps = 0;
  clock.advance(60, () => steps++);
  assert.equal(steps, 8);
  clock.reset();
  assert.equal(clock.accumulator, 0);
});

test("automatic quality reduces sustained load and recovers with hysteresis", () => {
  const changes = [],
    quality = new AdaptiveQuality((p) => changes.push(p));
  for (let i = 0; i < 220; i++) quality.sample(40);
  assert.equal(quality.level, 0);
  assert.equal(quality.profile().bloom, false);
  for (let i = 0; i < 2000; i++) quality.sample(16);
  assert.equal(quality.level, 2);
  assert(changes.length >= 4);
  assert.equal(quality.cycle().mode, "smooth");
  assert.equal(quality.profile().effects, false);
  const level = quality.level;
  for (let i = 0; i < 500; i++) quality.sample(80);
  assert.equal(quality.level, level);
  assert.equal(quality.cycle().mode, "cinema");
  assert.equal(quality.cycle().mode, "auto");
});
