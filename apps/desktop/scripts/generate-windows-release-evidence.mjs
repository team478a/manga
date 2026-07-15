import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const verifyOnly = args.includes("verify");
const directoryName =
  args.find((argument) => argument !== "verify") ?? "release";

if (
  !/^[a-zA-Z0-9._-]+$/.test(directoryName) ||
  directoryName === "." ||
  directoryName === ".."
) {
  console.error("出力先はDesktop内の単一ディレクトリ名で指定してください。");
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const lockPath = path.join(root, "package-lock.json");
const lockBytes = fs.readFileSync(lockPath);
const lock = JSON.parse(lockBytes);
const outputDirectory = path.join(root, directoryName);
const installerName = `MANGAI-Desktop-Setup-${packageJson.version}-x64.exe`;
const blockmapName = `${installerName}.blockmap`;
const metadataName = packageJson.version.includes("-beta.")
  ? "beta.yml"
  : "latest.yml";
const sbomName = `MANGAI-Desktop-${packageJson.version}-sbom.spdx.json`;
const checksumsName = "SHA256SUMS.txt";

for (const name of [installerName, blockmapName]) {
  const filePath = path.join(outputDirectory, name);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    console.error("Windows release成果物が不足しています。");
    process.exit(1);
  }
}

function packageNameFromPath(packagePath, entry) {
  if (entry.name) return entry.name;
  if (packagePath.startsWith("../../")) {
    const manifestPath = path.resolve(root, packagePath, "package.json");
    if (fs.existsSync(manifestPath))
      return JSON.parse(fs.readFileSync(manifestPath, "utf8")).name;
  }
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  return index >= 0 ? packagePath.slice(index + marker.length) : undefined;
}

function packageVersionFromPath(packagePath, entry) {
  if (entry.version) return entry.version;
  if (packagePath.startsWith("../../")) {
    const manifestPath = path.resolve(root, packagePath, "package.json");
    if (fs.existsSync(manifestPath))
      return JSON.parse(fs.readFileSync(manifestPath, "utf8")).version;
  }
  return undefined;
}

