import * as THREE from "three";
import { createGeometryKit } from "./models/procedural.js";
import { createPlayerVehicle } from "./models/player-car.js";
import { WheelInstances } from "./engine/wheel-instances.js";
import { RoadIndex } from "./engine/road-index.js";
import { AdaptiveQuality, FixedStepClock } from "./engine/performance.js";
import { batchRig } from "./engine/batching.js";
import { composeMusic } from "./audio/synth-score.js";
import { LocalTrack } from "./audio/local-track.js";
import { districtNames, streetMemories } from "./content.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
const uiCache = new Map();
const $ = (id) => {
  if (!uiCache.has(id)) uiCache.set(id, document.getElementById(id));
  return uiCache.get(id);
};
const scene = new THREE.Scene();
scene.background = new THREE.Color("#172638");
scene.fog = new THREE.FogExp2("#172638", 0.0027);
const camera = new THREE.PerspectiveCamera(
    73,
    innerWidth / innerHeight,
    0.1,
    1500,
  ),
  renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.info.autoReset = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer),
  room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.05).texture;
room.dispose();
pmrem.dispose();
scene.environmentIntensity = 0.3;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.23,
  0.35,
  1.8,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight(0xc0d5ec, 0x63503e, 0.62));
const moon = new THREE.DirectionalLight(0xbcd1ea, 0.9);
moon.position.set(60, 120, 45);
scene.add(moon);
const warm = new THREE.DirectionalLight(0xffc87b, 0.65);
warm.position.set(-45, 30, 65);
scene.add(warm);
const world = new THREE.Group();
scene.add(world);
const { mat, texture, box, cylinder, sphere, sign, materials, geometryCache } =
  createGeometryKit(world);
const brickTexture = texture((c, w, h) => {
  c.fillStyle = "#626367";
  c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32)
    for (let x = -64; x < w; x += 96) {
      let off = (y / 32) % 2 ? 48 : 0;
      c.fillStyle = ["#747171", "#666667", "#7c7772"][
        (((x + 64) / 96) % 3) | 0
      ];
      c.fillRect(x + off + 2, y + 2, 92, 28);
      c.fillStyle = "#8c8580";
      c.fillRect(x + off + 3, y + 3, 90, 1);
    }
});
brickTexture.wrapS = brickTexture.wrapT = THREE.RepeatWrapping;
brickTexture.repeat.set(1, 1);
const roadTexture = texture((c, w, h) => {
  c.fillStyle = "#303940";
  c.fillRect(0, 0, w, h);
  let seed = 431;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 14000; i++) {
    let v = 45 + Math.floor(rnd() * 12);
    c.fillStyle = "rgba(" + v + "," + (v + 6) + "," + (v + 9) + ",.23)";
    c.fillRect(rnd() * w, rnd() * h, 0.5 + rnd() * 1.4, 0.5 + rnd() * 1.4);
  }
  for (let j = 0; j < 4; j++) {
    c.strokeStyle = "#20293088";
    c.lineWidth = 1.1;
    c.beginPath();
    let x = rnd() * w,
      y = rnd() * h;
    c.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rnd() - 0.5) * 24;
      y += rnd() * 20;
      c.lineTo(x, y);
    }
    c.stroke();
  }
});
roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(1, 1);
const wetRoughness = texture((c, w, h) => {
  c.fillStyle = "#868686";
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) {
    let x = (i * 131) % w,
      y = (i * 79) % h;
    c.save();
    c.translate(x, y);
    c.scale(1, 0.45);
    const grad = c.createRadialGradient(0, 0, 5, 0, 0, 80);
    grad.addColorStop(0, "#252525");
    grad.addColorStop(1, "#868686");
    c.fillStyle = grad;
    c.beginPath();
    c.arc(0, 0, 80, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
});
wetRoughness.wrapS = wetRoughness.wrapT = THREE.RepeatWrapping;
const roofTexture = texture((c, w, h) => {
  c.fillStyle = "#37444b";
  c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    const gr = c.createLinearGradient(x, 0, x + 32, 0);
    gr.addColorStop(0, "#202d35");
    gr.addColorStop(0.35, "#586365");
    gr.addColorStop(1, "#35464c");
    c.fillStyle = gr;
    c.fillRect(x, 0, 31, h);
  }
  for (let y = 0; y < h; y += 38) {
    c.fillStyle = "#172e35";
    c.fillRect(0, y, w, 2);
    c.fillStyle = "#68716a";
    c.fillRect(0, y + 3, w, 1);
  }
});
const asphalt = new THREE.MeshStandardMaterial({
    map: roadTexture,
    color: "#b1bdc4",
    metalness: 0.26,
    roughness: 0.47,
    roughnessMap: wetRoughness,
  }),
  stone = new THREE.MeshStandardMaterial({
    map: brickTexture,
    color: "#a99c8a",
    roughness: 0.84,
  }),
  red = mat("#9a3b2c", 0.25, 0.4),
  gold = mat("#e0b367", 0.65, 0.28),
  teal = mat("#78d9ba", 0.2, 0.35, 1.6),
  white = mat("#fff0cc", 0.15, 0.3, 2.1),
  roofMat = new THREE.MeshStandardMaterial({
    map: roofTexture,
    color: "#b1b3a0",
    roughness: 0.58,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
let lanterns = [],
  windowBatches = { warm: [], cool: [] };
function roof(w, d, y, rise, parent) {
  const cols = 16,
    verts = [],
    uv = [],
    indices = [];
  for (let iz = 0; iz <= cols; iz++)
    for (let ix = 0; ix <= cols; ix++) {
      let x = (ix / cols) * 2 - 1,
        z = (iz / cols) * 2 - 1;
      verts.push(
        (x * w) / 2,
        y +
          (1 - Math.max(Math.max(0, Math.abs(x) - 0.32) / 0.68, Math.abs(z))) *
            rise +
          Math.pow(Math.abs(x * z), 5) * 0.7,
        (z * d) / 2,
      );
      uv.push(ix / cols, iz / cols);
    }
  for (let iz = 0; iz < cols; iz++)
    for (let ix = 0; ix < cols; ix++) {
      let k = iz * (cols + 1) + ix;
      indices.push(k, k + cols + 1, k + 1, k + 1, k + cols + 1, k + cols + 2);
    }
  let g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  parent.add(new THREE.Mesh(g, roofMat));
  box(w, 0.14, d, 0, y - 0.05, 0, mat("#453d32", 0.2, 0.65), parent);
  for (let side of [-1, 1]) {
    box(w, 0.09, 0.11, 0, y + 0.04, (side * d) / 2, gold, parent);
    box(0.11, 0.09, d, (side * w) / 2, y + 0.04, 0, gold, parent);
  }
  box(w * 0.5, 0.2, 0.3, 0, y + rise + 0.02, 0, gold, parent);
  for (let end of [-1, 1]) {
    let horn = box(
      0.28,
      0.7,
      0.28,
      end * w * 0.25,
      y + rise + 0.3,
      0,
      gold,
      parent,
    );
    horn.rotation.z = end * -0.55;
  }
}
function lantern(x, y, z, scale = 1, parent = world) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  parent.add(g);
  sphere(0.48, 0.61, 0.48, 0, 0, 0, mat("#c34d2a", 0.1, 0.55, 1.1), g);
  cylinder(0.29, 0.29, 0.12, 0, 0.58, 0, gold, g);
  cylinder(0.25, 0.25, 0.13, 0, -0.59, 0, gold, g);
  cylinder(0.025, 0.025, 0.5, 0, 0.93, 0, mat("#5b3e2e"), g, 6);
  for (let k = 0; k < 8; k++) {
    let a = (k * Math.PI) / 4;
    let line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 13 }, (_, j) => {
          let t = (j / 12) * Math.PI;
          return new THREE.Vector3(
            Math.sin(t) * 0.485 * Math.cos(a),
            Math.cos(t) * 0.59,
            Math.sin(t) * 0.485 * Math.sin(a),
          );
        }),
      ),
      new THREE.LineBasicMaterial({
        color: "#eab65d",
        transparent: true,
        opacity: 0.7,
      }),
    );
    g.add(line);
  }
  for (let k = -1; k <= 1; k++)
    cylinder(0.016, 0.016, 0.35, k * 0.09, -0.85, 0, gold, g, 4);
  lanterns.push(g);
  return g;
}
function clockTower() {
  const g = new THREE.Group();
  world.add(g);
  box(34, 7.7, 29, 0, 3.35, 0, stone, g);
  box(35.2, 0.45, 30.2, 0, 7.3, 0, gold, g);
  for (let side of [-1, 1]) {
    box(12, 0.2, 8, side * 12, 0.1, 18, stone, g);
    box(10, 5.6, 0.08, 0, 2.25, side * 14.55, mat("#152029"), g);
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(5, 1.0, 6, 20, Math.PI),
      stone,
    );
    arch.position.set(0, 4.0, side * 14.58);
    g.add(arch);
  }
  for (let i = 0; i < 5; i++)
    box(34 - i * 0.6, 0.18, 29 - i * 0.5, 0, 7.65 + i * 0.15, 0, stone, g);
  for (let level = 0; level < 2; level++) {
    let yy = 8.7 + level * 8,
      w = 24 - level * 5,
      d = 20 - level * 4;
    box(w, 5.4, d, 0, yy + 2.7, 0, red, g);
    for (let side of [-1, 1]) {
      for (let x = -w / 2 + 1; x < w / 2; x += 3.7) {
        cylinder(0.28, 0.32, 5.8, x, yy + 2.9, side * (d / 2 + 0.35), red, g);
        box(
          2.3,
          3,
          0.12,
          x + 1.4,
          yy + 3,
          side * (d / 2 + 0.07),
          mat("#4d2720"),
          g,
        );
        for (let j = 0; j < 4; j++)
          box(
            0.08,
            2.8,
            0.08,
            x + 0.55 + j * 0.45,
            yy + 3,
            side * (d / 2 + 0.19),
            gold,
            g,
          );
      }
      box(w + 2, 0.25, d + 2, 0, yy - 0.15, 0, gold, g);
      for (let side of [-1, 1])
        box(
          w + 2,
          0.055,
          0.09,
          0,
          yy - 0.32,
          side * (d / 2 + 1),
          mat("#dc9e4c", 0.2, 0.4, 1.4),
          g,
        );
      box(w + 1, 0.3, 0.15, 0, yy + 1, side * (d / 2 + 0.8), red, g);
      for (let x = -w / 2; x <= w / 2; x += 1.8)
        box(0.11, 1, 0.11, x, yy + 0.5, side * (d / 2 + 0.8), gold, g);
    }
    roof(w + 9, d + 9, yy + 5.8, 3.3, g);
  }
  roof(19, 17, 29.7, 3.7, g);
  cylinder(0.1, 0.3, 2, 0, 34, 0, gold, g);
  sphere(0.4, 0.4, 0.4, 0, 35, 0, gold, g);
  for (let side of [-1, 1]) {
    sign("钟 楼", 0, 20.2, side * 8.2, "#f1c477", 6, g).rotation.y =
      side < 0 ? Math.PI : 0;
    for (let x of [-10.5, -3.5, 3.5, 10.5])
      lantern(x, 12.3, side * 11.2, 0.8, g);
  }
  for (let i = 0; i < 10; i++) {
    box(10, 0.25, 1.1, 22, 7.3 - i * 0.73, -8 + i * 1.1, stone, g);
  }
  for (let x of [-18, 18]) {
    const light = new THREE.PointLight(0xffb257, 420, 52, 2);
    light.position.set(x, 7, 8);
    g.add(light);
  }
}
let difficulty = 0,
  points = [],
  N = 320,
  width = 26,
  obstacles = [],
  gates = [],
  length = 0;
let roadIndex;
let seed = 71;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function wallRise(t) {
  t = ((t % 1) + 1) % 1;
  const up = THREE.MathUtils.smoothstep(t, 0.35, 0.425),
    down = 1 - THREE.MathUtils.smoothstep(t, 0.565, 0.635);
  return up * down;
}
function point(t) {
  const a = t * Math.PI * 2,
    w = wallRise(t);
  return new THREE.Vector3(
    Math.sin(a) * (325 + 32 * Math.cos(3 * a)),
    0.12 + 11.6 * w + (1 - w) * difficulty * 0.07 * Math.sin(a * 3) ** 2,
    Math.cos(a) * (248 + 25 * Math.sin(2 * a)),
  );
}
let traffic = [],
  wheelInstances;
