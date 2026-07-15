import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MangaiDatabase } from "../dist-main/main/database.js";

const args = process.argv.slice(2);
const allowLocal = args.includes("allow-local");
const requestedVolume = args.find((argument) => argument !== "allow-local");

if (process.platform !== "win32") {
  console.error("別ドライブ削除E2EはWindows上で実行してください。");
  process.exit(1);
}
if (!allowLocal || !requestedVolume) {
  console.error("対象ドライブとallow-localを指定してください。");
  process.exit(1);
}

const targetVolume = path.parse(path.resolve(requestedVolume)).root;
const appVolume = path.parse(path.resolve(os.tmpdir())).root;
if (path.resolve(requestedVolume) !== path.resolve(targetVolume)) {
  console.error("対象はD:\\のようなドライブrootで指定してください。");
  process.exit(1);
}
if (targetVolume.toLowerCase() === appVolume.toLowerCase()) {
  console.error("アプリデータと異なるドライブを指定してください。");
  process.exit(1);
}

const prefix = "MANGAI-Codex-E2E-";
const externalRoot = path.join(targetVolume, `${prefix}${crypto.randomUUID()}`);
const appRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "mangai-cross-volume-e2e-"),
);
const storagePath = path.join(externalRoot, "custom-project");
const paths = {
  root: appRoot,
  database: path.join(appRoot, "mangai.sqlite"),
  projects: path.join(appRoot, "projects"),
  assets: path.join(appRoot, "assets"),
  exports: path.join(appRoot, "exports"),
  logs: path.join(appRoot, "logs"),
};
let db;

function removeExternalTestRoot() {
  if (!fs.existsSync(externalRoot)) return;
  const resolved = path.resolve(externalRoot);
  if (
    path.dirname(resolved).toLowerCase() !==
      path.resolve(targetVolume).toLowerCase() ||
    !path.basename(resolved).startsWith(prefix)
  )
    throw new Error("外部ドライブのcleanup対象が安全条件を満たしません。");
  fs.rmSync(resolved, { recursive: true, force: true });
}

try {
  db = new MangaiDatabase(paths);
  const bundle = db.createProject({
    title: "実ドライブ削除E2E",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1000,
    height: 1500,
    dpi: 300,
    storagePath,
  });
  fs.writeFileSync(path.join(storagePath, "project-marker.txt"), "preserved");
  db.deleteProject(bundle.project.id);

  const fallbackTrash = path.join(externalRoot, ".mangai-trash");
  const entries = fs.readdirSync(fallbackTrash);
  assert.equal(entries.length, 1);
  assert.match(entries[0], new RegExp(`^${bundle.project.id}-`));
  assert.equal(
    fs.readFileSync(
      path.join(fallbackTrash, entries[0], "project-marker.txt"),
      "utf8",
    ),
    "preserved",
  );
  assert.equal(fs.existsSync(storagePath), false);
  assert.equal(db.listProjects().length, 0);
  console.log("MANGAI cross-volume trash E2E");
  console.log("  Cross-volume fallback: checked");
  console.log("  Project bytes preserved: checked");
  console.log("  Database deletion after move: checked");
  console.log("  Result: PASSED");
} finally {
  db?.close();
  removeExternalTestRoot();
  const temporaryBase = path.resolve(os.tmpdir()) + path.sep;
  const resolvedAppRoot = path.resolve(appRoot);
  if (resolvedAppRoot.startsWith(temporaryBase))
    fs.rmSync(resolvedAppRoot, { recursive: true, force: true });
}
