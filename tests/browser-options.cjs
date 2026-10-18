// Dedicated test browsers only. Explicit SwANGLE is needed on GPU-less Linux bots:
// https://chromium.googlesource.com/chromium/src/+/HEAD/docs/gpu/swiftshader.md
module.exports = {
  headless: true,
  channel:
    process.env.FOOD_RACER_BROWSER ||
    (process.platform === "win32" ? "msedge" : undefined),
  args:
    process.platform === "win32"
      ? []
      : ["--use-gl=angle", "--use-angle=swiftshader"],
};
if (process.env.CI) {
  setTimeout(() => {
    console.error("Browser verification exceeded its 3 minute limit");
    process.exit(1);
  }, 180000).unref();
}