function purl(name, version) {
  if (name.startsWith("@")) {
    const slash = name.indexOf("/");
    return `pkg:npm/${encodeURIComponent(name.slice(0, slash))}/${encodeURIComponent(name.slice(slash + 1))}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function checksumFromIntegrity(integrity) {
  const match = /^sha512-([a-zA-Z0-9+/=]+)$/.exec(integrity ?? "");
  if (!match) return undefined;
  return Buffer.from(match[1], "base64").toString("hex").toUpperCase();
}

const componentMap = new Map();
for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (!packagePath) continue;
  const name = packageNameFromPath(packagePath, entry);
  const version = packageVersionFromPath(packagePath, entry);
  if (!name || !version) continue;
  const key = `${name}@${version}`;
  const integrityChecksum = checksumFromIntegrity(entry.integrity);
  const existing = componentMap.get(key);
  if (!existing || (!existing.integrityChecksum && integrityChecksum))
    componentMap.set(key, {
      name,
      version,
      license: entry.license,
      resolved: /^https:\/\//.test(entry.resolved ?? "")
        ? entry.resolved
        : undefined,
      integrityChecksum,
    });
}

const components = [...componentMap.values()].sort((left, right) =>
  `${left.name}@${left.version}`.localeCompare(
    `${right.name}@${right.version}`,
    "en",
  ),
);
const rootId = "SPDXRef-Package-MANGAI-Desktop";
const componentIds = new Map();
const spdxPackages = components.map((component, index) => {
  const spdxId = `SPDXRef-Package-${index + 1}`;
  componentIds.set(component.name, spdxId);
  return {
    SPDXID: spdxId,
    name: component.name,
    versionInfo: component.version,
    downloadLocation: component.resolved ?? "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: component.license ?? "NOASSERTION",
    copyrightText: "NOASSERTION",
    ...(component.integrityChecksum
      ? {
          checksums: [
            {
              algorithm: "SHA512",
              checksumValue: component.integrityChecksum,
            },
          ],
        }
      : {}),
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: purl(component.name, component.version),
      },
    ],
  };
});

const rootPackage = {
  SPDXID: rootId,
  name: packageJson.name,
  versionInfo: packageJson.version,
  supplier: "Organization: MANGAI",
  downloadLocation: "NOASSERTION",
  filesAnalyzed: false,
  licenseConcluded: "NOASSERTION",
  licenseDeclared: packageJson.license ?? "NOASSERTION",
  copyrightText: "NOASSERTION",
  primaryPackagePurpose: "APPLICATION",
  externalRefs: [
    {
      referenceCategory: "PACKAGE-MANAGER",
      referenceType: "purl",
      referenceLocator: purl(packageJson.name, packageJson.version),
    },
  ],
};
const directDependencies = Object.keys(lock.packages?.[""]?.dependencies ?? {});
const lockDigest = crypto.createHash("sha256").update(lockBytes).digest("hex");
const relationships = [
  {
    spdxElementId: "SPDXRef-DOCUMENT",
    relationshipType: "DESCRIBES",
    relatedSpdxElement: rootId,
  },
  ...spdxPackages.map((component) => ({
    spdxElementId: rootId,
    relationshipType: "CONTAINS",
    relatedSpdxElement: component.SPDXID,
  })),
  ...directDependencies.flatMap((name) => {
    const relatedSpdxElement = componentIds.get(name);
    return relatedSpdxElement
      ? [
          {
            spdxElementId: rootId,
            relationshipType: "DEPENDS_ON",
            relatedSpdxElement,
          },
        ]
      : [];
  }),
];

const sbom = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: `MANGAI Desktop ${packageJson.version}`,
  documentNamespace: `https://mangai.jp/spdx/desktop/${encodeURIComponent(packageJson.version)}/${lockDigest}`,
  creationInfo: {
    created: new Date().toISOString(),
    creators: ["Tool: MANGAI release evidence generator"],
  },
  documentDescribes: [rootId],
  packages: [rootPackage, ...spdxPackages],
  relationships,
};
const sbomPath = path.join(outputDirectory, sbomName);
const evidenceNames = [installerName, blockmapName];
if (fs.existsSync(path.join(outputDirectory, metadataName)))
  evidenceNames.push(metadataName);
evidenceNames.push(sbomName);
const checksumsPath = path.join(outputDirectory, checksumsName);
if (!verifyOnly) {
  fs.writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);
  const checksumLines = evidenceNames.map((name) => {
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(outputDirectory, name)))
      .digest("hex");
    return `${digest}  ${name}`;
  });
  fs.writeFileSync(checksumsPath, `${checksumLines.join("\n")}\n`);
}

for (const filePath of [sbomPath, checksumsPath]) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    console.error("Windows release証跡が不足しています。");
    process.exit(1);
  }
}

const parsedSbom = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
if (
  parsedSbom.spdxVersion !== "SPDX-2.3" ||
  parsedSbom.packages?.[0]?.name !== packageJson.name ||
  parsedSbom.packages?.[0]?.versionInfo !== packageJson.version ||
  parsedSbom.packages.length !== components.length + 1
) {
  console.error("生成したSBOMの自己検証に失敗しました。");
  process.exit(1);
}
const checksumLines = fs.readFileSync(checksumsPath, "utf8").trim().split("\n");
const checksumNames = [];
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line.trim());
  if (!match) {
    console.error("生成したSHA-256一覧の形式が不正です。");
    process.exit(1);
  }
  checksumNames.push(match[2]);
  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(outputDirectory, match[2])))
    .digest("hex");
  if (actual !== match[1]) {
    console.error("生成したSHA-256一覧の自己検証に失敗しました。");
    process.exit(1);
  }
}
if (
  checksumNames.length !== evidenceNames.length ||
  evidenceNames.some((name) => !checksumNames.includes(name))
) {
  console.error("SHA-256一覧の対象ファイルが一致しません。");
  process.exit(1);
}

console.log("MANGAI Windows release evidence");
console.log(`  Mode: ${verifyOnly ? "verify" : "generate"}`);
console.log(`  SPDX packages: ${parsedSbom.packages.length}`);
console.log(`  SHA-256 entries: ${checksumLines.length}`);
console.log("  Result: PASSED");
