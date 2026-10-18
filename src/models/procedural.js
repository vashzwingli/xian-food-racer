import * as THREE from "three";
export function createGeometryKit(world) {
  const materials = new Map();
  function mat(c, m = 0, r = 0.7, e = 0) {
    let key = [c, m, r, e].join();
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: c,
          metalness: m,
          roughness: r,
          emissive: c,
          emissiveIntensity: e,
        }),
      );
    return materials.get(key);
  }
  function texture(draw, w = 512, h = 512) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  const geometryCache = new Map();
  function box(w, h, d, x, y, z, material, parent = world) {
    const key = [w, h, d].join();
    if (!geometryCache.has(key))
      geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
    geometryCache.get(key).userData.shared = true;
    const o = new THREE.Mesh(geometryCache.get(key), material);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function cylinder(
    r1,
    r2,
    h,
    x,
    y,
    z,
    material,
    parent = world,
    segments = 12,
  ) {
    const key = "c" + [r1, r2, h, segments].join();
    if (!geometryCache.has(key)) {
      const g = new THREE.CylinderGeometry(r1, r2, h, segments);
      g.userData.shared = true;
      geometryCache.set(key, g);
    }
    const o = new THREE.Mesh(geometryCache.get(key), material);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function sphere(rx, ry, rz, x, y, z, material, parent) {
    const key = "sphere";
    if (!geometryCache.has(key)) {
      let g = new THREE.SphereGeometry(1, 20, 12);
      g.userData.shared = true;
      geometryCache.set(key, g);
    }
    let o = new THREE.Mesh(geometryCache.get(key), material);
    o.scale.set(rx, ry, rz);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  const allSignMaterials = new Map();
  function sign(text, x, y, z, color = "#ecd197", size = 12, parent = world) {
    const cacheKey = text + color;
    let material = allSignMaterials.get(cacheKey);
    if (!material) {
      const tx = texture(
        (ctx, w, h) => {
          ctx.fillStyle = "#462e25";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#b18a51";
          ctx.lineWidth = 3;
          ctx.strokeRect(7, 7, w - 14, h - 14);
          ctx.strokeStyle = "#d9b778";
          ctx.lineWidth = 1;
          ctx.strokeRect(13, 13, w - 26, h - 26);
          for (let xx of [18, w - 28])
            for (let yy of [18, h - 28]) {
              ctx.strokeRect(xx, yy, 10, 10);
            }
          ctx.fillStyle = color;
          ctx.font =
            "bold " +
            (text.length > 9 ? 49 : 60) +
            "px KaiTi, STKaiti, Microsoft YaHei";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, w / 2, h / 2 + 2, w - 42);
        },
        768,
        160,
      );
      material = new THREE.MeshStandardMaterial({
        map: tx,
        roughness: 0.6,
        emissive: "#c6a372",
        emissiveMap: tx,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide,
      });
      material.userData.persistent = true;
      allSignMaterials.set(cacheKey, material);
    }
    const o = new THREE.Mesh(
      new THREE.PlaneGeometry(size, (size * 160) / 768),
      material,
    );
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }

  return {
    mat,
    texture,
    box,
    cylinder,
    sphere,
    sign,
    materials,
    geometryCache,
  };
}
