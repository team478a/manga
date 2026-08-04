import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const SERVER_SECRET_PATTERN = /(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|WEBHOOK_SECRET)/;
const FEATURE_FLAG_PATTERN = /^[A-Z][A-Z0-9_]*(?:ENABLED|FLAG)$/;

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith(".d.ts") ? [target] : [];
  }))).flat();
}

export function extractImports(source) {
  const imports = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^;"']*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns)
    for (const match of source.matchAll(pattern)) imports.push(match[1]);
  return [...new Set(imports)];
}

function layerOf(file) {
  return file.replaceAll("\\", "/").match(/\/(domain|application|infrastructure|presentation|contracts)\//)?.[1] ?? null;
}

function moduleOf(root, file) {
  const relative = path.relative(path.join(root, "src", "modules"), file).replaceAll("\\", "/");
  return relative.startsWith("../") ? null : relative.split("/")[0];
}

function importedModule(specifier) {
  return specifier.match(/^@\/modules\/([^/]+)/)?.[1] ?? null;
}

function add(findings, severity, code, file, message) {
  findings.push({ severity, code, file, message });
}

export function inspectSource({ root, file, source, imports }) {
  const findings = [];
  const layer = layerOf(file);
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const isClient = /^\s*["']use client["'];?/m.test(source);

  if (layer === "domain") {
    for (const specifier of imports) {
      if (/^(?:next(?:\/|$)|react(?:\/|$)|@supabase\/|stripe(?:\/|$))/.test(specifier) || /(?:supabase|storage)/i.test(specifier))
        add(findings, "error", "DOMAIN_EXTERNAL_DEPENDENCY", file, `domain層から ${specifier} を参照できません。`);
    }
  }
  if (layer === "application")
    for (const specifier of imports)
      if (/^react(?:\/|$)/.test(specifier))
        add(findings, "error", "APPLICATION_REACT_DEPENDENCY", file, `application層から ${specifier} を参照できません。`);

  if (layer === "presentation" && /createAdminClient|SUPABASE_SERVICE_ROLE_KEY|service.?role/i.test(source))
    add(findings, "error", "PRESENTATION_SERVICE_ROLE", file, "presentation層からservice roleを直接利用できません。");

  if (isClient) {
    for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/g))
      if (!match[1].startsWith("NEXT_PUBLIC_"))
        add(findings, "error", "CLIENT_SERVER_ENV", file, `Client Componentがserver環境変数 ${match[1]} を参照しています。`);
    if (SERVER_SECRET_PATTERN.test(source))
      add(findings, "error", "CLIENT_SECRET_REFERENCE", file, "Client Componentに秘密情報を示す識別子があります。");
  }

  if (relative.startsWith("src/app/") && /createAdminClient|@\/lib\/supabase\/admin/.test(source))
    add(findings, "warning", "APP_ADMIN_CLIENT", file, "App RouterからSupabase admin clientを直接利用しています。段階的にinfrastructure層へ移してください。");

  if (/console\.log\s*\([^\n]*(?:prompt|providerResponse|provider_response|rawResponse|raw_response)/i.test(source))
    add(findings, "error", "SENSITIVE_CONSOLE_LOG", file, "PromptまたはProvider応答をconsole.logへ出力できません。");
  if (/throw\s+new\s+Error\s*\(\s*(?:providerMessage|provider_message|providerResponse|provider_response)(?:\.|\s*\))/i.test(source))
    add(findings, "error", "RAW_PROVIDER_ERROR", file, "Providerの生エラーをpresentationへ渡せません。");

  const adultFile = /(?:^|[\\/._-])adult(?:[\\/._-]|$)/i.test(relative);
  if (adultFile)
    for (const specifier of imports)
      if (/cloud-ai-(?:registry|gateway)|general-provider|providers\/general/i.test(specifier))
        add(findings, "error", "ADULT_GENERAL_PROVIDER_ROUTE", file, `成人向けデータを一般Cloud Provider経路 ${specifier} へ接続できません。`);

  return findings;
}

function findModuleCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const active = new Set();
  const stack = [];
  function visit(node) {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node); active.add(node); stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop(); active.delete(node);
  }
  for (const node of graph.keys()) visit(node);
  return cycles;
}

export async function analyzeModuleBoundaries(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const moduleFiles = await listFiles(path.join(root, "src", "modules"));
  const appFiles = await listFiles(path.join(root, "src", "app"));
  const findings = [];
  const graph = new Map();
  for (const file of [...moduleFiles, ...appFiles]) {
    const source = await readFile(file, "utf8");
    const imports = extractImports(source);
    findings.push(...inspectSource({ root, file, source, imports }));
    const owner = moduleOf(root, file);
    if (owner) {
      if (!graph.has(owner)) graph.set(owner, new Set());
      for (const specifier of imports) {
        const dependency = importedModule(specifier);
        if (dependency && dependency !== owner) graph.get(owner).add(dependency);
      }
    }
  }
  for (const cycle of findModuleCycles(graph))
    add(findings, "error", "MODULE_CYCLE", path.join(root, "src", "modules", cycle[0]), cycle.join(" -> "));

  const envExample = path.join(root, ".env.example");
  try {
    const declared = [...(await readFile(envExample, "utf8")).matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]).filter((name) => FEATURE_FLAG_PATTERN.test(name));
    const allSource = await Promise.all((await listFiles(path.join(root, "src"))).concat(await listFiles(path.join(root, "scripts"))).map((file) => readFile(file, "utf8")));
    for (const flag of declared)
      if (!allSource.some((source) => source.includes(flag))) add(findings, "warning", "UNUSED_FEATURE_FLAG", envExample, `${flag} はコードから参照されていません。`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { scannedFiles: moduleFiles.length + appFiles.length, findings };
}

export function formatFinding(root, finding) {
  return `${finding.severity.toUpperCase()} [${finding.code}] ${path.relative(root, finding.file).replaceAll("\\", "/")}: ${finding.message}`;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const result = await analyzeModuleBoundaries(root);
  for (const finding of result.findings) (finding.severity === "error" ? console.error : console.warn)(formatFinding(root, finding));
  const errors = result.findings.filter((finding) => finding.severity === "error").length;
  const warnings = result.findings.length - errors;
  console.log(`Module boundaries: ${result.scannedFiles} files, ${errors} errors, ${warnings} warnings.`);
  if (errors) process.exitCode = 1;
}
