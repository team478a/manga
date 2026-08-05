import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Worker route resolves providers through the Cloud AI registry", () => {
  const route = read("src/app/api/internal/cloud-ai/worker/route.ts");

  assert.match(
    route,
    /@\/modules\/cloud-ai\/infrastructure\/provider-registry/,
  );
  assert.match(route, /createConfiguredCloudProviders/);
  assert.doesNotMatch(route, /cloud-ai-gateway-provider/);
  assert.doesNotMatch(route, /cloud-flux-image-provider/);
  assert.doesNotMatch(route, /cloud-ai-mock-provider/);
  assert.doesNotMatch(route, /new (?:BlackForestLabs|MangaiCloud|MockCloud)/);
});