function batchCity() {
  world.updateMatrixWorld(true);
  const buckets = new Map(),
    remove = [];
  world.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    let ancestor = o,
      dynamic = false;
    while (ancestor && ancestor !== world) {
      if (ancestor.userData.dynamic) dynamic = true;
      ancestor = ancestor.parent;
    }
    if (dynamic) return;
    const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),
      key =
        o.material.uuid +
        ":" +
        Math.floor(wp.x / 135) +
        ":" +
        Math.floor(wp.z / 135);
    let g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (let name of Object.keys(g.attributes))
      if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv)
      g.setAttribute(
        "uv",
        new THREE.BufferAttribute(
          new Float32Array(g.attributes.position.count * 2),
          2,
        ),
      );
    if (!buckets.has(key))
      buckets.set(key, { material: o.material, geometries: [] });
    buckets.get(key).geometries.push(g);
    remove.push(o);
  });
  for (let o of remove) {
    o.parent.remove(o);
    if (!o.geometry.userData.shared) o.geometry.dispose();
  }
  for (let bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometries, false);
    for (let g of bucket.geometries) g.dispose();
    if (geometry) {
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, bucket.material);
      mesh.matrixAutoUpdate = false;
      world.add(mesh);
    }
  }
  const lines = [];
  world.traverse((o) => {
    if (o.isLine && !o.isLineSegments) lines.push(o);
  });
  const lineBuckets = new Map();
  for (let o of lines) {
    let positions = o.geometry.attributes.position;
    let wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),
      key = Math.floor(wp.x / 90) + ":" + Math.floor(wp.z / 90);
    if (!lineBuckets.has(key)) lineBuckets.set(key, []);
    let out = lineBuckets.get(key);
    for (let i = 0; i < positions.count - 1; i++) {
      for (let j of [i, i + 1]) {
        let v = new THREE.Vector3()
          .fromBufferAttribute(positions, j)
          .applyMatrix4(o.matrixWorld);
        out.push(v.x, v.y, v.z);
      }
    }
    o.parent.remove(o);
    o.geometry.dispose();
    o.material.dispose();
  }
  for (let vertices of lineBuckets.values()) {
    let g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    world.add(
      new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({
          color: "#d6a75c",
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );
  }
  lanterns = [];
}
function pagoda() {
  const g = new THREE.Group();
  g.position.set(-104, 0, -42);
  world.add(g);
  box(32, 0.5, 32, 0, 0.1, 0, stone, g);
  for (let k = 0; k < 7; k++) {
    const w = 20 - k * 1.7,
      y = k * 5.4;
    box(w, 5.1, w, 0, y + 2.7, 0, mat("#bba17a", 0.1, 0.77), g);
    box(w + 1.6, 0.35, w + 1.6, 0, y + 5.25, 0, mat("#826f56", 0.1, 0.65), g);
    for (let side of [-1, 1]) {
      box(1.6, 2.7, 0.07, 0, y + 2.4, side * (w / 2 + 0.04), mat("#313132"), g);
      box(w, 0.1, 0.05, 0, y + 0.7, side * (w / 2 + 0.07), gold, g);
    }
  }
  cylinder(0.15, 0.5, 3, 0, 39, 0, gold, g);
  sign("雁 塔 古 院", 0, 3.4, 11, "#efd5a5", 8, g);
  for (let x of [-19, 19]) {
    let l = new THREE.PointLight(0xffb56a, 220, 50, 2);
    l.position.set(x, 6, 12);
    g.add(l);
  }
  for (let k = 0; k < 8; k++)
    box(18, 0.18, 1, 0, 1.5 - k * 0.2, 15 + k, stone, g);
}
function tree(x, y, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  world.add(g);
  cylinder(0.15, 0.3, 4, 0, 2, 0, mat("#514339"), g, 7);
  for (let k = 0; k < 3; k++)
    sphere(
      1.6,
      1.1,
      1.6,
      Math.sin(k * 2.1) * 0.8,
      4.5 + k * 0.5,
      Math.cos(k * 2.1) * 0.8,
      mat(k % 2 ? "#405843" : "#69734b"),
      g,
    );
  box(2.8, 0.4, 2.8, 0, 0.2, 0, stone, g);
}
function noodleSculpture(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  world.add(g);
  cylinder(4.6, 2.7, 2.4, 0, 1.5, 0, mat("#e6cda1", 0.3, 0.35), g, 32);
  cylinder(4.25, 4.25, 0.1, 0, 2.75, 0, mat("#a94c2a"), g, 32);
  for (let k = 0; k < 9; k++) {
    let a = k * 0.7,
      curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 15 }, (_, j) => {
          let t = j / 14;
          return new THREE.Vector3(
            Math.sin(t * Math.PI * 2 + k) * 2.7,
            2.8 + Math.sin(t * Math.PI) * 0.4,
            Math.cos(t * Math.PI * 2 + k) * 2.7,
          );
        }),
      );
    g.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 20, 0.13, 5, false),
        mat("#efd39a"),
      ),
    );
  }
  for (let side of [-1, 1]) {
    let chop = box(0.16, 9, 0.16, side * 0.6, 6, 0, mat("#b78c4e"), g);
    chop.rotation.z = -0.4;
    chop.rotation.x = 0.3;
  }
  sign("油泼面 · 比车还带劲", 0, 1.4, 4.5, "#9a3322", 6, g);
}
const roadQuips = [
  "面条像裤带 · 车别压线",
  "锅盔像锅盖 · 翻滚看手艺",
  "油泼辣子一道菜 · 火箭往前迈",
  "泡馍自己掰 · 弯道自己拐",
  "冰峰配凉皮 · 油门得心应手",
  "额滴神啊 · 前面又是弯",
  "咥饱了再跑 · 刹车也得好",
  "八百里秦川 · 一脚油门谝",
];
const checkpointQuips = [
  "馍要酥，方向要稳。",
  "面条像裤带，车道可不能随便拽！",
  "油泼辣子滋啦响，燃料给你加满上！",
  "泡馍自己掰，弯道自己拐。",
  "冰峰配凉皮，这圈美得很！",
  "额滴神啊，你都开到陕北咧！",
  "秦岭的弯有点绕，先松油门再傲娇。",
  "三秦碳水已到位，终点再咥一碗！",
];
function roadBoard(index, text, side = -1) {
  const p = points[index],
    n = points[(index + 1) % N],
    a = Math.atan2(n.x - p.x, n.z - p.z),
    right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
    q = p.clone().addScaledVector(right, side * 20.5);
  const g = new THREE.Group();
  g.position.copy(q);
  g.rotation.y = a;
  world.add(g);
  for (let x of [-4.6, 4.6])
    cylinder(0.09, 0.12, 4.2, x, 2.1, 0, mat("#504638"), g);
  sign(text, 0, 3.9, 0, "#f3cf91", 10, g).rotation.y = Math.PI;
  box(10.4, 0.2, 0.5, 0, 5.15, 0, red, g);
}
function caveCourtyard(x, z, angle, y = 0) {
  if (y > 0.1) {
    const base = box(52, y, 29, x, y / 2, z, stone);
    base.rotation.y = angle;
  }
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = angle;
  world.add(g);
  sphere(26, 10, 13, 0, 3, -4, mat("#a99165"), g);
  box(31, 0.4, 18, 0, 0.1, 5, stone, g);
  for (let i = -1; i <= 1; i++) {
    const xx = i * 9;
    box(8, 6, 2, xx, 3, 3, mat("#ad936a"), g);
    box(3.1, 3.1, 0.1, xx, 1.6, 4.07, mat("#342d25"), g);
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.25, 7, 18, Math.PI),
      mat("#d4b98b"),
    );
    arch.position.set(xx, 3.1, 4.12);
    g.add(arch);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 20, 0, Math.PI),
      mat("#342d25"),
    );
    fill.position.set(xx, 3.1, 4.1);
    g.add(fill);
    for (let j = -2; j <= 2; j++)
      box(0.07, 3.6, 0.1, xx + j * 0.52, 1.8, 4.2, mat("#725738"), g);
    box(3.2, 0.07, 0.15, xx, 1.5, 4.25, gold, g);
    lantern(xx + 3, 4.2, 4.4, 0.65, g);
    for (let j = 0; j < 4; j++) {
      const chili = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.5, 6),
        mat("#b2442b"),
      );
      chili.position.set(xx - 3.1, 3.8 - j * 0.4, 4.3);
      g.add(chili);
    }
  }
  sign("陕北窑洞 · 馍力补给", 0, 6.4, 4.25, "#f5d7a3", 16, g);
  cylinder(2.4, 2.4, 0.25, -11, 0.7, 9, mat("#b89761"), g, 24);
  cylinder(1.9, 1.9, 0.25, -11, 0.88, 9, mat("#e7c585"), g, 24);
  for (let j = 0; j < 3; j++) {
    cylinder(0.7, 0.6, 0.4, 8 + j * 1.2, 0.6, 9, mat("#765d43"), g, 14);
  }
  for (let j = 0; j < 6; j++) {
    box(1.8, 0.3, 1.1, -5 + j * 2.1, 0.4, 11, mat("#6d5744"), g);
  }
}
function addTrafficWheel(parent, x, z, radius, axle) {
  const g = new THREE.Group();
  g.position.set(x, radius, z);
  g.rotation.z = Math.PI / 2;
  parent.add(g);
  const tireKey = "traffic-tire:" + radius;
  if (!geometryCache.has(tireKey)) {
    const geometry = new THREE.TorusGeometry(
      radius * 0.74,
      radius * 0.25,
      8,
      18,
    );
    geometry.userData.shared = true;
    geometryCache.set(tireKey, geometry);
  }
  const tire = new THREE.Mesh(geometryCache.get(tireKey), rubber);
  tire.rotation.x = Math.PI / 2;
  g.add(tire);
  cylinder(
    radius * 0.62,
    radius * 0.62,
    0.32,
    0,
    0,
    0,
    mat("#9ca5a6", 0.75, 0.3),
    g,
    16,
  );
  cylinder(radius * 0.22, radius * 0.22, 0.35, 0, 0, 0, carbon, g, 12);
  g.userData.animated = true;
  axle.push(g);
}
function trafficModel(type, index) {
  const g = new THREE.Group();
  g.userData.dynamic = true;
  const axle = [],
    bodyMat = mat(
      ["#b59652", "#376a71", "#9e4937", "#7b7895"][index % 4],
      0.45,
      0.35,
    ),
    busMat = mat("#698d83", 0.25, 0.4);
  let w = 1.95,
    l = 4.5,
    h = 1.55;
  if (type === "taxi") {
    loft(
      [
        [-2.2, 0.8, 0.3, 0.5],
        [-1.5, 0.96, 0.3, 0.65],
        [0.7, 0.94, 0.3, 0.55],
        [2.2, 0.81, 0.3, 0.4],
      ],
      bodyMat,
      g,
    );
    loft(
      [
        [-1.1, 0.72, 0.85, 0.08],
        [-0.7, 0.74, 0.85, 0.7],
        [0.4, 0.71, 0.85, 0.67],
        [1, 0.65, 0.85, 0.1],
      ],
      glass,
      g,
    );
    box(1.24, 0.08, 1.2, -0, 1.57, -0.2, bodyMat, g);
    box(0.8, 0.22, 0.4, 0, 1.75, -0.2, mat("#d5cda4", 0.2, 0.5, 0.3), g);
    const taxi = sign("陕 A 夜食", 0, 1.76, 0.03, "#3a5f53", 0.76, g);
    for (let x of [-1, 1]) {
      box(0.3, 0.12, 0.2, x * 1.02, 1.15, 0.6, bodyMat, g);
      box(0.07, 0.04, 2.7, x * 0.94, 0.9, -0.1, gold, g);
      for (let z of [-0.55, 0.9])
        box(0.11, 0.04, 0.28, x * 0.97, 1, z, carbon, g);
    }
    for (let x of [-0.97, 0.97])
      for (let z of [-1.4, 1.4]) addTrafficWheel(g, x, z, 0.43, axle);
  } else if (type === "bus") {
    w = 2.35;
    l = 7.8;
    h = 2.95;
    box(w, 1.35, l, 0, 1, 0, busMat, g);
    box(w - 0.08, 1.05, l - 0.1, 0, 2.16, 0, glass, g);
    box(w, 0.25, l, 0, 2.82, 0, mat("#d0ceba", 0.2, 0.45), g);
    box(w, 0.08, l, 0, 1.58, 0, mat("#d1bc89", 0.3, 0.4), g);
    for (let x of [-1.18, 1.18])
      for (let z = -3.2; z < 3.6; z += 1.18)
        box(0.08, 1.2, 0.1, x, 2.2, z, busMat, g);
    for (let z of [-2.45, 2.5])
      for (let x of [-1.15, 1.15]) addTrafficWheel(g, x, z, 0.51, axle);
    box(1.4, 0.25, 2.1, 0, 3.05, -0.5, mat("#a4aaa2", 0.3, 0.5), g);
    for (let z of [-1.1, -0.4, 0.3])
      box(1.2, 0.03, 0.06, 0, 3.19, z, carbon, g);
    sign(
      Math.floor(index / 3) % 2 ? "616" : "215",
      0,
      2.51,
      3.96,
      "#ffc66e",
      1.95,
      g,
    );
    for (let x of [-1.19, 1.19]) {
      box(0.045, 1.8, 0.75, x, 1.45, 2.85, carbon, g);
      box(0.05, 0.05, 0.6, x, 1.5, 2.85, gold, g);
      for (let z of [-2.4, -2.1, -1.8, -1.5])
        box(0.02, 0.07, 0.19, x, 0.8, z, carbon, g);
    }
    for (let side of [-1, 1])
      sign(
        (Math.floor(index / 3) % 2 ? "616" : "215") + " 路",
        side * 1.185,
        1.35,
        -0.5,
        "#eed19a",
        1.2,
        g,
      ).rotation.y = (side * Math.PI) / 2;
    sign(
      Math.floor(index / 3) % 2 ? "616" : "215",
      0,
      2.5,
      -3.96,
      "#ffc66e",
      1.2,
      g,
    ).rotation.y = Math.PI;
  } else {
    w = 2.25;
    l = 6;
    h = 2.7;
    box(2.1, 0.25, 5.8, 0, 0.53, 0, carbon, g);
    box(2.05, 1.22, 1.85, 0, 1.16, 2, mat("#d8cfaa", 0.25, 0.45), g);
    box(1.84, 0.85, 0.13, 0, 1.92, 2.98, glass, g);
    box(2.12, 0.2, 2.05, 0, 2.4, 2, bodyMat, g);
    for (let side of [-1, 1]) {
      box(0.12, 0.6, 0.12, side * 1.1, 2.15, 2.7, carbon, g);
      box(0.14, 0.45, 0.28, side * 1.13, 2.22, 2.65, glass, g);
    }
    box(2.23, 2.2, 3.7, 0, 1.65, -0.87, bodyMat, g);
    for (let z = -2.5; z < 1; z += 0.35)
      for (let side of [-1, 1])
        box(0.02, 2.05, 0.035, side * 1.13, 1.65, z, gold, g);
    for (let side of [-1, 1])
      sign(
        index % 2 ? "冰峰补给车" : "馍力运输",
        side * 1.14,
        1.8,
        -0.7,
        "#f3dfb7",
        2.8,
        g,
      ).rotation.y = (side * Math.PI) / 2;
    for (let x of [-1.1, 1.1])
      for (let z of [-1.8, 1.9]) addTrafficWheel(g, x, z, 0.48, axle);
    box(1.85, 1.8, 0.06, 0, 1.7, -2.76, mat("#9e9b85", 0.35, 0.6), g);
    box(0.05, 1.65, 0.06, 0, 1.7, -2.82, carbon, g);
  }
  for (let side of [-1, 1]) {
    box(0.38, 0.12, 0.08, side * w * 0.34, 0.95, l / 2 + 0.05, white, g);
    box(
      0.3,
      0.11,
      0.07,
      side * w * 0.36,
      0.88,
      -l / 2 - 0.06,
      mat("#c54d38", 0.2, 0.4, 1.5),
      g,
    );
  }
  box(w * 0.88, 0.09, 0.14, 0, 0.36, l / 2 + 0.02, carbon, g);
  for (let j = -2; j <= 2; j++)
    box(0.04, 0.24, 0.03, j * 0.12, 0.67, l / 2 + 0.08, carbon, g);
  sign(
    "陕A·夜" + String(index + 1).padStart(2, "0"),
    0,
    0.56,
    l / 2 + 0.1,
    "#e9cf8f",
    0.72,
    g,
  );
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 1.4, l + 1.4),
    contactShadow.material.clone(),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  g.add(shadow);
  batchRig(g);
  return {
    g,
    axle,
    w,
    l,
    h,
    type,
    route: type === "bus" ? (Math.floor(index / 3) % 2 ? "616" : "215") : null,
  };
}
function createTraffic() {
  traffic = [];
  const count = 24;
  for (let j = 0; j < count; j++) {
    const v = trafficModel(["taxi", "bus", "truck"][j % 3], j);
    v.dir = j % 2 === 0 ? 1 : -1;
    v.phase = (j + 0.6) / count;
    v.speed = 11 + (j % 6) * 1.55;
    v.lane = (v.dir > 0 ? -1 : 1) * (j % 4 < 2 ? 3.25 : 9.75);
    v.travel = v.phase;
    v.currentSpeed = v.speed;
    v.hits = 0;
    v.lastHit = -9;
    world.add(v.g);
    traffic.push(v);
  }
  wheelInstances = new WheelInstances(world, traffic);
  updateTraffic(0);
  wheelInstances.update();
}
function updateTraffic(dt) {
  for (const v of traffic) {
    let leader = null,
      gap = Infinity;
    for (const other of traffic) {
      if (
        other === v ||
        other.dir !== v.dir ||
        Math.abs(other.lane - v.lane) > 1
      )
        continue;
      const d = (((other.travel - v.travel) * v.dir + 1) % 1) * length;
      if (d < gap) {
        gap = d;
        leader = other;
      }
    }
    const safe = leader ? (v.l + leader.l) / 2 + 9 : 0;
    let target = v.speed;
    if (leader && gap < safe + 35)
      target = Math.min(
        target,
        Math.max(0, leader.currentSpeed + (gap - safe) * 0.5),
      );
    v.currentSpeed = Math.min(target, v.currentSpeed + dt * 2);
    if (gap < safe)
      v.currentSpeed = Math.min(
        v.currentSpeed,
        Math.max(0, (gap - safe + 3) * 2),
      );
    if (dt > 0)
      v.travel =
        (((v.travel + ((dt * v.currentSpeed) / length) * v.dir) % 1) + 1) % 1;
  }
  for (const v of traffic) {
    const t = v.travel,
      p = point(t),
      n = point(t + 0.0007),
      a = Math.atan2(n.x - p.x, n.z - p.z),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    v.g.position.copy(p).addScaledVector(r, v.lane);
    v.g.position.y = nearest(v.g.position).ground + 0.025;
    v.heading = a + (v.dir < 0 ? Math.PI : 0);
    v.g.rotation.set(
      -Math.atan2((n.y - p.y) * v.dir, Math.hypot(n.x - p.x, n.z - p.z)),
      v.heading,
      0,
    );
    v.g.visible =
      v.g.position.distanceTo(camera.position) < (quality ? 230 : 155);
    for (const w of v.axle) w.rotateY(v.currentSpeed * dt * 2 * v.dir);
  }
}
let solids = [],
  sites = [],
  pedestrians = [],
  steamVents = [],
  collectibles = [],
  lampAnchors = [],
  pickupGroup = null,
  wallVisits = 0,
  wallOn = false,
  lastSolidHit = -9;
const signCache = new Map(),
  facadeMats = [
    "#756b60",
    "#9b8e79",
    "#646b6e",
    "#8e7762",
    "#77776a",
    "#626e73",
  ].map((c) => mat(c, 0.1, 0.85));
