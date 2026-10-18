const enterMenu = require("./enter-menu.cjs");
const { chromium } = require("playwright");
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const server = http
  .createServer((req, res) => {
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    res.end(fs.readFileSync(path.join(root, "index.offline.html")));
  })
  .listen(0, "127.0.0.1");
(async () => {
  const browser = await chromium.launch(require("./browser-options.cjs"));
  try {
    const page = await browser.newPage({
        viewport: { width: 1024, height: 640 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("http://127.0.0.1:" + server.address().port, {
      timeout: 60000,
    });
    await enterMenu(page);
    await page.locator("#start").click();
    await page.waitForFunction(() => raceTest.snapshot().state === "race");
    await page.keyboard.press("q");
    await page.keyboard.press("q");
    await page.keyboard.press("c");
    await page.keyboard.press("c");
    await page.waitForFunction(() => raceTest.snapshot().cockpitVisible);
    const cockpit = await page.evaluate(() => raceTest.snapshot());
    assert.equal(cockpit.view, 2);
    assert.equal(cockpit.exteriorVisible, false);
    assert(
      Math.hypot(
        cockpit.camera[0] - cockpit.position[0],
        cockpit.camera[2] - cockpit.position[2],
      ) < 0.6,
    );
    await page.waitForFunction(() => raceTest.snapshot().elapsed > 3.1, null, {
      timeout: 60000,
    });
    await page.keyboard.down("w");
    await page.keyboard.down("Shift");
    await page.waitForFunction(
      () =>
        raceTest.snapshot().speed > 30 && raceTest.snapshot().motionBlur.active,
      { timeout: 60000 },
    );
    await page.screenshot({ path: path.join(root, "cockpit-driving.png") });
    const comparison = await page.evaluate(() => raceTest.motionComparison());
    for (const [name, data] of Object.entries(comparison))
      fs.writeFileSync(
        path.join(root, "motion-blur-" + name + ".png"),
        Buffer.from(data.split(",")[1], "base64"),
      );
    const pixels = await page.evaluate(async ({ on, off }) => {
      const images = await Promise.all(
        [on, off].map(async (src) => {
          const i = new Image();
          i.src = src;
          await i.decode();
          const c = document.createElement("canvas");
          c.width = i.width;
          c.height = i.height;
          const x = c.getContext("2d");
          x.drawImage(i, 0, 0);
          return {
            data: x.getImageData(0, 0, c.width, c.height).data,
            w: c.width,
            h: c.height,
          };
        }),
      );
      let edge = 0,
        center = 0,
        dash = 0,
        ne = 0,
        nc = 0,
        nd = 0;
      const [a, b] = images;
      for (let y = 0; y < a.h; y += 2)
        for (let x = 0; x < a.w; x += 2) {
          const k = (y * a.w + x) * 4,
            d =
              (Math.abs(a.data[k] - b.data[k]) +
                Math.abs(a.data[k + 1] - b.data[k + 1]) +
                Math.abs(a.data[k + 2] - b.data[k + 2])) /
              3;
          const u = x / a.w,
            v = 1 - y / a.h,
            r = Math.hypot(((u - 0.5) * a.w) / a.h, v - 0.54);
          if (r > 0.55 && v > 0.45) {
            edge += d;
            ne++;
          }
          if (r < 0.075) {
            center += d;
            nc++;
          }
          if (v < 0.22) {
            dash += d;
            nd++;
          }
        }
      return { edge: edge / ne, center: center / nc, dashboard: dash / nd };
    }, comparison);
    assert(pixels.edge > 0.1, JSON.stringify(pixels));
    assert(pixels.center < 0.05, JSON.stringify(pixels));
    assert(pixels.dashboard < 0.05, JSON.stringify(pixels));
    await page.keyboard.press("v");
    await page.waitForFunction(() => !raceTest.snapshot().motionBlur.active);
    assert.equal(
      (await page.evaluate(() => raceTest.snapshot())).motionBlur.selected,
      false,
    );
    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
    await page.keyboard.press("v");
    await page.keyboard.press("r");
    await page.waitForFunction(() => !raceTest.snapshot().motionBlur.active);
    await page.keyboard.press("c");
    assert.equal((await page.evaluate(() => raceTest.snapshot())).view, 0);
    const audit = await page.evaluate(() => raceTest.auditWorld());
    assert.equal(audit.visualOverlaps, 0);
    assert.equal(audit.visualEscapes, 0);
    assert(audit.eaveColliders > 200);
    assert(audit.awningColliders > 50);
    const layouts = [];
    for (const size of [
      { width: 1024, height: 640 },
      { width: 390, height: 844 },
      { width: 667, height: 375 },
    ]) {
      await page.setViewportSize(size);
      const boxes = await page
        .locator(".drive-options button")
        .evaluateAll((es) =>
          es.map((e) => {
            const r = e.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          }),
        );
      for (const r of boxes)
        assert(
          r.left >= 0 &&
            r.top >= 0 &&
            r.right <= size.width &&
            r.bottom <= size.height,
          JSON.stringify({ size, r }),
        );
      const overlaps = await page.evaluate(() => {
        const a = document
          .querySelector(".drive-options")
          .getBoundingClientRect();
        return [".map-frame", "#hud .radio-open"].filter((q) => {
          const b = document.querySelector(q).getBoundingClientRect();
          return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
          );
        });
      });
      assert.deepEqual(overlaps, [], JSON.stringify(size));
      await page.locator("[data-view]").click();
      assert.equal((await page.evaluate(() => raceTest.snapshot())).view, 1);
      await page.locator("[data-view]").click();
      assert.equal((await page.evaluate(() => raceTest.snapshot())).view, 2);
      await page.locator("[data-view]").click();
      layouts.push(size);
    }
    await page.close();
    const reduced = await browser.newPage({
      viewport: { width: 800, height: 600 },
      reducedMotion: "reduce",
    });
    await reduced.goto("http://127.0.0.1:" + server.address().port, {
      timeout: 60000,
    });
    await enterMenu(reduced);
    assert.equal(
      (await reduced.evaluate(() => raceTest.snapshot())).motionBlur.selected,
      false,
    );
    await reduced.close();
    assert.deepEqual(errors, []);
    const report = {
      errors,
      cockpit: {
        view: cockpit.view,
        name: cockpit.viewName,
        exteriorVisible: cockpit.exteriorVisible,
      },
      pixels,
      audit,
      layouts,
      reducedMotion: "default off",
      controls:
        "C cycles all three views; V and reset disable blur; touch buttons work",
    };
    fs.writeFileSync(
      path.join(root, "driving-verification.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
