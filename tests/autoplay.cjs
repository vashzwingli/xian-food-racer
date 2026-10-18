const { chromium } = require("playwright");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const server = http
  .createServer((req, res) => {
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    res.end(fs.readFileSync(path.join(root, "index.offline.html")));
  })
  .listen(0, "127.0.0.1");

(async () => {
  const errors = [],
    report = { errors };
  // These official Chrome developer switches affect only isolated test browsers.
  // The shipped game never changes browser policy or fakes a user gesture.
  for (const allowed of [true, false]) {
    const options = require("./browser-options.cjs");
    const browser = await chromium.launch({
      ...options,
      channel: "chromium",
      args: [
        ...options.args,
        "--enable-automation",
        allowed
          ? "--autoplay-policy=no-user-gesture-required"
          : "--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies",
      ],
    });
    try {
      const browserCdp = await browser.newBrowserCDPSession();
      const command = await browserCdp.send("Browser.getBrowserCommandLine");
      if (allowed)
        assert(
          command.arguments.includes(
            "--autoplay-policy=no-user-gesture-required",
          ),
        );
      const page = await browser.newPage({
        viewport: { width: 1024, height: 640 },
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      // Playwright's normal evaluate/poll calls set CDP userGesture:true.
      // Observe through CDP without granting activation to the page under test.
      const cdp = await page.context().newCDPSession(page);
      const read = async (expression) => {
        const result = await cdp.send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          userGesture: false,
        });
        if (result.exceptionDetails)
          throw new Error(result.exceptionDetails.text);
        return result.result.value;
      };
      const until = async (expression) => {
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          const value = await read(expression);
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw new Error("Autoplay observation timed out: " + expression);
      };
      await page.goto("http://127.0.0.1:" + server.address().port, {
        timeout: 60000,
      });
      await until("!!window.raceTest");
      console.log("Autoplay initial state", {
        allowed,
        audio: await read("raceTest.audioStats()"),
      });
      assert.equal(await read("navigator.userActivation.hasBeenActive"), false);
      if (allowed) {
        await until("raceTest.audioStats()?.rms > 0.001");
        const track = await read("raceTest.localAudio()");
        assert.equal(track.source, "home");
        assert(!track.paused && track.currentTime > 1 && track.duration > 188);
        assert.equal((await read("raceTest.snapshot()")).musicReady, "idle");
        report.allowed = {
          beforeAnyGesture: true,
          track,
          signal: await read("raceTest.audioStats()"),
        };
        console.log("Autoplay: home song audible without user interaction");
      } else {
        const shot = await read("raceTest.entranceSnapshot()");
        assert.equal(shot.musicBlocked, true);
        assert.match(
          await page.locator("#menu [data-music]").innerText(),
          /点击开启音乐/,
        );
        await page.locator("#menu [data-music]").click();
        await page.waitForFunction(() => raceTest.audioStats()?.rms > 0.001);
        assert.equal(
          (await page.evaluate(() => raceTest.entranceSnapshot())).musicBlocked,
          false,
        );
        assert(
          !/浏览器需要/.test(
            (await page.evaluate(() => raceTest.localAudio())).message,
          ),
        );
        report.blocked = {
          honestPrompt: true,
          oneRealClick: true,
          signal: await page.evaluate(() => raceTest.audioStats()),
        };
        await page.keyboard.press("m");
        await page.waitForFunction(() => raceTest.localAudio().paused);
        await page.locator("#introReplay").click();
        await page.locator("#introSkip").click();
        await page.waitForFunction(() => !changanIntro.active);
        assert.equal(
          (await page.evaluate(() => raceTest.snapshot())).muted,
          true,
        );
        assert.equal(
          (await page.evaluate(() => raceTest.localAudio())).paused,
          true,
        );
        await page.keyboard.press("m");
        await page.waitForFunction(() => raceTest.audioStats()?.rms > 0.001);
        await page.keyboard.press("b");
        await page.waitForFunction(() => raceTest.localAudio().paused);
        await page.locator("#introReplay").click();
        await page.locator("#introSkip").click();
        await page.waitForFunction(() => !changanIntro.active);
        assert.equal(
          (await page.evaluate(() => raceTest.snapshot())).musicEnabled,
          false,
        );
        assert.equal(
          (await page.evaluate(() => raceTest.localAudio())).paused,
          true,
        );
        report.blocked.muteAndMusicOffSurviveReplay = true;
        console.log(
          "Autoplay: blocked prompt, one-click recovery and replay preferences passed",
        );
      }
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "test-results/autoplay-verification.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => server.close());
