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
  .listen(8763, "127.0.0.1");
(async () => {
  const browser = await chromium.launch(require("./tests/browser-options.cjs"));
  try {
    const page = await browser.newPage({
        viewport: { width: 1024, height: 640 },
      }),
      errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message || String(e));
      console.log("page", e.message);
    });
    page.on("console", (m) => {
      if (m.type() === "error") {
        errors.push(m.text());
        console.log("console", m.text());
      }
    });
    await page.goto("http://127.0.0.1:8763");
    await page.waitForFunction(() => window.raceTest, { timeout: 60000 });
    await page.screenshot({ path: path.join(__dirname, "menu.png") });
    await page.locator("#start").click();
    await page.waitForFunction(() => raceTest.snapshot().state === "race", {
      timeout: 30000,
    });
    const initial = await page.evaluate(() => raceTest.snapshot());
    console.log("initial", initial);
    const audit = await page.evaluate(() => raceTest.auditWorld());
    const roadMesh = await page.evaluate(() => raceTest.auditRoadMesh());
    console.log("road mesh", roadMesh);
    assert.equal(roadMesh.misses, 0);
    assert(roadMesh.maxError < 0.12);
    console.log("audit", audit);
    assert.equal(audit.roadWidth, 26);
    assert(audit.siteCount > 120);
    assert.equal(audit.siteOverlaps, 0);
    assert.equal(audit.visualOverlaps, 0);
    assert.equal(audit.visualEscapes, 0);
    assert.equal(audit.roadIntrusions, 0);
    assert(audit.maxGroundGap < 0.08);
    assert.deepEqual(audit.busRoutes.sort(), ["215", "616"]);
    assert(audit.pickups > 25);
    assert(audit.wall.height > 11);
    const pickups = [];
    for (let type = 0; type < 3; type++) {
      const result = await page.evaluate((type) => {
        raceTest.choose(0);
        return raceTest.pickupFixture(type);
      }, type);
      pickups.push(result);
      assert(result.after.picked > result.before.picked);
      if (type === 0)
        assert(result.after.nightScore >= result.before.nightScore + 100);
      if (type === 1) assert(result.after.fuel >= result.before.fuel + 22);
      if (type === 2) assert(result.after.chiliTime > 7);
    }
    const solid = await page.evaluate(() => {
      raceTest.choose(0);
      return raceTest.solidFixture();
    });
    assert(solid.before);
    assert(!solid.after);
    assert(solid.contacts > 0);
    const camera = await page.evaluate(() => raceTest.cameraFixture());
    assert(camera.originalHit !== null);
    assert(camera.safeHit === null);
    await page.evaluate(() => {
      raceTest.choose(0);
      raceTest.sceneAt(14);
    });
    await page.waitForTimeout(1300);
    await page.screenshot({
      path: path.join(__dirname, "rainstreet-market.png"),
    });
    await page.evaluate(() => {
      raceTest.choose(1);
      raceTest.sceneAt(150);
    });
    await page.waitForTimeout(1000);
    const wall = await page.evaluate(() => raceTest.snapshot());
    assert(wall.wallOn);
    assert(wall.roadGround > 11);
    assert(Math.abs(wall.position[1] - wall.roadGround - 0.08) < 0.1);
    await page.screenshot({ path: path.join(__dirname, "driveable-wall.png") });
    await page.evaluate(() => {
      raceTest.choose(0);
      raceTest.sceneAt(8);
    });
    await page.keyboard.down("w");
    await page.waitForTimeout(650);
    await page.keyboard.up("w");
    await page.screenshot({ path: path.join(__dirname, "pickup-effect.png") });
    assert.deepEqual(errors, []);
    const report = {
      errors,
      initial,
      audit,
      roadMesh,
      pickups,
      solid,
      camera,
      wall,
    };
    fs.writeFileSync(
      path.join(__dirname, "rainstreet-verification.json"),
      JSON.stringify(report, null, 2),
    );
    console.log("Street audit, collision, camera, pickups and wall passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
