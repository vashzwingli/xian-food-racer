// Each segment is indexed in every cell intersected by its expanded bounds.
// Inside the supported query radius this gives the same closest segment as a full scan.
export class RoadIndex {
  constructor(points, cellSize = 48, radius = 58) {
    this.points = points;
    this.cellSize = cellSize;
    this.radius = radius;
    this.grid = new Map();
    this.segments = points.map((a, i) => {
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        angle = Math.atan2(dx, dz);
      const segment = {
        i,
        a,
        b,
        dx,
        dz,
        invLength2: 1 / (dx * dx + dz * dz),
        angle,
        rx: Math.cos(angle),
        rz: -Math.sin(angle),
      };
      for (
        let x = Math.floor((Math.min(a.x, b.x) - radius) / cellSize);
        x <= Math.floor((Math.max(a.x, b.x) + radius) / cellSize);
        x++
      ) {
        for (
          let z = Math.floor((Math.min(a.z, b.z) - radius) / cellSize);
          z <= Math.floor((Math.max(a.z, b.z) + radius) / cellSize);
          z++
        ) {
          const key = x + ":" + z;
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key).push(segment);
        }
      }
      return segment;
    });
  }

  nearest(p, out = {}) {
    const candidates = this.grid.get(
      Math.floor(p.x / this.cellSize) + ":" + Math.floor(p.z / this.cellSize),
    );
    let min = Infinity,
      best,
      bt = 0,
      bx = 0,
      bz = 0;
    const visit = (segments) => {
      for (const s of segments) {
        const t = Math.max(
          0,
          Math.min(
            1,
            ((p.x - s.a.x) * s.dx + (p.z - s.a.z) * s.dz) * s.invLength2,
          ),
        );
        const x = s.a.x + t * s.dx,
          z = s.a.z + t * s.dz;
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < min || (d === min && s.i < best.i)) {
          min = d;
          best = s;
          bt = t;
          bx = x;
          bz = z;
        }
      }
    };
    if (candidates) visit(candidates);
    if (!best || min > this.radius ** 2) visit(this.segments);
    out.index = best.i;
    out.t = bt;
    out.dist = Math.sqrt(min);
    out.ground = best.a.y + (best.b.y - best.a.y) * bt;
    out.x = bx;
    out.z = bz;
    out.angle = best.angle;
    out.rx = best.rx;
    out.rz = best.rz;
    out.lateral = (p.x - bx) * best.rx + (p.z - bz) * best.rz;
    return out;
  }
}
