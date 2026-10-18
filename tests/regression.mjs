import { spawnSync } from "node:child_process";
for (const script of [
  "rainstreet-qa.cjs",
  "expansion-qa.cjs",
  "sanqin-qa.cjs",
  "visual-qa.cjs",
  "tests/driving.cjs",
]) {
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
