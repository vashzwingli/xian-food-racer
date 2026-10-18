import { build, transform } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const offline = process.argv.includes("--offline");
const result = await build({
  entryPoints: [path.join(root, "src/main.js")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  charset: "utf8",
  legalComments: "inline",
  external: offline ? [] : ["three", "three/*"],
});
const css = await transform(
  await readFile(path.join(root, "src/styles.css"), "utf8"),
  { loader: "css", minify: true },
);
let html = await readFile(path.join(root, "src/template.html"), "utf8");
html = html
  .replace("/* INLINE_STYLES */", () => css.code)
  .replace("/* INLINE_GAME */", () =>
    result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
  );
if (offline)
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, "");
const name = offline ? "index.offline.html" : "index.html";
await writeFile(path.join(root, name), html);
await mkdir(path.join(root, "dist"), { recursive: true });
await writeFile(path.join(root, "dist", name), html);
console.log(`${name}: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB`);
