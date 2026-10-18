export class AdaptiveQuality {
  constructor(apply) {
    this.apply = apply;
    this.mode = "auto";
    this.level = 2;
    this.emaMs = 16.7;
    this.elapsed = 0;
    this.samples = 0;
    this.slow = 0;
    this.fast = 0;
    this.lastChange = 0;
  }
  profile() {
    const level =
      this.mode === "smooth" ? 0 : this.mode === "cinema" ? 3 : this.level;
    const native = globalThis.devicePixelRatio || 1;
    return {
      mode: this.mode,
      level,
      label:
        this.mode === "auto"
          ? "自动适配"
          : this.mode === "smooth"
            ? "流畅优先"
            : "精致夜景",
      dpr: Math.min(native, [0.9, 1.15, 1.5, 2][level]),
      bloom: level >= 1,
      rain: [260, 430, 700, 700][level],
      detailDistance: [65, 80, 95, 120][level],
      effects: level >= 1,
    };
  }
  cycle() {
    this.mode = { auto: "smooth", smooth: "cinema", cinema: "auto" }[this.mode];
    this.slow = this.fast = this.elapsed = this.samples = 0;
    this.apply(this.profile());
    return this.profile();
  }
  sample(ms) {
    // Ignore tab switches, debugger pauses, initial shader compilation and very long stalls.
    if (this.mode !== "auto" || ms <= 0 || ms > 180) return;
    this.emaMs += (ms - this.emaMs) * 0.045;
    this.elapsed += ms;
    this.samples++;
    if (this.elapsed < 1500 || this.samples < 30) return;
    this.slow = this.emaMs > 24 ? this.slow + 1 : 0;
    this.fast = this.emaMs < 17.8 ? this.fast + 1 : 0;
    this.elapsed = this.samples = 0;
    if (this.slow >= 2 && this.level > 0) {
      this.level--;
      this.slow = this.fast = 0;
      this.apply(this.profile());
    } else if (this.fast >= 5 && this.level < 2) {
      this.level++;
      this.slow = this.fast = 0;
      this.apply(this.profile());
    }
  }
}

export class FixedStepClock {
  constructor(step = 1 / 60, maxSteps = 8) {
    this.step = step;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
  }
  advance(seconds, simulate) {
    this.accumulator += Math.max(
      0,
      Math.min(seconds, this.step * this.maxSteps),
    );
    let steps = 0;
    while (this.accumulator + 1e-9 >= this.step && steps < this.maxSteps) {
      simulate(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    return steps;
  }
  reset() {
    this.accumulator = 0;
  }
}
