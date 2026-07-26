import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeCloudCanvas } from "../src/modules/cloud-creator/canvas/canvas-normalizer.ts";

const root = fileURLToPath(
  new URL("../src/modules/cloud-creator/", import.meta.url),
);

async function listTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? listTypeScriptFiles(target)
        : entry.name.endsWith(".ts")
          ? [target]
          : [];
    }),
  );
  return nested.flat();
}

test("Cloud Canvas正規化はPage寸法を固定し不正データを拒否する", () => {
  const page = {
    id: "10000000-0000-4000-8000-000000000001",
    width: 1600,
    height: 2400,
    background_color: "#ffffff",
  };
  const normalized = normalizeCloudCanvas(page, {
    width: 1,
    height: 1,
    backgroundColor: "#f5f5f5",
    panels: [],
  });
  assert.equal(normalized.pageId, page.id);
  assert.equal(normalized.width, page.width);
  assert.equal(normalized.height, page.height);
  assert.equal(normalized.backgroundColor, "#f5f5f5");
  assert.throws(
    () =>
      normalizeCloudCanvas(page, {
        panels: [
          {
            id: "10000000-0000-4000-8000-000000000002",
            pageId: "10000000-0000-4000-8000-000000000003",
          },
        ],
      }),
    /Canvasデータが不正/,
  );
});

test("互換entrypointは公開APIだけを再exportする", async () => {
  const source = await readFile(
    new URL("../src/lib/cloud-creator-server.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /createClient|\.from\(|\.rpc\(/);
  for (const name of [
    "createCloudProject",
    "getCloudProjectWorkspace",
    "saveCloudPageSnapshot",
    "uploadCloudAsset",
    "enqueueCloudGenerationJob",
    "stageCloudProjectExportBundle",
  ]) {
    assert.match(source, new RegExp(`\\b${name}\\b`));
  }
  assert.ok(source.split(/\r?\n/).length < 100);
});

test("Supabase client生成を認証contextだけに限定し循環依存を持たない", async () => {
  const files = await listTypeScriptFiles(root);
  const graph = new Map();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (source.includes("@/lib/supabase/server")) {
      assert.equal(path.relative(root, file), "auth-context.ts");
    }
    const dependencies = [
      ...source.matchAll(/from\s+["'](\.[^"']+)["']/g),
    ].flatMap((match) => {
      const candidate = path.resolve(path.dirname(file), `${match[1]}.ts`);
      return files.includes(candidate) ? [candidate] : [];
    });
    graph.set(file, dependencies);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(file) {
    if (visiting.has(file))
      assert.fail(`循環依存: ${pathToFileURL(file).href}`);
    if (visited.has(file)) return;
    visiting.add(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    visiting.delete(file);
    visited.add(file);
  }
  for (const file of files) visit(file);
});

test("RepositoryはServiceへ逆依存しない", async () => {
  const files = await listTypeScriptFiles(root);
  for (const file of files.filter((entry) => entry.endsWith("-repository.ts"))) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /-service["']/);
  }
});
