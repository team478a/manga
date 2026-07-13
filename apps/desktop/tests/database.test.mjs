import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Buffer } from "node:buffer";
import { MangaiDatabase } from "../dist-main/main/database.js";
import Database from "better-sqlite3";
import sharp from "sharp";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { imageSize } from "image-size";

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
  const db = new MangaiDatabase(paths);
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
  migrated.close();
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

test("project export creates PDF, ZIP, manifest and sales text", async () => {
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
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