const sidewalkMap = texture((c, w, h) => {
  c.fillStyle = "#8a9292";
  c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 48)
    for (let x = -32; x < w; x += 32) {
      const off = (y / 48) % 2 ? 16 : 0;
      c.fillStyle = "#505c61";
      c.fillRect(x + off, y, 1, 48);
      c.fillRect(x + off, y, 32, 1);
      c.fillStyle = "#a6aaa7";
      c.fillRect(x + off + 1, y + 1, 30, 1);
    }
});
sidewalkMap.wrapS = sidewalkMap.wrapT = THREE.RepeatWrapping;
const deckMap = brickTexture.clone();
deckMap.wrapS = deckMap.wrapT = THREE.RepeatWrapping;
deckMap.repeat.set(5.5, 5.5);
deckMap.needsUpdate = true;
const walkMat = new THREE.MeshStandardMaterial({
    map: sidewalkMap,
    color: "#8a989e",
    metalness: 0.12,
    roughness: 0.72,
  }),
  kerbMat = mat("#858783", 0.05, 0.8),
  lineMat = mat("#c9c2ac", 0.05, 0.65),
  yellowMat = mat("#b8a66c", 0.1, 0.65),
  wallDeckMat = new THREE.MeshStandardMaterial({
    map: deckMap,
    color: "#6c747a",
    roughness: 0.55,
    metalness: 0.2,
  }),
  puddleMat = new THREE.MeshPhysicalMaterial({
    color: "#253c49",
    metalness: 0.38,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
function solidBox(x, z, w, d, angle, minY, maxY, kind = "building") {
  const b = { x, z, w, d, angle, minY, maxY, kind };
  solids.push(b);
  return b;
}
function overlap2D(a, b, pad = 0) {
  const axes = [
    [Math.cos(a.angle), -Math.sin(a.angle)],
    [Math.sin(a.angle), Math.cos(a.angle)],
    [Math.cos(b.angle), -Math.sin(b.angle)],
    [Math.sin(b.angle), Math.cos(b.angle)],
  ];
  for (const [nx, nz] of axes) {
    const project = (o) =>
      Math.abs(nx * Math.cos(o.angle) - nz * Math.sin(o.angle)) *
        (o.w / 2 + pad) +
      Math.abs(nx * Math.sin(o.angle) + nz * Math.cos(o.angle)) *
        (o.d / 2 + pad);
    if (
      Math.abs((a.x - b.x) * nx + (a.z - b.z) * nz) >=
      project(a) + project(b)
    )
      return false;
  }
  return true;
}
function reserveSite(x, z, w, d, angle) {
  const site = { x, z, w: w + 1.8, d: d + 1.8, angle };
  if (
    sites.some(
      (b) =>
        Math.abs(b.x - x) < 50 &&
        Math.abs(b.z - z) < 50 &&
        overlap2D(site, b, 0.3),
    )
  )
    return false;
  for (const xx of [-w / 2, w / 2])
    for (const zz of [-d / 2, d / 2]) {
      const vx = x + xx * Math.cos(angle) + zz * Math.sin(angle),
        vz = z - xx * Math.sin(angle) + zz * Math.cos(angle),
        n = nearest(new THREE.Vector3(vx, 0, vz));
      if (n.dist < width / 2 + 2.4) return false;
    }
  sites.push(site);
  return true;
}
function brickBox(w, h, d, x, y, z, parent = world) {
  const key = "brick" + [w, h, d].join();
  if (!geometryCache.has(key)) {
    const g = new THREE.BoxGeometry(w, h, d),
      uv = g.attributes.uv;
    for (let face = 0; face < 6; face++) {
      let u = face < 2 ? d : face < 4 ? w : w,
        v = face < 2 ? h : face < 4 ? d : h;
      for (let k = 0; k < 4; k++) {
        const i = face * 4 + k;
        uv.setXY(i, (uv.getX(i) * u) / 1.45, (uv.getY(i) * v) / 0.95);
      }
    }
    g.userData.shared = true;
    geometryCache.set(key, g);
  }
  const m = new THREE.Mesh(geometryCache.get(key), stone);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function shopSign(text, x, y, z, size, parent) {
  if (!signCache.has(text)) {
    const tmp = sign(text, 0, 0, 0, "#f0cf92", size, parent);
    tmp.material.userData.sign = false;
    signCache.set(text, tmp.material);
    parent.remove(tmp);
    tmp.geometry.dispose();
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, (size * 160) / 768),
    signCache.get(text),
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function ribbon(a, b, material, lift = 0, start = 0, end = N) {
  if (a > b) [a, b] = [b, a];
  const v = [],
    uv = [],
    ids = [];
  let travelled = 0;
  for (let i = start; i <= end; i++) {
    const p = points[i % N],
      n = points[(i + 1) % N],
      right = new THREE.Vector3(n.z - p.z, 0, p.x - n.x).normalize();
    if (i > start) travelled += p.distanceTo(points[(i - 1) % N]);
    for (let raw of [a, b]) {
      const o =
        Math.abs(raw) > 16.2
          ? Math.sign(raw) *
            Math.min(Math.abs(raw), 21.2 - 5 * Math.min(1, wallRise(i / N) * 6))
          : raw;
      v.push(p.x + right.x * o, p.y + lift, p.z + right.z * o);
      uv.push(o / 8, travelled / 8);
    }
    if (i < end) {
      const k = (i - start) * 2;
      ids.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ids);
  g.computeVertexNormals();
  world.add(new THREE.Mesh(g, material));
}
function buildWall() {
  const start = 112,
    end = 203,
    half = 17.1,
    verts = [],
    uv = [],
    idx = [];
  for (let side of [-1, 1]) {
    const base = verts.length / 3;
    let length = 0;
    for (let i = start; i <= end; i++) {
      const p = points[i],
        n = points[(i + 1) % N],
        r = new THREE.Vector3(n.z - p.z, 0, p.x - n.x).normalize();
      if (i > start) length += p.distanceTo(points[i - 1]);
      for (let y of [-0.15, p.y - 0.035]) {
        verts.push(p.x + r.x * half * side, y, p.z + r.z * half * side);
        uv.push(length / 1.45, y / 0.95);
      }
      if (i < end) {
        let k = base + (i - start) * 2;
        if (side > 0) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        else idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  world.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: brickTexture,
        color: "#8d8a80",
        roughness: 0.87,
        side: THREE.DoubleSide,
      }),
    ),
  );
  for (let i = start; i < end; i++) {
    const p = points[i],
      q = points[i + 1],
      a = Math.atan2(q.x - p.x, q.z - p.z),
      len = p.distanceTo(q),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    for (let side of [-1, 1]) {
      const mid = p
        .clone()
        .lerp(q, 0.5)
        .addScaledVector(r, side * 16.7);
      const par = brickBox(0.85, 1.1, len + 0.14, mid.x, mid.y + 0.55, mid.z);
      orientGrade(par, p, q);
      solidBox(mid.x, mid.z, 0.85, len + 0.18, a, 0, mid.y + 2.1, "parapet");
      const merlon = brickBox(
        1.0,
        1.0,
        2.6,
        p.x + r.x * 16.7 * side,
        p.y + 1.6,
        p.z + r.z * 16.7 * side,
      );
      merlon.rotation.y = a;
      if (i % 4 === 0) {
        const foot = brickBox(
          2.1,
          p.y,
          2.4,
          p.x + r.x * 17.7 * side,
          p.y / 2 - 0.1,
          p.z + r.z * 17.7 * side,
        );
        foot.rotation.y = a;
      }
    }
  }
  for (let i of [143, 174]) {
    const p = points[i],
      n = points[i + 1],
      a = Math.atan2(n.x - p.x, n.z - p.z),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
      q = p.clone().addScaledVector(r, -27);
    const g = new THREE.Group();
    g.position.set(q.x, 0, q.z);
    g.rotation.y = a;
    world.add(g);
    brickBox(20, p.y + 1, 16, 0, (p.y + 1) / 2, 0, g);
    box(13, 5.7, 10, 0, p.y + 3.85, 0, red, g);
    for (let x of [-5, -2, 2, 5])
      box(1.2, 2.3, 0.08, x, p.y + 3.5, 5.05, mat("#372f28"), g);
    roof(21, 18, p.y + 7, 3.4, g);
    shopSign(
      i === 143 ? "永宁门 · 城墙巡游" : "长安城防 · 趁热咥面",
      0,
      p.y + 5.7,
      5.1,
      11,
      g,
    );
    solidBox(q.x, q.z, 22, 18, a, 0, p.y + 10.5, "tower");
  }
  roadBoard(109, "登城坡道 · 顺路上城墙", -1);
  roadBoard(184, "下城慢行 · 夜市等你咥", 1);
}
function makeArch(p, a, index) {
  const g = new THREE.Group();
  g.position.copy(p);
  g.rotation.y = a;
  world.add(g);
  for (let side of [-1, 1]) {
    brickBox(6, p.y + 0.05, 4, side * 19.4, -(p.y + 0.05) / 2, 0, g);
    brickBox(1.2, 0.5, 1.3, side * 20.8, 0.25, 0, g);
    cylinder(0.31, 0.4, 13.8, side * 20.8, 7.1, 0, red, g);
    cylinder(0.45, 0.45, 0.16, side * 20.8, 13.7, 0, gold, g);
    lantern(side * 20.2, 7.4, 0, 0.95, g);
    solidBox(
      p.x + Math.cos(a) * 14.6 * side,
      p.z - Math.sin(a) * 14.6 * side,
      1.35,
      1.35,
      a,
      p.y,
      p.y + 14,
      "gate",
    );
  }
  box(42.4, 0.35, 1, 0, 14, 0, red, g);
  roof(45, 4, 14.4, 1.7, g);
  shopSign(
    index === 0
      ? "长安夜食 · 起终点"
      : index === 4
        ? "永宁城墙 · 嘹咋咧"
        : districtNames[index],
    0,
    13.6,
    -0.6,
    10,
    g,
  ).rotation.y = Math.PI;
  gates.push(index * 40);
}
const marketNames = [
  "腊汁肉夹馍",
  "秦镇凉皮",
  "手工油泼面",
  "桂花甑糕",
  "羊肉泡馍",
  "冰峰 · 酸梅汤",
  "老陕葫芦头",
  "biangbiang面",
];
function makeMarketBlock(
  x,
  z,
  angle,
  index,
  w = 14,
  depth = 10,
  background = false,
) {
  if (!reserveSite(x, z, w + 2, depth + 3, angle)) return false;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  world.add(g);
  const floors = background ? 3 + (index % 3) : 1 + (index % 3),
    h = background ? floors * 3.1 : 6.2 + (floors - 1) * 3.1,
    front = depth / 2;
  brickBox(w, 0.32, depth, 0, 0.16, 0, g);
  box(w, 0.18, 0.1, 0, 0.42, front + 0.04, mat("#414c4d", 0.1, 0.8), g);
  box(
    w,
    h - 0.32,
    depth,
    0,
    0.32 + (h - 0.32) / 2,
    0,
    facadeMats[index % facadeMats.length],
    g,
  );
  for (let side of [-1, 1])
    box(0.25, h, 0.3, side * (w / 2 - 0.1), h / 2, front + 0.08, red, g);
  box(w, 0.2, 0.7, 0, 3.4, front + 0.2, mat("#655341"), g);
  box(w * 0.9, 2.6, 0.12, 0, 1.7, front + 0.07, mat("#202c31"), g);
  for (let yy = 5.1; yy < h; yy += 3.1) {
    for (let xx = -w / 2 + 1.4; xx < w / 2 - 1; xx += 2.7) {
      box(
        1.45,
        1.7,
        0.12,
        xx,
        yy,
        front + 0.07,
        mat(
          index % 4 ? "#bca67d" : "#7d9b9f",
          0.2,
          0.5,
          index % 4 ? 0.38 : 0.13,
        ),
        g,
      );
      box(0.07, 1.7, 0.15, xx, yy, front + 0.16, mat("#51463c"), g);
      box(1.5, 0.07, 0.15, xx, yy + 0.08, front + 0.16, mat("#51463c"), g);
      if ((index + Math.floor(xx)) % 3 === 0) {
        box(
          0.85,
          0.52,
          0.6,
          xx + 1,
          yy - 0.85,
          front + 0.35,
          mat("#a4a8a0", 0.25, 0.6),
          g,
        );
        for (let k = -2; k <= 2; k++)
          box(
            0.63,
            0.03,
            0.02,
            xx + 1,
            yy - 0.85 + k * 0.07,
            front + 0.66,
            carbon,
            g,
          );
      }
    }
    box(w, 0.1, 0.6, 0, yy - 1.2, front + 0.18, kerbMat, g);
  }
  if (index % 3 === 0) {
    roof(w + 1.7, depth + 1.8, h + 0.25, 1.8, g);
  } else {
    box(w + 0.35, 0.25, depth + 0.4, 0, h + 0.12, 0, stone, g);
    box(w, 0.5, 0.25, 0, h + 0.4, -depth / 2, stone, g);
  }
  const name = marketNames[index % marketNames.length];
  shopSign(background ? "长安人家" : name, 0, 3.95, front + 0.18, w * 0.87, g);
  if (!background) {
    const awning = box(
      w - 0.35,
      0.13,
      2.3,
      0,
      3.26,
      front + 1.08,
      index % 2 ? red : mat("#426560"),
      g,
    );
    awning.rotation.x = -0.06;
    for (let xx = -w / 2 + 0.6; xx < w / 2; xx += 0.85) {
      box(
        0.45,
        0.33,
        0.08,
        xx,
        3.04,
        front + 2.24,
        index % 2 ? mat("#b27a56") : mat("#96a38b"),
        g,
      );
    }
    for (let xx of [-w / 2 + 0.65, w / 2 - 0.65]) {
      cylinder(0.04, 0.04, 3.1, xx, 1.57, front + 2.15, mat("#41484a"), g);
      lantern(xx, 2.55, front + 1.9, 0.58, g);
    }
    box(
      w * 0.66,
      0.88,
      1.05,
      0,
      0.75,
      front + 1.15,
      mat("#785840", 0.15, 0.6),
      g,
    );
    box(
      w * 0.7,
      0.09,
      1.22,
      0,
      1.24,
      front + 1.15,
      mat("#aab2ae", 0.7, 0.27),
      g,
    );
    for (let j = -2; j <= 2; j++) {
      const xx = j * w * 0.115;
      if (index % 3 === 0) {
        for (let k = 0; k < 2; k++) {
          cylinder(
            0.42,
            0.42,
            0.19,
            xx,
            1.39 + k * 0.2,
            front + 1.1,
            mat("#bb9860"),
            g,
            16,
          );
        }
        cylinder(
          0.34,
          0.37,
          0.08,
          xx,
          1.78,
          front + 1.1,
          mat("#e1c590"),
          g,
          16,
        );
        box(0.57, 0.05, 0.38, xx, 1.7, front + 1.1, mat("#785036"), g);
      } else if (index % 3 === 1) {
        sphere(
          0.38,
          0.18,
          0.38,
          xx,
          1.4,
          front + 1.1,
          mat("#d8d6c7", 0.3, 0.3),
          g,
        );
        cylinder(
          0.31,
          0.31,
          0.04,
          xx,
          1.55,
          front + 1.1,
          mat("#c4854b"),
          g,
          16,
        );
        for (let k = 0; k < 3; k++)
          box(
            0.46,
            0.025,
            0.07,
            xx,
            1.6,
            front + 0.97 + k * 0.1,
            mat("#ead1a0"),
            g,
          );
        box(0.5, 0.022, 0.028, xx + 0.05, 1.67, front + 1.1, gold, g);
      } else {
        cylinder(
          0.11,
          0.12,
          0.46,
          xx,
          1.51,
          front + 1.1,
          mat("#d78834", 0.25, 0.23),
          g,
          12,
        );
        cylinder(
          0.07,
          0.07,
          0.14,
          xx,
          1.81,
          front + 1.1,
          mat("#acb2a6", 0.6, 0.2),
          g,
          12,
        );
      }
    }
    box(1.15, 0.75, 0.85, w / 2 - 0.8, 0.65, front + 1.1, carbon, g);
    cylinder(
      0.43,
      0.35,
      0.46,
      w / 2 - 0.8,
      1.25,
      front + 1.1,
      mat("#aab1b1", 0.75, 0.24),
      g,
      18,
    );
    const steamPos = new THREE.Vector3(w / 2 - 0.8, 1.6, front + 1.1);
    g.updateMatrixWorld(true);
    steamVents.push(g.localToWorld(steamPos));
    const board = box(
      1.1,
      1.25,
      0.12,
      -w / 2 + 0.6,
      0.77,
      front + 2.65,
      mat("#364340"),
      g,
    );
    board.rotation.x = -0.12;
    shopSign("热乎现做", -w / 2 + 0.6, 1.02, front + 2.75, 1, g);
    for (let k = 0; k < 2; k++)
      box(
        0.65,
        0.55,
        0.65,
        w / 2 + 0.7,
        0.28,
        front - 0.5 - k * 0.9,
        mat("#876a44"),
        g,
      ); // 厨具与箱子都在人行道内侧
    if (index % 2 === 0) {
      makePerson(g, -1.2, 0.32, front + 0.4, index, false, false, Math.PI);
      makePerson(g, 1.0, 0.32, front + 2.8, index + 2, false, false, Math.PI);
    }
  }
  solidBox(x, z, w, depth, angle, 0, h + 0.2, "building");
  if (!background)
    solidBox(
      x + Math.sin(angle) * (front + 1.15),
      z + Math.cos(angle) * (front + 1.15),
      w * 0.72,
      1.3,
      angle,
      0.3,
      1.35,
      "counter",
    );
  return true;
}
function makePerson(
  parent,
  x,
  y,
  z,
  index,
  walking = false,
  umbrella = true,
  angle = 0,
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = angle;
  parent.add(g);
  if (walking) g.userData.dynamic = true;
  const cloth = mat(
      ["#394c5b", "#8d5c44", "#5e736d", "#66566c", "#9a815d"][index % 5],
      0.02,
      0.86,
    ),
    skin = mat("#bca18a", 0.01, 0.85);
  cylinder(0.17, 0.23, 0.66, 0, 1.12, 0, cloth, g, 9);
  sphere(0.18, 0.22, 0.17, 0, 1.62, 0, skin, g);
  sphere(0.2, 0.1, 0.19, 0, 1.78, 0, mat("#2b2c2c"), g);
  box(0.24, 0.16, 0.09, 0, 1.56, 0.14, skin, g);
  const legs = [];
  for (let side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.userData.animated = walking;
    leg.position.set(side * 0.11, 0.84, 0);
    g.add(leg);
    box(0.12, 0.73, 0.13, 0, -0.365, 0, mat("#30383d"), leg);
    box(0.17, 0.11, 0.29, 0, -0.785, 0.06, mat("#222a2e"), leg);
    legs.push(leg);
    let arm = box(0.12, 0.55, 0.13, side * 0.26, 1.1, 0.04, cloth, g);
    arm.rotation.z = side * -0.14;
    sphere(0.065, 0.08, 0.06, side * 0.3, 0.82, 0.04, skin, g);
  }
  box(0.3, 0.35, 0.12, 0.3, 0.97, -0.08, mat("#776550"), g);
  if (umbrella) {
    const key = "umbrella";
    if (!geometryCache.has(key)) {
      const geo = new THREE.SphereGeometry(
        0.8,
        16,
        7,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      geo.userData.shared = true;
      geometryCache.set(key, geo);
    }
    const u = new THREE.Mesh(
      geometryCache.get(key),
      mat(["#6b5547", "#5b767c", "#843f34", "#515d70"][index % 4], 0.1, 0.45),
    );
    u.scale.y = 0.42;
    u.position.set(0.2, 2.12, 0.03);
    g.add(u);
    cylinder(
      0.014,
      0.014,
      1.3,
      0.2,
      1.62,
      0.03,
      mat("#a4aba7", 0.65, 0.3),
      g,
      6,
    );
    cylinder(0.025, 0.025, 0.14, 0.2, 2.49, 0.03, gold, g, 6);
  }
  if (walking) {
    batchRig(g);
    pedestrians.push({
      g,
      legs,
      index,
      phase: (index * 0.618) % 1,
      side: index % 2 ? 1 : -1,
      speed: 0.75 + (index % 5) * 0.13,
    });
  }
  return g;
}
function streetLight(i, side) {
  const p = points[i],
    n = points[(i + 1) % N],
    a = Math.atan2(n.x - p.x, n.z - p.z),
    r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
    q = p
      .clone()
      .addScaledVector(r, side * (wallRise(i / N) > 0.01 ? 16.1 : 15.2)),
    base = wallRise(i / N) > 0.01 ? p.y + 0.19 : 0.3,
    g = new THREE.Group();
  g.position.set(q.x, base, q.z);
  g.rotation.y = a;
  world.add(g);
  cylinder(0.07, 0.14, 6.8, 0, 3.4, 0, mat("#364247", 0.35, 0.55), g);
  box(1.5, 0.08, 0.12, -side * 0.65, 6.65, 0, mat("#515d62", 0.5, 0.4), g);
  box(0.65, 0.055, 0.35, -side * 1.1, 6.6, 0, mat("#ffe3ae", 0.1, 0.4, 2.2), g);
  if (i % 8 === 0) lantern(0, 4.7, 0, 0.7, g);
  if (i % 16 === 0) {
    lampAnchors.push(
      new THREE.Vector3(
        q.x - r.x * side * 1.1,
        base + 6.4,
        q.z - r.z * side * 1.1,
      ),
    );
  }
  solidBox(q.x, q.z, 0.32, 0.32, a, base, base + 7, "lamp");
}
function orientGrade(mesh, p, n) {
  const a = Math.atan2(n.x - p.x, n.z - p.z),
    pitch = Math.atan2(n.y - p.y, Math.hypot(n.x - p.x, n.z - p.z));
  mesh.rotation.set(0, a, 0);
  mesh.rotateX(-pitch);
}
function groundNormal(p, n) {
  const forward = n.clone().sub(p).normalize(),
    side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  return forward.cross(side).normalize();
}
function streetDetails() {
  for (let i = 0; i < N; i++) {
    const p = points[i],
      n = points[(i + 1) % N],
      a = Math.atan2(n.x - p.x, n.z - p.z),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    if (i % 2 === 0) {
      for (let side of [-1, 1]) {
        const pp = p.clone().addScaledVector(r, side * 13.15);
        const curb = box(
          0.28,
          0.25,
          p.distanceTo(n) * 2 + 0.1,
          pp.x,
          p.y + 0.08,
          pp.z,
          kerbMat,
        );
        orientGrade(curb, p, n);
      }
      for (let off of [-0.16, 0.16]) {
        const mark = box(
          0.075,
          0.018,
          3.7,
          p.x + r.x * off,
          p.y + 0.017,
          p.z + r.z * off,
          yellowMat,
        );
        orientGrade(mark, p, n);
      }
      for (let off of [-6.5, 6.5]) {
        const line = box(
          0.13,
          0.02,
          1.8,
          p.x + r.x * off,
          p.y + 0.02,
          p.z + r.z * off,
          lineMat,
        );
        orientGrade(line, p, n);
      }
    }
    if (i % 4 === 0) {
      const side = i % 8 === 0 ? 1 : -1,
        pp = p.clone().addScaledVector(r, side * 11.7),
        drain = box(
          0.45,
          0.045,
          1.1,
          pp.x,
          p.y + 0.025,
          pp.z,
          mat("#29363c", 0.55, 0.45),
        );
      orientGrade(drain, p, n);
      for (let k = -3; k <= 3; k++) {
        const bar = box(
          0.36,
          0.018,
          0.034,
          pp.x,
          p.y + 0.055,
          pp.z,
          mat("#7c8689", 0.5, 0.5),
        );
        orientGrade(bar, p, n);
        bar.position.y +=
          ((n.y - p.y) / Math.hypot(n.x - p.x, n.z - p.z)) * k * 0.12;
        bar.position.x += Math.sin(a) * k * 0.12;
        bar.position.z += Math.cos(a) * k * 0.12;
      }
    }
    if (i % 5 === 2) {
      const off = (rand() - 0.5) * 18,
        pp = p.clone().addScaledVector(r, off);
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 24), puddleMat);
      puddle.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        groundNormal(p, n),
      );
      puddle.scale.set(0.7 + rand() * 1.9, 1.5 + rand() * 3, 1);
      puddle.position.set(pp.x, p.y + 0.012, pp.z);
      world.add(puddle);
    }
    if (i % 13 === 7) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.43, 0.43, 0.035, 20),
        mat("#465154", 0.45, 0.5),
      );
      ring.position.copy(p);
      ring.position.y += 0.025;
      ring.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        groundNormal(p, n),
      );
      world.add(ring);
    }
    if (i % 8 === 0) {
      streetLight(i, 1);
      streetLight((i + 4) % N, -1);
    }
    if (i % 40 === 8 && wallRise(i / N) < 0.02) {
      const g = new THREE.Group();
      g.position.copy(p);
      g.position.y += 0.025;
      g.rotation.y = a;
      world.add(g);
      for (let z = -4; z <= 4; z += 1.35)
        box(width - 0.7, 0.025, 0.65, 0, 0.01, z, lineMat, g);
    }
  }
}
function groundCity() {
  box(1500, 1, 1500, 0, -0.5, 0, mat("#29363d", 0.14, 0.82));
  clockTower();
  pagoda();
  noodleSculpture(-168, 68);
  // 核心街坊填充；道路和地标庭院预留明确的空隙。
  for (let z = -196; z <= 196; z += 32)
    for (let x = -256; x <= 256; x += 32) {
      if (
        Math.hypot(x, z) < 78 ||
        Math.hypot(x + 104, z + 42) < 35 ||
        Math.hypot(x - 263, z + 18) < 82 ||
        Math.abs(x) < 10 ||
        Math.abs(z) < 10
      )
        continue;
      const n = nearest(new THREE.Vector3(x, 0, z));
      if (n.dist < 67) continue;
      makeMarketBlock(
        x,
        z,
        (x + z) % 64 ? Math.PI / 2 : 0,
        (Math.floor(x / 32) + Math.floor(z / 32) + 40) % 17,
        17,
        12,
        true,
      );
    }
  for (let k = 0; k < 45; k++) {
    const a = (k / 45) * Math.PI * 2,
      r = 438 + rand() * 95,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r * 0.85,
      h = 17 + rand() * 30;
    box(16, h, 14, x, h / 2, z, facadeMats[k % 6]);
    for (let yy = 5; yy < h - 1; yy += 4)
      for (let xx = -5; xx <= 5; xx += 3)
        if (rand() > 0.5)
          box(
            1,
            1.6,
            0.08,
            x + xx,
            yy,
            z + 7.06,
            mat("#bbaa85", 0.1, 0.6, 0.32),
          );
  }
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(62, 48),
    new THREE.MeshStandardMaterial({
      color: "#203c47",
      metalness: 0.6,
      roughness: 0.18,
    }),
  );
  lake.material.userData.transient = true;
  lake.rotation.x = -Math.PI / 2;
  lake.scale.y = 1.35;
  lake.position.set(263, 0.008, -18);
  world.add(lake);
  for (let j = 0; j < 18; j++) {
    box(3.2, 0.35, 2, 214 + j * 2.7, 0.17, -40, mat("#655749"));
    if (j % 3 === 0) {
      cylinder(0.06, 0.06, 3, 214 + j * 2.7, 1.5, -37.7, gold);
      lantern(214 + j * 2.7, 2.8, -37.7, 0.65);
    }
  }
  const cp = points[213],
    cn = points[214],
    a = Math.atan2(cn.x - cp.x, cn.z - cp.z),
    r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
    q = cp.clone().addScaledVector(r, -47);
  caveCourtyard(q.x, q.z, Math.atan2(cp.x - q.x, cp.z - q.z), 0);
  solidBox(q.x, q.z, 52, 28, Math.atan2(cp.x - q.x, cp.z - q.z), 0, 12, "cave");
  sites.push({
    x: q.x,
    z: q.z,
    w: 56,
    d: 33,
    angle: Math.atan2(cp.x - q.x, cp.z - q.z),
  });
  for (let j = 0; j < 8; j++) {
    const x = -515 - Math.sin(j) * 26,
      z = -165 + j * 39,
      h = 35 + (j % 3) * 13;
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(36, h, 7),
      mat("#263a42", 0.05, 0.95),
    );
    m.position.set(x, h / 2, z);
    world.add(m);
  }
}
function build() {
  wheelInstances?.dispose();
  wheelInstances = null;
  world.traverse((o) => {
    if (o.material?.userData.sign) {
      if (!o.material.userData.persistent) {
        o.material.map.dispose();
        o.material.dispose();
      }
    }
    if (o.isLine) o.material.dispose();
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
  const transient = new Set();
  world.traverse((o) => {
    if (o.material?.userData.transient) transient.add(o.material);
  });
  for (const m of transient) m.dispose();
  world.clear();
  seed = 71;
  solids = [];
  sites = [];
  pedestrians = [];
  steamVents = [];
  collectibles = [];
  lampAnchors = [];
  obstacles = [];
  gates = [];
  lanterns = [];
  points = Array.from({ length: N }, (_, i) => point(i / N));
  roadIndex = new RoadIndex(points);
  length = points.reduce(
    (sum, p, i) => sum + p.distanceTo(points[(i + 1) % N]),
    0,
  );
  document.querySelector(".route-label span").textContent =
    "约 " + (length / 1000).toFixed(2) + " km · 三圈";
  groundCity();
  ribbon(-width / 2, width / 2, asphalt);
  ribbon(-width / 2, width / 2, wallDeckMat, 0.018, 130, 187);
  for (let side of [-1, 1]) {
    ribbon(side * 13.32, side * 21.2, walkMat, 0.19);
    ribbon(side * 13.35, side * 13.67, kerbMat, 0.205);
  }
  buildWall();
  streetDetails();
  for (let i = 0; i < N; i++) {
    const p = points[i],
      n = points[(i + 1) % N],
      a = Math.atan2(n.x - p.x, n.z - p.z),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    if (i % 40 === 0) makeArch(p, a, i / 40);
    if (i % 3 === 1 && wallRise(i / N) < 0.01) {
      for (let side of [-1, 1]) {
        const q = p.clone().addScaledVector(r, side * 26),
          face = Math.atan2(p.x - q.x, p.z - q.z),
          id = i + (side > 0 ? 0 : 7);
        makeMarketBlock(q.x, q.z, face, id, 13 + (i % 3), 10, false);
        if (i % 6 === 1) {
          const back = p.clone().addScaledVector(r, side * 43);
          makeMarketBlock(back.x, back.z, face, id + 3, 16, 11, true);
        }
      }
    }
    if (i % 5 === 2) {
      makePerson(world, 0, 0, 0, i, true, true, a);
    }
    if (i % 19 === 8) {
      const off = (rand() - 0.5) * 17,
        ob = new THREE.Group();
      ob.userData.dynamic = true;
      ob.position.copy(p).addScaledVector(r, off);
      world.add(ob);
      box(0.9, 0.1, 0.9, 0, 0.05, 0, carbon, ob);
      cylinder(0.06, 0.34, 1.03, 0, 0.6, 0, mat("#cf6b38"), ob, 8);
      cylinder(0.15, 0.22, 0.18, 0, 0.63, 0, lineMat, ob, 8);
      obstacles.push({
        mesh: ob,
        index: i,
        off,
        right: r,
        base: p.clone(),
        dynamic: false,
        w: 0.85,
        d: 0.85,
        h: 1.15,
        angle: a,
      });
    }
  }
  for (let j = 0; j < 4; j++) {
    const p = points[102 + j],
      n = points[103 + j],
      a = Math.atan2(n.x - p.x, n.z - p.z),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
      q = p.clone().addScaledVector(r, 7.8),
      m = box(5, 1.3, 1, q.x, p.y + 0.65, q.z, j % 2 ? lineMat : red);
    m.rotation.y = a;
    m.userData.dynamic = true;
    obstacles.push({
      mesh: m,
      index: 102 + j,
      off: 7.8,
      right: r,
      base: p.clone(),
      dynamic: false,
      barrier: true,
      w: 5,
      d: 1,
      h: 1.3,
      angle: a,
    });
  }
  roadBoard(99, "临时施工 · 靠右慢行", -1);
  for (let j = 0; j < 8; j++) {
    const i = j * 40 + 20;
    if (wallRise(i / N) < 0.01) {
      const p = points[i],
        n = points[i + 1],
        a = Math.atan2(n.x - p.x, n.z - p.z),
        r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
        q = p.clone().addScaledVector(r, -18);
      const g = new THREE.Group();
      g.position.set(q.x, 0.3, q.z);
      g.rotation.y = a;
      world.add(g);
      shopSign(roadQuips[j], 0, 3.8, 0, 10, g).rotation.y = Math.PI;
      for (let x of [-4.7, 4.7]) cylinder(0.06, 0.06, 4, x, 2, 0, red, g);
    }
  }
  for (const ob of obstacles)
    solidBox(
      ob.mesh.position.x,
      ob.mesh.position.z,
      ob.w,
      ob.d,
      ob.angle,
      points[ob.index].y,
      points[ob.index].y + ob.h,
      "obstacle",
    );
  buildSolidGrid();
  createTraffic();
  batchCity();
  buildPickups();
  updatePedestrians(0);
  const p = points[0],
    n = points[1],
    a = Math.atan2(n.x - p.x, n.z - p.z),
    g = new THREE.Group();
  g.position.copy(p);
  g.rotation.y = a;
  world.add(g);
  for (let x = 0; x < 20; x++)
    for (let z = 0; z < 2; z++)
      box(
        1.12,
        0.025,
        0.65,
        (x - 9.5) * 1.12,
        0.035,
        z * 0.65,
        mat((x + z) % 2 ? "#c9c3b3" : "#303c43"),
        g,
      );
}
let pedestrianAccumulator = 0;
function updatePedestrians(dt) {
  pedestrianAccumulator += dt;
  if (dt > 0 && pedestrianAccumulator < 0.05) return;
  pedestrianAccumulator %= 0.05;
  for (let p of pedestrians) {
    const t = (((p.index / N + (elapsed * p.speed) / length) % 1) + 1) % 1,
      pt = point(t),
      next = point(t + 0.0003),
      a = Math.atan2(next.x - pt.x, next.z - pt.z),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    p.g.position
      .copy(pt)
      .addScaledVector(r, p.side * (wallRise(t) > 0.01 ? 14.6 : 16.8));
    p.g.position.y = nearest(p.g.position).ground + 0.19;
    p.g.rotation.y = a + (p.side < 0 ? Math.PI : 0);
    p.g.visible =
      p.g.position.distanceToSquared(camera.position) <
      activeProfile.detailDistance ** 2;
    const phase = elapsed * 5 + p.index;
    for (let k = 0; k < p.legs.length; k++)
      p.legs[k].rotation.x = Math.sin(phase + k * Math.PI) * 0.36;
  }
}
const {
  car,
  wheels,
  flame,
  contactShadow,
  liftJets,
  jetBodies,
  plumes,
  jetLight,
  glass,
  carbon,
  rubber,
  loft,
} = createPlayerVehicle({
  scene,
  mat,
  texture,
  box,
  cylinder,
  sphere,
  sign,
  gold,
  white,
});
const particleCount = 400,
  jetPositions = new Float32Array(particleCount * 3),
  jetAlphas = new Float32Array(particleCount),
  jetSizes = new Float32Array(particleCount),
  jetData = Array.from({ length: particleCount }, () => ({
    life: 0,
    max: 1,
    v: new THREE.Vector3(),
  }));
for (let i = 0; i < particleCount; i++) jetPositions[i * 3 + 1] = -10000;
const jetGeometry = new THREE.BufferGeometry();
jetGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(jetPositions, 3),
);
jetGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(jetAlphas, 1));
jetGeometry.setAttribute("aSize", new THREE.BufferAttribute(jetSizes, 1));
const jetMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { pointScale: { value: 320 } },
  vertexShader:
    "attribute float aAlpha;attribute float aSize;varying float vAlpha;void main(){vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(65.0,aSize*320.0/max(1.0,-mv.z));gl_Position=projectionMatrix*mv;}",
  fragmentShader:
    "varying float vAlpha;void main(){float r=length(gl_PointCoord-0.5);float a=pow(1.0-smoothstep(0.0,0.5,r),2.0)*vAlpha;gl_FragColor=vec4(0.69,0.87,1.0,a);}",
  toneMapped: false,
});
const jetParticles = new THREE.Points(jetGeometry, jetMaterial);
jetParticles.frustumCulled = false;
scene.add(jetParticles);
let particleCursor = 0,
  emitCarry = 0;
