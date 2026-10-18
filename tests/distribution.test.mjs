import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
