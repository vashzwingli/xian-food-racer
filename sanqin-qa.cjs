const enterMenu = require("./tests/enter-menu.cjs");
const { chromium } = require("playwright");
const fs = require("fs"),
  http = require("http"),
  path = require("path"),
  assert = require("assert");
const server = http
  .createServer((q, s) => {
    s.setHeader("Content-Type", "text/html;charset=utf-8");
    s.end(
      fs.readFileSync(
        path.join(
          __dirname,
          process.env.FOOD_RACER_GAME || "index.offline.html",
        ),
      ),
    );
  })
  .listen(8761, "127.0.0.1");
(async () => {
  const browser = await chromium.launch(require("./tests/browser-options.cjs"));
  try {
    const page = await browser.newPage({
        viewport: { width: 1024, height: 640 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message || String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("http://127.0.0.1:8761");
    await enterMenu(page);
    await page.locator("#start").click();
    await page.waitForFunction(() => raceTest.snapshot().state === "race", {
      timeout: 30000,
    });
    const initial = await page.evaluate(() => raceTest.snapshot());
    assert(initial.length > 1750);
    assert.equal(initial.trafficCount, 24);
    assert.deepEqual(initial.trafficTypes.sort(), ["bus", "taxi", "truck"]);
    const before = await page.evaluate(() => raceTest.trafficSnapshot());
    await page.waitForFunction(
      (before) =>
        raceTest
          .trafficSnapshot()
          .every(
            (v, i) =>
              Math.hypot(
                v.position[0] - before[i].position[0],
                v.position[2] - before[i].position[2],
              ) > 2,
          ),
      before,
      { timeout: 15000 },
    );
    const after = await page.evaluate(() => raceTest.trafficSnapshot());
    assert(
      after.every(
        (v, i) =>
          Math.hypot(
            v.position[0] - before[i].position[0],
            v.position[2] - before[i].position[2],
          ) > 2,
      ),
    );
    assert(after.some((v) => v.dir === 1) && after.some((v) => v.dir === -1));
    const collision = await page.evaluate(() => {
      raceTest.choose(0);
      return raceTest.collisionFixture(0, false);
    });
    assert(collision.after > collision.before);
    assert(collision.speed < 25);
    const clearance = await page.evaluate(() => {
      raceTest.choose(0);
      return raceTest.collisionFixture(0, true);
    });
    assert.equal(clearance.after, clearance.before);
    assert.equal(clearance.speed, 25);
    await page.evaluate(() => {
      raceTest.choose(1);
      for (let i = 0; i <= 17; i++) raceTest.driveStep(i);
    });
    await page.waitForTimeout(650);
    await page.screenshot({ path: path.join(__dirname, "traffic.png") });
    await page.keyboard.down("f");
    await page.waitForFunction(() => raceTest.snapshot().airHeight > 1, {
      timeout: 15000,
    });
    await page.keyboard.up("f");
    await page.keyboard.press("f");
    await page.waitForFunction(
      () =>
        raceTest.snapshot().rollTime > 0 &&
        Math.abs(raceTest.snapshot().rollAngle) > 1,
      { timeout: 15000 },
    );
    const mid = await page.evaluate(() => raceTest.snapshot());
    assert.equal(mid.jumps, 2);
    assert(mid.rollTime > 0 && Math.abs(mid.rollAngle) > 1);
    assert(mid.jetVisible);
    await page.screenshot({ path: path.join(__dirname, "barrel-roll.png") });
    await page.waitForFunction(() => raceTest.snapshot().rolls === 1, {
      timeout: 20000,
    });
    await page.waitForFunction(() => raceTest.snapshot().jumps === 0, {
      timeout: 20000,
    });
    const landed = await page.evaluate(() => raceTest.snapshot());
    assert.equal(landed.rollAngle, 0);
    assert.equal(landed.rollTime, 0);
    await page.keyboard.press("f");
    await page.keyboard.press("f");
    await page.waitForTimeout(170);
    await page.keyboard.press("r");
    const reset = await page.evaluate(() => raceTest.snapshot());
    assert.equal(reset.rollAngle, 0);
    assert.equal(reset.rollTime, 0);
    assert.equal(reset.jumps, 0);
    await page.evaluate(() => {
      raceTest.choose(2);
      for (let i = 0; i <= 200; i++) raceTest.driveStep(i);
    });
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(__dirname, "sanqin-countryside.png"),
    });
    assert.deepEqual(errors, []);
    const report = {
      errors,
      trackLength: initial.length,
      trafficCount: initial.trafficCount,
      types: initial.trafficTypes,
      bothDirections: true,
      collision,
      airborneClearance: clearance,
      roll: {
        midAngle: mid.rollAngle,
        midHeight: mid.airHeight,
        completed: landed.rolls,
        landedUpright: true,
        resetUpright: true,
      },
    };
    fs.writeFileSync(
      path.join(__dirname, "sanqin-verification.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