function emitJet(x, z, ground, dust = false) {
  const i = particleCursor++ % particleCount,
    d = jetData[i];
  car.updateMatrixWorld(true);
  const t = car.localToWorld(new THREE.Vector3(x, 0.13, z));
  d.max = dust ? 0.6 : 0.65 + Math.random() * 0.3;
  d.life = d.max;
  jetPositions.set([t.x, dust ? ground + 0.12 : t.y, t.z], i * 3);
  d.v.set(
    (Math.random() - 0.5) * (dust ? 8 : 2.3),
    dust ? 0.3 + Math.random() : -6 - Math.random() * 5,
    (Math.random() - 0.5) * (dust ? 8 : 2.3),
  );
  d.v.x += Math.sin(heading) * speed * 0.15;
  d.v.z += Math.cos(heading) * speed * 0.15;
  jetSizes[i] = dust ? 1.1 : 0.28 + Math.random() * 0.4;
  jetAlphas[i] = 0.7;
}
const landingRing = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1.2, 40),
  new THREE.MeshBasicMaterial({
    color: "#b9dfeb",
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
landingRing.rotation.x = -Math.PI / 2;
scene.add(landingRing);
let ringLife = 0;

let picked = 0,
  nightScore = 0,
  chiliTime = 0,
  pickupFlash = 0,
  pickupSerial = 0,
  physicsContacts = 0;
const pickBurstCount = 90,
  pickPos = new Float32Array(pickBurstCount * 3),
  pickLife = new Float32Array(pickBurstCount),
  pickVelocity = Array.from(
    { length: pickBurstCount },
    () => new THREE.Vector3(),
  );
const pickGeo = new THREE.BufferGeometry();
pickGeo.setAttribute("position", new THREE.BufferAttribute(pickPos, 3));
pickGeo.setAttribute("aAlpha", new THREE.BufferAttribute(pickLife, 1));
const pickMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader:
    "attribute float aAlpha;varying float vAlpha;void main(){vAlpha=aAlpha;vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(20.0,55.0/max(1.0,-p.z));gl_Position=projectionMatrix*p;}",
  fragmentShader:
    "varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(1.0,.76,.33,(1.0-smoothstep(.1,.5,r))*vAlpha);}",
  toneMapped: false,
});
const pickupBurst = new THREE.Points(pickGeo, pickMaterial);
pickupBurst.frustumCulled = false;
scene.add(pickupBurst);
let burstCursor = 0;
function buildPickups() {
  pickupGroup = new THREE.Group();
  pickupGroup.userData.dynamic = true;
  world.add(pickupGroup);
  collectibles = [];
  for (let i = 8; i < N; i += 8) {
    if (i >= 96 && i <= 108) continue;
    const index = collectibles.length,
      type = index % 3,
      p = points[i],
      n = points[(i + 1) % N],
      a = Math.atan2(n.x - p.x, n.z - p.z),
      r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
      off = [0, -8, 8][Math.floor(index / 3) % 3],
      q = p.clone().addScaledVector(r, off),
      g = new THREE.Group();
    g.position.copy(q);
    g.position.y += 1.25;
    pickupGroup.add(g);
    const base = new THREE.Group();
    g.add(base);
    if (type === 0) {
      cylinder(0.43, 0.46, 0.2, 0, 0.15, 0, mat("#e4c386"), base, 20);
      cylinder(0.45, 0.43, 0.18, 0, -0.15, 0, mat("#c49a57"), base, 20);
      box(0.64, 0.12, 0.56, 0, -0.015, 0, mat("#76432b"), base);
      for (let k = -2; k <= 2; k++)
        box(0.44, 0.018, 0.035, 0, 0.26, k * 0.08, mat("#9c753f"), base);
    } else if (type === 1) {
      cylinder(0.22, 0.23, 0.7, 0, 0, 0, mat("#d6812c", 0.35, 0.25), base, 16);
      cylinder(
        0.12,
        0.13,
        0.26,
        0,
        0.47,
        0,
        mat("#bdc4b0", 0.4, 0.25),
        base,
        12,
      );
      cylinder(0.15, 0.15, 0.08, 0, 0.65, 0, white, base, 12);
      box(0.28, 0.29, 0.025, 0, 0.02, 0.23, mat("#f2d6a6"), base);
    } else {
      cylinder(0.3, 0.35, 0.6, 0, 0, 0, mat("#9f3c29", 0.2, 0.5), base, 16);
      cylinder(0.32, 0.32, 0.08, 0, 0.35, 0, gold, base, 16);
      box(0.42, 0.26, 0.025, 0, 0, 0.34, mat("#e9c78a"), base);
    }
    batchRig(base);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.025, 6, 28),
      mat(type === 1 ? "#87d2ce" : "#efbe66", 0.2, 0.4, 1.7),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.55;
    g.add(ring);
    collectibles.push({
      g,
      base,
      index: i,
      type,
      q: q.clone(),
      takenLap: 0,
      off,
    });
  }
}
function pickupSound(type) {
  if (!audio || muted) return;
  const now = audio.currentTime;
  for (let k = 0; k < 3; k++) {
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sine";
    o.frequency.value = 440 * Math.pow(2, ([0, 4, 7][k] + type * 2) / 12);
    g.gain.setValueAtTime(0.0001, now + k * 0.07);
    g.gain.exponentialRampToValueAtTime(0.075, now + k * 0.07 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + k * 0.07 + 0.21);
    o.connect(g).connect(effectsBus);
    o.start(now + k * 0.07);
    o.stop(now + k * 0.07 + 0.23);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
}
function collect(p) {
  p.takenLap = lap;
  p.g.visible = false;
  picked++;
  nightScore += p.type === 0 ? 100 : 50;
  const names = [
    "肉夹馍 +100 夜市积分",
    "冰峰 +22 火箭燃料",
    "油泼辣子 · 8 秒辣力加速",
  ];
  if (p.type === 1) fuel = Math.min(100, fuel + 22);
  if (p.type === 2) chiliTime = 8;
  pickupFlash = 1;
  $("pickupPopup").textContent = names[p.type];
  pickupSound(p.type);
  for (let j = 0; j < 25; j++) {
    const i = burstCursor++ % pickBurstCount;
    pickPos.set(p.g.position.toArray(), i * 3);
    pickLife[i] = 1;
    pickVelocity[i].set(
      (Math.random() - 0.5) * 5,
      Math.random() * 4,
      (Math.random() - 0.5) * 5,
    );
  }
  pickupSerial++;
}
function updatePickups(dt) {
  if (state === "race") {
    chiliTime = Math.max(0, chiliTime - dt);
    for (const p of collectibles) {
      p.g.visible = p.takenLap !== lap && p.q.distanceTo(pos) < 130;
      if (!p.g.visible) continue;
      p.g.position.y = p.q.y + 1.25 + Math.sin(elapsed * 2.4 + p.index) * 0.16;
      p.base.rotation.y = elapsed * 0.75 + p.index;
      if (
        Math.hypot(pos.x - p.q.x, pos.z - p.q.z) < 2.15 &&
        Math.abs(pos.y + 0.75 - p.g.position.y) < 1.55
      )
        collect(p);
    }
  }
  for (let i = 0; i < pickBurstCount; i++) {
    if (pickLife[i] <= 0) continue;
    pickLife[i] = Math.max(0, pickLife[i] - dt * 1.4);
    const v = pickVelocity[i];
    v.y -= dt * 3;
    pickPos[i * 3] += v.x * dt;
    pickPos[i * 3 + 1] += v.y * dt;
    pickPos[i * 3 + 2] += v.z * dt;
  }
  pickGeo.attributes.position.needsUpdate = true;
  pickGeo.attributes.aAlpha.needsUpdate = true;
  pickupFlash = Math.max(0, pickupFlash - dt * 0.75);
  $("pickupPopup").style.opacity = pickupFlash;
  $("lootHud").textContent =
    "夜市好味 " +
    picked +
    " 份　" +
    nightScore +
    " 分" +
    (chiliTime > 0 ? "　辣力 " + chiliTime.toFixed(1) + "s" : "");
}
function landed(ground) {
  ringLife = 0.5;
  landingRing.position.set(pos.x, ground + 0.07, pos.z);
  for (let i = 0; i < 36; i++)
    emitJet((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, ground, true);
}
function updateJets(dt, active) {
  const ground = nearest(pos).ground;
  airHeight = Math.max(0, pos.y - ground - 0.025);
  const visible =
    state === "race" && (airHeight > 0.08 || jetPulse > 0.05) && jumps > 0;
  liftJets.visible = visible;
  jetLight.intensity = visible ? 11 + Math.sin(elapsed * 35) * 2 : 0;
  for (let nozzle of jetBodies)
    nozzle.position.y = THREE.MathUtils.lerp(
      nozzle.position.y,
      visible ? 0.13 : 0.28,
      0.2,
    );
  for (let plume of plumes) {
    plume.scale.y =
      0.85 +
      Math.sin(elapsed * 45 + plume.position.x) * 0.1 +
      (active ? 0.3 : 0);
    plume.scale.x = plume.scale.z = 1 + Math.sin(elapsed * 30) * 0.06;
  }
  jetPulse = Math.max(0, jetPulse - dt);
  if (visible) {
    emitCarry += dt * (quality ? 180 : 75);
    while (emitCarry >= 1) {
      emitCarry--;
      const j = particleCursor % 4;
      emitJet(j < 2 ? -0.8 : 0.8, j % 2 ? 1.3 : -1.3, ground);
    }
  }
  for (let i = 0; i < particleCount; i++) {
    const d = jetData[i];
    if (d.life <= 0) {
      jetAlphas[i] = 0;
      continue;
    }
    if (state !== "paused") d.life -= dt;
    const k = i * 3;
    jetPositions[k] += d.v.x * dt;
    jetPositions[k + 1] += d.v.y * dt;
    jetPositions[k + 2] += d.v.z * dt;
    if (jetPositions[k + 1] < ground + 0.04) {
      jetPositions[k + 1] = ground + 0.04;
      d.v.y = 0.2;
      d.v.x *= 1.04;
      d.v.z *= 1.04;
    }
    jetSizes[i] += 0.9 * dt;
    jetAlphas[i] = Math.max(0, d.life / d.max) * 0.55;
  }
  jetGeometry.attributes.position.needsUpdate = true;
  jetGeometry.attributes.aAlpha.needsUpdate = true;
  jetGeometry.attributes.aSize.needsUpdate = true;
  if (ringLife > 0) {
    ringLife -= dt;
    landingRing.scale.setScalar(1 + (1 - ringLife / 0.5) * 3);
    landingRing.material.opacity = ringLife * 0.38;
  } else landingRing.material.opacity = 0;
  contactShadow.material.opacity = Math.max(0.12, 1 - airHeight * 0.12);
  $("flightHud").classList.toggle("active", visible);
  $("flightHeight").textContent =
    (rollTime > 0 ? "锅盔翻面 · " : "离地 ") + airHeight.toFixed(1) + " m";
}
const sparks = [];
for (let i = 0; i < 35; i++) {
  let m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 4, 4), gold);
  scene.add(m);
  sparks.push({ m, life: 0, v: new THREE.Vector3() });
}
const rainCount = 700,
  rainGeo = new THREE.BufferGeometry(),
  rainPos = new Float32Array(rainCount * 6);
