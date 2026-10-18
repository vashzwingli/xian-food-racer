import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera } from "three";
import { createEntrance, MENU_SHOT } from "../src/engine/entrance.js";

test("an eight-second renderer stall cannot skip the gate passage", () => {
  const camera = new PerspectiveCamera(73, 1.6, 0.1, 2000);
  let finished = 0,
    opened = 0;
  const entrance = createEntrance(
    camera,
    () => ({
      open: (value) => {
        opened = value;
      },
    }),
    () => {
      finished++;
    },
  );
  entrance.start(0);
  entrance.update(8000);
  assert(entrance.snapshot().progress < 0.1);
  assert(entrance.playing && !entrance.snapshot().crossed);
  for (let now = 8100; entrance.playing && now < 20000; now += 100)
    entrance.update(now);
  const shot = entrance.snapshot();
  assert(shot.crossed && shot.exited && shot.insideFrames > 10);
  assert.deepEqual(shot.camera, MENU_SHOT.position);
  assert.deepEqual(shot.target, MENU_SHOT.target);
  assert.equal(opened, 1);
  assert.equal(finished, 1);
});
