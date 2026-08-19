import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import nextConfig from "../next.config.ts";

const require = createRequire(import.meta.url);

const EXPECTED_LINUX_SHARP_TRACES = [
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
];

test("Production Server Routes include Sharp and libvips Linux binaries", () => {
  assert.deepEqual(
    nextConfig.outputFileTracingIncludes?.["/*"],
    EXPECTED_LINUX_SHARP_TRACES,
  );

  const packageLock = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
  );
  assert.equal(
    packageLock.packages["node_modules/@img/sharp-linux-x64"]?.version,
    "0.35.3",
  );
  assert.equal(
    packageLock.packages["node_modules/@img/sharp-libvips-linux-x64"]?.version,
    "1.3.2",
  );

  if (process.platform === "linux" && process.arch === "x64") {
    assert.doesNotThrow(() => require.resolve("@img/sharp-linux-x64"));
    assert.doesNotThrow(() => require.resolve("@img/sharp-libvips-linux-x64"));
  }
});
