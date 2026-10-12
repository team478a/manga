import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import type { BrowserWindow } from "electron";
import type { MangaiDatabase } from "../database.js";
import { renderPagePng } from "../page-renderer.js";
import { createMangaVisualFixture } from "./manga-visual-fixture.js";
import { dialogueRectInside, dialogueInnerRegion, dialogueInkFitsTextBox } from "@mangai/canvas-core";

export function seedMangaVisualFixture(store: MangaiDatabase, output: string) {
  let bundle = store.createProject({ title: "C3d FIXTURE - NOT AI ART", subtitle: "", description: "Synthetic visual acceptance only", genre: "", ageRating: "全年齢", readingDirection: "rtl", width: 1600, height: 2400, dpi: 300, adultProjectAcknowledged: false });
  const projectId = bundle.project.id;
  const fixture = createMangaVisualFixture();
  for (let index = 1; index <= 16; index += 1) bundle = store.importAssets(projectId, [path.join(output, `fixture-${index}.png`)]);
  for (const canvas of fixture) {
    bundle = store.addPage(bundle.episodes[0].id);
    const pageId = bundle.pages[bundle.pages.length - 1].id;
    const rewritePage = <T extends { pageId: string }>(item: T) => ({ ...item, pageId });
    bundle = store.saveCanvasBatch({ pageId, panels: canvas.panels.map((panel, slot) => ({ ...rewritePage(panel), imageAssetId: bundle.assets.find(asset => asset.fileName === `fixture-${(fixture.indexOf(canvas) * 4) + slot + 1}.png`)!.id })), balloons: canvas.balloons.map(rewritePage), textObjects: canvas.textObjects.map(rewritePage), replacePanels: false, replaceBalloons: false, replaceTextObjects: false });
  }
  // Deliberately unsafe old manuscript geometry, repaired only by real UI click.
  bundle = store.saveTextObject({ ...bundle.textObjects[0], x: bundle.textObjects[0].x + 500 });
  return { projectId, textId: bundle.textObjects[0].id };
}

export async function inspectMangaVisualFixture(win: BrowserWindow, store: MangaiDatabase, output: string, pdfOutput: string, projectId: string, textId: string) {
  win.setContentSize(1920, 2100);
  const wait = async (expression: string) => {
    const result = await win.webContents.executeJavaScript(`new Promise(resolve => {
      const deadline = performance.now() + 15000;
      function observe() { if (${expression}) return resolve(true); if (performance.now() > deadline) return resolve(false); requestAnimationFrame(observe); }
      observe();
    })`);
    assert.equal(result, true, "renderer readiness failed");
  };
  const click = (expression: string) => win.webContents.executeJavaScript(`(() => { const node = ${expression}; if (!node) throw new Error('fixture control not found'); node.click(); })()`);
  const capture = async (name: string) => {
    await win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    fs.writeFileSync(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG());
  };
  const imagePainted = `Array.from(document.querySelectorAll('canvas')).some(canvas => {
    const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return false; let count = 0;
    for (let index = 0; index < pixels.length; index += 64) {
      if (Math.abs(pixels[index]-216)<2 && Math.abs(pixels[index+1]-232)<2 && Math.abs(pixels[index+2]-244)<2) count++;
    }
    return count > 100;
  })`;
  await wait("document.querySelector('.home-project-card-open')");
  await click("document.querySelector('.home-project-card-open')");
  await wait("document.querySelector('.canvas-layer-row')");
  await wait(imagePainted);
  await click("Array.from(document.querySelectorAll('.canvas-layer-row button')).find(node => node.textContent.trim() === 'TFixture text 1')");
  await wait("Array.from(document.querySelectorAll('button')).some(node => node.textContent.trim() === '吹き出し内へ文字を修復')");
  await capture("desktop-before-repair");
  await click("Array.from(document.querySelectorAll('button')).find(node => node.textContent.trim() === '吹き出し内へ文字を修復')");
  await wait("!document.querySelector('.canvas-warning')");
  const repaired = store.openProject(projectId).textObjects.find(item => item.id === textId)!;
  const parent = store.openProject(projectId).balloons.find(item => item.id === repaired.parentBalloonId)!;
  assert.ok(dialogueRectInside({ x: 0, y: 0, width: repaired.width, height: repaired.height }, repaired, dialogueInnerRegion(parent)) && dialogueInkFitsTextBox(repaired));
  await capture("desktop-after-repair");
  await new Promise<void>(resolve => { win.webContents.once("did-finish-load", () => resolve()); win.webContents.reload(); });
  await wait("document.querySelector('.home-project-card-open') || document.querySelector('.canvas-layer-row')");
  await win.webContents.executeJavaScript("document.querySelector('.home-project-card-open')?.click()");
  await wait("document.querySelector('.canvas-layer-row')");
  await wait(imagePainted);
  await capture("desktop-after-reload");
  const bundle = store.openProject(projectId);
  assert.equal(bundle.pages.length, 4);
  assert.equal(bundle.panels.length, 16);
  assert.equal(bundle.textObjects.find(item => item.id === textId)!.x, repaired.x);
  const assets = new Map(bundle.assets.map(asset => [asset.id, { ...asset, bytes: fs.readFileSync(path.join(bundle.project.storagePath, asset.relativePath)) }]));
  for (const [index, page] of bundle.pages.entries()) {
    const bytes = await renderPagePng({ page, panels: bundle.panels.filter(item => item.pageId === page.id), balloons: bundle.balloons.filter(item => item.pageId === page.id), textObjects: bundle.textObjects.filter(item => item.pageId === page.id), panelLayers: [], assets });
    fs.writeFileSync(path.join(output, `desktop-${index + 1}.png`), bytes);
    const desktopPixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
    const cloudPixels = await sharp(path.join(output, `cloud-${index + 1}.png`)).ensureAlpha().raw().toBuffer();
    assert.ok(desktopPixels.equals(cloudPixels), "Cloud/Desktop decoded fixture pixels must match");
  }
  const exported = await store.exportProject(projectId);
  fs.copyFileSync(path.join(exported.outputDir, exported.files[0]), pdfOutput);
  assert.equal((await PDFDocument.load(fs.readFileSync(pdfOutput))).getPageCount(), 4);
  fs.writeFileSync(path.join(output, "desktop-checks.json"), JSON.stringify({ fixtureOnly: true, pageCount: 4, panelCount: 16, realUiRepair: true, reload: true, geometry: true, screenshotCount: 3, visualReview: "PENDING", paidGenerationCount: 0 }, null, 2));
}
