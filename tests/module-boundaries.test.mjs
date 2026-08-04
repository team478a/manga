import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeModuleBoundaries, inspectSource } from "../scripts/check-module-boundaries.mjs";
import { inspectNewSource } from "../scripts/check-codebase-size-regressions.mjs";

test("domain層のframework・DB依存を拒否する", () => {
  const file = path.join("repo", "src", "modules", "research", "domain", "report.ts");
  const source = 'import { createClient } from "@supabase/supabase-js";';
  const findings = inspectSource({ root: "repo", file, source, imports: ["@supabase/supabase-js"] });
  assert.equal(findings.some((finding) => finding.code === "DOMAIN_EXTERNAL_DEPENDENCY" && finding.severity === "error"), true);
});

test("application層のReact依存を拒否する", () => {
  const file = path.join("repo", "src", "modules", "proposal", "application", "use-case.ts");
  const source = 'import { useState } from "react";';
  const findings = inspectSource({ root: "repo", file, source, imports: ["react"] });
  assert.equal(findings.some((finding) => finding.code === "APPLICATION_REACT_DEPENDENCY"), true);
});

test("Client Componentのserver secret参照を拒否する", () => {
  const file = path.join("repo", "src", "modules", "shared", "presentation", "secret.tsx");
  const source = `'use client';\nconst secret = process.env.OPENAI_API_KEY;`;
  const findings = inspectSource({ root: "repo", file, source, imports: [] });
  assert.equal(findings.some((finding) => finding.code === "CLIENT_SERVER_ENV"), true);
});

test("App Routerのadmin client直接利用は段階移行のwarningにする", () => {
  const file = path.join("repo", "src", "app", "admin", "page.tsx");
  const source = 'import { createAdminClient } from "@/lib/supabase/admin";';
  const findings = inspectSource({ root: "repo", file, source, imports: ["@/lib/supabase/admin"] });
  assert.equal(findings.some((finding) => finding.code === "APP_ADMIN_CLIENT" && finding.severity === "warning"), true);
});

test("成人向けmoduleから一般Provider経路への接続を拒否する", () => {
  const file = path.join("repo", "src", "modules", "adult-scenario", "infrastructure", "provider.ts");
  const source = 'import { provider } from "@/lib/cloud-ai-registry";';
  const findings = inspectSource({ root: "repo", file, source, imports: ["@/lib/cloud-ai-registry"] });
  assert.equal(findings.some((finding) => finding.code === "ADULT_GENERAL_PROVIDER_ROUTE"), true);
});

test("module間循環依存を検出する", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mangai-module-boundaries-"));
  await mkdir(path.join(root, "src", "modules", "research", "domain"), { recursive: true });
  await mkdir(path.join(root, "src", "modules", "proposal", "domain"), { recursive: true });
  await writeFile(path.join(root, "src", "modules", "research", "domain", "a.ts"), 'import "@/modules/proposal/domain/b";');
  await writeFile(path.join(root, "src", "modules", "proposal", "domain", "b.ts"), 'import "@/modules/research/domain/a";');
  const result = await analyzeModuleBoundaries(root);
  assert.equal(result.findings.some((finding) => finding.code === "MODULE_CYCLE"), true);
});

test("新規ファイルの800行超過はerror、500行超過はwarning", () => {
  assert.equal(inspectNewSource("large.ts", Array(802).fill("export {};").join("\n")).some((finding) => finding.code === "NEW_FILE_OVER_800_LINES" && finding.severity === "error"), true);
  assert.equal(inspectNewSource("medium.ts", Array(502).fill("export {};").join("\n")).some((finding) => finding.code === "NEW_FILE_OVER_500_LINES" && finding.severity === "warning"), true);
});

test("新規ファイルの明示的anyはwarning", () => {
  const unsafeSource = `export const value: ${["a", "ny"].join("")} = null;`;
  assert.equal(inspectNewSource("unsafe.ts", unsafeSource).some((finding) => finding.code === "NEW_ANY" && finding.severity === "warning"), true);
});
