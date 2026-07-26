import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.join(here, "..", "src", "renderer");
const mainSource = fs.readFileSync(path.join(rendererDir, "main.tsx"), "utf8");

test("main.tsx: Phase D2のButtonコンポーネントをimportしている", () => {
  assert.match(mainSource, /import \{ Button \} from "\.\/components\/common\/Button";/);
});

test("Home画面: 主要操作(新規Project/削除)がButtonコンポーネントで実装されている", () => {
  assert.match(mainSource, /<Button\s+variant="primary"\s+ref=\{newProjectButtonRef\}/);
  assert.match(mainSource, /variant="danger"\s+size="sm"/);
});

test("新規Project作成モーダルのCreateボタンはtype=submitを維持している（フォーム送信の回帰防止）", () => {
  // Button.tsxはtype既定値を"button"にしているため、フォーム内のsubmitボタンを
  // Buttonへ置き換える際にtype="submit"を明示しないとフォーム送信が壊れる。
  assert.match(
    mainSource,
    /<Button\s+type="submit"\s+variant="primary"[^]*?\{t\("projectDialog\.create"\)\}/,
  );
});

test("Project一覧のカードトリガー（.project-open）は本フェーズでは未変更（Cardコンポーネント適用は別フェーズ）", () => {
  // カードグリッド・カバー画像レイアウトの全面再設計はビジュアル検証が
  // 必要な大きな変更のため、本フェーズのスコープには含めていない。
  assert.match(mainSource, /className="project-open"/);
  assert.doesNotMatch(mainSource, /common\/Card/);
});
