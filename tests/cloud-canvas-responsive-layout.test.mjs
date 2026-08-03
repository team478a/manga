import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorPath =
  "src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx";

test("原稿編集の3カラムは左ナビを含めて収まる画面幅から有効になる", async () => {
  const source = await readFile(editorPath, "utf8");

  assert.match(
    source,
    /min-\[1360px\]:grid-cols-\[220px_minmax\(480px,1fr\)_320px\]/,
  );
  assert.doesNotMatch(
    source,
    /xl:grid-cols-\[220px_minmax\(480px,1fr\)_320px\]/,
  );
});
