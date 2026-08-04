import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_PATTERN = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

export function inspectNewSource(file, source) {
  const lineCount = source === "" ? 0 : source.split(/\r?\n/).length;
  const findings = [];
  if (lineCount > 800) findings.push({ severity: "error", code: "NEW_FILE_OVER_800_LINES", file, message: `${lineCount} lines` });
  else if (lineCount > 500) findings.push({ severity: "warning", code: "NEW_FILE_OVER_500_LINES", file, message: `${lineCount} lines` });
  if ([/\bas\s+any\b/, /:\s*any\b/, /<\s*any\s*>/, /\b(?:Array|Promise)\s*<\s*any\s*>/].some((pattern) => pattern.test(source)))
    findings.push({ severity: "warning", code: "NEW_ANY", file, message: "新規ファイルに明示的なanyがあります。" });
  return findings;
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function resolveBaseRef(root, env = process.env) {
  const candidates = [env.MANGAI_QUALITY_BASE_REF, env.GITHUB_BASE_REF && `origin/${env.GITHUB_BASE_REF}`, "origin/feature/manga-canvas-mvp"].filter(Boolean);
  for (const candidate of candidates) {
    try { git(root, ["rev-parse", "--verify", candidate]); return candidate; } catch { /* try next */ }
  }
  return "HEAD^";
}

export function listNewFiles(root, baseRef) {
  try {
    const mergeBase = git(root, ["merge-base", baseRef, "HEAD"]);
    return git(root, ["diff", "--name-only", "--diff-filter=A", `${mergeBase}...HEAD`]).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

export async function analyzeCodebaseSize(rootDirectory, options = {}) {
  const root = path.resolve(rootDirectory);
  const baseRef = options.baseRef ?? resolveBaseRef(root, options.env);
  const files = options.files ?? listNewFiles(root, baseRef);
  const sourceFiles = files.filter((file) => SOURCE_PATTERN.test(file) && !file.includes("/dist/") && !file.includes("/node_modules/"));
  const findings = [];
  for (const file of sourceFiles) findings.push(...inspectNewSource(file, await readFile(path.join(root, file), "utf8")));
  return { baseRef, files: sourceFiles, findings };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const result = await analyzeCodebaseSize(root);
  for (const finding of result.findings) (finding.severity === "error" ? console.error : console.warn)(`${finding.severity.toUpperCase()} [${finding.code}] ${finding.file}: ${finding.message}`);
  const errors = result.findings.filter((finding) => finding.severity === "error").length;
  const warnings = result.findings.length - errors;
  console.log(`Codebase size regressions: ${result.files.length} new source files against ${result.baseRef}, ${errors} errors, ${warnings} warnings.`);
  if (errors) process.exitCode = 1;
}
