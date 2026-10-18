// Gameplay suites use the real skip button. Full entrance visuals, timing and
// autoplay without gestures are verified separately by intro/autoplay suites.
module.exports = async function enterMenu(page) {
  const rect = await page.locator("#introSkip").boundingBox();
  if (rect)
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.waitForFunction(() => window.raceTest, null, { timeout: 60000 });
};
