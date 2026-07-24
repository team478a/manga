import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const FORBIDDEN_PACKAGE_IMPORTS = [
  "next",
  "electron",
  "@supabase/",
  "stripe",
  "better-sqlite3",
  "node:",
  "fs",
  "path",
];

async function pathExists(target) {
  try {
    await readFile(target);
    return true;
  } catch {
    return false;
  }
}

async function listSourceFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return listSourceFiles(target);
      if (
        SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) &&
        !entry.name.endsWith(".d.ts")
      )
        return [target];
      return [];
    }),
  );
  return files.flat();
}

export function extractModuleSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^;"']*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns)
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return [...new Set(specifiers)];
}

function isForbiddenPackageImport(specifier) {
  return FORBIDDEN_PACKAGE_IMPORTS.some(
    (forbidden) =>
      specifier === forbidden ||
      ((forbidden.endsWith("/") || forbidden.endsWith(":")) &&
        specifier.startsWith(forbidden)) ||
      specifier.startsWith(`${forbidden}/`),
  );
}

function packageNameFromSpecifier(specifier) {
  const match = specifier.match(/^(@mangai\/[^/]+)(?:\/.*)?$/);
  return match?.[1] ?? null;
}

async function resolveSourceFile(basePath) {
  const extension = path.extname(basePath);
  const stems =
    extension === ".js" || extension === ".mjs" || extension === ".cjs"
      ? [basePath.slice(0, -extension.length)]
      : extension
        ? [basePath]
        : [basePath, path.join(basePath, "index")];
  const candidates = [];
  for (const stem of stems) {
    if (SOURCE_EXTENSIONS.includes(path.extname(stem))) candidates.push(stem);
    else
      for (const sourceExtension of SOURCE_EXTENSIONS)
        candidates.push(`${stem}${sourceExtension}`);
  }
  for (const candidate of candidates)
    if (await pathExists(candidate)) return path.resolve(candidate);
  return null;
}

function findCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const visiting = new Set();
  const stack = [];
  function visit(node) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of graph.keys()) visit(node);
  return cycles;
}

export async function analyzeDependencyBoundaries(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const packagesDirectory = path.join(root, "packages");
  const packageEntries = await readdir(packagesDirectory, {
    withFileTypes: true,
  });
  const packages = new Map();
  for (const entry of packageEntries.filter((item) => item.isDirectory())) {
    const directory = path.join(packagesDirectory, entry.name);
    const manifestPath = path.join(directory, "package.json");
    if (!(await pathExists(manifestPath))) continue;
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    packages.set(manifest.name, { directory, manifest, manifestPath });
  }

  const violations = [];
  const packageGraph = new Map();
  const sourceGraph = new Map();
  for (const [packageName, packageInfo] of packages) {
    const { directory, manifest, manifestPath } = packageInfo;
    const publicEntry = manifest.exports?.["."];
    if (
      !publicEntry ||
      publicEntry.types !== "./dist/index.d.ts" ||
      publicEntry.import !== "./dist/index.js"
    )
      violations.push({
        code: "PACKAGE_PUBLIC_API",
        file: manifestPath,
        message: `${packageName} must expose only dist/index through exports["."].`,
      });

    const files = await listSourceFiles(path.join(directory, "src"));
    const declaredDependencies = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    const packageDependencies = new Set();
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const localDependencies = [];
      for (const specifier of extractModuleSpecifiers(source)) {
        if (isForbiddenPackageImport(specifier))
          violations.push({
            code: "FRAMEWORK_DEPENDENCY",
            file,
            message: `${packageName} cannot import ${specifier}.`,
          });
        const dependencyPackage = packageNameFromSpecifier(specifier);
        if (dependencyPackage && dependencyPackage !== packageName) {
          packageDependencies.add(dependencyPackage);
          if (!declaredDependencies.has(dependencyPackage))
            violations.push({
              code: "UNDECLARED_PACKAGE_DEPENDENCY",
              file,
              message: `${packageName} imports undeclared dependency ${dependencyPackage}.`,
            });
        }
        if (specifier.startsWith(".")) {
          const resolved = await resolveSourceFile(
            path.resolve(path.dirname(file), specifier),
          );
          if (resolved) localDependencies.push(resolved);
        }
      }
      sourceGraph.set(path.resolve(file), localDependencies);
    }
    packageGraph.set(packageName, packageDependencies);
  }

  const consumerRoots = [
    path.join(root, "src"),
    path.join(root, "apps", "desktop", "src"),
    path.join(root, "tests"),
  ];
  for (const consumerRoot of consumerRoots)
    for (const file of await listSourceFiles(consumerRoot)) {
      const source = await readFile(file, "utf8");
      for (const specifier of extractModuleSpecifiers(source))
        if (/^@mangai\/[^/]+\//.test(specifier))
          violations.push({
            code: "PACKAGE_DEEP_IMPORT",
            file,
            message: `Import ${specifier} through the package public API.`,
          });
    }

  for (const cycle of findCycles(packageGraph))
    violations.push({
      code: "PACKAGE_CYCLE",
      file: packages.get(cycle[0])?.manifestPath ?? packagesDirectory,
      message: cycle.join(" -> "),
    });
  for (const cycle of findCycles(sourceGraph))
    violations.push({
      code: "SOURCE_CYCLE",
      file: cycle[0],
      message: cycle
        .map((file) => path.relative(root, file).replaceAll("\\", "/"))
        .join(" -> "),
    });

  return {
    packageCount: packages.size,
    sourceFileCount: sourceGraph.size,
    violations,
  };
}

export function formatViolation(rootDirectory, violation) {
  const relative = path
    .relative(path.resolve(rootDirectory), violation.file)
    .replaceAll("\\", "/");
  return `[${violation.code}] ${relative}: ${violation.message}`;
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const result = await analyzeDependencyBoundaries(root);
  if (result.violations.length) {
    console.error(
      result.violations
        .map((violation) => formatViolation(root, violation))
        .join("\n"),
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Dependency boundaries valid: ${result.packageCount} packages, ${result.sourceFileCount} package source files.`,
    );
  }
}
