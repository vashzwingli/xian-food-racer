import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, ".pages");
await mkdir(destination, { recursive: true });
// Pages serves the complete, self-contained build; playing needs no CDN request.
await copyFile(
  path.join(root, "index.offline.html"),
  path.join(destination, "index.html"),
);
await writeFile(path.join(destination, ".nojekyll"), "");
console.log("GitHub Pages ready: .pages/index.html");