for (let i = 0; i < rainCount; i++) {
  const k = i * 6,
    x = (rand() - 0.5) * 100,
    z = (rand() - 0.5) * 100,
    y = rand() * 45;
  rainPos.set([x, y, z, x - 0.12, y - 0.75, z + 0.04], k);
}
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(
  rainGeo,
  new THREE.LineBasicMaterial({
    color: "#9cb6c4",
    transparent: true,
    opacity: 0.24,
  }),
);
rain.frustumCulled = false;
scene.add(rain);
const steamCount = 140,
  steamPos = new Float32Array(steamCount * 3),
  steamAlpha = new Float32Array(steamCount),
  steamSize = new Float32Array(steamCount),
  steamLife = new Float32Array(steamCount);
const steamGeo = new THREE.BufferGeometry();
steamGeo.setAttribute("position", new THREE.BufferAttribute(steamPos, 3));
steamGeo.setAttribute("aAlpha", new THREE.BufferAttribute(steamAlpha, 1));
steamGeo.setAttribute("aSize", new THREE.BufferAttribute(steamSize, 1));
const steamMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexShader:
    "attribute float aAlpha;attribute float aSize;varying float vAlpha;void main(){vAlpha=aAlpha;vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(65.0,aSize*180.0/max(1.0,-p.z));gl_Position=projectionMatrix*p;}",
  fragmentShader:
    "varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(.78,.83,.83,(1.0-smoothstep(.0,.5,r))*vAlpha);}",
  toneMapped: false,
});
const steam = new THREE.Points(steamGeo, steamMaterial);
steam.frustumCulled = false;
scene.add(steam);
let steamCursor = 0,
  steamCarry = 0;
