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
  .listen(8760, "127.0.0.1");
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
    await page.goto("http://127.0.0.1:8760");
    await page.waitForFunction(() => window.raceTest, null, { timeout: 60000 });
    if (process.env.FOOD_RACER_SMOOTH) await page.keyboard.press("q");
    await page.locator("#menu [data-radio]").click();
    await page.locator("#radioPreview").click();
    await page.locator("#radioClose").click();
    await page.waitForFunction(
      () => raceTest.snapshot().musicReady === "ready",
      null,
      { timeout: 60000 },
    );
    await page.waitForTimeout(700);
    const audio = await page.evaluate(() => raceTest.audioStats());
    assert(audio.context === "running");
    assert(audio.rms > 0.001, JSON.stringify(audio));
    assert(audio.peak <= 0.8);
    await page.screenshot({ path: path.join(__dirname, "menu.png") });
    await page.keyboard.press("b");
    await page.waitForTimeout(500);
    assert((await page.evaluate(() => raceTest.snapshot())).musicGain < 0.01);
    await page.keyboard.press("b");
    await page.keyboard.press("m");
    await page.waitForTimeout(350);
    assert((await page.evaluate(() => raceTest.snapshot())).masterGain < 0.01);
    await page.keyboard.press("m");
    const routes = [];
    for (let d = 0; d < (process.env.FOOD_RACER_VISUAL_ONLY ? 0 : 3); d++) {
      await page.evaluate((d) => raceTest.choose(d), d);
      const result = await page.evaluate(() => raceTest.autoDrive(14000));
      console.log("Physics route", d, result);
      routes.push({ difficulty: d, ...result });
      assert.equal(result.state, "result", "autodrive failed " + d);
      assert.equal(result.laps.length, 3);
      assert.equal(result.resets, 0);
      assert.equal((await page.evaluate(() => raceTest.snapshot())).jumps, 0);
    }
    await page.evaluate(() => {
      raceTest.choose(2);
      for (let i = 0; i <= 90; i++) raceTest.driveStep(i);
    });
    await page.waitForTimeout(500);
    await page.keyboard.down("f");
    // Smooth quality emits fewer particles per simulation second. Wait for the
    // complete effect, rather than sampling the first frame above two metres.
    await page.waitForFunction(
      () => {
        const flight = raceTest.snapshot();
        return (
          flight.jetVisible && flight.airHeight > 2 && flight.jetParticles > 20
        );
      },
      null,
      { timeout: 20000 },
    );
    const flying = await page.evaluate(() => raceTest.snapshot());
    console.log("Flight effect", {
      height: flying.airHeight,
      particles: flying.jetParticles,
      qualityLevel: flying.rendering.level,
    });
    assert(flying.jetVisible);
    assert(flying.airHeight > 2);
    assert(flying.jetParticles > 20);
    assert(flying.fuel < 100);
    await page.screenshot({ path: path.join(__dirname, "flight.png") });
    await page.keyboard.up("f");
    await page.keyboard.press("f");
    await page.waitForTimeout(300);
    assert.equal((await page.evaluate(() => raceTest.snapshot())).jumps, 2);
    // Verify bounded landing time using the same fixed-step physics. Software
    // rendering can spend many wall-clock seconds drawing one simulated second.
    const landing = await page.evaluate(() => {
      let frames = 0;
      while (raceTest.snapshot().jumps > 0 && frames < 360) {
        raceTest.step(1 / 60);
        frames++;
      }
      const landed = raceTest.snapshot();
      return {
        frames,
        seconds: frames / 60,
        jumps: landed.jumps,
        jetVisible: landed.jetVisible,
      };
    });
    assert.equal(landing.jumps, 0, JSON.stringify(landing));
    console.log("Landing", landing);
    assert.equal(
      (await page.evaluate(() => raceTest.snapshot())).jetVisible,
      false,
    );
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(__dirname, "expanded-city.png") });
    assert.deepEqual(errors, []);
    const report = {
      errors,
      audio,
      musicControls: "B and M passed",
      flight: flying,
      landing,
      routes,
    };
    if (!process.env.FOOD_RACER_VISUAL_ONLY)
      fs.writeFileSync(
        path.join(__dirname, "expansion-verification.json"),
        JSON.stringify(report, null, 2),
      );
    console.log(
      process.env.FOOD_RACER_VISUAL_ONLY
        ? "Music, four jets, landing and visual checks passed"
        : "Music, four jets, landing and all routes passed",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.close();
});
