import { spawnSync } from "node:child_process";
import path from "node:path";

const fixtureRoot = path.resolve(
  process.env.MANGAI_QUALITY_BENCHMARK_ROOT ?? "tests/fixtures/manga-quality/v2.1",
);
const checker = path.resolve("tests/fixtures/manga-quality/tools/bench_leak_check_v2_1.py");
const result = spawnSync(
  process.platform === "win32" ? "python" : "python3",
  [checker, path.join(fixtureRoot, "dev"), "--holdout-root", path.join(fixtureRoot, "holdout-private")],
  { stdio: "inherit" },
);

if (result.error) {
  process.stderr.write(`benchmark leak checker failed to start: ${result.error.message}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
