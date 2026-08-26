import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import {
  createImagesZip,
  createPagesPdf,
  createProjectManifest,
} from "../packages/export-core/src/index.ts";
import { createJpegExport } from "../packages/export-core/src/jpeg.ts";
import {
  createCompletionModeProfile,
  resolveCompletionModeProfile,
} from "../packages/shared/src/index.ts";
import { p4CompletionExportProjects } from "./fixtures/p4-completion-export-projects.mjs";

async function renderPages(fixture) {
  const ordered = [...fixture.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  return Promise.all(ordered.map(async (page) => ({
    fileName: `${String(page.pageNumber).padStart(3, "0")}.png`,
    bytes: new Uint8Array(await sharp({
      create: { width: page.width, height: page.height, channels: 4, background: page.backgroundColor },
    }).png().toBuffer()),
    mimeType: "image/png",
    width: page.width,
    height: page.height,
  })));
}

test("P4-F固定3作品はmode profileと保存再読込後の文字レイヤーを維持する", () => {
  const fixtures = p4CompletionExportProjects();
  assert.deepEqual(fixtures.map((item) => item.project.completionModeProfile.mode), [
    "longform_story", "kindle_explainer", "adult_local",
  ]);
  for (const fixture of fixtures) {
    const saved = JSON.stringify(fixture);
    const reloaded = JSON.parse(saved);
    assert.deepEqual(reloaded, fixture);
    assert.deepEqual(
      resolveCompletionModeProfile(reloaded.project.completionModeProfile),
      fixture.project.completionModeProfile,
    );
    assert.deepEqual(
      reloaded.pages.map((page) => page.canvas.textObjects[0].text),
      fixture.pages.map((page) => page.canvas.textObjects[0].text),
    );
  }
});

test("3 modeは実寸・ページ順をPNG／JPEG／PDF／Project JSONで追跡する", async () => {
  for (const fixture of p4CompletionExportProjects()) {
    const images = await renderPages(fixture);
    assert.deepEqual(images.map((image) => image.fileName), ["001.png", "002.png"]);
    for (const image of images) {
      const metadata = await sharp(image.bytes).metadata();
      assert.equal(metadata.width, fixture.project.width);
      assert.equal(metadata.height, fixture.project.height);
    }

    if (fixture.project.completionModeProfile.allowedExports.includes("png")) {
      const zip = await JSZip.loadAsync(await createImagesZip(images));
      assert.deepEqual(Object.keys(zip.files).sort(), ["001.png", "002.png"]);
    } else {
      assert.equal(fixture.project.completionModeProfile.mode, "kindle_explainer");
    }

    const jpeg = await createJpegExport(images);
    assert.deepEqual(jpeg.images.map((image) => image.fileName), ["001.jpg", "002.jpg"]);
    assert.ok(jpeg.manifest.files.every((file) =>
      file.mimeType === "image/jpeg" &&
      file.width === fixture.project.width &&
      file.height === fixture.project.height,
    ));

    const pdf = await PDFDocument.load(await createPagesPdf(images, { dpi: fixture.project.dpi }));
    assert.equal(pdf.getPageCount(), 2);
    assert.equal(Math.round(pdf.getPage(0).getWidth() * fixture.project.dpi / 72), fixture.project.width);
    assert.equal(Math.round(pdf.getPage(0).getHeight() * fixture.project.dpi / 72), fixture.project.height);

    const exportDocument = {
      ...fixture,
      pages: [...fixture.pages].sort((a, b) => a.pageNumber - b.pageNumber),
    };
    const projectBytes = createProjectManifest(exportDocument);
    const projectJson = JSON.parse(new TextDecoder().decode(projectBytes));
    assert.deepEqual(projectJson.pages.map((page) => page.pageNumber), [1, 2]);
    assert.equal(projectJson.project.completionModeProfile.mode, fixture.project.completionModeProfile.mode);
    assert.deepEqual(projectJson.pages.map((page) => page.canvas.textObjects[0].text), exportDocument.pages.map((page) => page.canvas.textObjects[0].text));
  }
});

test("mode別の許可形式と成人向けCloud拒否をfail closedで維持する", () => {
  const [longform, kindle, adult] = p4CompletionExportProjects();
  assert.deepEqual(longform.project.completionModeProfile.allowedExports, ["png", "jpeg", "pdf", "project_json"]);
  assert.deepEqual(kindle.project.completionModeProfile.allowedExports, ["jpeg", "pdf", "project_json"]);
  assert.deepEqual(adult.project.completionModeProfile.allowedExports, ["png", "jpeg", "pdf", "project_json"]);
  assert.throws(() => createCompletionModeProfile("adult_local", "cloud_general"));

  const migration = fs.readFileSync("supabase/migrations/202608260001_cloud_completion_mode_profiles.sql", "utf8");
  assert.match(migration, /mode' in \('longform_story','kindle_explainer'\)/);
  assert.match(migration, /executionSurface' = 'cloud_general'/);
  assert.doesNotMatch(migration, /mode' in \([^)]*adult_local/);
});

test("Cloud作成・exportは認証owner境界と成人向け除外をDBで維持する", () => {
  const modeMigration = fs.readFileSync("supabase/migrations/202608260001_cloud_completion_mode_profiles.sql", "utf8");
  const exportMigration = fs.readFileSync("supabase/migrations/202608010006_cloud_durable_export.sql", "utf8");
  const service = fs.readFileSync("src/modules/cloud-creator/export/durable-export-service.ts", "utf8");
  assert.match(modeMigration, /v_profile_id uuid := public\.current_profile_id\(\)/);
  assert.match(modeMigration, /insert into public\.cloud_projects\(id,owner_profile_id,source_surface,content_class/);
  assert.match(modeMigration, /values\(project_id,v_profile_id,'cloud','general'/);
  assert.match(exportMigration, /created_by_profile_id=public\.current_profile_id\(\)/);
  assert.match(service, /\.eq\("created_by_profile_id", profile\.id\)/);
});
