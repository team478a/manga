import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Buffer } from "node:buffer";
import { MangaiDatabase } from "../dist-main/main/database.js";
import { openDatabaseWithRecovery } from "../dist-main/main/database-recovery.js";
import Database from "better-sqlite3";
import sharp from "sharp";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { imageSize } from "image-size";
import { parseSalesPackageManifest } from "@mangai/export-core";

test("30 canvas objects remain responsive across save, move and reopen", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-canvas-perf-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "30オブジェクト性能確認",
    subtitle: "",
    description: "",
    genre: "漫画",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1600,
    height: 2400,
    dpi: 300,
  });
  bundle = db.addPage(bundle.episodes[0].id);
  const pageId = bundle.pages[0].id;
  const panels = Array.from({ length: 28 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    pageId,
    name: `性能確認コマ${index + 1}`,
    x: 40 + (index % 4) * 380,
    y: 40 + Math.floor(index / 4) * 320,
    width: 340,
    height: 280,
    rotation: 0,
    zIndex: index,
    visible: true,
    locked: false,
    borderColor: "#000000",
    borderWidth: 4,
    fillColor: "#ffffff",
    imageAssetId: null,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    shape: "rectangle",
    slant: 0.12,
    imageOpacity: 1,
  }));
  const balloonId = "00000000-0000-4000-8000-000000000029";
  const saveStartedAt = performance.now();
  bundle = db.saveCanvasBatch({
    pageId,
    panels,
    balloons: [
      {
        id: balloonId,
        pageId,
        name: "性能確認吹き出し",
        type: "speech_ellipse",
        x: 1100,
        y: 100,
        width: 360,
        height: 240,
        rotation: 0,
        zIndex: 28,
        visible: true,
        locked: false,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 4,
        opacity: 1,
        tailDirection: "bottom_left",
        tailOffset: 0.5,
      },
    ],
    textObjects: [
      {
        id: "00000000-0000-4000-8000-000000000030",
        pageId,
        parentBalloonId: balloonId,
        name: "性能確認テキスト",
        text: "30オブジェクト",
        writingMode: "vertical",
        x: 1180,
        y: 130,
        width: 180,
        height: 180,
        rotation: 0,
        zIndex: 29,
        visible: true,
        locked: false,
        fontFamily: "sans-serif",
        fontSize: 40,
        fontWeight: 400,
        color: "#000000",
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.2,
        letterSpacing: 0,
        padding: 8,
        opacity: 1,
      },
    ],
    replacePanels: true,
    replaceBalloons: true,
    replaceTextObjects: true,
  });
  const batchSaveMs = performance.now() - saveStartedAt;
  assert.equal(
    bundle.panels.length + bundle.balloons.length + bundle.textObjects.length,
    30,
  );

  const moveStartedAt = performance.now();
  bundle = db.savePanel({
    ...bundle.panels[0],
    x: bundle.panels[0].x + 10,
    y: bundle.panels[0].y + 10,
  });
  const moveSaveMs = performance.now() - moveStartedAt;
  assert.equal(bundle.panels[0].x, 50);
  db.close();

  const reopenStartedAt = performance.now();
  const reopenedDb = new MangaiDatabase(paths);
  const reopened = reopenedDb.openProject(bundle.project.id);
  const reopenMs = performance.now() - reopenStartedAt;
  assert.equal(
    reopened.panels.length +
      reopened.balloons.length +
      reopened.textObjects.length,
    30,
  );
  assert.ok(batchSaveMs < 2_000, `一括保存が遅すぎます: ${batchSaveMs}ms`);
  assert.ok(moveSaveMs < 2_000, `移動保存が遅すぎます: ${moveSaveMs}ms`);
  assert.ok(reopenMs < 2_000, `再読込が遅すぎます: ${reopenMs}ms`);
  t.diagnostic(
    `30 objects: batch ${batchSaveMs.toFixed(1)}ms, move ${moveSaveMs.toFixed(1)}ms, reopen ${reopenMs.toFixed(1)}ms`,
  );
  reopenedDb.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("project, episode, page and asset data survive reopening", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-test-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "テスト漫画",
    subtitle: "",
    description: "",
    genre: "漫画",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  assert.equal(bundle.episodes.length, 1);
  bundle = db.addPage(bundle.episodes[0].id);
  assert.equal(bundle.pages.length, 1);
  bundle = db.savePage(bundle.pages[0].id, "prompt", "negative", "memo");
  assert.equal(bundle.pages[0].notes, "memo");
  db.close();
  const reopenedDb = new MangaiDatabase(paths),
    reopened = reopenedDb.openProject(bundle.project.id);
  assert.equal(reopened.project.title, "テスト漫画");
  assert.equal(reopened.pages[0].prompt, "prompt");
  reopenedDb.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("project generation policy survives reopening, duplication and backup restore", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-policy-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  const bundle = db.createProject({
    title: "外部送信ポリシー",
    subtitle: "",
    description: "",
    genre: "漫画",
    ageRating: "成人向け",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  const defaults = db.getProjectGenerationPolicy(bundle.project.id);
  assert.equal(defaults.externalProcessingPolicy, "safe_assets_only");
  assert.equal(defaults.preferLocal, true);
  assert.equal(defaults.externalConfirmationRequired, true);
  assert.equal(defaults.monthlyCostLimit, null);

  const expected = {
    externalProcessingPolicy: "custom",
    preferLocal: false,
    externalConfirmationRequired: true,
    monthlyCostLimit: 2500,
    customCloudJobTypes: ["background", "effect"],
  };
  db.saveProjectGenerationPolicy({
    projectId: bundle.project.id,
    ...expected,
  });
  db.close();

  db = new MangaiDatabase(paths);
  const comparable = (policy) => {
    const { projectId, updatedAt, ...settings } = policy;
    void projectId;
    void updatedAt;
    return settings;
  };
  assert.deepEqual(
    comparable(db.getProjectGenerationPolicy(bundle.project.id)),
    expected,
  );

  const duplicate = db.duplicateProject(bundle.project.id);
  assert.deepEqual(
    comparable(db.getProjectGenerationPolicy(duplicate.project.id)),
    expected,
  );

  const backupPath = path.join(root, "policy.mangai-backup");
  await db.backupProject(bundle.project.id, backupPath);
  const archive = await JSZip.loadAsync(fs.readFileSync(backupPath));
  const manifest = JSON.parse(
    await archive.file("manifest.json").async("string"),
  );
  assert.deepEqual(comparable(manifest.generationPolicy), expected);

  const restored = await db.restoreProject(backupPath);
  assert.deepEqual(
    comparable(db.getProjectGenerationPolicy(restored.project.id)),
    expected,
  );

  delete manifest.generationPolicy;
  delete manifest.history.routeDecisions;
  archive.file("manifest.json", JSON.stringify(manifest));
  const legacyPath = path.join(root, "policy-legacy-v2.mangai-backup");
  fs.writeFileSync(
    legacyPath,
    await archive.generateAsync({ type: "nodebuffer" }),
  );
  const legacyRestored = await db.restoreProject(legacyPath);
  assert.equal(
    db.getProjectGenerationPolicy(legacyRestored.project.id)
      .externalProcessingPolicy,
    "safe_assets_only",
  );

  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("asset library metadata survives reopening, duplication and backup restore", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-assets-library-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "素材ライブラリ",
    subtitle: "",
    description: "",
    genre: "漫画",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  const sourceImage = path.join(root, "school-background.png");
  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 30, g: 120, b: 220, alpha: 1 },
    },
  })
    .png()
    .toFile(sourceImage);
  bundle = db.importAssets(bundle.project.id, [sourceImage]);
  bundle = db.saveAssetLibraryMetadata({
    assetId: bundle.assets[0].id,
    category: "background",
    tags: ["学校", "昼", "学校"],
    favorite: true,
  });
  const expected = {
    libraryCategory: "background",
    libraryTags: ["学校", "昼"],
    libraryFavorite: true,
  };
  assert.deepEqual(
    {
      libraryCategory: bundle.assets[0].libraryCategory,
      libraryTags: bundle.assets[0].libraryTags,
      libraryFavorite: bundle.assets[0].libraryFavorite,
    },
    expected,
  );

  db.close();
  db = new MangaiDatabase(paths);
  bundle = db.openProject(bundle.project.id);
  assert.equal(bundle.assets[0].libraryCategory, "background");
  assert.deepEqual(bundle.assets[0].libraryTags, ["学校", "昼"]);

  const duplicate = db.duplicateProject(bundle.project.id);
  assert.equal(duplicate.assets[0].libraryCategory, "background");
  assert.deepEqual(duplicate.assets[0].libraryTags, ["学校", "昼"]);
  assert.equal(duplicate.assets[0].libraryFavorite, true);

  const backupPath = path.join(root, "library.mangai-backup");
  await db.backupProject(bundle.project.id, backupPath);
  const restored = await db.restoreProject(backupPath);
  assert.equal(restored.assets[0].libraryCategory, "background");
  assert.deepEqual(restored.assets[0].libraryTags, ["学校", "昼"]);
  assert.equal(restored.assets[0].libraryFavorite, true);

  const archive = await JSZip.loadAsync(fs.readFileSync(backupPath));
  const manifest = JSON.parse(
    await archive.file("manifest.json").async("string"),
  );
  for (const asset of manifest.bundle.assets) {
    delete asset.libraryCategory;
    delete asset.libraryTags;
    delete asset.libraryFavorite;
    delete asset.libraryUpdatedAt;
  }
  archive.file("manifest.json", JSON.stringify(manifest));
  const legacyPath = path.join(root, "library-legacy.mangai-backup");
  fs.writeFileSync(
    legacyPath,
    await archive.generateAsync({ type: "nodebuffer" }),
  );
  const legacy = await db.restoreProject(legacyPath);
  assert.equal(legacy.assets[0].libraryCategory, "unclassified");
  assert.deepEqual(legacy.assets[0].libraryTags, []);
  assert.equal(legacy.assets[0].libraryFavorite, false);

  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("project duplication preserves assets, canvas content and rendered pages", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-duplicate-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  let source = db.createProject({
    title: "複製元",
    subtitle: "Canvas内容を維持",
    description: "素材を含むProject",
    genre: "漫画",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  const sourceImage = path.join(root, "red-page.png");
  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 220, g: 30, b: 40, alpha: 1 },
    },
  })
    .png()
    .toFile(sourceImage);
  source = db.importAssets(source.project.id, [sourceImage]);
  const sourceAsset = source.assets[0];
  source = db.addPage(source.episodes[0].id, sourceAsset.id);
  const sourcePage = source.pages[0];
  db.savePanel({
    id: "20000000-0000-4000-8000-000000000001",
    pageId: sourcePage.id,
    name: "複製対象コマ",
    x: 100,
    y: 100,
    width: 500,
    height: 600,
    rotation: 0,
    zIndex: 0,
    visible: true,
    locked: false,
    borderColor: "#000000",
    borderWidth: 4,
    fillColor: "#ffffff",
    imageAssetId: sourceAsset.id,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    shape: "rectangle",
    slant: 0.12,
    imageOpacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  const balloonId = "20000000-0000-4000-8000-000000000002";
  db.saveBalloon({
    id: balloonId,
    pageId: sourcePage.id,
    name: "複製対象吹き出し",
    type: "speech_ellipse",
    x: 700,
    y: 100,
    width: 350,
    height: 250,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 4,
    opacity: 1,
    tailDirection: "bottom_left",
    tailOffset: 0.5,
    createdAt: "",
    updatedAt: "",
  });
  db.saveTextObject({
    id: "20000000-0000-4000-8000-000000000003",
    pageId: sourcePage.id,
    parentBalloonId: balloonId,
    name: "複製対象テキスト",
    text: "複製成功",
    writingMode: "vertical",
    x: 775,
    y: 125,
    width: 200,
    height: 180,
    rotation: 0,
    zIndex: 2,
    visible: true,
    locked: false,
    fontFamily: "sans-serif",
    fontSize: 40,
    fontWeight: 400,
    color: "#000000",
    textAlign: "center",
    verticalAlign: "middle",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding: 8,
    opacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  source = db.setProjectCover(source.project.id, sourceAsset.id);

  const duplicate = db.duplicateProject(source.project.id);
  assert.notEqual(duplicate.project.id, source.project.id);
  assert.notEqual(duplicate.project.storagePath, source.project.storagePath);
  assert.equal(duplicate.project.title, "複製元 のコピー");
  assert.equal(duplicate.assets.length, 1);
  assert.equal(duplicate.pages.length, 1);
  assert.equal(duplicate.panels.length, 1);
  assert.equal(duplicate.panelLayers.length, 1);
  assert.equal(duplicate.balloons.length, 1);
  assert.equal(duplicate.textObjects.length, 1);
  assert.notEqual(duplicate.assets[0].id, sourceAsset.id);
  assert.equal(duplicate.pages[0].imageAssetId, duplicate.assets[0].id);
  assert.equal(duplicate.panels[0].imageAssetId, duplicate.assets[0].id);
  assert.equal(duplicate.panelLayers[0].panelId, duplicate.panels[0].id);
  assert.equal(duplicate.panelLayers[0].assetId, duplicate.assets[0].id);
  assert.equal(duplicate.panelLayers[0].type, "flattened_legacy");
  assert.equal(duplicate.project.coverAssetId, duplicate.assets[0].id);
  assert.equal(
    duplicate.textObjects[0].parentBalloonId,
    duplicate.balloons[0].id,
  );
  assert.equal(duplicate.textObjects[0].text, "複製成功");
  const copiedBytes = fs.readFileSync(
    path.join(duplicate.project.storagePath, duplicate.assets[0].relativePath),
  );
  assert.equal(
    crypto.createHash("sha256").update(copiedBytes).digest("hex"),
    sourceAsset.sha256,
  );

  const exported = await db.exportProject(duplicate.project.id);
  const images = await JSZip.loadAsync(
    fs.readFileSync(path.join(exported.outputDir, "本編画像ZIP.zip")),
  );
  const renderedPage = await images.file("001.png").async("nodebuffer");
  const centerPixel = await sharp(renderedPage)
    .extract({ left: 600, top: 900, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok(centerPixel[0] > 200);
  assert.ok(centerPixel[1] < 50);
  assert.ok(centerPixel[2] < 60);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("project can use a selected custom storage folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-storage-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  const selected = path.join(root, "selected-project");
  const bundle = db.createProject({
    title: "保存先テスト",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1000,
    height: 1500,
    dpi: 300,
    storagePath: selected,
  });
  assert.equal(bundle.project.storagePath, path.resolve(selected));
  assert.equal(fs.existsSync(path.join(selected, "assets")), true);
  assert.throws(
    () =>
      db.createProject({
        title: "重複保存先",
        subtitle: "",
        description: "",
        genre: "",
        ageRating: "全年齢",
        readingDirection: "rtl",
        width: 1000,
        height: 1500,
        dpi: 300,
        storagePath: selected.toUpperCase(),
      }),
    /別のProjectで使用されています/,
  );
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("custom storage deletion falls back to a same-volume trash", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-trash-volume-"));
  const paths = {
    root: path.join(root, "app-data"),
    database: path.join(root, "app-data", "mangai.sqlite"),
    projects: path.join(root, "app-data", "projects"),
    assets: path.join(root, "app-data", "assets"),
    exports: path.join(root, "app-data", "exports"),
    logs: path.join(root, "app-data", "logs"),
  };
  const db = new MangaiDatabase(paths);
  const selected = path.join(root, "external-volume", "custom-project");
  const bundle = db.createProject({
    title: "別ドライブ削除",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1000,
    height: 1500,
    dpi: 300,
    storagePath: selected,
  });
  fs.writeFileSync(path.join(selected, "project-marker.txt"), "preserved");

  const originalRename = fs.renameSync;
  const renameDestinations = [];
  fs.renameSync = (source, destination) => {
    renameDestinations.push(destination);
    if (renameDestinations.length === 1) {
      const error = new Error("cross-device rename");
      error.code = "EXDEV";
      throw error;
    }
    return originalRename(source, destination);
  };
  try {
    db.deleteProject(bundle.project.id);
  } finally {
    fs.renameSync = originalRename;
  }

  const fallbackTrash = path.join(path.dirname(selected), ".mangai-trash");
  const entries = fs.readdirSync(fallbackTrash);
  assert.equal(renameDestinations.length, 2);
  assert.equal(path.dirname(renameDestinations[1]), fallbackTrash);
  assert.equal(entries.length, 1);
  assert.match(entries[0], new RegExp(`^${bundle.project.id}-`));
  assert.equal(
    fs.readFileSync(
      path.join(fallbackTrash, entries[0], "project-marker.txt"),
      "utf8",
    ),
    "preserved",
  );
  assert.equal(fs.existsSync(selected), false);
  assert.equal(db.listProjects().length, 0);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("project metadata remains when cross-volume trash fallback fails", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-trash-failure-"));
  const paths = {
    root: path.join(root, "app-data"),
    database: path.join(root, "app-data", "mangai.sqlite"),
    projects: path.join(root, "app-data", "projects"),
    assets: path.join(root, "app-data", "assets"),
    exports: path.join(root, "app-data", "exports"),
    logs: path.join(root, "app-data", "logs"),
  };
  const db = new MangaiDatabase(paths);
  const selected = path.join(root, "external-volume", "custom-project");
  const bundle = db.createProject({
    title: "退避失敗",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1000,
    height: 1500,
    dpi: 300,
    storagePath: selected,
  });

  const originalRename = fs.renameSync;
  let attempt = 0;
  fs.renameSync = () => {
    const error = new Error("move failed");
    error.code = attempt++ === 0 ? "EXDEV" : "EACCES";
    throw error;
  };
  try {
    assert.throws(() => db.deleteProject(bundle.project.id), /move failed/);
  } finally {
    fs.renameSync = originalRename;
  }

  assert.equal(db.listProjects().length, 1);
  assert.equal(db.openProject(bundle.project.id).project.id, bundle.project.id);
  assert.equal(fs.existsSync(selected), true);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("asset deletion uses project-local trash and supports undo and redo", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-asset-trash-"));
  const paths = {
    root: path.join(root, "app-data"),
    database: path.join(root, "app-data", "mangai.sqlite"),
    projects: path.join(root, "app-data", "projects"),
    assets: path.join(root, "app-data", "assets"),
    exports: path.join(root, "app-data", "exports"),
    logs: path.join(root, "app-data", "logs"),
  };
  let db = new MangaiDatabase(paths);
  const selected = path.join(root, "external-volume", "custom-project");
  let bundle = db.createProject({
    title: "素材ゴミ箱",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1000,
    height: 1500,
    dpi: 300,
    storagePath: selected,
  });
  const image = path.join(root, "source.png");
  await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 20, g: 80, b: 140, alpha: 1 },
    },
  })
    .png()
    .toFile(image);
  bundle = db.importAssets(bundle.project.id, [image]);
  const asset = bundle.assets[0];
  bundle = db.saveAssetLibraryMetadata({
    assetId: asset.id,
    category: "background",
    tags: ["undo対象"],
    favorite: true,
  });
  bundle = db.addPage(bundle.episodes[0].id, asset.id);
  const originalAssetPath = path.join(selected, asset.relativePath);
  bundle = db.captureHistory(
    bundle.project.id,
    "素材を削除",
    () => db.deleteAsset(asset.id),
    { assetIds: [asset.id] },
  );

  const assetTrash = path.join(selected, ".trash");
  const trashedAssets = fs.readdirSync(assetTrash);
  assert.equal(bundle.assets.length, 0);
  assert.equal(fs.existsSync(originalAssetPath), false);
  assert.equal(trashedAssets.length, 1);
  assert.equal(
    fs.statSync(path.join(assetTrash, trashedAssets[0])).size,
    asset.byteSize,
  );
  assert.equal(bundle.pages[0].imageAssetId, null);

  db.close();
  db = new MangaiDatabase(paths);
  bundle = db.undo(bundle.project.id);
  assert.equal(bundle.assets[0].id, asset.id);
  assert.equal(bundle.pages[0].imageAssetId, asset.id);
  assert.equal(bundle.project.coverAssetId, asset.id);
  assert.equal(bundle.assets[0].libraryCategory, "background");
  assert.deepEqual(bundle.assets[0].libraryTags, ["undo対象"]);
  assert.equal(bundle.assets[0].libraryFavorite, true);
  assert.equal(fs.existsSync(originalAssetPath), true);
  assert.equal(fs.readdirSync(assetTrash).length, 0);

  const secondImage = path.join(root, "second.png");
  await sharp({
    create: {
      width: 6,
      height: 6,
      channels: 4,
      background: { r: 180, g: 40, b: 90, alpha: 1 },
    },
  })
    .png()
    .toFile(secondImage);
  bundle = db.importAssets(bundle.project.id, [secondImage]);
  const secondAsset = bundle.assets.find((item) => item.id !== asset.id);
  assert.ok(secondAsset);

  bundle = db.redo(bundle.project.id);
  assert.deepEqual(
    bundle.assets.map((item) => item.id),
    [secondAsset.id],
  );
  assert.equal(bundle.pages[0].imageAssetId, null);
  assert.equal(bundle.project.coverAssetId, null);
  assert.equal(fs.existsSync(originalAssetPath), false);
  assert.equal(fs.readdirSync(assetTrash).length, 1);

  const backupPath = path.join(root, "asset-deletion.mangai-backup");
  await db.backupProject(bundle.project.id, backupPath);
  const restored = await db.restoreProject(backupPath);
  assert.deepEqual(
    restored.assets.map((item) => item.sha256),
    [secondAsset.sha256],
  );
  assert.equal(db.listOperationHistory(restored.project.id).items.length, 0);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("legacy database is backed up before canvas schema migration", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-migration-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const legacy = new Database(paths.database);
  legacy.exec(
    "create table panels(id text primary key,page_id text not null,order_index integer not null,x real not null,y real not null,width real not null,height real not null,image_asset_id text,prompt text not null default '',negative_prompt text not null default '',generation_status text not null default 'idle',metadata text not null default '{}')",
  );
  legacy.close();
  const db = new MangaiDatabase(paths);
  const backups = fs.readdirSync(path.join(root, "backups"));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /before-canvas-v1/);
  db.close();
  const migrated = new Database(paths.database);
  const panelColumns = migrated
    .prepare("pragma table_info(panels)")
    .all()
    .map((column) => column.name);
  assert.equal(panelColumns.includes("image_fit"), true);
  assert.equal(panelColumns.includes("locked"), true);
  assert.equal(panelColumns.includes("shape"), true);
  assert.equal(panelColumns.includes("slant"), true);
  assert.ok(
    migrated
      .prepare("select 1 from schema_migrations where version='canvas-v1'")
      .get(),
  );
  assert.ok(
    migrated.prepare("select 1 from sqlite_master where name='balloons'").get(),
  );
  assert.ok(
    migrated
      .prepare("select 1 from sqlite_master where name='text_objects'")
      .get(),
  );
  const textColumns = migrated
    .prepare("pragma table_info(text_objects)")
    .all()
    .map((column) => column.name);
  assert.equal(textColumns.includes("relative_x"), true);
  assert.equal(textColumns.includes("relative_height"), true);
  assert.ok(
    migrated
      .prepare(
        "select 1 from schema_migrations where version='canvas-relative-text-v1'",
      )
      .get(),
  );
  assert.ok(
    migrated
      .prepare(
        "select 1 from schema_migrations where version='canvas-panel-shape-v1'",
      )
      .get(),
  );
  assert.ok(
    migrated
      .prepare(
        "select 1 from schema_migrations where version='panel-layers-v1'",
      )
      .get(),
  );
  assert.ok(
    migrated
      .prepare("select 1 from sqlite_master where name='panel_layers'")
      .get(),
  );
  migrated
    .prepare(
      "delete from schema_migrations where version='canvas-panel-shape-v1'",
    )
    .run();
  migrated.close();
  const reopened = new MangaiDatabase(paths);
  reopened.close();
  assert.ok(
    fs
      .readdirSync(path.join(root, "backups"))
      .some((file) => file.includes("before-canvas-panel-shape-v1")),
  );
  const beforePanelLayers = new Database(paths.database);
  beforePanelLayers
    .prepare("delete from schema_migrations where version='panel-layers-v1'")
    .run();
  beforePanelLayers.close();
  const panelLayersReopened = new MangaiDatabase(paths);
  panelLayersReopened.close();
  assert.ok(
    fs
      .readdirSync(path.join(root, "backups"))
      .some((file) => file.includes("before-panel-layers-v1")),
  );
  fs.rmSync(root, { recursive: true, force: true });
});
test("page reordering is persisted", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-order-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  let b = db.createProject({
    title: "順番",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "ltr",
    width: 1000,
    height: 1000,
    dpi: 300,
  });
  b = db.addPage(b.episodes[0].id);
  b = db.addPage(b.episodes[0].id);
  const first = b.pages[0].id,
    second = b.pages[1].id;
  b = db.reorderPages(b.episodes[0].id, [second, first]);
  const ordered = [...b.pages].sort((a, c) => a.orderIndex - c.orderIndex);
  assert.deepEqual(
    ordered.map((p) => p.pageNumber),
    [1, 2],
  );
  assert.equal(ordered[0].id, second);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("episode template creates pages and panels as one undoable operation", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-episode-template-"),
  );
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "話テンプレート",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1600,
    height: 2400,
    dpi: 300,
  });
  const projectId = bundle.project.id;
  const episodeId = bundle.episodes[0].id;
  bundle = db.captureHistory(projectId, "話テンプレートを一括追加", () =>
    db.addEpisodeTemplate(episodeId, "short_8"),
  );
  assert.equal(bundle.pages.length, 8);
  assert.equal(bundle.panels.length, 28);
  assert.deepEqual(
    [...bundle.pages]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((page) => page.pageNumber),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(
    db.listOperationHistory(projectId).items[0].label,
    "話テンプレートを一括追加",
  );
  bundle = db.undo(projectId);
  assert.equal(bundle.pages.length, 0);
  assert.equal(bundle.panels.length, 0);
  bundle = db.redo(projectId);
  assert.equal(bundle.pages.length, 8);
  assert.equal(bundle.panels.length, 28);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("operation history supports persistent undo, redo and branch clearing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-history-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "履歴",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1000,
    height: 1500,
    dpi: 300,
  });
  const projectId = bundle.project.id;
  const episodeId = bundle.episodes[0].id;
  bundle = db.captureHistory(projectId, "ページを追加", () =>
    db.addPage(episodeId),
  );
  const pageId = bundle.pages[0].id;
  db.captureHistory(projectId, "ページ内容を編集", () =>
    db.savePage(pageId, "prompt", "negative", "memo"),
  );
  assert.equal(db.listOperationHistory(projectId).items.length, 2);
  assert.equal(db.undo(projectId).pages[0].notes, "");
  db.close();

  db = new MangaiDatabase(paths);
  assert.equal(db.listOperationHistory(projectId).canRedo, true);
  assert.equal(db.undo(projectId).pages.length, 0);
  bundle = db.redo(projectId);
  assert.equal(bundle.pages[0].id, pageId);
  db.captureHistory(projectId, "エピソード名を変更", () =>
    db.renameEpisode(episodeId, "分岐後"),
  );
  assert.equal(db.listOperationHistory(projectId).canRedo, false);
  assert.equal(db.undo(projectId).episodes[0].title, "第1話");
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("canvas objects persist and participate in undo and redo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-canvas-crud-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "Canvas CRUD",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  bundle = db.addPage(bundle.episodes[0].id);
  const projectId = bundle.project.id;
  const pageId = bundle.pages[0].id;
  const panel = {
    id: "00000000-0000-4000-8000-000000000001",
    pageId,
    name: "コマ1",
    x: 20,
    y: 30,
    width: 500,
    height: 700,
    rotation: 0,
    zIndex: 0,
    visible: true,
    locked: false,
    borderColor: "#000000",
    borderWidth: 4,
    fillColor: "#ffffff",
    imageAssetId: null,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    shape: "rectangle",
    slant: 0.12,
    imageOpacity: 1,
    createdAt: "",
    updatedAt: "",
  };
  const balloon = {
    id: "00000000-0000-4000-8000-000000000002",
    pageId,
    name: "吹き出し1",
    type: "speech_ellipse",
    x: 100,
    y: 100,
    width: 360,
    height: 240,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 4,
    opacity: 1,
    tailDirection: "bottom_left",
    tailOffset: 0.5,
    createdAt: "",
    updatedAt: "",
  };
  const textObject = {
    id: "00000000-0000-4000-8000-000000000003",
    pageId,
    parentBalloonId: balloon.id,
    name: "台詞1",
    text: "こんにちは",
    writingMode: "vertical",
    x: 130,
    y: 120,
    width: 280,
    height: 180,
    rotation: 0,
    zIndex: 2,
    visible: true,
    locked: false,
    fontFamily: "sans-serif",
    fontSize: 48,
    fontWeight: 400,
    color: "#000000",
    textAlign: "center",
    verticalAlign: "middle",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding: 16,
    opacity: 1,
    createdAt: "",
    updatedAt: "",
  };
  db.captureHistory(projectId, "Canvasを作成", () => {
    db.savePanel(panel);
    db.saveBalloon(balloon);
    return db.saveTextObject(textObject);
  });
  db.close();

  const stored = new Database(paths.database);
  const relative = stored
    .prepare(
      "select relative_x,relative_y,relative_width,relative_height from text_objects where id=?",
    )
    .get(textObject.id);
  assert.ok(Math.abs(relative.relative_x - 1 / 12) < 1e-9);
  assert.ok(Math.abs(relative.relative_y - 1 / 12) < 1e-9);
  assert.ok(Math.abs(relative.relative_width - 7 / 9) < 1e-9);
  assert.ok(Math.abs(relative.relative_height - 3 / 4) < 1e-9);
  stored
    .prepare(
      "update text_objects set relative_x=null,relative_y=null,relative_width=null,relative_height=null where id=?",
    )
    .run(textObject.id);
  stored
    .prepare(
      "delete from schema_migrations where version='canvas-relative-text-v1'",
    )
    .run();
  stored.close();

  db = new MangaiDatabase(paths);
  bundle = db.openProject(projectId);
  assert.ok(
    fs
      .readdirSync(path.join(root, "backups"))
      .some((file) => /before-canvas-relative-text-v1/.test(file)),
  );
  assert.equal(bundle.panels[0].name, "コマ1");
  assert.equal(bundle.balloons[0].tailDirection, "bottom_left");
  assert.equal(bundle.textObjects[0].writingMode, "vertical");
  bundle = db.saveBalloon({
    ...bundle.balloons[0],
    x: 200,
    y: 300,
    width: 720,
    height: 480,
  });
  assert.deepEqual(
    {
      x: bundle.textObjects[0].x,
      y: bundle.textObjects[0].y,
      width: bundle.textObjects[0].width,
      height: bundle.textObjects[0].height,
    },
    { x: 260, y: 340, width: 560, height: 360 },
  );
  assert.equal(db.undo(projectId).panels.length, 0);
  bundle = db.redo(projectId);
  assert.equal(bundle.balloons.length, 1);
  assert.equal(bundle.textObjects[0].text, "こんにちは");
  bundle = db.captureHistory(projectId, "吹き出しを削除", () =>
    db.deleteCanvasObject("balloon", balloon.id),
  );
  assert.equal(bundle.balloons.length, 0);
  assert.equal(bundle.textObjects.length, 0);
  bundle = db.undo(projectId);
  assert.equal(bundle.balloons.length, 1);
  assert.equal(bundle.textObjects.length, 1);
  bundle = db.captureHistory(projectId, "テンプレートを適用", () =>
    db.saveCanvasBatch({
      pageId,
      panels: [
        { ...panel, id: "00000000-0000-4000-8000-000000000011", name: "左" },
        {
          ...panel,
          id: "00000000-0000-4000-8000-000000000012",
          name: "右",
          x: 540,
        },
      ],
      balloons: [],
      textObjects: [],
      replacePanels: true,
      replaceBalloons: false,
      replaceTextObjects: false,
    }),
  );
  assert.equal(bundle.panels.length, 2);
  assert.equal(
    db.listOperationHistory(projectId).items[0].label,
    "テンプレートを適用",
  );
  bundle = db.undo(projectId);
  assert.equal(bundle.panels.length, 1);
  assert.equal(bundle.panels[0].name, "コマ1");
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("panel layers preserve legacy images and participate in undo, copy and backup", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-panel-layers-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "コマレイヤー",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1000,
    height: 1500,
    dpi: 300,
  });
  const source = path.join(root, "layer.png");
  fs.writeFileSync(
    source,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nzsAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  bundle = db.importAssets(bundle.project.id, [source]);
  bundle = db.addPage(bundle.episodes[0].id);
  const projectId = bundle.project.id;
  const panelId = "30000000-0000-4000-8000-000000000001";
  bundle = db.savePanel({
    id: panelId,
    pageId: bundle.pages[0].id,
    name: "レイヤー対象コマ",
    x: 10,
    y: 20,
    width: 600,
    height: 800,
    rotation: 0,
    zIndex: 0,
    visible: true,
    locked: false,
    borderColor: "#000000",
    borderWidth: 4,
    fillColor: "#ffffff",
    shape: "rectangle",
    slant: 0.12,
    imageAssetId: bundle.assets[0].id,
    imageFit: "manual",
    imageOffsetX: 12,
    imageOffsetY: -4,
    imageScale: 1.2,
    imageRotation: 3,
    imageOpacity: 0.8,
    createdAt: "",
    updatedAt: "",
  });
  assert.equal(bundle.panelLayers.length, 1);
  assert.equal(bundle.panelLayers[0].type, "flattened_legacy");
  assert.equal(bundle.panelLayers[0].assetId, bundle.assets[0].id);
  assert.equal(bundle.panelLayers[0].imageFit, "manual");
  assert.equal(bundle.panelLayers[0].opacity, 0.8);

  db.close();
  const preLayerMigration = new Database(paths.database);
  preLayerMigration.exec(
    "delete from panel_layers; delete from schema_migrations where version='panel-layers-v1'",
  );
  preLayerMigration.close();
  db = new MangaiDatabase(paths);
  bundle = db.openProject(projectId);
  assert.equal(bundle.panelLayers.length, 1);
  assert.equal(bundle.panelLayers[0].type, "flattened_legacy");
  assert.ok(
    fs
      .readdirSync(path.join(root, "backups"))
      .some((file) => file.includes("before-panel-layers-v1")),
  );

  const layers = [
    {
      id: "30000000-0000-4000-8000-000000000002",
      panelId,
      name: "背景",
      type: "background",
      orderIndex: 0,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      assetId: bundle.assets[0].id,
      sourceJobId: null,
      imageFit: "cover",
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      imageRotation: 0,
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      panelId,
      name: "効果",
      type: "effect",
      orderIndex: 1,
      visible: true,
      locked: false,
      opacity: 0.5,
      blendMode: "screen",
      assetId: bundle.assets[0].id,
      sourceJobId: null,
      imageFit: "contain",
      imageOffsetX: 2,
      imageOffsetY: 3,
      imageScale: 1,
      imageRotation: 0,
    },
  ];
  bundle = db.captureHistory(projectId, "コマレイヤーを保存", () =>
    db.savePanelLayers(panelId, layers),
  );
  assert.deepEqual(
    bundle.panelLayers.map((layer) => layer.type),
    ["background", "effect"],
  );
  bundle = db.savePanel({ ...bundle.panels[0], borderWidth: 5 });
  assert.deepEqual(
    bundle.panelLayers.map((layer) => layer.type),
    ["background", "effect"],
  );
  assert.equal(db.undo(projectId).panelLayers[0].type, "flattened_legacy");
  assert.deepEqual(
    db.redo(projectId).panelLayers.map((layer) => layer.type),
    ["background", "effect"],
  );
  db.close();
  db = new MangaiDatabase(paths);
  assert.deepEqual(
    db.openProject(projectId).panelLayers.map((layer) => layer.type),
    ["background", "effect"],
  );
  const duplicate = db.duplicateProject(projectId);
  assert.deepEqual(
    duplicate.panelLayers.map((layer) => layer.type),
    ["background", "effect"],
  );
  assert.equal(duplicate.panelLayers[0].panelId, duplicate.panels[0].id);
  assert.equal(duplicate.panelLayers[0].assetId, duplicate.assets[0].id);
  const backupPath = path.join(root, "panel-layers.mangai-backup");
  await db.backupProject(projectId, backupPath);
  const restored = await db.restoreProject(backupPath);
  assert.deepEqual(
    restored.panelLayers.map((layer) => layer.type),
    ["background", "effect"],
  );
  assert.equal(restored.panelLayers[0].panelId, restored.panels[0].id);
  assert.equal(restored.panelLayers[0].assetId, restored.assets[0].id);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("project backup restores canvas data and verifies asset integrity", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-backup-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "バックアップ確認",
    subtitle: "副題",
    description: "説明",
    genre: "漫画",
    ageRating: "12歳以上",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  const sourceImage = path.join(root, "source.png");
  await sharp({
    create: {
      width: 80,
      height: 120,
      channels: 4,
      background: { r: 25, g: 100, b: 180, alpha: 1 },
    },
  })
    .png()
    .toFile(sourceImage);
  bundle = db.importAssets(bundle.project.id, [sourceImage]);
  const sourceAsset = bundle.assets[0];
  bundle = db.addPage(bundle.episodes[0].id, sourceAsset.id);
  const pageId = bundle.pages[0].id;
  const balloonId = "10000000-0000-4000-8000-000000000002";
  db.savePanel({
    id: "10000000-0000-4000-8000-000000000001",
    pageId,
    name: "復元コマ",
    x: 20,
    y: 30,
    width: 500,
    height: 700,
    rotation: 5,
    zIndex: 0,
    visible: true,
    locked: false,
    borderColor: "#123456",
    borderWidth: 6,
    fillColor: "#ffffff",
    imageAssetId: sourceAsset.id,
    imageFit: "manual",
    imageOffsetX: 12,
    imageOffsetY: -8,
    imageScale: 1.25,
    imageRotation: 3,
    shape: "slant_up",
    slant: 0.18,
    imageOpacity: 0.8,
    createdAt: "",
    updatedAt: "",
  });
  db.saveBalloon({
    id: balloonId,
    pageId,
    name: "復元吹き出し",
    type: "speech_rounded",
    x: 100,
    y: 100,
    width: 360,
    height: 240,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 4,
    opacity: 1,
    tailDirection: "bottom_left",
    tailOffset: 0.5,
    createdAt: "",
    updatedAt: "",
  });
  db.saveTextObject({
    id: "10000000-0000-4000-8000-000000000003",
    pageId,
    parentBalloonId: balloonId,
    name: "復元テキスト",
    text: "バックアップ",
    writingMode: "vertical",
    x: 130,
    y: 120,
    width: 280,
    height: 180,
    rotation: 0,
    zIndex: 2,
    visible: true,
    locked: false,
    fontFamily: "sans-serif",
    fontSize: 48,
    fontWeight: 400,
    color: "#000000",
    textAlign: "center",
    verticalAlign: "middle",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding: 16,
    opacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  bundle = db.setProjectCover(bundle.project.id, sourceAsset.id);

  const backupPath = path.join(root, "project.mangai-backup");
  const backup = await db.backupProject(bundle.project.id, backupPath);
  assert.equal(backup.filePath, backupPath);
  assert.ok(backup.byteSize > 0);
  const archive = await JSZip.loadAsync(fs.readFileSync(backupPath));
  assert.ok(archive.file("manifest.json"));
  assert.ok(archive.file(`assets/${sourceAsset.id}`));
  const manifest = JSON.parse(
    await archive.file("manifest.json").async("string"),
  );
  assert.equal(manifest.bundle.project.storagePath, "");

  const restored = await db.restoreProject(backupPath);
  assert.notEqual(restored.project.id, bundle.project.id);
  assert.equal(restored.project.title, "バックアップ確認 (復元)");
  assert.equal(restored.project.subtitle, "副題");
  assert.equal(restored.assets.length, 1);
  assert.equal(restored.pages.length, 1);
  assert.equal(restored.panels[0].name, "復元コマ");
  assert.equal(restored.panels[0].imageAssetId, restored.assets[0].id);
  assert.equal(restored.panelLayers.length, 1);
  assert.equal(restored.panelLayers[0].panelId, restored.panels[0].id);
  assert.equal(restored.panelLayers[0].assetId, restored.assets[0].id);
  assert.equal(restored.panelLayers[0].type, "flattened_legacy");
  assert.equal(restored.panels[0].shape, "slant_up");
  assert.equal(restored.panels[0].slant, 0.18);
  assert.equal(restored.pages[0].imageAssetId, restored.assets[0].id);
  assert.equal(restored.balloons[0].name, "復元吹き出し");
  assert.equal(
    restored.textObjects[0].parentBalloonId,
    restored.balloons[0].id,
  );
  assert.equal(restored.textObjects[0].text, "バックアップ");
  assert.equal(restored.project.coverAssetId, restored.assets[0].id);
  const restoredBytes = fs.readFileSync(
    path.join(restored.project.storagePath, restored.assets[0].relativePath),
  );
  assert.equal(
    crypto.createHash("sha256").update(restoredBytes).digest("hex"),
    sourceAsset.sha256,
  );

  archive.file(`assets/${sourceAsset.id}`, Buffer.from("broken"));
  const corruptPath = path.join(root, "corrupt.mangai-backup");
  fs.writeFileSync(
    corruptPath,
    await archive.generateAsync({ type: "nodebuffer" }),
  );
  const projectCount = db.listProjects().length;
  await assert.rejects(() => db.restoreProject(corruptPath), /破損/);
  assert.equal(db.listProjects().length, projectCount);

  const invalidReferenceArchive = await JSZip.loadAsync(
    fs.readFileSync(backupPath),
  );
  manifest.bundle.pages[0].imageAssetId =
    "ffffffff-ffff-4fff-8fff-ffffffffffff";
  invalidReferenceArchive.file("manifest.json", JSON.stringify(manifest));
  const invalidReferencePath = path.join(
    root,
    "invalid-reference.mangai-backup",
  );
  fs.writeFileSync(
    invalidReferencePath,
    await invalidReferenceArchive.generateAsync({ type: "nodebuffer" }),
  );
  await assert.rejects(
    () => db.restoreProject(invalidReferencePath),
    /ページ素材の参照が不正/,
  );
  assert.equal(db.listProjects().length, projectCount);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("version 2 backup restores undo, chat and generation history", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-full-backup-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "履歴バックアップ",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  bundle = db.addPage(bundle.episodes[0].id);
  db.captureHistory(bundle.project.id, "タイトルを変更", () =>
    db.renameProject(bundle.project.id, "変更後タイトル"),
  );
  bundle = db.undo(bundle.project.id);
  assert.equal(bundle.project.title, "履歴バックアップ");
  assert.equal(db.listOperationHistory(bundle.project.id).canRedo, true);

  const sessionId = db.createChatSession(bundle.project.id, "復元する会話");
  db.addChatMessage(sessionId, "user", "構成案を考えて");
  db.addChatMessage(
    sessionId,
    "assistant",
    "3幕構成を提案します",
    "ollama",
    "test-model",
  );

  const jobId = db.createGenerationJob({
    projectId: bundle.project.id,
    episodeId: bundle.episodes[0].id,
    pageId: bundle.pages[0].id,
    providerType: "image",
    providerId: "comfyui",
    generationType: "image",
    prompt: "manga page",
    inputJson: { width: 1200, height: 1800 },
  });
  db.updateGenerationJob(jobId, "completed", {
    output: { images: 1 },
    progress: 1,
  });
  const promptSha256 = crypto
    .createHash("sha256")
    .update("manga page", "utf8")
    .digest("hex");
  db.createGenerationRouteDecision({
    jobId,
    projectId: bundle.project.id,
    draft: {
      projectId: bundle.project.id,
      pageId: bundle.pages[0].id,
      type: "adult_character_render",
      sensitivity: "external_forbidden",
      personPresence: "unknown",
    },
    context: {
      policy: "safe_assets_only",
      availableTargets: ["builtin", "local"],
      preferLocal: true,
    },
    decision: {
      target: "local",
      reason: "sensitive_local_only",
      requiresUserConfirmation: false,
      blocked: false,
    },
    promptSha256,
  });
  const generatedDirectory = path.join(bundle.project.storagePath, "generated");
  fs.mkdirSync(generatedDirectory, { recursive: true });
  const generatedPath = path.join(generatedDirectory, "history.png");
  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 100, g: 40, b: 180, alpha: 1 },
    },
  })
    .png()
    .toFile(generatedPath);
  db.registerGeneratedAsset(
    bundle.project.id,
    path.join("generated", "history.png"),
    jobId,
    { prompt: "manga page", provider: "comfyui" },
  );

  const backupPath = path.join(root, "full.mangai-backup");
  await db.backupProject(bundle.project.id, backupPath);
  const archive = await JSZip.loadAsync(fs.readFileSync(backupPath));
  const manifest = JSON.parse(
    await archive.file("manifest.json").async("string"),
  );
  assert.equal(manifest.version, 2);
  assert.equal(manifest.history.operations.length, 1);
  assert.equal(manifest.history.chatMessages.length, 2);
  assert.equal(manifest.history.generationJobs.length, 1);
  assert.equal(manifest.history.generationOutputs.length, 1);
  assert.equal(manifest.history.routeDecisions.length, 1);

  const restored = await db.restoreProject(backupPath);
  assert.equal(restored.project.title, "履歴バックアップ (復元)");
  assert.equal(db.listOperationHistory(restored.project.id).canRedo, true);
  const redone = db.redo(restored.project.id);
  assert.equal(redone.project.title, "変更後タイトル");
  assert.equal(db.undo(restored.project.id).project.title, "履歴バックアップ");

  const sessions = db.listChatSessions(restored.project.id);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].title, "復元する会話");
  const messages = db.listChatMessages(sessions[0].id);
  assert.deepEqual(
    messages.map((message) => message.content),
    ["構成案を考えて", "3幕構成を提案します"],
  );
  const jobs = db.listGenerationJobs(restored.project.id);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "completed");
  assert.equal(jobs[0].episodeId, restored.episodes[0].id);
  assert.equal(jobs[0].pageId, restored.pages[0].id);
  const routes = db.listGenerationRouteDecisions(restored.project.id);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].jobId, jobs[0].id);
  assert.equal(routes[0].draft.projectId, restored.project.id);
  assert.equal(routes[0].draft.pageId, restored.pages[0].id);
  assert.equal(routes[0].decision.target, "local");
  assert.equal(routes[0].promptSha256, promptSha256);
  const inspect = new Database(paths.database, { readonly: true });
  const output = inspect
    .prepare(
      "select o.job_id as jobId,o.asset_id as assetId,a.generation_job_id as assetJobId from generation_outputs o join assets a on a.id=o.asset_id where a.project_id=?",
    )
    .get(restored.project.id);
  assert.equal(output.jobId, jobs[0].id);
  assert.equal(output.assetId, restored.assets[0].id);
  assert.equal(output.assetJobId, jobs[0].id);
  inspect.close();

  delete manifest.history;
  manifest.version = 1;
  archive.file("manifest.json", JSON.stringify(manifest));
  const legacyPath = path.join(root, "legacy-v1.mangai-backup");
  fs.writeFileSync(
    legacyPath,
    await archive.generateAsync({ type: "nodebuffer" }),
  );
  const legacyRestored = await db.restoreProject(legacyPath);
  assert.equal(db.listChatSessions(legacyRestored.project.id).length, 0);
  assert.equal(db.listGenerationJobs(legacyRestored.project.id).length, 0);
  assert.equal(
    db.listGenerationRouteDecisions(legacyRestored.project.id).length,
    0,
  );
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("automatic project backup skips unchanged data and keeps limited generations", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-auto-backup-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  const project = db.createProject({
    title: "自動バックアップ",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  }).project;
  const startedAt = Date.now();
  const first = await db.autoBackupProjects({
    nowMs: startedAt,
    minimumIntervalMs: 60_000,
    retention: 2,
  });
  assert.equal(first.created.length, 1);
  assert.equal(first.errors.length, 0);

  const unchanged = await db.autoBackupProjects({
    nowMs: startedAt + 61_000,
    minimumIntervalMs: 60_000,
    retention: 2,
  });
  assert.equal(unchanged.created.length, 0);
  assert.equal(unchanged.skipped[0].reason, "unchanged");

  db.renameProject(project.id, "変更1");
  const rateLimited = await db.autoBackupProjects({
    nowMs: startedAt + 1_000,
    minimumIntervalMs: 60_000,
    retention: 2,
  });
  assert.equal(rateLimited.skipped[0].reason, "interval");
  const second = await db.autoBackupProjects({
    nowMs: startedAt + 62_000,
    minimumIntervalMs: 60_000,
    retention: 2,
  });
  assert.equal(second.created.length, 1);

  const directory = path.join(root, "backups", "automatic", project.id);
  fs.writeFileSync(path.join(directory, "interrupted.partial"), "partial");
  db.renameProject(project.id, "変更2");
  const third = await db.autoBackupProjects({
    nowMs: startedAt + 123_000,
    minimumIntervalMs: 60_000,
    retention: 2,
  });
  assert.equal(third.created.length, 1);
  assert.equal(third.errors.length, 0);
  const files = fs.readdirSync(directory);
  assert.equal(
    files.filter((name) => name.endsWith(".mangai-backup")).length,
    2,
  );
  assert.equal(
    files.some((name) => name.endsWith(".partial")),
    false,
  );
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("corrupt database is preserved and rebuilt from automatic project backups", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-recovery-auto-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  db.createProject({
    title: "破損復旧Project",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  const backup = await db.autoBackupProjects({ minimumIntervalMs: 60_000 });
  assert.equal(backup.created.length, 1);
  db.close();
  const corruptBytes = Buffer.from("this is not sqlite");
  fs.writeFileSync(paths.database, corruptBytes);

  const opened = await openDatabaseWithRecovery(paths);
  db = opened.database;
  assert.ok(opened.recovery);
  assert.equal(opened.recovery.source, "project-backups");
  assert.deepEqual(opened.recovery.restoredProjects, ["破損復旧Project"]);
  assert.equal(db.listProjects()[0].title, "破損復旧Project");
  const archived = path.join(
    opened.recovery.archiveDirectory,
    path.basename(paths.database),
  );
  assert.deepEqual(fs.readFileSync(archived), corruptBytes);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("corrupt database falls back to a valid migration backup", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-recovery-db-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  let db = new MangaiDatabase(paths);
  db.createProject({
    title: "SQLiteバックアップ復旧",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  db.close();
  const backupDirectory = path.join(root, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  fs.copyFileSync(
    paths.database,
    path.join(backupDirectory, "mangai_local-before-test.sqlite"),
  );
  fs.writeFileSync(paths.database, "broken");

  const opened = await openDatabaseWithRecovery(paths);
  db = opened.database;
  assert.equal(opened.recovery?.source, "sqlite-backup");
  assert.equal(db.listProjects()[0].title, "SQLiteバックアップ復旧");
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("RC multi-page export creates consistent release artifacts", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-export-"));
  const paths = {
    root,
    database: path.join(root, "mangai.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  let bundle = db.createProject({
    title: "書き出しテスト",
    subtitle: "",
    description: "",
    genre: "漫画",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1200,
    height: 1800,
    dpi: 300,
  });
  const sourceImage = path.join(root, "page.png");
  fs.writeFileSync(
    sourceImage,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nzsAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const webpImage = path.join(root, "page.webp");
  await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 20, g: 80, b: 180, alpha: 1 },
    },
  })
    .webp()
    .toFile(webpImage);
  bundle = db.importAssets(bundle.project.id, [sourceImage, webpImage]);
  const pngAsset = bundle.assets.find(
    (asset) => asset.mimeType === "image/png",
  );
  const webpAsset = bundle.assets.find(
    (asset) => asset.mimeType === "image/webp",
  );
  assert.ok(pngAsset);
  assert.ok(webpAsset);
  bundle = db.addPage(bundle.episodes[0].id, pngAsset.id);
  bundle = db.addPage(bundle.episodes[0].id, webpAsset.id);
  bundle = db.addPage(bundle.episodes[0].id);
  const pageId = bundle.pages[0].id;
  db.savePanel({
    id: "00000000-0000-4000-8000-000000000021",
    pageId,
    name: "書き出しコマ",
    x: 100,
    y: 100,
    width: 500,
    height: 600,
    rotation: 5,
    zIndex: 0,
    visible: true,
    locked: false,
    borderColor: "#000000",
    borderWidth: 6,
    fillColor: "#ffffff",
    imageAssetId: pngAsset.id,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    shape: "curve_right",
    slant: 0.2,
    imageOpacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  db.saveBalloon({
    id: "00000000-0000-4000-8000-000000000022",
    pageId,
    name: "書き出し吹き出し",
    type: "speech_ellipse",
    x: 650,
    y: 100,
    width: 400,
    height: 250,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 4,
    opacity: 1,
    tailDirection: "bottom_left",
    tailOffset: 0.5,
    createdAt: "",
    updatedAt: "",
  });
  db.saveTextObject({
    id: "00000000-0000-4000-8000-000000000023",
    pageId,
    parentBalloonId: "00000000-0000-4000-8000-000000000022",
    name: "書き出し台詞",
    text: "縦書き。",
    writingMode: "vertical",
    x: 730,
    y: 130,
    width: 200,
    height: 180,
    rotation: 0,
    zIndex: 2,
    visible: true,
    locked: false,
    fontFamily: "sans-serif",
    fontSize: 40,
    fontWeight: 400,
    color: "#000000",
    textAlign: "center",
    verticalAlign: "middle",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding: 8,
    opacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  db.savePanel({
    id: "00000000-0000-4000-8000-000000000024",
    pageId: bundle.pages[2].id,
    name: "非表示レイヤー",
    x: 0,
    y: 0,
    width: 1200,
    height: 1800,
    rotation: 0,
    zIndex: 0,
    visible: false,
    locked: false,
    borderColor: "#ff0000",
    borderWidth: 0,
    fillColor: "#ff0000",
    imageAssetId: null,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    shape: "rectangle",
    slant: 0.12,
    imageOpacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  const progress = [];
  const result = await db.exportProject(bundle.project.id, {
    onProgress: (value) => progress.push(value),
  });
  assert.deepEqual(result.files, [
    "本編PDF.pdf",
    "本編画像ZIP.zip",
    "作品情報.json",
    "販売用説明文.txt",
    "SNS告知文.txt",
    "MANGAI販売パッケージ.zip",
  ]);
  result.files.forEach((file) =>
    assert.equal(fs.existsSync(path.join(result.outputDir, file)), true),
  );
  assert.equal(
    fs
      .readFileSync(path.join(result.outputDir, "本編PDF.pdf"), "utf8")
      .slice(0, 4),
    "%PDF",
  );
  assert.deepEqual(result.warnings, []);
  const exportHistory = db.listExportHistory(bundle.project.id);
  assert.equal(exportHistory.length, 1);
  assert.equal(exportHistory[0].outputDir, result.outputDir);
  assert.deepEqual(exportHistory[0].files, result.files);
  assert.deepEqual(exportHistory[0].warnings, []);
  const salesPackage = await JSZip.loadAsync(
    fs.readFileSync(path.join(result.outputDir, "MANGAI販売パッケージ.zip")),
  );
  const salesManifest = JSON.parse(
    await salesPackage.file("manifest.json").async("string"),
  );
  assert.equal(salesManifest.format, "mangai.sales-package");
  assert.equal(salesManifest.version, 1);
  assert.equal(salesManifest.work.sourceProjectId, bundle.project.id);
  assert.equal(salesManifest.work.pageCount, 3);
  assert.equal(parseSalesPackageManifest(salesManifest).version, 1);
  assert.throws(
    () =>
      parseSalesPackageManifest({
        ...salesManifest,
        files: [{ ...salesManifest.files[0], path: "../unsafe.pdf" }],
      }),
    /ファイル情報が不正/,
  );
  assert.throws(
    () => parseSalesPackageManifest({ ...salesManifest, version: 2 }),
    /対応していない/,
  );
  assert.deepEqual(
    [...new Set(salesManifest.files.map((file) => file.role))].sort(),
    [
      "cover",
      "description",
      "page_images_zip",
      "product_pdf",
      "project_info",
      "sample",
      "social_post",
    ],
  );
  for (const file of salesManifest.files) {
    const entry = salesPackage.file(file.path);
    assert.ok(entry, `販売パッケージに${file.path}がありません。`);
    const bytes = await entry.async("nodebuffer");
    assert.equal(bytes.byteLength, file.byteSize);
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      file.sha256,
    );
  }
  const salesFileByRole = (role) => {
    const file = salesManifest.files.find(
      (candidate) => candidate.role === role,
    );
    assert.ok(file, `販売パッケージに${role}がありません。`);
    return salesPackage.file(file.path);
  };
  assert.deepEqual(
    await salesFileByRole("product_pdf").async("nodebuffer"),
    fs.readFileSync(path.join(result.outputDir, "本編PDF.pdf")),
  );
  assert.deepEqual(
    await salesFileByRole("page_images_zip").async("nodebuffer"),
    fs.readFileSync(path.join(result.outputDir, "本編画像ZIP.zip")),
  );
  assert.deepEqual(
    await salesFileByRole("cover").async("nodebuffer"),
    fs.readFileSync(sourceImage),
  );
  const packagedProjectInfo = JSON.parse(
    await salesFileByRole("project_info").async("string"),
  );
  assert.equal(packagedProjectInfo.sourceProjectId, bundle.project.id);
  assert.equal(packagedProjectInfo.pageCount, 3);
  assert.equal(packagedProjectInfo.width, 1200);
  assert.equal(packagedProjectInfo.height, 1800);
  assert.equal(packagedProjectInfo.dpi, 300);
  const zip = await JSZip.loadAsync(
    fs.readFileSync(path.join(result.outputDir, "本編画像ZIP.zip")),
  );
  assert.deepEqual(Object.keys(zip.files), ["001.png", "002.png", "003.png"]);
  const firstPng = await zip.file("001.png").async("uint8array");
  assert.deepEqual(imageSize(firstPng), {
    width: 1200,
    height: 1800,
    type: "png",
  });
  const secondPng = await zip.file("002.png").async("uint8array");
  const secondPixel = await sharp(secondPng)
    .extract({ left: 600, top: 900, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok(Math.abs(secondPixel[0] - 20) <= 3);
  assert.ok(Math.abs(secondPixel[1] - 80) <= 3);
  assert.ok(Math.abs(secondPixel[2] - 180) <= 3);
  const thirdPng = await zip.file("003.png").async("uint8array");
  const pixel = await sharp(thirdPng).raw().toBuffer();
  assert.deepEqual([...pixel.subarray(0, 3)], [255, 255, 255]);
  const samples = salesManifest.files
    .filter((file) => file.role === "sample")
    .sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(samples.length, 3);
  for (let index = 0; index < samples.length; index++) {
    assert.deepEqual(
      await salesPackage.file(samples[index].path).async("nodebuffer"),
      await zip
        .file(`${String(index + 1).padStart(3, "0")}.png`)
        .async("nodebuffer"),
    );
  }
  const pdf = await PDFDocument.load(
    fs.readFileSync(path.join(result.outputDir, "本編PDF.pdf")),
  );
  assert.equal(pdf.getPageCount(), 3);
  assert.equal(Math.round(pdf.getPage(0).getWidth()), 288);
  assert.equal(Math.round(pdf.getPage(0).getHeight()), 432);
  assert.equal(progress[0].status, "rendering");
  assert.equal(progress.at(-1).status, "complete");
  assert.equal(progress.at(-1).percent, 100);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => db.exportProject(bundle.project.id, { signal: controller.signal }),
    /キャンセル/,
  );
  const retry = await db.exportProject(bundle.project.id);
  assert.notEqual(retry.outputDir, result.outputDir);
  const retryPdf = await PDFDocument.load(
    fs.readFileSync(path.join(retry.outputDir, "本編PDF.pdf")),
  );
  assert.equal(retryPdf.getPageCount(), 3);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
