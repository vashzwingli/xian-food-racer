import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("both standalone files declare UTF-8 fully within their first 1024 bytes", () => {
  for (const name of ["index.html", "index.offline.html"]) {
    const bytes = readFileSync(new URL("../" + name, import.meta.url));
    const start = bytes.indexOf(Buffer.from('<meta charset="UTF-8"'));
    assert(start >= 0, name + " needs UTF-8 for its Chinese UI");
    const end = bytes.indexOf(Buffer.from(">"), start) + 1;
    assert(
      end > start && end <= 1024,
      name + " charset must precede bundled notices and scripts",
    );
  }
});

test("both standalone files embed the same complete live recording", () => {
  const audio = readFileSync(
    new URL("../assets/audio/xian-ren-de-ge.mp3", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(audio).digest("hex"),
    "93a0a95a56fc6ec9a4054b03d53ebcfb9c9ee0dc4a27bacf838c64c29a906990",
  );
  for (const name of ["index.html", "index.offline.html"]) {
    const html = readFileSync(new URL("../" + name, import.meta.url), "utf8");
    assert(
      html.includes(audio.toString("base64")),
      name + " must work without an external audio request",
    );
  }
});
