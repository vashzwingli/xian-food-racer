const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results");
fs.mkdirSync(output, { recursive: true });
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
  const errors = [],
    layouts = [];
  const base = "http://127.0.0.1:" + server.address().port;
  const monitor = (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
  };
  try {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 640 },
    });
    monitor(page);
    // Hold the real Three.js imports: the independent loading screen must paint,
    // and skipping must never unlock an unfinished city or falsify its progress.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(
      "https://cdn.jsdelivr.net/npm/three@0.170.0/**",
      async (route) => {
        await gate;
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
    await page.goto(base + "/cdn", { waitUntil: "commit", timeout: 60000 });
    await page.locator("#introSkip").waitFor();
    await page.locator("#introSkip").click();
    const blocked = await page.evaluate(() => ({
      active: changanIntro.active,
      progress: +document
        .getElementById("introProgress")
        .getAttribute("aria-valuenow"),
      inert: document.getElementById("menu").inert,
      hasGame: !!window.raceTest,
    }));
    assert.equal(blocked.active, true);
    assert.equal(blocked.inert, true);
    assert.equal(blocked.hasGame, false);
    assert(blocked.progress < 100);
    release();
    await page.waitForFunction(() => window.raceTest, null, { timeout: 60000 });
    assert.equal(await page.locator("#loading").isVisible(), false);
    assert.equal(
      await page.evaluate(() => document.getElementById("menu").inert),
      false,
    );
    assert.equal(
      (await page.evaluate(() => raceTest.snapshot())).state,
      "menu",
    );
    console.log("Intro: dependency loading and safe skip passed");

    for (const size of [
      { width: 1024, height: 640 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 667, height: 375 },
    ]) {
      await page.setViewportSize(size);
      const before = await page.evaluate(() => {
        const s = raceTest.snapshot();
        return {
          state: s.state,
          worldMeshes: s.worldMeshes,
          rendering: s.rendering,
          assets: raceTest.resourceInventory(),
        };
      });
      await page.locator("#introReplay").click();
      await page.waitForTimeout(1700);
      const layout = await page.evaluate(() => {
        const rect = (q) => {
          const r = document.querySelector(q).getBoundingClientRect();
          return { q, x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        };
        return {
          active: changanIntro.active,
          rects: [
            ".intro-copy",
            "#introSkip",
            "#introSound",
            ".intro-foods",
            ".intro-footer",
          ].map(rect),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(
        layout.active,
        true,
        "replay must remain visible long enough to see its drawing",
      );
      assert.equal(layout.overflow, false);
      for (const r of layout.rects)
        assert(
          r.x >= 0 &&
            r.y >= 0 &&
            r.right <= size.width + 1 &&
            r.bottom <= size.height + 1,
          JSON.stringify({ size, r }),
        );
      if (size.width === 1024)
        await page.screenshot({ path: path.join(root, "intro-loading.png") });
      if (size.width === 390)
        await page.screenshot({ path: path.join(root, "intro-mobile.png") });
      // Let one normal replay open automatically; use keyboard skipping elsewhere.
      if (size.width !== 1024) await page.keyboard.press("Space");
      if (size.width === 1024) {
        await page.waitForFunction(() =>
          document.getElementById("loading").classList.contains("is-opening"),
        );
        try {
          await page.waitForFunction(
            () => {
              const element = document.getElementById("loading");
              const opacity = +getComputedStyle(element, "::before").opacity;
              (window.__fadeSamples ??= []).push({
                active: changanIntro.active,
                opacity,
                progress: changanIntro.cinematic.progress,
              });
              return changanIntro.active && opacity < 1;
            },
            null,
            { timeout: 10000 },
          );
        } catch (error) {
          console.error(
            "Fade diagnostics",
            await page.evaluate(() => {
              const element = document.getElementById("loading");
              return {
                active: changanIntro.active,
                reduced: changanIntro.reduced,
                phase: element.dataset.phase,
                classes: element.className,
                hidden: element.hidden,
                before: getComputedStyle(element, "::before").opacity,
                cinematic: changanIntro.cinematic,
                firstSamples: window.__fadeSamples?.slice(0, 12),
                lastSamples: window.__fadeSamples?.slice(-8),
                animations: element
                  .getAnimations({ subtree: true })
                  .map((a) => ({
                    name: a.animationName,
                    property: a.transitionProperty,
                    time: a.currentTime,
                    state: a.playState,
                  })),
              };
            }),
          );
          await page.screenshot({
            path: path.join(output, "fade-failure.png"),
          });
          throw error;
        }
        const opacity = await page
          .locator("#loading")
          .evaluate(
            (element) => +getComputedStyle(element, "::before").opacity,
          );
        assert(
          opacity < 1,
          "the gate must fade into the real city before it closes",
        );
        // In-flight screenshot encoding can outlast the tunnel on software GPUs.
        // Verify the actual rendered traversal below, without blocking its clock.
      }
      await page.waitForFunction(() => !changanIntro.active);
      if (size.width === 1024) {
        const shot = await page.evaluate(() => raceTest.entranceSnapshot());
        assert(shot.insideFrames > 0 && shot.crossed && shot.exited);
        assert.deepEqual(shot.camera, [28, 5.8, -47]);
        assert.deepEqual(shot.target, [0, 11.5, 0]);
        assert.equal(shot.landmark.roofTiers, 3);
        assert.deepEqual(
          await page.evaluate(() => raceTest.auditEntrancePassage()),
          [],
        );
        layout.cinematic = shot;
        layout.passageIntersections = 0;
      }
      const after = await page.evaluate(() => {
        const s = raceTest.snapshot();
        return {
          state: s.state,
          worldMeshes: s.worldMeshes,
          rendering: s.rendering,
          assets: raceTest.resourceInventory(),
        };
      });
      assert.equal(after.state, before.state);
      assert.equal(
        after.worldMeshes,
        before.worldMeshes,
        "replay must not rebuild the city",
      );
      // Renderer memory counts change when a resized view first uploads visible
      // meshes. Compare actual scene resource identities to detect rebuilding.
      assert.deepEqual(
        after.assets,
        before.assets,
        "replay must reuse every scene geometry, material and texture",
      );
      layout.resources = Object.fromEntries(
        Object.entries(after.assets).map(([key, values]) => [
          key,
          values.length,
        ]),
      );
      console.log("Intro replay resources", {
        size,
        scene: layout.resources,
        gpuBefore: before.rendering.geometries,
        gpuAfter: after.rendering.geometries,
      });
      layouts.push({ size, ...layout });
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "start",
      );
    }
    await page.locator("#start").click();
    await page.waitForFunction(() => raceTest.snapshot().state === "race");
    assert.equal(await page.locator("#loading").isVisible(), false);
    await page.close();
    console.log("Intro: four layouts, replay and countdown passed");

    const reduced = await browser.newPage({
      reducedMotion: "reduce",
      viewport: { width: 1024, height: 640 },
    });
    monitor(reduced);
    const external = [];
    reduced.on("request", (r) => {
      if (!r.url().startsWith(base)) external.push(r.url());
    });
    await reduced.goto(base, { timeout: 60000 });
    await reduced.waitForFunction(() => window.raceTest, null, {
      timeout: 60000,
    });
    await reduced.locator("#introReplay").click();
    const hasAnimations = await reduced.evaluate(() =>
      document
        .getElementById("loading")
        .getAnimations({ subtree: true })
        .some((a) => a instanceof CSSAnimation),
    );
    assert.equal(hasAnimations, false);
    await reduced.waitForFunction(() => !changanIntro.active, null, {
      timeout: 3000,
    });
    assert.deepEqual(external, []);
    await reduced.close();

    // Failure is intentionally injected in a separate page, outside clean-run errors.
    const failed = await browser.newPage();
    await failed.route("https://cdn.jsdelivr.net/**", (r) => r.abort());
    await failed.goto(base + "/cdn", { timeout: 60000 });
    await failed.locator("#introRetry").waitFor();
    assert.equal(
      await failed.evaluate(() => document.getElementById("menu").inert),
      true,
    );
    assert.equal(
      await failed.evaluate(
        () => document.getElementById("loading").dataset.phase,
      ),
      "failed",
    );
    const retried = failed.waitForEvent("request", {
      predicate: (request) => request.url() === base + "/cdn",
    });
    await failed.locator("#introRetry").focus();
    await failed.keyboard.press("Enter");
    await retried;
    await failed.locator("#introRetry").waitFor();
    await failed.close();
    assert.deepEqual(errors, []);
    const report = {
      errors,
      blockedDependency: blocked,
      layouts,
      reducedMotion: true,
      offlineExternalRequests: external,
      failureRecovery: "retry shown; unfinished city remains locked",
      replay: "no world rebuild; returns focus to start",
      raceStart: "countdown then race",
    };
    fs.writeFileSync(
      path.join(root, "intro-verification.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    fs.writeFileSync(
      path.join(output, "intro-verification.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        errors,
        layouts: layouts.length,
        reducedMotion: true,
        offlineExternalRequests: external.length,
      }),
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
