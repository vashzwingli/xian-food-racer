import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export function batchRig(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    groups = new Map(),
    old = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let parent = o,
      animated = false;
    while (parent && parent !== root) {
      if (parent.userData.animated) animated = true;
      parent = parent.parent;
    }
    if (animated) return;
    const g = o.geometry.clone();
    g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    for (const name of Object.keys(g.attributes))
      if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv)
      g.setAttribute(
        "uv",
        new THREE.BufferAttribute(
          new Float32Array(g.attributes.position.count * 2),
          2,
        ),
      );
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(g);
    old.push(o);
  });
  for (const o of old) {
    o.parent.remove(o);
    if (!o.geometry.userData.shared) o.geometry.dispose();
  }
  for (const [m, items] of groups) {
    const geo = mergeGeometries(items, false);
    for (const g of items) g.dispose();
    if (geo) {
      geo.computeBoundingSphere();
      root.add(new THREE.Mesh(geo, m));
    }
  }
}
