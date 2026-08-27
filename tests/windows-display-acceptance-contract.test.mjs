import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("Desktop display acceptance runs isolated 150% and forced-color variants", async () => {
  const [rootPackage, desktopPackage, runner, main] = await Promise.all([
    read("package.json"),
    read("apps/desktop/package.json"),
    read("apps/desktop/scripts/test-accessibility.mjs"),
    read("apps/desktop/src/main/index.ts"),
  ]);

  assert.match(rootPackage, /desktop:test:display-acceptance/);
  assert.match(desktopPackage, /MANGAI_A11Y_VARIANT=scale-150/);
  assert.match(desktopPackage, /MANGAI_A11Y_VARIANT=high-contrast/);
  assert.match(runner, /--force-device-scale-factor=1\.5/);
  assert.match(runner, /--force-high-contrast/);
  assert.match(main, /devicePixelRatio < 1\.49/);
  assert.match(main, /forcedColorsActive/);
  assert.match(main, /scrollWidth > runtimeReport\.document\.clientWidth/);
});

test("forced colors map semantic tokens and controls to Windows system colors", async () => {
  const styles = await read("apps/desktop/src/renderer/styles.css");
  assert.match(styles, /@media \(forced-colors: active\)[^]*--bg-app:\s*Canvas/);
  assert.match(styles, /--text-primary:\s*CanvasText/);
  assert.match(styles, /--text-muted:\s*GrayText/);
  assert.match(styles, /button\s*\{\s*background:\s*ButtonFace;\s*color:\s*ButtonText/);
  assert.match(styles, /input,[^]*background:\s*Field;\s*color:\s*FieldText/);
});
