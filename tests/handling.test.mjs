import test from "node:test";
import assert from "node:assert/strict";
import { ArcadeHandling } from "../src/engine/handling.js";

function drive(h, speed, seconds, controls) {
  let distance = 0;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    speed = h.step(speed, 1 / 60, controls).speed;
    distance += Math.abs(speed) / 60;
  }
  return { speed, distance };
}
test("braking stops a 100 km/h car before it starts reversing", () => {
  const h = new ArcadeHandling();
  const stopped = drive(h, 100 / 3.6, 0.8, { throttle: -1 });
  assert(Math.abs(stopped.speed) < 0.1);
  assert(stopped.distance < 14);
  assert(drive(h, 0, 1, { throttle: -1 }).speed < 0);
});
test("rocket release preserves momentum and settles to ordinary top speed", () => {
  const h = new ArcadeHandling();
  const fast = drive(h, 0, 8, { throttle: 1, boosting: true });
  assert(fast.speed > 55 && fast.speed <= 61);
  const release = h.step(fast.speed, 1 / 60, { throttle: 1 });
  assert(release.speed > 50);
  assert(release.speed < fast.speed);
  assert(drive(h, release.speed, 5, { throttle: 1 }).speed <= 38.01);
});
test("steering eases in, centers quickly and reduces authority at high speed", () => {
  const slow = new ArcadeHandling(),
    fast = new ArcadeHandling();
  slow.step(20, 1 / 60, { turn: 1 });
  assert(slow.steering > 0 && slow.steering < 0.2);
  drive(slow, 20, 0.5, { turn: 1, throttle: 1 });
  drive(fast, 61, 0.5, { turn: 1, throttle: 1, boosting: true });
  assert(fast.yawRate < slow.yawRate);
  drive(slow, 20, 0.5, {});
  assert(Math.abs(slow.steering) < 0.01);
});
test("handbrake allows more lateral slip while normal tires recover grip", () => {
  const normal = new ArcadeHandling(),
    drift = new ArcadeHandling();
  drive(normal, 30, 0.7, { turn: 1, throttle: 1 });
  drive(drift, 30, 0.7, { turn: 1, throttle: 1, handbrake: true });
  assert(Math.abs(drift.lateral) > Math.abs(normal.lateral));
  drive(normal, 30, 0.7, {});
  assert(Math.abs(normal.lateral) < 0.1);
});
