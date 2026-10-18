import * as THREE from "three";
import { batchRig } from "../engine/batching.js";
export function createPlayerVehicle({
  scene,
  mat,
  texture,
  box,
  cylinder,
  sphere,
  sign,
  gold,
  white,
}) {
  const car = new THREE.Group();
  scene.add(car);
  const paint = new THREE.MeshPhysicalMaterial({
      color: "#a82b24",
      metalness: 0.65,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
    }),
    glass = new THREE.MeshPhysicalMaterial({
      color: "#263e4b",
      metalness: 0.7,
      roughness: 0.12,
      clearcoat: 1,
    }),
    carbon = mat("#1d262b", 0.5, 0.45),
    rubber = mat("#15191b", 0.04, 0.85);
  function loft(sections, material, parent) {
    const v = [],
      idx = [];
    const shape = [
      [-1, 0],
      [-1, 0.4],
      [-0.88, 0.85],
      [-0.5, 1],
      [0.5, 1],
      [0.88, 0.85],
      [1, 0.4],
      [1, 0],
    ];
    sections.forEach(([z, w, y, h]) =>
      shape.forEach(([x, t]) => v.push(x * w, y + t * h, z)),
    );
    for (let j = 0; j < sections.length - 1; j++)
      for (let k = 0; k < 8; k++) {
        let a = j * 8 + k,
          b = j * 8 + ((k + 1) % 8),
          c = a + 8,
          d = b + 8;
        idx.push(a, c, b, b, c, d);
      }
    for (let end of [0, sections.length - 1])
      for (let k = 1; k < 7; k++)
        idx.push(end * 8, end * 8 + k, end * 8 + k + 1);
    let g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    material.side = THREE.DoubleSide;
    let m = new THREE.Mesh(g, material);
    parent.add(m);
    return m;
  }
  loft(
    [
      [-2.18, 0.82, 0.4, 0.48],
      [-1.65, 1.04, 0.35, 0.62],
      [-0.8, 1.01, 0.37, 0.57],
      [0.45, 0.96, 0.35, 0.44],
      [1.35, 1.04, 0.32, 0.4],
      [2.2, 0.82, 0.33, 0.25],
    ],
    paint,
    car,
  );
  loft(
    [
      [-0.9, 0.72, 0.78, 0.15],
      [-0.55, 0.73, 0.8, 0.65],
      [0.15, 0.69, 0.82, 0.62],
      [0.95, 0.64, 0.72, 0.04],
    ],
    glass,
    car,
  );
  box(1.27, 0.055, 0.46, -0, 1.43, -0.23, paint, car);
  for (let x of [-0.96, 0.96]) {
    box(0.14, 0.18, 2.7, x, 0.35, 0, carbon, car);
    let intake = box(0.1, 0.28, 0.7, x, 0.65, -0.25, carbon, car);
    intake.rotation.y = x > 0 ? 0.15 : -0.15;
    box(0.11, 0.045, 3.3, x * 0.82, 0.86, -0.1, gold, car);
  }
  for (let x of [-0.27, 0.27]) {
    let stripe = box(0.1, 0.024, 1.16, x, 0.753, 1.35, gold, car);
    stripe.rotation.x = 0.09;
  }
  for (let x of [-0.9, 0.9]) {
    box(0.28, 0.1, 0.16, x * 1.1, 1.01, 0.36, paint, car);
    box(0.05, 0.05, 0.16, x * 1.05, 0.96, 0.3, gold, car);
  }
  box(2.03, 0.12, 0.28, 0, 0.28, 2.14, carbon, car);
  box(1.88, 0.1, 0.18, 0, 0.31, -2.17, carbon, car);
  for (let x of [-0.65, 0.65])
    box(0.06, 0.4, 0.11, x, 0.98, -1.88, carbon, car);
  box(2.25, 0.1, 0.46, 0, 1.2, -1.9, paint, car);
  box(2.22, 0.025, 0.1, 0, 1.27, -2.04, gold, car);
  const wheels = [],
    frontWheels = [];
  for (let x of [-1.04, 1.04])
    for (let z of [-1.38, 1.38]) {
      const w = new THREE.Group();
      const steeringPivot = new THREE.Group();
      steeringPivot.position.set(x, 0.48, z);
      steeringPivot.userData.animated = true;
      car.add(steeringPivot);
      if (z > 0) frontWheels.push(steeringPivot);
      w.rotation.z = Math.PI / 2;
      steeringPivot.add(w);
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.14, 10, 24),
        rubber,
      );
      tire.rotation.x = Math.PI / 2;
      w.add(tire);
      cylinder(0.31, 0.31, 0.31, 0, 0, 0, carbon, w, 24);
      cylinder(0.26, 0.26, 0.33, 0, 0, 0, gold, w, 20);
      cylinder(0.2, 0.2, 0.345, 0, 0, 0, carbon, w, 16);
      for (let k = 0; k < 5; k++) {
        let sp = box(0.048, 0.36, 0.48, 0, 0, 0, gold, w);
        sp.rotation.y = (k * Math.PI) / 5;
      }
      cylinder(0.07, 0.07, 0.38, 0, 0, 0, gold, w, 12);
      w.userData.animated = true;
      wheels.push(w);
    }
  for (let x of [-0.72, 0.72]) {
    let lamp = box(0.43, 0.065, 0.1, x, 0.65, 2.12, white, car);
    lamp.rotation.y = x > 0 ? -0.12 : 0.12;
    box(0.63, 0.045, 0.09, x, 0.83, -2.13, mat("#ed4c31", 0.3, 0.25, 2.6), car);
    let rocket = new THREE.Group();
    rocket.position.set(x * 0.64, 0.6, -2.15);
    rocket.rotation.x = Math.PI / 2;
    car.add(rocket);
    cylinder(0.24, 0.3, 0.32, 0, 0, 0, gold, rocket, 16);
    cylinder(0.17, 0.21, 0.35, 0, -0.04, 0, carbon, rocket, 16);
    cylinder(
      0.12,
      0.15,
      0.36,
      0,
      -0.07,
      0,
      mat("#ff8749", 0.2, 0.25, 0.7),
      rocket,
      16,
    );
  }
  const badge = sign("长 安", 0, 0.83, -2.21, "#f1cc8e", 0.9, car);
  badge.rotation.y = Math.PI;
  for (let side of [-1, 1]) {
    const decal = sign(
      "长安 · 08",
      side * 1.014,
      0.72,
      -0.25,
      "#e9c78b",
      1.2,
      car,
    );
    decal.rotation.y = (side * Math.PI) / 2;
  }
  const flame = new THREE.Group();
  flame.position.set(0, 0.6, -2.4);
  car.add(flame);
  flame.userData.animated = true;
  for (let x of [-0.46, 0.46]) {
    let f = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 1.6, 12),
      mat("#ffad50", 0.15, 0.3, 4),
    );
    f.rotation.x = -Math.PI / 2;
    f.position.set(x, 0, -0.6);
    flame.add(f);
    let core = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 1, 10),
      mat("#e2f2f5", 0.1, 0.2, 4),
    );
    core.rotation.x = -Math.PI / 2;
    core.position.set(x, 0, -0.35);
    flame.add(core);
  }
  flame.visible = false;

  function bodyCurve(points, material, radius = 0.025) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, radius, 6, false),
      material,
    );
    car.add(mesh);
    return mesh;
  }
  for (let side of [-1, 1]) {
    for (let z of [-1.38, 1.38]) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.54, 0.055, 8, 24, Math.PI),
        carbon,
      );
      arch.rotation.y = Math.PI / 2;
      arch.position.set(side * 1.055, 0.48, z);
      car.add(arch);
      box(
        0.08,
        0.22,
        0.19,
        side * 1.095,
        0.55,
        z + 0.14,
        mat("#ba4b31", 0.5, 0.4),
        car,
      );
      for (let k = 0; k < 5; k++) {
        const a = (k * Math.PI * 2) / 5;
        sphere(
          0.024,
          0.024,
          0.024,
          side * 1.2,
          0.48 + Math.sin(a) * 0.14,
          z + Math.cos(a) * 0.14,
          gold,
          car,
        );
      }
    }
    bodyCurve(
      [
        [side * 0.85, 0.49, 1.2],
        [side * 1.02, 0.53, 0.55],
        [side * 1.025, 0.53, -0.55],
        [side * 0.9, 0.64, -0.9],
      ],
      gold,
      0.015,
    );
    bodyCurve(
      [
        [side * 0.78, 0.88, 0.65],
        [side * 0.96, 0.8, 0.2],
        [side * 1.017, 0.77, -0.6],
        [side * 0.85, 0.79, -1.0],
      ],
      carbon,
      0.012,
    );
    for (let j = 0; j < 4; j++) {
      let vent = box(
        0.38,
        0.022,
        0.055,
        side * 0.58,
        0.78,
        1.25 + j * 0.12,
        carbon,
        car,
      );
      vent.rotation.x = 0.1;
    }
    box(0.14, 0.06, 0.3, side * 0.99, 0.81, -0.5, gold, car);
    box(0.23, 0.06, 0.13, side * 1.13, 0.99, 0.4, glass, car);
  }
  box(1.5, 0.13, 3.45, 0, 0.23, -0.1, carbon, car);
  box(0.55, 0.04, 1.85, 0, 0.14, -0.2, mat("#575b58", 0.5, 0.5), car);
  for (let x of [-0.65, 0.65])
    for (let z of [-1.4, 0, 1.4]) {
      const bolt = cylinder(0.035, 0.035, 0.035, x, 0.14, z, gold, car, 8);
    }
  for (let x of [-0.6, -0.3, 0, 0.3, 0.6]) {
    box(0.035, 0.18, 0.65, x, 0.27, -1.95, carbon, car);
  }
  box(1.58, 0.035, 0.08, 0, 0.82, -2.18, mat("#de4931", 0.3, 0.25, 2), car);
  for (let side of [-1, 1]) {
    box(0.08, 0.12, 0.07, side * 0.93, 0.61, 2.15, white, car);
    box(
      0.31,
      0.025,
      0.04,
      side * 0.7,
      0.58,
      2.17,
      mat("#d8bc89", 0.35, 0.35),
      car,
    );
  }
  const shadowMap = texture((ctx, w, h) => {
    const grad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      10,
      w / 2,
      h / 2,
      w / 2,
    );
    grad.addColorStop(0, "#000000bb");
    grad.addColorStop(0.6, "#00000066");
    grad.addColorStop(1, "#00000000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 6.3),
    new THREE.MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      depthWrite: false,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.012;
  scene.add(contactShadow);
  const headlight = new THREE.SpotLight(0xffe9c2, 9, 38, 0.4, 0.8, 1.5);
  headlight.position.set(0, 1, 2);
  headlight.target.position.set(0, 0, 20);
  car.add(headlight, headlight.target);

  const liftJets = new THREE.Group(),
    jetBodies = [],
    plumes = [];
  car.add(liftJets);
  liftJets.userData.animated = true;
  for (let x of [-0.8, 0.8])
    for (let z of [-1.3, 1.3]) {
      const nozzle = new THREE.Group();
      nozzle.position.set(x, 0.28, z);
      car.add(nozzle);
      nozzle.userData.animated = true;
      jetBodies.push(nozzle);
      cylinder(0.18, 0.24, 0.18, 0, 0, 0, carbon, nozzle, 16);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.045, 8, 16),
        gold,
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -0.1;
      nozzle.add(rim);
      cylinder(
        0.12,
        0.12,
        0.03,
        0,
        -0.11,
        0,
        mat("#b6eaff", 0.3, 0.25, 2.8),
        nozzle,
        16,
      );
      const plume = new THREE.Group();
      plume.position.set(x, 0.17, z);
      liftJets.add(plume);
      for (let k = 0; k < 3; k++) {
        const material = new THREE.MeshBasicMaterial({
          color: k === 0 ? "#e7faff" : "#8fd7ff",
          transparent: true,
          opacity: [0.65, 0.18, 0.08][k],
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.08 + k * 0.04,
            0.25 + k * 0.12,
            1.5 + k * 0.4,
            14,
            1,
            true,
          ),
          material,
        );
        mesh.position.y = -0.72 - k * 0.15;
        plume.add(mesh);
      }
      plumes.push(plume);
    }
  liftJets.visible = false;
  const jetLight = new THREE.PointLight(0x9bdfff, 0, 10, 2);
  jetLight.position.y = -0.5;
  car.add(jetLight);

  batchRig(car);
  return {
    car,
    wheels,
    frontWheels,
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
  };
}
