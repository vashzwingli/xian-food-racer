import * as THREE from "three";
export function createCockpit(camera) {
  const root = new THREE.Group();
  camera.add(root);
  root.visible = false;
  const dark = new THREE.MeshStandardMaterial({
    color: "#172126",
    roughness: 0.64,
    metalness: 0.25,
  });
  const red = new THREE.MeshStandardMaterial({
    color: "#732f28",
    roughness: 0.5,
    metalness: 0.3,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: "#caa575",
    roughness: 0.36,
    metalness: 0.7,
  });
  function box(w, h, d, x, y, z, material = dark, parent = root) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  box(2.7, 0.24, 0.6, 0, -0.58, -0.93);
  box(2.7, 0.035, 0.09, 0, -0.443, -0.69, brass);
  box(2.7, 0.075, 0.08, 0, -0.51, -0.58, red);
  // Narrow A-pillars sit at the edge of the windshield, clear of the road ahead.
  for (const s of [-1, 1]) {
    const pillar = box(0.065, 1.36, 0.08, s * 0.96, 0.03, -1.05, red);
    pillar.rotation.z = -s * 0.12;
    box(0.16, 0.04, 0.25, s * 0.78, -0.45, -0.78, brass);
  }
  const wheel = new THREE.Group();
  wheel.position.set(-0.09, -0.43, -0.59);
  root.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.022, 8, 44), dark));
  for (const a of [-Math.PI / 6, Math.PI / 6, Math.PI / 2]) {
    const spoke = box(
      0.17,
      0.018,
      0.028,
      Math.cos(a) * 0.08,
      -Math.sin(a) * 0.08,
      0,
      brass,
      wheel,
    );
    spoke.rotation.z = -a;
  }
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), red);
  hub.position.z = 0.02;
  wheel.add(hub);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d"),
    map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.206),
    new THREE.MeshBasicMaterial({ map, toneMapped: false }),
  );
  screen.position.set(-0.04, -0.285, -0.93);
  root.add(screen);
  const wipers = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.4, -0.34, -1.25);
    root.add(pivot);
    box(0.012, 0.48, 0.012, 0, 0.24, 0, dark, pivot);
    box(0.021, 0.24, 0.012, 0, 0.48, 0, dark, pivot);
    wipers.push(pivot);
  }
  root.traverse((o) => o.layers.set(1));
  let lastSpeed = -1,
    lastFuel = -1;
  function update(speed, fuel, steering, time, refresh = true) {
    wheel.rotation.z = -steering * 1.1;
    for (let i = 0; i < wipers.length; i++)
      wipers[i].rotation.z = -0.25 + Math.sin(time * 3.2 + i * 0.1) * 0.66;
    const kmh = Math.round(Math.abs(speed) * 3.6),
      f = Math.round(fuel);
    if (refresh && (kmh !== lastSpeed || f !== lastFuel)) {
      lastSpeed = kmh;
      lastFuel = f;
      ctx.fillStyle = "#0c171c";
      ctx.fillRect(0, 0, 512, 160);
      ctx.strokeStyle = "#b79a6b";
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, 506, 154);
      ctx.fillStyle = "#dcbf88";
      ctx.font = "20px KaiTi, serif";
      ctx.fillText("陕 A · 08", 22, 34);
      ctx.font = "68px Georgia,serif";
      ctx.fillText(String(kmh).padStart(3, "0"), 22, 105);
      ctx.font = "18px sans-serif";
      ctx.fillText("km/h", 170, 105);
      ctx.font = "20px KaiTi,serif";
      ctx.fillText("长安夜食", 300, 42);
      ctx.fillText("火箭燃料 " + f + "%", 290, 99);
      ctx.fillStyle = "#4a514d";
      ctx.fillRect(22, 130, 468, 8);
      ctx.fillStyle = "#d0ac70";
      ctx.fillRect(22, 130, (468 * f) / 100, 8);
      map.needsUpdate = true;
    }
  }
  update(0, 100, 0, 0);
  return { root, wheel, wipers, update };
}
