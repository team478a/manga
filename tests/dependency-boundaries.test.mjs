import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeDependencyBoundaries,
  extractModuleSpecifiers,
} from "../scripts/check-dependency-boundaries.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

async function createFixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mangai-deps-"));
  await Promise.all(
    Object.entries(files).map(async ([relative, contents]) => {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents);
    }),
  );
  return root;
}

const manifest = (name, dependencies = {}) =>
  JSON.stringify({
    name,
    type: "module",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    },
    dependencies,
  });

test("import、export、dynamic importから依存先を抽出する", () => {
  assert.deepEqual(
    extractModuleSpecifiers(`
      import type { A } from "./a.js";
      export { B } from "@mangai/shared";
      import "node:fs";
      const lazy = import("./lazy.js");
    `),
    ["./a.js", "@mangai/shared", "node:fs", "./lazy.js"],
  );
});

test("現在のMANGAI package境界に違反がない", async () => {
  const result = await analyzeDependencyBoundaries(repositoryRoot);
  assert.equal(
    result.violations.length,
    0,
    result.violations.map((item) => `${item.code}: ${item.message}`).join("\n"),
  );
  assert.equal(result.packageCount, 5);
});

test("framework依存、未宣言依存、deep importを検出する", async () => {
  const root = await createFixture({
    "packages/domain/package.json": manifest("@mangai/domain"),
    "packages/domain/src/index.ts":
      'import fs from "node:fs"; export { value } from "@mangai/shared";',
    "packages/shared/package.json": manifest("@mangai/shared"),
    "packages/shared/src/index.ts": "export const value = 1;",
    "src/consumer.ts":
      'import { value } from "@mangai/shared/src/internal.js";',
  });
  try {
    const result = await analyzeDependencyBoundaries(root);
    assert.deepEqual(
      new Set(result.violations.map((item) => item.code)),
      new Set([
        "FRAMEWORK_DEPENDENCY",
        "UNDECLARED_PACKAGE_DEPENDENCY",
        "PACKAGE_DEEP_IMPORT",
      ]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package間とpackage内部の循環依存を検出する", async () => {
  const root = await createFixture({
    "packages/a/package.json": manifest("@mangai/a", {
      "@mangai/b": "file:../b",
    }),
    "packages/a/src/index.ts":
      'export { b } from "@mangai/b"; export { localA } from "./local-a.js";',
    "packages/a/src/local-a.ts":
      'import { localB } from "./local-b.js"; export const localA = localB;',
    "packages/a/src/local-b.ts":
      'import { localA } from "./local-a.js"; export const localB = localA;',
    "packages/b/package.json": manifest("@mangai/b", {
      "@mangai/a": "file:../a",
    }),
    "packages/b/src/index.ts":
      'export const b = 1; export { localA } from "@mangai/a";',
  });
  try {
    const result = await analyzeDependencyBoundaries(root);
    const codes = result.violations.map((item) => item.code);
    assert.ok(codes.includes("PACKAGE_CYCLE"));
    assert.ok(codes.includes("SOURCE_CYCLE"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
