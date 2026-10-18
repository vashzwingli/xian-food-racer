import * as THREE from "three";
export const MENU_SHOT = {
  position: [28, 5.8, -47],
  target: [0, 11.5, 0],
  car: [8.5, 0.03, -28],
  yaw: 2.1,
};
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));
export function createEntrance(camera, getTower, onFinish) {
  const approach = new THREE.CatmullRomCurve3(
    [
      [0, 16.8, 45],
      [0, 15.9, 40],
      [0, 7.5, 28],
      [0, 3.4, 23],
      [0, 3.15, 20],
    ].map((p) => new THREE.Vector3(...p)),
  );
  const arrival = new THREE.CatmullRomCurve3(
    [[0, 3.15, -21], [0, 4.4, -33], [12, 7.2, -43], MENU_SHOT.position].map(
      (p) => new THREE.Vector3(...p),
    ),
  );
  const target = new THREE.Vector3(),
    p = new THREE.Vector3();
  let started = 0,
    playing = false,
    progress = 0,
    insideFrames = 0,
    crossed = false,
    exited = false;
  function pose(t) {
    if (t < 0.13) {
      p.set(0, 16.8, 45);
      target.set(0, 14.5, 0);
    } else if (t < 0.37) {
      const k = (t - 0.13) / 0.24;
      approach.getPoint(k, p);
      target.set(0, THREE.MathUtils.lerp(14.5, 3.35, smooth(k)), -20);
    } else if (t < 0.66) {
      const k = (t - 0.37) / 0.29;
      p.set(0, 3.15, THREE.MathUtils.lerp(20, -21, k));
      target.set(0, 3.3, -46);
    } else {
      const k = (t - 0.66) / 0.34;
      // Preserve the entering speed, then come to rest at the menu camera.
      arrival.getPoint(k + k * k - k * k * k, p);
      target
        .set(0, 3.3, -46)
        .lerp(new THREE.Vector3(...MENU_SHOT.target), smooth(clamp(k * 1.8)));
    }
    camera.position.copy(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
  }
  function finish() {
    playing = false;
    progress = 1;
    getTower()?.open(1);
    camera.position.set(...MENU_SHOT.position);
    target.set(...MENU_SHOT.target);
    camera.lookAt(...MENU_SHOT.target);
    onFinish();
  }
  return {
    start() {
      started = performance.now();
      progress = 0;
      insideFrames = 0;
      crossed = exited = false;
      playing = true;
      getTower()?.open(0);
      pose(0);
    },
    update(now) {
      if (!playing) return;
      progress = clamp((now - started) / 6100);
      pose(progress);
      getTower()?.open(smooth(clamp(progress / 0.27)));
      if (p.z < 14 && p.z > -14 && Math.abs(p.x) < 3) {
        insideFrames++;
        crossed = true;
      }
      if (progress > 0.6 && p.z < -15) exited = true;
      if (progress >= 1) finish();
    },
    skip: finish,
    snapshot() {
      return {
        playing,
        progress,
        insideFrames,
        crossed,
        exited,
        camera: camera.position.toArray(),
        target: target.toArray(),
      };
    },
    get playing() {
      return playing;
    },
  };
}
