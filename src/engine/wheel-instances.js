import * as THREE from "three";

// Wheels retain their transform nodes for steering/spin. Repeated geometry is submitted
// once per geometry/material instead of once per wheel on each of the 24 traffic cars.
export class WheelInstances {
  constructor(world, traffic) {
    this.groups = new Map();
    for (const vehicle of traffic) {
      for (const wheel of vehicle.axle)
        wheel.traverse((source) => {
          if (!source.isMesh) return;
          const key = source.geometry.uuid + ":" + source.material.uuid;
          if (!this.groups.has(key))
            this.groups.set(key, {
              geometry: source.geometry,
              material: source.material,
              items: [],
            });
          this.groups.get(key).items.push({ source, vehicle });
          source.visible = false;
        });
    }
    for (const group of this.groups.values()) {
      const mesh = new THREE.InstancedMesh(
        group.geometry,
        group.material,
        group.items.length,
      );
      mesh.userData.dynamic = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      world.add(mesh);
      group.mesh = mesh;
    }
    this.traffic = traffic;
  }
  update() {
    for (const vehicle of this.traffic)
      if (vehicle.g.visible) vehicle.g.updateMatrixWorld(true);
    for (const group of this.groups.values()) {
      let count = 0;
      for (const { source, vehicle } of group.items) {
        if (vehicle.g.visible)
          group.mesh.setMatrixAt(count++, source.matrixWorld);
      }
      group.mesh.count = count;
      group.mesh.visible = count > 0;
      group.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  dispose() {
    for (const group of this.groups.values()) group.mesh.dispose();
  }
}
