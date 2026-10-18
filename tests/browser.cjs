const { chromium } = require("playwright");
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results");
fs.mkdirSync(output, { recursive: true });
function waveFixture() {
  const rate = 22050,
    count = rate * 2,
    buf = Buffer.alloc(44 + count * 2);
  buf.write("RIFF");
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    buf.writeInt16LE(
      Math.round(Math.sin((i / rate) * 440 * Math.PI * 2) * 2000),
      44 + i * 2,
    );
  return buf;
}
const server = http
  .createServer((req, res) => {
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    res.end(
      fs.readFileSync(
        path.join(
          root,
          req.url.startsWith("/cdn") ? "index.html" : "index.offline.html",
        ),
      ),
    );
  })
  .listen(0, "127.0.0.1");
(async () => {
  const browser = await chromium.launch(require("./browser-options.cjs"));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const page = await browser.newPage({
        viewport: { width: 1024, height: 640 },
      }),
      errors = [],
      external = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(base))
        external.push(r.url());
    });
    await page.goto(base);
    await page.waitForFunction(() => window.raceTest);
    console.log(
      "Browser suite: loaded offline build",
      await page.evaluate(() => raceTest.performanceProfile()),
    );
    assert.deepEqual(external, [], "offline build must not request a CDN");
    const layouts = [];
    for (const size of [
      { width: 1024, height: 640 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 667, height: 375 },
    ]) {
      await page.setViewportSize(size);
      const overflow = await page.evaluate(() =>
        ["#menu .panel", "#start", '[data-d="0"]', '[data-d="2"]']
          .map((q) => {
            const r = document.querySelector(q).getBoundingClientRect();
            return {
              q,
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
            };
          })
          .filter(
            (r) =>
              r.left < 0 ||
              r.top < 0 ||
              r.right > innerWidth ||
              r.bottom > innerHeight,
          ),
      );
      assert.equal(overflow.length, 0, JSON.stringify({ size, overflow }));
      layouts.push(size);
    }
    await page.setViewportSize({ width: 1024, height: 640 });
    console.log("Browser suite: four layouts passed");
    await page.screenshot({ path: path.join(root, "menu.png") });
    await page.locator("#menu [data-radio]").click();
    assert(await page.locator("#radioDialog").isVisible());
    await page.locator("#trackImport").setInputFiles({
      name: "西安人的歌-测试音频.wav",
      mimeType: "audio/wav",
      buffer: waveFixture(),
    });
    await page.waitForFunction(
      () => raceTest.localAudio().hasFile && !raceTest.localAudio().paused,
    );
    const imported = await page.evaluate(() => raceTest.localAudio());
    assert(imported.selected);
    assert(imported.loop);
    await page.locator("#radioVolume").fill("37");
    await page.locator("#radioVolume").dispatchEvent("input");
    assert.equal(
      (await page.evaluate(() => raceTest.localAudio())).volume,
      0.37,
    );
    await page.locator("#radioOriginal").click();
    assert.equal(
      (await page.evaluate(() => raceTest.localAudio())).selected,
      false,
    );
    await page.locator("#radioLocal").click();
    await page.waitForFunction(() => !raceTest.localAudio().paused);
    await page.locator("#radioClose").click();
    await page.keyboard.press("b");
    await page.waitForFunction(() => raceTest.localAudio().paused);
    await page.keyboard.press("b");
    await page.waitForFunction(() => !raceTest.localAudio().paused);
    await page.keyboard.press("m");
    await page.waitForFunction(() => raceTest.localAudio().paused);
    await page.keyboard.press("m");
    await page.reload();
    await page.waitForFunction(
      () => window.raceTest && raceTest.localAudio().hasFile,
    );
    console.log("Browser suite: radio import and persistence passed");
    assert.equal(
      (await page.evaluate(() => raceTest.localAudio())).name,
      "西安人的歌-测试音频",
    );
    await page.locator("#menu [data-radio]").click();
    await page.locator("#radioRemove").click();
    await page.waitForFunction(() => !raceTest.localAudio().hasFile);
    await page.locator("#radioClose").click();
    await page.locator("#start").click();
    await page.waitForFunction(() => raceTest.snapshot().state === "race");
    await page.keyboard.press("u");
    assert.equal(
      (await page.evaluate(() => raceTest.snapshot())).state,
      "paused",
    );
    await page.locator("#radioClose").click();
    assert.equal(
      (await page.evaluate(() => raceTest.snapshot())).state,
      "race",
    );
    await page.keyboard.press("q");
    assert.equal(
      (await page.evaluate(() => raceTest.performanceProfile())).mode,
      "smooth",
    );
    await page.keyboard.press("q");
    assert.equal(
      (await page.evaluate(() => raceTest.performanceProfile())).mode,
      "cinema",
    );
    await page.keyboard.press("q");
    assert.equal(
      (await page.evaluate(() => raceTest.performanceProfile())).mode,
      "auto",
    );
    const memory = await page.evaluate(() => {
      raceTest.sceneAt(90);
      raceTest.step(1 / 60);
      return document.getElementById("memoryTitle").textContent;
    });
    assert.equal(memory, "小寨的晚班车");
    await page.evaluate(() => {
      raceTest.choose(0);
      raceTest.sceneAt(14);
    });
    await page.waitForTimeout(1000);
    const performanceAfter = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 180; i++) {
        const t = performance.now();
        raceTest.step(1 / 60);
        samples.push(performance.now() - t);
      }
      samples.sort((a, b) => a - b);
      return {
        snapshot: raceTest.snapshot(),
        updateMsMedian: samples[90],
        updateMsP95: samples[171],
      };
    });
    fs.writeFileSync(
      path.join(output, "performance-after.json"),
      JSON.stringify(performanceAfter, null, 2),
    );
    const memoryCounts = [];
    console.log("Browser suite: controls and memories passed");
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        raceTest.choose(0);
        raceTest.sceneAt(14);
      });
      await page.waitForTimeout(500);
      memoryCounts.push(
        (await page.evaluate(() => raceTest.snapshot())).rendering,
      );
    }
    assert(
      memoryCounts[3].textures <= memoryCounts[1].textures + 2,
      JSON.stringify(memoryCounts),
    );
    assert(
      memoryCounts[3].geometries <= memoryCounts[1].geometries + 3,
      JSON.stringify(memoryCounts),
    );
    const touch = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    });
    console.log("Browser suite: resource recycling passed");
    const mobile = await touch.newPage();
    await mobile.goto(base);
    await mobile.waitForFunction(() => window.raceTest);
    await mobile.locator("#start").click();
    await mobile.waitForFunction(() => raceTest.snapshot().state === "race");
    assert(await mobile.locator("#touchControls").isVisible());
    const hudOverlap = await mobile.evaluate(() => {
      const hit = (a, b) => {
        const x = document.querySelector(a).getBoundingClientRect(),
          y = document.querySelector(b).getBoundingClientRect();
        return (
          x.left < y.right &&
          x.right > y.left &&
          x.top < y.bottom &&
          x.bottom > y.top
        );
      };
      return {
        navSpeed: hit("#nav", ".speed"),
        radioMap: hit("#hud .radio-open", ".map-frame"),
      };
    });
    assert.equal(hudOverlap.navSpeed, false);
    assert.equal(hudOverlap.radioMap, false);
    // Browser touch events use the real pointer-capture path through the touchscreen.
    const throttle = await mobile.locator('[data-hold="KeyW"]').boundingBox();
    await mobile.mouse.move(
      throttle.x + throttle.width / 2,
      throttle.y + throttle.height / 2,
    );
    await mobile.mouse.down();
    await mobile.waitForTimeout(550);
    const touchSpeed = (await mobile.evaluate(() => raceTest.snapshot())).speed;
    await mobile.mouse.up();
    assert(touchSpeed > 3);
    await mobile.screenshot({ path: path.join(root, "touch-driving.png") });
    await touch.close();
    console.log("Browser suite: touch driving passed");
    // CDN output also loads with the exact same pinned Three.js sources, without relying on public network during CI.
    const cdn = await browser.newPage();
    await cdn.route(
      "https://cdn.jsdelivr.net/npm/three@0.170.0/**",
      async (route) => {
        const suffix = new URL(route.request().url()).pathname.split(
          "/three@0.170.0/",
        )[1];
        await route.fulfill({
          path: path.join(root, "node_modules/three", suffix),
          contentType: "text/javascript",
          headers: { "access-control-allow-origin": "*" },
        });
      },
    );
    await cdn.goto(base + "/cdn");
    await cdn.waitForFunction(() => window.raceTest);
    assert.equal(
      (await cdn.evaluate(() => raceTest.snapshot())).trafficCount,
      24,
    );
    await cdn.close();
    assert.deepEqual(errors, []);
    const report = {
      errors,
      layouts,
      offlineNetworkRequests: external,
      radio:
        "import / loop / volume / B / M / original / persistence / delete / pause passed (synthetic test audio only)",
      touchSpeed,
      memoryCounts,
      performanceAfter,
    };
    fs.writeFileSync(
      path.join(output, "browser-verification.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        errors,
        layouts,
        drawCalls: performanceAfter.snapshot.drawCalls,
        updateMsMedian: performanceAfter.updateMsMedian,
        touchSpeed,
        radio: "passed",
      }),
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
