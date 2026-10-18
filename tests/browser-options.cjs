// Dedicated test browsers only. Explicit SwANGLE is needed on GPU-less Linux bots:
// https://chromium.googlesource.com/chromium/src/+/HEAD/docs/gpu/swiftshader.md
module.exports = {
  headless: true,
  channel:
    process.env.FOOD_RACER_BROWSER ||
    (process.platform === "win32" ? "msedge" : "chromium"),
  args:
    process.platform === "win32"
      ? []
      : ["--use-gl=angle", "--use-angle=swiftshader"],
};
if (process.env.CI) {
  setTimeout(() => {
    console.error("Browser verification exceeded its 5 minute limit");
    process.exit(1);
  }, 300000).unref();
}
