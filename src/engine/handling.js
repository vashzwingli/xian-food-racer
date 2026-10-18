const damp = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export class ArcadeHandling {
  constructor() {
    this.reset();
  }
  reset() {
    this.steering = this.yawRate = this.lateral = this.acceleration = 0;
    this.wheelAngle = 0;
    this.reverseDelay = 0;
    this.brakeDirection = 0;
  }
  impact(factor = 0.35) {
    this.lateral *= factor;
    this.yawRate *= factor;
  }
  step(
    speed,
    dt,
    {
      throttle = 0,
      turn = 0,
      handbrake = false,
      airborne = false,
      boosting = false,
      chili = false,
    } = {},
  ) {
    const previousSpeed = speed;
    const v = Math.abs(speed),
      limit = boosting ? 61 : chili ? 44 : 38;
    const braking = throttle && speed * throttle < -0.025;
    const drag = 0.9 + v * v * 0.0025;
    if (this.reverseDelay > 0 && throttle === this.brakeDirection) {
      this.reverseDelay = Math.max(0, this.reverseDelay - dt);
      speed = 0;
    } else if (braking) {
      speed -= Math.sign(speed) * Math.min(v, (34 + drag) * dt);
      if (speed === 0) {
        this.reverseDelay = 0.22;
        this.brakeDirection = throttle;
      }
    } else if (throttle) {
      this.reverseDelay = 0;
      const max = throttle > 0 ? limit : 12;
      const power = throttle > 0 ? (boosting ? 31 : chili ? 22 : 18) : 10;
      const force = power * (1 - 0.45 * Math.min(1, v / max));
      speed += (throttle * force - Math.sign(speed) * drag) * dt;
      // Releasing the rocket sheds excess speed gradually rather than snapping to 38 m/s.
      if (v <= max) speed = clamp(speed, -12, max);
      else speed -= Math.sign(speed) * Math.min(Math.abs(speed) - max, 9 * dt);
    } else {
      speed -= Math.sign(speed) * Math.min(v, drag * dt);
    }
    if (handbrake && !airborne)
      speed -=
        Math.sign(speed) *
        Math.min(Math.abs(speed), (10 + Math.abs(speed) * 0.34) * dt);
    if (Math.abs(speed) < 0.025 && !throttle) speed = 0;
    this.steering = damp(this.steering, turn, turn === 0 ? 11 : 7.5, dt);
    const authority =
      (handbrake ? 2.05 : 1.68 - Math.min(1, v / 61) * 0.58) *
      Math.min(1, v / 7);
    const desiredYaw =
      this.steering * authority * Math.sign(speed || 1) * (airborne ? 0.38 : 1);
    this.yawRate = damp(this.yawRate, desiredYaw, airborne ? 4 : 10, dt);
    const headingDelta = this.yawRate * dt;
    const grip = airborne ? 1.2 : handbrake ? 3.1 : 13.5;
    this.lateral = (this.lateral - speed * headingDelta) * Math.exp(-grip * dt);
    this.lateral = clamp(
      this.lateral,
      handbrake ? -12 : -7,
      handbrake ? 12 : 7,
    );
    this.acceleration = damp(
      this.acceleration,
      (speed - previousSpeed) / dt,
      8,
      dt,
    );
    this.wheelAngle = Math.atan2(this.yawRate * 3.1, Math.max(5, v));
    return { speed, headingDelta, lateral: this.lateral };
  }
}
