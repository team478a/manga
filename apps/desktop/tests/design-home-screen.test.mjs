import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.join(here, "..", "src", "renderer");
const mainSource = fs.readFileSync(path.join(rendererDir, "main.tsx"), "utf8");
const homeProjectCardSource = fs.readFileSync(
  path.join(rendererDir, "components", "home", "HomeProjectCard.tsx"),
  "utf8",
);

test("main.tsx: Phase D2のButtonコンポーネントをimportしている", () => {
  assert.match(mainSource, /import \{ Button \} from "\.\/components\/common\/Button";/);
});

test("Home画面: 新規Project作成ボタンがButtonコンポーネントで実装されている", () => {
  assert.match(mainSource, /<Button\s+variant="primary"\s+ref=\{newProjectButtonRef\}/);
});

test("Home画面: Projectカードの削除ボタン(danger)がButtonコンポーネントで実装されている", () => {
  // Phase D3-CでProjectカードはHomeProjectCard.tsxへ分離された。
  assert.match(homeProjectCardSource, /variant="danger"\s*\n?\s*size="sm"/);
});

test("新規Project作成モーダルのCreateボタンはtype=submitを維持している（フォーム送信の回帰防止）", () => {
  // Button.tsxはtype既定値を"button"にしているため、フォーム内のsubmitボタンを
  // Buttonへ置き換える際にtype="submit"を明示しないとフォーム送信が壊れる。
  assert.match(
    mainSource,
    /<Button\s+type="submit"\s+variant="primary"[^]*?\{t\("projectDialog\.create"\)\}/,
  );
});

test("Project一覧のカードトリガー（.project-open）はHomeProjectCard.tsxへ分離されたうえで維持されている（Phase D3-C）", () => {
  assert.match(homeProjectCardSource, /className="project-open home-project-card-open"/);
  assert.doesNotMatch(mainSource, /className="project-open"/);
});
