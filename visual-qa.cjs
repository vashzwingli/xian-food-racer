const { chromium } = require("playwright");
const http = require("http"),
  fs = require("fs"),
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
  .listen(8757, "127.0.0.1");
(async () => {
  const browser = await chromium.launch({
    channel:
      process.env.FOOD_RACER_BROWSER ||
      (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
  });
  const page = await browser.newPage({
      viewport: { width: 1024, height: 640 },
    }),
    errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("Page error:", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(m.text());
      console.log("Console error:", m.text());
    }
  });
  await page.goto("http://127.0.0.1:8757");
  await page.waitForFunction(() => window.raceTest, { timeout: 60000 });
  const layouts = [];
  for (const size of [
    { width: 1024, height: 640 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const overflow = await page.evaluate(() =>
      [
        "#menu .panel",
        "#start",
        ...["0", "1", "2"].map((d) => '[data-d="' + d + '"]'),
      ]
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
    assert.equal(overflow.length, 0, JSON.stringify(overflow));
    layouts.push({ ...size, overflow });
    if (size.width === 390)
      await page.screenshot({ path: path.join(__dirname, "mobile-menu.png") });
  }
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.locator('[data-d="1"]').click();
  assert.equal(
    await page.locator('[data-d="1"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#start").click();
  await page.waitForFunction(() => raceTest.snapshot().state === "race");
  await page.keyboard.down("w");
  await page.keyboard.down("Shift");
  await page.waitForTimeout(750);
  let boosted = await page.evaluate(() => raceTest.snapshot());
  assert(boosted.speed > 5);
  assert(boosted.fuel < 100);
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  await page.keyboard.press("f");
  await page.keyboard.press("f");
  assert.equal((await page.evaluate(() => raceTest.snapshot())).jumps, 2);
  await page.keyboard.press("c");
  assert.equal((await page.evaluate(() => raceTest.snapshot())).view, 1);
  await page.keyboard.press("m");
  assert.equal((await page.evaluate(() => raceTest.snapshot())).muted, true);
  await page.keyboard.press("q");
  assert.equal((await page.evaluate(() => raceTest.snapshot())).quality, false);
  await page.keyboard.press("r");
  assert.equal((await page.evaluate(() => raceTest.snapshot())).jumps, 0);
  await page.keyboard.press("Escape");
  assert.equal(
    (await page.evaluate(() => raceTest.snapshot())).state,
    "paused",
  );
  await page.keyboard.press("Escape");
  assert.equal((await page.evaluate(() => raceTest.snapshot())).state, "race");
  await page.evaluate(() => {
    raceTest.choose(0);
    for (let l = 0; l < 3; l++)
      for (let i = 0; i < 320; i++) raceTest.driveStep(i);
    raceTest.driveStep(0);
  });
  await page.screenshot({ path: path.join(__dirname, "result.png") });
  await page.locator("#again").click();
  assert.equal(
    (await page.evaluate(() => raceTest.snapshot())).state,
    "countdown",
  );
  await page.evaluate(() => {
    raceTest.choose(0);
    for (let l = 0; l < 3; l++)
      for (let i = 0; i < 320; i++) raceTest.driveStep(i);
    raceTest.driveStep(0);
  });
  await page.locator("#back").click();
  assert.equal(await page.locator("#menu").isVisible(), true);
  assert.deepEqual(errors, []);
  const report = {
    errors,
    layouts,
    controls:
      "boost / double jump / camera / mute / quality / reset / pause / resume / restart / back passed",
    drawCalls: boosted.drawCalls,
  };
  fs.writeFileSync(
    path.join(__dirname, "verification.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(report);
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
