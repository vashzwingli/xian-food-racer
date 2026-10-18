import * as THREE from "three";
import { batchRig } from "../engine/batching.js";

// A game-scale interpretation of Xi'an's square brick base and triple eaves.
export function createBellTower(kit) {
  const { box, cylinder, sphere, mat, sign, stone, gold } = kit;
  const root = new THREE.Group();
  root.name = "xian-bell-tower";
  const vermilion = mat("#913d2e", 0.12, 0.54);
  const paint = mat("#2b635b", 0.22, 0.45);
  const tile = mat("#375d4b", 0.3, 0.36);
  const trim = mat("#d3aa66", 0.5, 0.35, 0.12);
  const window = mat("#77482c", 0.08, 0.55, 0.25);
  const wood = mat("#532c26", 0.08, 0.7);
  const light = mat("#ffce8a", 0.12, 0.3, 2.1);
  const wet = mat("#34424a", 0.34, 0.24);
  const doors = [];
  const addMesh = (geometry, material, parent = root) => {
    // City batches use indexed geometry; preserve extruded face normals while
    // giving the arch and vault the same index layout as boxes and roof tiles.
    if (!geometry.index)
      geometry.setIndex(
        Array.from({ length: geometry.attributes.position.count }, (_, i) => i),
      );
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  };
  function archShape(w, h, r, spring) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(-r, 0);
    shape.lineTo(-r, spring);
    shape.absarc(0, spring, r, Math.PI, 0, true);
    shape.lineTo(r, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h);
    shape.lineTo(-w / 2, h);
    shape.closePath();
    return shape;
  }
  function portal(w, z, rotation = 0) {
    const g = new THREE.Group();
    root.add(g);
    g.rotation.y = rotation;
    const mesh = addMesh(
      new THREE.ExtrudeGeometry(archShape(w, 8.3, 3.6, 2.7), {
        depth: 0.8,
        bevelEnabled: false,
        curveSegments: 24,
      }),
      stone,
      g,
    );
    mesh.position.z = z;
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * 0.42, uv.getY(i) * 0.16);
    // Individual voussoirs make the round arch read as masonry rather than a torus.
    for (let i = 0; i < 19; i++) {
      const a = (i * Math.PI) / 19 + 0.012,
        b = ((i + 1) * Math.PI) / 19 - 0.012;
      const s = new THREE.Shape();
      s.absarc(0, 2.7, 3.65, a, b, false);
      s.absarc(0, 2.7, 4.15, b, a, true);
      s.closePath();
      const key = addMesh(
        new THREE.ExtrudeGeometry(s, {
          depth: 0.2,
          bevelEnabled: false,
          curveSegments: 3,
        }),
        trim,
        g,
      );
      key.position.z = z + 0.82;
    }
    for (const side of [-1, 1])
      box(0.5, 2.7, 0.25, side * 3.9, 1.35, z + 0.88, stone, g);
    box(w, 0.28, 1.2, 0, 8.27, z + 0.3, stone, g);
  }
  portal(34, 13.7);
  portal(34, 13.7, Math.PI);
  portal(29, 16.2, Math.PI / 2);
  portal(29, 16.2, -Math.PI / 2);
  box(34, 0.45, 29, 0, 8.38, 0, stone, root);
  box(35, 0.22, 30, 0, 8.7, 0, trim, root);
  box(35, 0.25, 30, 0, 0.02, 0, stone, root);
  // Open vaulted north/south passage. Its interior is real geometry used by the camera shot.
  const vault = new THREE.Shape();
  vault.absarc(0, 2.7, 3.6, 0, Math.PI, false);
  vault.absarc(0, 2.7, 3.94, Math.PI, 0, true);
  vault.closePath();
  const ceiling = addMesh(
    new THREE.ExtrudeGeometry(vault, {
      depth: 27.4,
      bevelEnabled: false,
      curveSegments: 24,
    }),
    stone,
  );
  ceiling.position.z = -13.7;
  for (const side of [-1, 1])
    box(0.55, 2.7, 27.4, side * 3.88, 1.35, 0, stone, root);
  box(8, 0.035, 62, 0, 0.16, 0, wet, root);
  for (let z = -29; z <= 29; z += 1.7)
    box(7.4, 0.006, 0.025, 0, 0.182, z, stone, root);
  for (const z of [-10, 0, 10]) {
    for (const side of [-1, 1]) {
      box(0.09, 0.6, 0.38, side * 3.48, 3.15, z, trim, root);
      box(0.11, 0.28, 0.24, side * 3.42, 3.35, z, light, root);
    }
    const lamp = new THREE.PointLight(0xffbd78, 24, 10, 2);
    lamp.position.set(0, 5.1, z);
    root.add(lamp);
  }
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.userData.dynamic = true;
    hinge.position.set(side * 3.55, 0, 14.48);
    root.add(hinge);
    const top = (x) =>
      2.7 + Math.sqrt(Math.max(0, 3.58 ** 2 - (side * 3.55 + x) ** 2)) - 0.06;
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0.15);
    leaf.lineTo(-side * 3.5, 0.15);
    for (let i = 0; i <= 24; i++) {
      const x = -side * 3.5 * (1 - i / 24);
      leaf.lineTo(x, top(x));
    }
    leaf.closePath();
    addMesh(
      new THREE.ExtrudeGeometry(leaf, { depth: 0.18, bevelEnabled: false }),
      wood,
      hinge,
    );
    for (let x = 0.35; x < 3.3; x += 0.46) {
      const h = top(-side * x) - 0.3;
      box(0.025, h, 0.025, -side * x, 0.15 + h / 2, 0.2, trim, hinge);
      for (let y = 1; y < top(-side * x) - 0.3; y += 0.87)
        sphere(0.055, 0.055, 0.04, -side * x, y, 0.22, trim, hinge);
    }
    const ring = addMesh(
      new THREE.TorusGeometry(0.18, 0.032, 6, 16),
      trim,
      hinge,
    );
    ring.position.set(-side * 2.9, 2.7, 0.2);
    // Keep the hinges animated, but draw each leaf in a few material batches.
    batchRig(hinge);
    doors.push({ hinge, side });
  }
  function gallery(y, w, d, h) {
    box(w - 0.8, h - 0.5, d - 0.8, 0, y + h / 2, 0, wood, root);
    for (let face = 0; face < 4; face++) {
      const g = new THREE.Group();
      root.add(g);
      g.rotation.y = (face * Math.PI) / 2;
      const fw = face % 2 ? d : w,
        fd = face % 2 ? w : d;
      for (let x = -fw / 2; x <= fw / 2 + 0.1; x += fw / 6) {
        cylinder(0.22, 0.28, h, x, y + h / 2, fd / 2 + 0.28, vermilion, g, 10);
        box(0.68, 0.18, 0.75, x, y + 0.12, fd / 2 + 0.28, stone, g);
        for (let b = 0; b < 3; b++) {
          box(
            0.7 + b * 0.22,
            0.16,
            0.5 + b * 0.25,
            x,
            y + h - 0.3 + b * 0.19,
            fd / 2 + 0.23 + b * 0.17,
            b % 2 ? trim : paint,
            g,
          );
        }
      }
      for (let x = -fw / 2 + 0.8; x < fw / 2 - 1; x += 2.65) {
        box(2.1, h - 1.2, 0.1, x, y + h / 2, fd / 2 + 0.03, window, g);
        for (let j = 0; j < 5; j++)
          box(
            0.045,
            h - 1.1,
            0.08,
            x - 0.85 + j * 0.42,
            y + h / 2,
            fd / 2 + 0.11,
            paint,
            g,
          );
        for (let j = 0; j < 3; j++)
          box(
            2.12,
            0.065,
            0.08,
            x,
            y + 1 + (j * (h - 2)) / 2,
            fd / 2 + 0.17,
            trim,
            g,
          );
      }
      box(fw + 1.8, 0.24, 0.24, 0, y + h - 0.1, fd / 2 + 0.65, paint, g);
      box(fw + 1.8, 0.13, 0.24, 0, y + h + 0.13, fd / 2 + 0.65, trim, g);
      box(fw + 2.1, 0.18, 0.25, 0, y + 1.1, fd / 2 + 1, vermilion, g);
      for (let x = -fw / 2 - 0.6; x < fw / 2 + 1; x += 1.1)
        box(0.09, 1.05, 0.1, x, y + 0.58, fd / 2 + 1, trim, g);
      box(fw + 2.5, 0.22, 0.5, 0, y - 0.05, fd / 2 + 0.8, stone, g);
    }
  }
  function pyramid(w, d, y, rise, inner) {
    const positions = [],
      uv = [],
      indices = [],
      steps = 20,
      rows = 10;
    for (let face = 0; face < 4; face++) {
      const fw = face % 2 ? d : w,
        fd = face % 2 ? w : d,
        a = (face * Math.PI) / 2;
      const offset = positions.length / 3;
      const point = (u, v) => {
        const r = inner + (1 - inner) * v;
        const x = u * fw * 0.5 * r,
          z = fd * 0.5 * r;
        return new THREE.Vector3(
          x * Math.cos(a) + z * Math.sin(a),
          y +
            rise * Math.pow(1 - v, 1.28) +
            0.56 * Math.pow(Math.abs(u), 7) * Math.pow(v, 3),
          -x * Math.sin(a) + z * Math.cos(a),
        );
      };
      for (let row = 0; row <= rows; row++)
        for (let col = 0; col <= steps; col++) {
          const p = point((col / steps) * 2 - 1, row / rows);
          positions.push(p.x, p.y, p.z);
          uv.push(col / steps, row / rows);
        }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < steps; c++) {
          const k = offset + r * (steps + 1) + c;
          indices.push(
            k,
            k + steps + 1,
            k + 1,
            k + 1,
            k + steps + 1,
            k + steps + 2,
          );
        }
      for (let col = 0; col <= steps; col++) {
        const path = [];
        for (let r = 0; r <= rows; r++)
          path.push(
            point((col / steps) * 2 - 1, r / rows).add(
              new THREE.Vector3(0, 0.045, 0),
            ),
          );
        const curve = new THREE.CatmullRomCurve3(path);
        addMesh(
          new THREE.TubeGeometry(
            curve,
            10,
            col === 0 || col === steps ? 0.075 : 0.027,
            4,
            false,
          ),
          col === 0 || col === steps ? trim : paint,
        );
      }
      for (let col = 0; col < steps; col++) {
        const p = point(((col + 0.5) / steps) * 2 - 1, 1);
        sphere(0.065, 0.055, 0.065, p.x, p.y, p.z, trim, root);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = addMesh(geometry, tile);
    mesh.material.side = THREE.DoubleSide;
  }
  gallery(9.05, 24, 19, 5.7);
  gallery(18.1, 19, 15, 8.0);
  pyramid(34.8, 29.5, 14.85, 3.25, 0.66);
  pyramid(27.4, 23.0, 22.2, 3.35, 0.62);
  pyramid(22.4, 19.0, 27.15, 6.35, 0.025);
  cylinder(0.19, 0.36, 1.25, 0, 34.05, 0, gold, root, 12);
  sphere(0.42, 0.55, 0.42, 0, 34.9, 0, gold, root);
  cylinder(0.01, 0.13, 0.8, 0, 35.55, 0, gold, root, 10);
  for (const side of [-1, 1]) {
    sign("钟 楼", 0, 20.5, side * 8.14, "#efd098", 5.1, root).rotation.y =
      side < 0 ? Math.PI : 0;
    const lamp = new THREE.PointLight(0xffc17a, 180, 47, 2);
    lamp.position.set(side * 17, 10, 18);
    root.add(lamp);
  }
  root.userData.landmark = {
    roofTiers: 3,
    baseHeight: 8.5,
    height: 36,
    passageRadius: 3.6,
    passageSpring: 2.7,
  };
  function open(amount = 1) {
    for (const { hinge, side } of doors)
      hinge.rotation.y = side * amount * 1.48;
  }
  open(1);
  return { root, open, doors };
}
