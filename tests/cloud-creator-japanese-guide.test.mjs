import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("原稿編集の入口は日本語表記と3ステップガイドを表示する", async () => {
  const source = await readFile(
    new URL("../src/app/creator/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /クラウド制作/);
  assert.match(source, /原稿編集/);
  assert.match(source, /まずはこの3ステップで原稿を編集します/);
  assert.match(source, /ステップ1/);
  assert.match(source, /作品を作成/);
  assert.match(source, /ステップ2/);
  assert.match(source, /話とページを整理/);
  assert.match(source, /ステップ3/);
  assert.match(source, /ページを編集/);
  assert.match(source, /作品づくりを始める/);
  assert.doesNotMatch(source, />Cloud Creator</);
  assert.doesNotMatch(source, />Project/);
});

test("作品作成・構成・ゴミ箱・ヘッダーは利用者向け用語を日本語に統一する", async () => {
  const [header, create, workspace, trash, editor] = await Promise.all([
    readFile(new URL("../src/components/Header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/creator/new/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/creator/[projectId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/creator/trash/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(header, /クラウド制作/);
  assert.match(create, /新しい作品/);
  assert.match(create, /作品名/);
  assert.match(create, /ページ設定/);
  assert.match(workspace, /作品情報を編集/);
  assert.match(workspace, /話を追加/);
  assert.match(workspace, /ページを追加/);
  assert.match(workspace, /作品の状況/);
  assert.match(trash, /作品のゴミ箱/);
  assert.match(editor, /プレビュー/);
  assert.match(editor, /画像素材/);
});

test("クラウド制作は紫基調の制作ワークフローシェルを使用する", async () => {
  const [layout, shell, styles, creator] = await Promise.all([
    readFile(
      new URL("../src/app/creator/layout.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/CloudWorkflowShell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../src/app/creator/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /CloudWorkflowShell/);
  assert.match(layout, /cloud-studio-scope/);
  assert.match(shell, /label: "ネーム作成"/);
  assert.match(shell, /href: "\/dashboard\/workflow\/proposal"/);
  assert.match(shell, /href: "\/dashboard\/workflow\/scenario"/);
  assert.match(shell, /href: "\/dashboard\/workflow\/storyboard"/);
  assert.match(shell, /proposalEnabled/);
  assert.match(shell, /scenarioEnabled/);
  assert.match(shell, /storyboardEnabled/);
  assert.doesNotMatch(shell, /前工程の完了後/);
  assert.match(shell, /label: "原稿編集", href: "\/creator"/);
  assert.match(shell, /label: "販売準備"[\s\S]*availability: "coming-soon"/);
  assert.match(shell, /label: "収益管理"[\s\S]*availability: "coming-soon"/);
  assert.match(shell, /ステップ\{currentItem.step\}：\{currentItem.label\}/);
  assert.match(shell, /一般向け制作ワークフロー/);
  assert.doesNotMatch(shell, /label: "マンガ生成"/);
  assert.match(styles, /\.cloud-studio-scope \.button/);
  assert.match(styles, /bg-violet-700/);
  assert.match(creator, /制作ステップ 5/);
  assert.match(creator, /from-white to-violet-50/);
});