const rippleGeo = new THREE.RingGeometry(0.4, 0.43, 24),
  rippleMaterial = new THREE.MeshBasicMaterial({
    color: "#9ab9c3",
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
  ripples = [];
for (let i = 0; i < 24; i++) {
  const m = new THREE.Mesh(rippleGeo, rippleMaterial);
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  ripples.push({ m, life: i / 24 });
}
const streetLightPool = Array.from({ length: 4 }, () => {
  const l = new THREE.PointLight(0xffc283, 65, 29, 2);
  scene.add(l);
  return l;
});
let lampRefresh = 0,
  activeLamps = [];
function updateAtmosphere(dt) {
  lampRefresh -= dt;
  if (lampRefresh <= 0) {
    lampRefresh = 0.2;
    activeLamps = lampAnchors
      .map((v) => ({ v, d: v.distanceToSquared(camera.position) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
  }
  const closest = activeLamps;
  for (let i = 0; i < streetLightPool.length; i++) {
    const l = streetLightPool[i];
    if (closest[i]) {
      l.position.copy(closest[i].v);
      l.intensity = 65;
    } else l.intensity = 0;
  }
  const focus = state === "menu" ? car.position : pos;
  for (let i = 0; i < activeRainCount; i++) {
    const k = i * 6;
    rainPos[k + 1] -= dt * 23;
    rainPos[k + 4] -= dt * 23;
    if (
      rainPos[k + 1] < focus.y - 2 ||
      Math.abs(rainPos[k] - focus.x) > 50 ||
      Math.abs(rainPos[k + 2] - focus.z) > 50
    ) {
      const x = focus.x + (Math.random() - 0.5) * 90,
        z = focus.z + (Math.random() - 0.5) * 90,
        y = focus.y + 20 + Math.random() * 25;
      rainPos.set([x, y, z, x - 0.12, y - 0.75, z + 0.04], k);
    }
  }
  rainGeo.attributes.position.needsUpdate = true;
  steamCarry += dt * (quality ? 24 : 9);
  const active = steamVents.filter((v) => v.distanceTo(camera.position) < 55);
  while (steamCarry >= 1) {
    steamCarry--;
    if (active.length) {
      const i = steamCursor++ % steamCount,
        v = active[Math.floor(Math.random() * active.length)];
      steamPos.set(
        [
          v.x + (Math.random() - 0.5) * 0.2,
          v.y,
          v.z + (Math.random() - 0.5) * 0.2,
        ],
        i * 3,
      );
      steamLife[i] = 1.8;
      steamSize[i] = 0.28;
    }
  }
  for (let i = 0; i < steamCount; i++) {
    if (steamLife[i] <= 0) {
      steamAlpha[i] = 0;
      continue;
    }
    steamLife[i] -= dt;
    steamPos[i * 3] += 0.08 * Math.sin(i) * dt;
    steamPos[i * 3 + 1] += 0.43 * dt;
    steamSize[i] += 0.45 * dt;
    steamAlpha[i] =
      Math.max(0, Math.sin((steamLife[i] / 1.8) * Math.PI)) * 0.14;
  }
  steamGeo.attributes.position.needsUpdate = true;
  steamGeo.attributes.aAlpha.needsUpdate = true;
  steamGeo.attributes.aSize.needsUpdate = true;
  for (const r of ripples) {
    r.life -= dt;
    if (r.life <= 0) {
      const x = focus.x + (Math.random() - 0.5) * 38,
        z = focus.z + (Math.random() - 0.5) * 38,
        n = nearest(new THREE.Vector3(x, 0, z));
      r.m.position.set(
        x,
        n.dist < 13 ? n.ground + 0.025 : n.dist < 21 ? n.ground + 0.208 : 0.025,
        z,
      );
      r.life = 0.6 + Math.random() * 0.4;
    }
    r.m.scale.setScalar((1 - r.life) * 1.1);
    r.m.visible = quality && r.m.position.distanceTo(camera.position) < 45;
  }
}
let keys = {},
  state = "menu",
  pos = new THREE.Vector3(),
  heading = 0,
  speed = 0,
  vy = 0,
  jumps = 0,
  fuel = 100,
  elapsed = 0,
  lapStart = 0,
  laps = [],
  lap = 1,
  nextGate = 1,
  lastIndex = 0,
  checkpoint = 0,
  countdown = 0,
  view = 0,
  muted = false,
  quality = true,
  toastTime = 0,
  jetPulse = 0,
  airHeight = 0,
  flightTime = 0,
  resetCount = 0,
  rollTime = 0,
  rollAngle = 0,
  rollDirection = 1,
  rolls = 0,
  carLean = 0,
  trafficHits = 0,
  lastSector = -1;
let audio,
  osc,
  gain,
  rocketOsc,
  rocketGain,
  master,
  effectsBus,
  musicGain,
  musicSource,
  musicBuffer,
  musicAnalyser,
  airGain,
  musicReady = "idle",
  musicEnabled = true,
  musicPeak = 0;
let activeRainCount = rainCount,
  activeProfile;
function applyQuality(profile) {
  activeProfile = profile;
  quality = profile.effects;
  renderer.setPixelRatio(profile.dpr);
  composer.setPixelRatio(profile.dpr);
  bloom.enabled = profile.bloom;
  activeRainCount = profile.rain;
  rainGeo.setDrawRange(0, activeRainCount * 2);
  rain.visible = true;
  steam.visible = profile.effects;
  if ($("qualityStatus")) $("qualityStatus").textContent = profile.label;
}
const qualityManager = new AdaptiveQuality(applyQuality);
applyQuality(qualityManager.profile());
const localTrack = new LocalTrack(() => {
  updateMusicUI();
  renderRadio();
});
let radioPausedRace = false;
function renderRadio() {
  const track = localTrack.snapshot();
  $("radioCurrent").textContent = track.selected
    ? track.name
    : "长安夜行 · 原创国风电子";
  $("radioMessage").textContent = track.message;
  $("radioLocal").disabled = !track.hasFile;
  $("radioRemove").disabled = !track.hasFile;
  $("radioVolume").value = Math.round(track.volume * 100);
  $("radioVolumeValue").textContent = Math.round(track.volume * 100) + "%";
}
function openRadio() {
  if ($("radioDialog").open) return;
  radioPausedRace = state === "race";
  if (radioPausedRace) {
    state = "paused";
    keys = {};
    $("count").textContent = "";
  }
  renderRadio();
  $("radioDialog").showModal();
}
$("radioDialog").addEventListener("close", () => {
  if (radioPausedRace) {
    state = "race";
    $("count").textContent = "";
  }
  radioPausedRace = false;
});
document
  .querySelectorAll("[data-radio]")
  .forEach((button) => (button.onclick = openRadio));
$("radioClose").onclick = () => $("radioDialog").close();
$("radioPreview").onclick = () => {
  musicEnabled = true;
  sound();
  localTrack.blocked = false;
  localTrack.sync(!muted, state);
  updateMusicUI();
};
$("radioOriginal").onclick = () => {
  localTrack.selectOriginal();
  sound();
  musicEnabled = true;
  updateMusicUI();
};
$("radioLocal").onclick = () => {
  localTrack.selectLocal();
  sound();
  musicEnabled = true;
  localTrack.blocked = false;
  localTrack.sync(!muted, state);
};
$("radioRemove").onclick = () => localTrack.remove();
$("radioVolume").oninput = (e) => {
  localTrack.setVolume(+e.target.value / 100);
  $("radioVolumeValue").textContent = e.target.value + "%";
};
$("trackImport").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $("radioMessage").textContent = "正在读取音乐…";
  try {
    await localTrack.importFile(file);
    musicEnabled = true;
    sound();
    localTrack.blocked = false;
    localTrack.sync(!muted, state);
  } catch (error) {
    localTrack.message = error.message;
    renderRadio();
  }
  e.target.value = "";
};
function sound() {
  if (audio) {
    localTrack.blocked = false;
    audio.resume();
    return;
  }
  audio = new (window.AudioContext || window.webkitAudioContext)();
  master = audio.createGain();
  master.gain.value = 0.65;
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.ratio.value = 12;
  master.connect(limiter).connect(audio.destination);
  effectsBus = audio.createGain();
  effectsBus.gain.value = 0.7;
  effectsBus.connect(master);
  osc = audio.createOscillator();
  gain = audio.createGain();
  const motorFilter = audio.createBiquadFilter();
  motorFilter.type = "lowpass";
  motorFilter.frequency.value = 700;
  osc.type = "sawtooth";
  gain.gain.value = 0;
  osc.connect(motorFilter).connect(gain).connect(effectsBus);
  osc.start();
  const noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  let d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  rocketOsc = audio.createBufferSource();
  rocketOsc.buffer = noise;
  rocketOsc.loop = true;
  rocketGain = audio.createGain();
  rocketGain.gain.value = 0;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2100;
  rocketOsc.connect(filter).connect(rocketGain).connect(effectsBus);
  rocketOsc.start();
  const airSource = audio.createBufferSource();
  airSource.buffer = noise;
  airSource.loop = true;
  airGain = audio.createGain();
  airGain.gain.value = 0;
  const airFilter = audio.createBiquadFilter();
  airFilter.type = "bandpass";
  airFilter.frequency.value = 1700;
  airFilter.Q.value = 0.5;
  airSource.connect(airFilter).connect(airGain).connect(effectsBus);
  airSource.start();
  musicGain = audio.createGain();
  musicGain.gain.value = 0;
  musicAnalyser = audio.createAnalyser();
  musicAnalyser.fftSize = 1024;
  musicGain.connect(musicAnalyser).connect(master);
  musicReady = "rendering";
  localTrack.attach(audio, musicAnalyser);
  composeMusic()
    .then((buffer) => {
      musicBuffer = buffer;
      musicPeak = 0.76;
      musicSource = audio.createBufferSource();
      musicSource.buffer = buffer;
      musicSource.loop = true;
      musicSource.connect(musicGain);
      musicSource.start();
      musicReady = "ready";
      updateMusicUI();
    })
    .catch(() => {
      musicReady = "unavailable";
      updateMusicUI();
    });
  audio.resume();
  updateMusicUI();
}
function updateMusicUI() {
  document.querySelectorAll("[data-music]").forEach((b) => {
    b.textContent = "♫ " + (localTrack.selected ? localTrack.name : "长安夜行");
    const label = document.createElement("span");
    label.textContent = muted
      ? "M 已静音"
      : musicReady === "rendering"
        ? "正在起奏"
        : musicEnabled
          ? "B 音乐开"
          : "B 音乐关";
    b.append(label);
    b.setAttribute("aria-pressed", String(musicEnabled && !muted));
  });
}
function toggleMusic() {
  localTrack.blocked = false;
  if (!audio) {
    musicEnabled = true;
    sound();
  } else musicEnabled = !musicEnabled;
  updateMusicUI();
  localTrack.sync(musicEnabled && !muted, state);
}
function hit() {
  if (!audio || muted) return;
  const o = audio.createOscillator(),
    g = audio.createGain(),
    time = audio.currentTime;
  o.type = "triangle";
  o.frequency.setValueAtTime(100, time);
  o.frequency.exponentialRampToValueAtTime(25, time + 0.12);
  g.gain.setValueAtTime(0.15, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.17);
  o.connect(g).connect(effectsBus);
  o.start();
  o.stop(time + 0.18);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}
function jumpSound() {
  if (!audio || muted) return;
  const o = audio.createOscillator(),
    g = audio.createGain(),
    t = audio.currentTime;
  o.type = "sine";
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(370, t + 0.22);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(effectsBus);
  o.start();
  o.stop(t + 0.3);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}
function takeoff() {
  if (state !== "race" || jumps >= 2 || fuel < 7) return;
  jumps++;
  vy = jumps === 1 ? 11.5 : 10.8;
  fuel = Math.max(0, fuel - 7);
  jetPulse = 0.65;
  flightTime = 0;
  if (jumps === 2) {
    rollTime = 0.001;
    rollAngle = 0;
    rollDirection = keys.KeyA || keys.ArrowLeft ? 1 : -1;
    toast("二段翻滚 · 锅盔翻面！镜头稳着咧。");
  } else toast("四点喷气展开！长按 F 滞空，空中再按 F 翻面。");
  jumpSound();
}
function snapCamera() {
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
    target = pos
      .clone()
      .addScaledVector(forward, 3)
      .add(new THREE.Vector3(0, 1.3, 0)),
    desired = pos.clone().addScaledVector(forward, view === 1 ? -18 : -10);
  desired.y += view === 1 ? 11 : 4.2;
  camera.position.copy(safeCamera(target, desired));
  camera.lookAt(
    pos
      .clone()
      .addScaledVector(forward, 10)
      .add(new THREE.Vector3(0, 1.1, 0)),
  );
}
function resetRoll() {
  rollTime = 0;
  rollAngle = 0;
  carLean = 0;
}
function updateRoll(dt) {
  if (rollTime > 0 && state === "race") {
    rollTime += dt;
    const t = Math.min(1, rollTime / 0.88),
      ease = t * t * (3 - 2 * t);
    rollAngle = rollDirection * Math.PI * 2 * ease;
    if (t >= 1) {
      rolls++;
      rollTime = 0;
      rollAngle = 0;
      fuel = Math.min(100, fuel + 4);
      toast("锅盔翻面成功！这手艺嘹咋咧。");
    }
  }
}

function toast(t) {
  $("toast").textContent = t;
  toastTime = 3;
}
function fmt(t) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
}
function best() {
  try {
    return localStorage.getItem("xian-night-v4-" + difficulty);
  } catch {
    return null;
  }
}
function showBest() {
  $("best").textContent = best()
    ? "最佳送达纪录 " + fmt(+best())
    : "首位夜食车手，等你留下纪录";
}
function reset() {
  resetCount++;
  let p = points[checkpoint],
    n = points[(checkpoint + 1) % N];
  pos.copy(p);
  pos.y += 0.025;
  heading = Math.atan2(n.x - p.x, n.z - p.z);
  speed = 0;
  vy = 0;
  jumps = 0;
  jetPulse = 0;
  flightTime = 0;
  airHeight = 0;
  resetRoll();
  snapCamera();
}
function start() {
  sound();
  elapsed = 0;
  build();
  checkpoint = 0;
  reset();
  resetCount = 0;
  rolls = 0;
  trafficHits = 0;
  physicsContacts = 0;
  picked = 0;
  nightScore = 0;
  chiliTime = 0;
  wallVisits = 0;
  wallOn = false;
  lastSector = -1;
  elapsed = 0;
  lapStart = 0;
  laps = [];
  lap = 1;
  nextGate = 1;
  lastIndex = 0;
  fuel = 100;
  countdown = 3.5;
  state = "countdown";
  $("menu").style.display = "none";
  $("result").style.display = "none";
  $("hud").style.display = "block";
  $("routeTitle").textContent = [
    "肉夹馍街 · 微辣",
    "凉皮高架 · 中辣",
    "油泼面环线 · 特辣",
  ][difficulty];
  toast("沿灯笼牌坊前进，三圈把美味送达");
}

let solidGrid = new Map();
function nearest(p, out) {
  return roadIndex.nearest(p, out);
}
function buildSolidGrid() {
  solidGrid = new Map();
  for (const b of solids) {
    const r = Math.hypot(b.w, b.d) / 2 + 4;
    for (
      let x = Math.floor((b.x - r) / 40);
      x <= Math.floor((b.x + r) / 40);
      x++
    )
      for (
        let z = Math.floor((b.z - r) / 40);
        z <= Math.floor((b.z + r) / 40);
        z++
      ) {
        const k = x + ":" + z;
        if (!solidGrid.has(k)) solidGrid.set(k, []);
        solidGrid.get(k).push(b);
      }
  }
}
function nearSolids(p) {
  return solidGrid.get(Math.floor(p.x / 40) + ":" + Math.floor(p.z / 40)) || [];
}
function satContact(a, b) {
  let depth = Infinity,
    bnx = 0,
    bnz = 0;
  const ca = Math.cos(a.angle),
    sa = Math.sin(a.angle),
    cb = Math.cos(b.angle),
    sb = Math.sin(b.angle),
    axes = [
      [ca, -sa],
      [sa, ca],
      [cb, -sb],
      [sb, cb],
    ];
  for (const [nx, nz] of axes) {
    const ra =
        (Math.abs(nx * ca - nz * sa) * a.w) / 2 +
        (Math.abs(nx * sa + nz * ca) * a.d) / 2,
      rb =
        (Math.abs(nx * cb - nz * sb) * b.w) / 2 +
        (Math.abs(nx * sb + nz * cb) * b.d) / 2,
      dist = (a.x - b.x) * nx + (a.z - b.z) * nz,
      overlap = ra + rb - Math.abs(dist);
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      const sign = dist >= 0 ? 1 : -1;
      bnx = nx * sign;
      bnz = nz * sign;
    }
  }
  return { depth, nx: bnx, nz: bnz };
}
function carBounds() {
  return {
    x: pos.x,
    z: pos.z,
    w: rollTime > 0 ? 3.1 : 2.38,
    d: 4.55,
    angle: heading,
    minY: pos.y + (rollTime > 0 ? -1.5 : 0.02),
    maxY: pos.y + (rollTime > 0 ? 1.8 : 1.58),
  };
}
function solveSolids() {
  let touches = 0;
  for (let iteration = 0; iteration < 3; iteration++) {
    let changed = false;
    for (const b of nearSolids(pos)) {
      const a = carBounds();
      if (a.maxY <= b.minY || a.minY >= b.maxY) continue;
      const contact = satContact(a, b);
      if (!contact) continue;
      pos.x += contact.nx * (contact.depth + 0.015);
      pos.z += contact.nz * (contact.depth + 0.015);
      if (iteration === 0) {
        speed *= 0.45;
        touches++;
        if (elapsed - lastSolidHit > 0.8) {
          lastSolidHit = elapsed;
          hit();
          toast(
            b.kind === "obstacle"
              ? "额滴神啊，围挡可不是肉夹馍！"
              : "慢点咧，别拿车头试城砖！",
          );
        }
      }
      changed = true;
    }
    if (!changed) break;
  }
  return touches;
}
function clampRoad() {
  const n = nearest(pos),
    extent =
      Math.abs(Math.cos(heading) * n.rx - Math.sin(heading) * n.rz) * 1.2 +
      Math.abs(Math.sin(heading) * n.rx + Math.cos(heading) * n.rz) * 2.28,
    max = width / 2 - 0.35 - extent;
  if (Math.abs(n.lateral) > max) {
    const clipped = THREE.MathUtils.clamp(n.lateral, -max, max),
      diff = n.lateral - clipped;
    pos.x -= n.rx * diff;
    pos.z -= n.rz * diff;
    speed *= 0.8;
  }
  return nearest(pos);
}
function collideTraffic() {
  let touched = 0;
  for (const v of traffic) {
    if (
      Math.abs(pos.x - v.g.position.x) > 10 ||
      Math.abs(pos.z - v.g.position.z) > 10
    )
      continue;
    const b = {
        x: v.g.position.x,
        z: v.g.position.z,
        w: v.w,
        d: v.l,
        angle: v.heading,
        minY: v.g.position.y,
        maxY: v.g.position.y + v.h,
      },
      a = carBounds();
    if (a.maxY <= b.minY || a.minY >= b.maxY) continue;
    const c = satContact(a, b);
    if (!c) continue;
    pos.x += c.nx * (c.depth + 0.025);
    pos.z += c.nz * (c.depth + 0.025);
    speed *= 0.68;
    touched++;
    if (elapsed - v.lastHit > 0.8) {
      v.lastHit = elapsed;
      v.hits++;
      trafficHits++;
      hit();
      toast(
        v.type === "bus"
          ? v.route + " 路师傅：先让一哈，咥饭不抢这一秒！"
          : "陕A师傅：车上可以谝，方向不能乱！",
      );
    }
  }
  return touched;
}
function rayBox(a, b, box, margin = 0.45) {
  const cos = Math.cos(box.angle),
    sin = Math.sin(box.angle),
    transform = (p) => [
      (p.x - box.x) * cos - (p.z - box.z) * sin,
      p.y,
      (p.x - box.x) * sin + (p.z - box.z) * cos,
    ],
    from = transform(a),
    to = transform(b),
    lo = [-box.w / 2 - margin, box.minY - margin, -box.d / 2 - margin],
    hi = [box.w / 2 + margin, box.maxY + margin, box.d / 2 + margin];
  let near = 0,
    far = 1;
  for (let k = 0; k < 3; k++) {
    const d = to[k] - from[k];
    if (Math.abs(d) < 1e-8) {
      if (from[k] < lo[k] || from[k] > hi[k]) return null;
    } else {
      let t1 = (lo[k] - from[k]) / d,
        t2 = (hi[k] - from[k]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      near = Math.max(near, t1);
      far = Math.min(far, t2);
      if (near > far) return null;
    }
  }
  return near >= 0 && near < 1 ? near : null;
}
function safeCamera(target, desired) {
  const mid = target.clone().lerp(desired, 0.5),
    candidates = new Set([
      ...nearSolids(target),
      ...nearSolids(mid),
      ...nearSolids(desired),
    ]);
  let earliest = 1;
  for (const box of candidates) {
    const t = rayBox(target, desired, box);
    if (t !== null && t > 0.025) earliest = Math.min(earliest, t);
  }
  if (earliest < 1) {
    const length = target.distanceTo(desired);
    desired = target
      .clone()
      .lerp(desired, Math.max(0.08, earliest - 0.35 / length));
  }
  const n = nearest(desired);
  if (n.dist < 18) desired.y = Math.max(desired.y, n.ground + 0.7);
  return desired;
}
function progress(index) {
  if (nextGate < 8) {
    let gate = gates[nextGate];
    if (index >= gate && index < gate + 12) {
      checkpoint = gate;
      nextGate++;
      toast(checkpointQuips[(nextGate - 1) % checkpointQuips.length]);
      fuel = Math.min(100, fuel + 20);
    }
  } else if (lastIndex > 300 && index < 20) {
    laps.push(elapsed - lapStart);
    if (lap === 3) {
      finish();
      return;
    }
    lap++;
    lapStart = elapsed;
    nextGate = 1;
    checkpoint = 0;
    toast(`第 ${lap} 圈！老板说再来一份。`);
  }
  lastIndex = index;
}
function finish() {
  resetRoll();
  if (jumps) {
    pos.y = nearest(pos).ground + 0.025;
    vy = 0;
    jumps = 0;
    jetPulse = 0;
  }
  state = "result";
  $("result").style.display = "flex";
  $("finalTime").textContent = fmt(elapsed);
  let old = best();
  if (!old || elapsed < +old) {
    try {
      localStorage.setItem("xian-night-v4-" + difficulty, elapsed);
    } catch {}
  }
  $("summary").textContent =
    laps.map((t, i) => `第${i + 1}圈 ${fmt(t)}`).join("　") +
    `\n最佳纪录 ${fmt(+best() || elapsed)}　·　锅盔翻面 ${rolls} 次
夜市好味 ${picked} 份　·　${nightScore} 分
灯还亮着，饭还热着。街坊，到家咧。`;
  showBest();
}
let hudAccumulator = 0,
  lastBodyState = "";
function update(dt) {
  if (lastBodyState !== state) {
    document.body.dataset.state = state;
    lastBodyState = state;
  }
  hudAccumulator += dt;
  const refreshHud = hudAccumulator >= 0.08;
  if (refreshHud) hudAccumulator %= 0.08;
  let boosting = false,
    hovering = false;
  if (state === "countdown") {
    countdown -= dt;
    $("count").textContent = countdown > 0 ? Math.ceil(countdown) : "开咥！";
    if (countdown < -0.65) {
      state = "race";
      $("count").textContent = "";
    }
  }
  if (state === "race") {
    elapsed += dt;
    updateTraffic(dt);
    const throttle =
      (keys.KeyW || keys.ArrowUp ? 1 : 0) -
      (keys.KeyS || keys.ArrowDown ? 1 : 0);
    boosting =
      !!(keys.ShiftLeft || keys.ShiftRight) && fuel > 0 && throttle > 0;
    const max = boosting ? 61 : chiliTime > 0 ? 44 : 38;
    speed += throttle * (boosting ? 31 : chiliTime > 0 ? 22 : 18) * dt;
    speed *= Math.pow(keys.Space ? 0.3 : 0.995, dt * 60);
    speed = THREE.MathUtils.clamp(speed, -12, max);
    const turn =
      (keys.KeyA || keys.ArrowLeft ? 1 : 0) -
      (keys.KeyD || keys.ArrowRight ? 1 : 0);
    heading +=
      turn *
      dt *
      (keys.Space ? 2.8 : 1.55) *
      Math.min(1, Math.abs(speed) / 8) *
      Math.sign(speed || 1);
    const steps = Math.max(1, Math.ceil((Math.abs(speed) * dt) / 0.38));
    for (let step = 0; step < steps; step++) {
      pos.x += (Math.sin(heading) * speed * dt) / steps;
      pos.z += (Math.cos(heading) * speed * dt) / steps;
      let n = clampRoad();
      if (jumps === 0 && vy <= 0) pos.y = n.ground + 0.025;
      physicsContacts += solveSolids();
      collideTraffic();
      n = clampRoad();
    }
    const near = nearest(pos),
      ground = near.ground;
    hovering = !!keys.KeyF && jumps > 0 && fuel > 0 && flightTime < 2.6;
    flightTime += jumps > 0 ? dt : 0;
    vy -= (hovering ? 7 : 18) * dt;
    const wasAirborne = pos.y > ground + 0.35;
    pos.y += vy * dt;
    if (pos.y > ground + 10) {
      pos.y = ground + 10;
      vy = Math.min(0, vy);
    }
    if (pos.y <= ground + 0.025) {
      pos.y = ground + 0.025;
      if (wasAirborne) landed(ground);
      vy = 0;
      jumps = 0;
      flightTime = 0;
      resetRoll();
    }
    physicsContacts += solveSolids();
    fuel = THREE.MathUtils.clamp(
      fuel +
        ((boosting ? -24 : 0) +
          (hovering ? -16 : 0) +
          (!boosting && !hovering ? 9 : 0)) *
          dt,
      0,
      100,
    );
    if (pos.y < -10 || !Number.isFinite(pos.x)) {
      reset();
      toast("车辆已回到检查点");
    }
    progress(near.index);
    const wall = wallRise((near.index + near.t) / N) > 0.96;
    if (wall && !wallOn) {
      wallVisits++;
      toast("已驶上城墙！城砖有点滑，稳着咥。");
    }
    wallOn = wall;
    const sector = Math.floor(near.index / 40);
    if (sector !== lastSector) {
      lastSector = sector;
      const [title, line] = streetMemories[sector];
      $("memoryTitle").textContent = title;
      $("memoryLine").textContent = line;
    }
    const next = gates[nextGate] ?? 0,
      distance = (((next - near.index + N) % N) / N) * length,
      wallText =
        near.index >= 112 && near.index < 135
          ? "↗ 登城坡道 · 沿主路上城墙"
          : near.index >= 135 && near.index <= 181
            ? "↑ 城墙可驶 · 距地约 12 米"
            : near.index > 181 && near.index <= 203
              ? "↘ 下城坡道 · 慢点咧"
              : near.index > 96 && near.index < 109
                ? "↗ 施工段 · 靠右通过"
                : "↑ " +
                  districtNames[Math.floor(near.index / 40)] +
                  " · 雨夜慢行";
    if (refreshHud)
      $("nav").innerHTML =
        wallText +
        "<small>下个检查点 " +
        (nextGate < 8 ? nextGate + "/7" : "终点") +
        " · " +
        Math.round(distance) +
        " m　" +
        (jumps ? "喷气离地" : wall ? "城砖路面" : "湿滑柏油") +
        "</small>";
  } else updateTraffic(0);
  updatePedestrians(dt);
  updatePickups(dt);
  car.position.copy(pos);
  car.rotation.y = heading;
  const ni = nearest(pos).index,
    n1 = points[(ni + 2) % N],
    n0 = points[(ni + N - 2) % N];
  car.rotation.x = THREE.MathUtils.lerp(
    car.rotation.x,
    jumps
      ? -0.055
      : -Math.atan2(n1.y - n0.y, Math.hypot(n1.x - n0.x, n1.z - n0.z)),
    0.1,
  );
  updateRoll(dt);
  carLean = THREE.MathUtils.lerp(
    carLean,
    ((keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0)) * speed * 0.0015,
    0.1,
  );
  car.rotation.z = carLean + rollAngle;
  wheels.forEach((w) => w.rotateY(speed * dt * 2));
  flame.visible = boosting;
  flame.scale.z = 0.85 + Math.random() * 0.3;
  if (boosting)
    for (let sp of sparks)
      if (sp.life <= 0) {
        sp.life = 0.4;
        sp.m.position
          .copy(pos)
          .add(
            new THREE.Vector3(
              -Math.sin(heading) * 2,
              0.7,
              -Math.cos(heading) * 2,
            ),
          );
        sp.v.set(
          -Math.sin(heading) * 8 + (Math.random() - 0.5) * 3,
          Math.random() * 2,
          -Math.cos(heading) * 8,
        );
        break;
      }
  for (let sp of sparks) {
    sp.life -= dt;
    sp.m.visible = sp.life > 0;
    if (sp.life > 0) {
      sp.m.position.addScaledVector(sp.v, dt);
      sp.m.scale.setScalar(sp.life * 2);
    }
  }
  updateJets(dt, hovering);
  if (audio) {
    const t = audio.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : 0.65, t, 0.04);
    gain.gain.setTargetAtTime(
      state !== "race" ? 0 : 0.009 + Math.abs(speed) * 0.00025,
      t,
      0.05,
    );
    osc.frequency.setTargetAtTime(45 + Math.abs(speed) * 4, t, 0.06);
    rocketGain.gain.setTargetAtTime(boosting ? 0.23 : 0, t, 0.04);
    airGain.gain.setTargetAtTime(
      liftJets.visible ? (hovering ? 0.19 : 0.11) : 0,
      t,
      0.05,
    );
    musicGain.gain.setTargetAtTime(
      musicEnabled && !localTrack.selected
        ? (state === "race" ? 0.48 : state === "paused" ? 0.12 : 0.32) *
            (localTrack.volume / 0.62)
        : 0,
      t,
      0.12,
    );
  }
  localTrack.sync(musicEnabled && !muted, state, document.hidden);
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
    target = pos
      .clone()
      .addScaledVector(forward, 2.5)
      .add(new THREE.Vector3(0, 1.3, 0));
  let desired = pos.clone().addScaledVector(forward, view === 1 ? -18 : -10);
  desired.y += view === 1 ? 11 : 4.2;
  desired = safeCamera(target, desired);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 7));
  camera.position.copy(safeCamera(target, camera.position));
  camera.lookAt(
    pos
      .clone()
      .addScaledVector(forward, 10)
      .add(new THREE.Vector3(0, 1.1, 0)),
  );
  if (state === "menu") {
    car.position.set(37, 0.03, 23);
    car.rotation.set(0, -0.65, 0);
    car.scale.setScalar(2.8);
    camera.position.set(40, 6.4, 47);
    camera.lookAt(5, 10, 0);
  } else car.scale.setScalar(1);
  contactShadow.position.set(
    car.position.x,
    state === "menu" ? 0.012 : nearest(pos).ground + 0.025,
    car.position.z,
  );
  contactShadow.rotation.set(-Math.PI / 2, 0, -car.rotation.y);
  contactShadow.scale.setScalar(state === "menu" ? 2.8 : 1);
  if (refreshHud) {
    $("speed").textContent = Math.round(Math.abs(speed) * 3.6);
    $("fuel").style.width = fuel + "%";
    $("fuelValue").textContent = Math.round(fuel) + "%";
    $("lap").textContent = lap + " / 3";
    $("lapTime").textContent = fmt(elapsed - lapStart);
    $("total").textContent = fmt(elapsed);
  }
  toastTime -= dt;
  if (toastTime < 0) $("toast").textContent = "";
  updateAtmosphere(dt);
  if (refreshHud) drawMap();
}
function drawMap() {
  const ctx = $("map").getContext("2d"),
    scale = 0.4;
  ctx.clearRect(0, 0, 380, 270);
  ctx.strokeStyle = "#9a805330";
  ctx.lineWidth = 1;
  for (let x = 30; x < 380; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, 260);
    ctx.stroke();
  }
  for (let y = 20; y < 270; y += 40) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(368, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#365a5d88";
  ctx.beginPath();
  ctx.ellipse(190 + 263 * scale, 135 - 18 * scale, 28, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6c6a5f";
  ctx.lineWidth = 10;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = 190 + p.x * scale,
      y = 135 + p.z * scale;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = "#c1ab80";
  ctx.lineWidth = 2;
  ctx.stroke();
  gates.forEach((g, i) => {
    ctx.fillStyle = i < nextGate ? "#e9bc68" : "#827b67";
    ctx.beginPath();
    ctx.arc(
      190 + points[g].x * scale,
      135 + points[g].z * scale,
      3.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
  for (let [x, z, name] of [
    [0, 0, "钟楼"],
    [-104, -42, "雁塔"],
    [225, -18, "曲江"],
    [-275, -218, "窑洞"],
  ]) {
    ctx.fillStyle = "#c5b287";
    ctx.fillRect(187 + x * scale, 132 + z * scale, 6, 6);
    ctx.font = "13px KaiTi";
    ctx.textAlign = "center";
    ctx.fillText(name, 190 + x * scale, 152 + z * scale);
  }
  ctx.strokeStyle = "#edbd76";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 112; i <= 203; i++) {
    const p = points[i];
    i === 112
      ? ctx.moveTo(190 + p.x * scale, 135 + p.z * scale)
      : ctx.lineTo(190 + p.x * scale, 135 + p.z * scale);
  }
  ctx.stroke();
  ctx.fillStyle = "#d8bd8c";
  ctx.font = "13px KaiTi";
  ctx.fillText("城墙可驶", 190, 245);
  ctx.strokeStyle = "#b0986c00";
  ctx.beginPath();
  ctx.moveTo(15, 135 - 201 * scale);
  ctx.lineTo(365, 135 - 201 * scale);
  ctx.stroke();
  ctx.save();
  ctx.translate(190 + pos.x * scale, 135 + pos.z * scale);
  ctx.rotate(-heading);
  ctx.fillStyle = "#fff0c9";
  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.lineTo(-5.5, -6);
  ctx.lineTo(5.5, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
addEventListener("keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.repeat || e.target.closest?.("dialog,input,select,textarea")) return;
  keys[e.code] = true;
  if (e.code === "KeyF") takeoff();
  if (e.code === "KeyB") toggleMusic();
  if (e.code === "KeyR" && state === "race") {
    reset();
    toast("已返回最近检查点");
  }
  if (e.code === "KeyC") view = (view + 1) % 2;
  if (e.code === "KeyM") {
    muted = !muted;
    toast(muted ? "声音已关闭" : "声音已开启");
    updateMusicUI();
  }
  if (e.code === "KeyQ") {
    toast(qualityManager.cycle().label);
  }
  if (e.code === "KeyU") openRadio();
  if ($("radioDialog").open) return;
  if (e.code === "Escape") {
    if (state === "race") {
      state = "paused";
      $("count").textContent = "已暂停 · Esc 继续";
    } else if (state === "paused") {
      state = "race";
      $("count").textContent = "";
    }
  }
});
addEventListener("keyup", (e) => (keys[e.code] = false));
document.querySelectorAll("[data-hold]").forEach((button) => {
  const release = () => {
    keys[button.dataset.hold] = false;
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    keys[button.dataset.hold] = true;
    button.classList.add("pressed");
    sound();
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});
document.querySelector("[data-jump]").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  takeoff();
  sound();
});
addEventListener("blur", () => {
  keys = {};
  if (state === "race") {
    state = "paused";
    $("count").textContent = "已暂停 · Esc 继续";
  }
});
document.querySelectorAll("[data-d]").forEach(
  (b) =>
    (b.onclick = () => {
      difficulty = +b.dataset.d;
      document
        .querySelectorAll("[data-d]")
        .forEach(
          (x) => (
            x.classList.toggle("active", x === b),
            x.setAttribute("aria-pressed", String(x === b))
          ),
        );
      showBest();
      build();
    }),
);
document
  .querySelectorAll("[data-music]")
  .forEach((b) => (b.onclick = toggleMusic));
$("start").onclick = start;
$("again").onclick = start;
$("back").onclick = () => {
  state = "menu";
  $("result").style.display = "none";
  $("hud").style.display = "none";
  $("menu").style.display = "flex";
};
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  applyQuality(qualityManager.profile());
});
build();
reset();
showBest();
$("loading").style.display = "none";
let last = performance.now();
const fixedClock = new FixedStepClock();
let warmingFrames = 90;
function frame(now) {
  const frameMs = now - last;
  last = now;
  if (!document.hidden && !contextLost) {
    fixedClock.advance(frameMs / 1000, update);
    wheelInstances?.update();
    renderer.info.reset();
    if (bloom.enabled) composer.render();
    else renderer.render(scene, camera);
    if (warmingFrames-- <= 0) qualityManager.sample(frameMs);
  } else fixedClock.reset();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener("visibilitychange", () => {
  last = performance.now();
  fixedClock.reset();
  if (document.hidden) {
    keys = {};
    localTrack.sync(false, state, true);
    audio?.suspend();
  } else if (audio && !muted) audio.resume().catch(() => {});
});
let contextLost = false;
renderer.domElement.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  contextLost = true;
  keys = {};
  if (state === "race") state = "paused";
  $("count").textContent = "画面暂时中断，正在恢复…";
});
renderer.domElement.addEventListener("webglcontextrestored", () => {
  contextLost = false;
  fixedClock.reset();
  $("count").textContent = state === "paused" ? "已恢复 · Esc 继续" : "";
});
// 可重复的路线验收入口：沿道路中心逐帧推进，使用与驾驶相同的检查点/计圈逻辑。
window.raceTest = {
  roadQuery(p) {
    return nearest(p);
  },
  performanceProfile() {
    return qualityManager.profile();
  },
  localAudio() {
    return localTrack.snapshot();
  },
  auditRoadMesh() {
    world.updateMatrixWorld(true);
    const meshes = [];
    world.traverse((o) => {
      if (o.isMesh && (o.material === asphalt || o.material === wallDeckMat))
        meshes.push(o);
    });
    const ray = new THREE.Raycaster(),
      down = new THREE.Vector3(0, -1, 0);
    let maxError = 0,
      misses = 0,
      samples = 0;
    for (let i = 0; i < N; i++) {
      const a = points[i],
        b = points[(i + 1) % N],
        r = new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize();
      for (const lateral of [-9.75, 0, 9.75]) {
        const q = a.clone().lerp(b, 0.37).addScaledVector(r, lateral),
          n = nearest(q),
          expected = n.ground + (i >= 130 && i < 187 ? 0.018 : 0);
        ray.set(new THREE.Vector3(q.x, expected + 20, q.z), down);
        const hits = ray.intersectObjects(meshes, false);
        samples++;
        if (!hits.length) {
          misses++;
          continue;
        }
        maxError = Math.max(maxError, Math.abs(hits[0].point.y - expected));
      }
    }
    return { samples, misses, maxError };
  },
  auditWorld() {
    let siteOverlaps = 0;
    for (let i = 0; i < sites.length; i++)
      for (let j = i + 1; j < sites.length; j++)
        if (overlap2D(sites[i], sites[j], -0.05)) siteOverlaps++;
    let roadIntrusions = 0;
    for (const b of solids.filter((b) => b.kind === "building")) {
      for (let xx of [-b.w / 2, 0, b.w / 2])
        for (let zz of [-b.d / 2, 0, b.d / 2]) {
          const x = b.x + xx * Math.cos(b.angle) + zz * Math.sin(b.angle),
            z = b.z - xx * Math.sin(b.angle) + zz * Math.cos(b.angle);
          if (nearest(new THREE.Vector3(x, 0, z)).dist < width / 2 + 1)
            roadIntrusions++;
        }
    }
    const maxGroundGap = pedestrians.reduce(
      (m, p) =>
        Math.max(
          m,
          Math.abs(p.g.position.y - (nearest(p.g.position).ground + 0.19)),
        ),
      0,
    );
    let npcOverlaps = 0;
    for (let i = 0; i < traffic.length; i++)
      for (let j = i + 1; j < traffic.length; j++) {
        const a = traffic[i],
          b = traffic[j];
        if (
          satContact(
            {
              x: a.g.position.x,
              z: a.g.position.z,
              w: a.w,
              d: a.l,
              angle: a.heading,
            },
            {
              x: b.g.position.x,
              z: b.g.position.z,
              w: b.w,
              d: b.l,
              angle: b.heading,
            },
          )
        )
          npcOverlaps++;
      }
    return {
      siteOverlaps,
      roadIntrusions,
      maxGroundGap,
      npcOverlaps,
      siteCount: sites.length,
      solidCount: solids.length,
      pedestrians: pedestrians.length,
      busRoutes: [
        ...new Set(traffic.filter((v) => v.type === "bus").map((v) => v.route)),
      ],
      roadWidth: width,
      wall: { start: 112, top: 160, end: 203, height: points[160].y },
      pickups: collectibles.length,
    };
  },
  sceneAt(index, lateral = 0) {
    const i = index % N,
      p = points[i],
      n = points[(i + 1) % N],
      a = Math.atan2(n.x - p.x, n.z - p.z);
    pos
      .copy(p)
      .add(
        new THREE.Vector3(Math.cos(a) * lateral, 0.025, -Math.sin(a) * lateral),
      );
    heading = a;
    speed = 0;
    vy = 0;
    jumps = 0;
    resetRoll();
    snapCamera();
  },
  pickupFixture(type = 0) {
    const p = collectibles.find((p) => p.type === type && p.takenLap !== lap);
    if (!p) return null;
    pos.copy(p.q);
    pos.y += 0.025;
    fuel = 40;
    const before = { picked, nightScore, fuel, chiliTime };
    updatePickups(0.016);
    return {
      before,
      after: { picked, nightScore, fuel, chiliTime },
      itemIndex: p.index,
    };
  },
  solidFixture() {
    const b = solids.find((b) => b.kind === "building");
    pos.set(b.x + 0.2, b.minY + 0.08, b.z + 0.2);
    heading = b.angle;
    speed = 35;
    jumps = 0;
    const before = satContact(carBounds(), b);
    const contacts = solveSolids();
    return {
      before: !!before,
      after: !!satContact(carBounds(), b),
      contacts,
      speed,
    };
  },
  cameraFixture() {
    const b = solids.find((b) => b.kind === "building"),
      side = new THREE.Vector3(Math.sin(b.angle), 0, Math.cos(b.angle)),
      target = new THREE.Vector3(b.x, 2, b.z).addScaledVector(
        side,
        b.d / 2 + 4,
      ),
      desired = new THREE.Vector3(b.x, 2, b.z).addScaledVector(
        side,
        -b.d / 2 - 4,
      ),
      safe = safeCamera(target, desired);
    return {
      originalHit: rayBox(target, desired, b),
      safeHit: rayBox(target, safe, b),
      safe: safe.toArray(),
    };
  },
  trafficSnapshot() {
    return traffic.map((v) => ({
      type: v.type,
      dir: v.dir,
      position: v.g.position.toArray(),
      heading: v.heading,
      hits: v.hits,
      w: v.w,
      l: v.l,
      h: v.h,
      route: v.route,
    }));
  },
  collisionFixture(index = 0, airborne = false) {
    const v = traffic[index];
    pos.copy(v.g.position);
    pos.y += airborne ? v.h + 2 : 0.08;
    heading = v.heading;
    speed = 25;
    if (airborne) {
      jumps = 1;
      vy = 0;
    }
    const before = trafficHits;
    collideTraffic();
    return {
      before,
      after: trafficHits,
      speed,
      height: pos.y - v.g.position.y,
    };
  },
  step(dt) {
    update(dt);
  },
  nodes: N,
  autoDrive(maxFrames = 10000) {
    let frames = 0,
      resets = resetCount;
    while (state === "race" && frames++ < maxFrames) {
      const near = nearest(pos),
        target = points[(near.index + 5) % N],
        desired = Math.atan2(target.x - pos.x, target.z - pos.z),
        err = Math.atan2(
          Math.sin(desired - heading),
          Math.cos(desired - heading),
        );
      keys.KeyA = err > 0.025;
      keys.KeyD = err < -0.025;
      keys.KeyW = true;
      keys.KeyS = false;
      if (Math.abs(err) > 0.5 && speed > 23) {
        keys.KeyW = false;
        keys.KeyS = true;
      }
      if (
        jumps === 0 &&
        obstacles.some((ob) => (ob.index - near.index + N) % N < 4)
      )
        takeoff();
      update(1 / 60);
    }
    keys = {};
    return {
      frames,
      state,
      lap,
      nextGate,
      elapsed,
      laps: [...laps],
      resets: resetCount - resets,
      position: pos.toArray(),
    };
  },
  start,
  choose(d) {
    difficulty = d;
    start();
    state = "race";
    $("count").textContent = "";
  },
  driveStep(i) {
    pos.copy(points[i % N]);
    pos.y += 0.025;
    heading = Math.atan2(
      points[(i + 1) % N].x - pos.x,
      points[(i + 1) % N].z - pos.z,
    );
    elapsed += 0.04;
    progress(i % N);
    snapCamera();
  },
  snapshot() {
    return {
      state,
      lap,
      nextGate,
      checkpoint,
      laps: [...laps],
      elapsed,
      length,
      speed,
      fuel,
      jumps,
      view,
      quality,
      muted,
      position: pos.toArray(),
      airHeight,
      jetVisible: liftJets.visible,
      jetParticles: jetData.filter((p) => p.life > 0).length,
      musicEnabled,
      musicReady,
      musicPeak,
      musicGain: musicGain?.gain.value ?? 0,
      masterGain: master?.gain.value ?? 0,
      rolls,
      rollTime,
      rollAngle,
      trafficHits,
      trafficCount: traffic.length,
      trafficTypes: [...new Set(traffic.map((v) => v.type))],
      picked,
      nightScore,
      chiliTime,
      wallVisits,
      wallOn,
      physicsContacts,
      solidCount: solids.length,
      buildingCount: sites.length,
      pedestrians: pedestrians.length,
      busRoutes: [
        ...new Set(traffic.filter((v) => v.type === "bus").map((v) => v.route)),
      ],
      roadWidth: width,
      roadGround: nearest(pos).ground,
      camera: camera.position.toArray(),
      worldMeshes: world.children.length,
      rendering: {
        ...qualityManager.profile(),
        frameMs: qualityManager.emaMs,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      },
      localTrack: localTrack.snapshot(),
      drawCalls: renderer.info.render.calls,
      vertices: renderer.info.render.triangles,
    };
  },
  jump() {
    takeoff();
    return jumps;
  },
  audioStats() {
    if (!musicAnalyser) return null;
    const samples = new Float32Array(musicAnalyser.fftSize);
    musicAnalyser.getFloatTimeDomainData(samples);
    return {
      rms: Math.sqrt(samples.reduce((s, n) => s + n * n, 0) / samples.length),
      context: audio.state,
      duration: musicBuffer?.duration,
      peak: musicPeak,
    };
  },
  musicChannels() {
    return musicBuffer
      ? Array.from({ length: 2 }, (_, c) =>
          Array.from(musicBuffer.getChannelData(c)),
        )
      : null;
  },
};
