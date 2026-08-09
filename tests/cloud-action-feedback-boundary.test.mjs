import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("Cloud Action feedbackは既存の表示順・色・ARIAを維持する", async () => {
  const source = await readSource(
    "../src/components/CloudActionFeedback.tsx",
  );
  const errorIndex = source.indexOf("{error ?");
  const messageIndex = source.indexOf("{message ?");

  assert.ok(errorIndex >= 0 && errorIndex < messageIndex);
  assert.match(
    source,
    /className="mt-5 rounded-lg bg-red-50 p-4 text-red-700"[\s\S]*role="alert"/,
  );
  assert.match(
    source,
    /className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800"[\s\S]*role="status"/,
  );
  assert.match(source, /\{error\}/);
  assert.match(source, /\{message\}/);
});

test("企画比較からネーム版までの4画面は共通Action feedbackを使う", async () => {
  const paths = [
    "../src/app/dashboard/research/[reportId]/proposal/runs/[runId]/page.tsx",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/page.tsx",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/page.tsx",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/versions/[storyboardVersionId]/page.tsx",
  ];
  const sources = await Promise.all(paths.map(readSource));

  for (const [index, source] of sources.entries()) {
    assert.match(source, /import \{ CloudActionFeedback \}/, paths[index]);
    assert.match(
      source,
      /<CloudActionFeedback error=\{query\.error\} message=\{query\.message\} \/>/,
      paths[index],
    );
    assert.doesNotMatch(
      source,
      /query\.error \? <p className="mt-5 rounded-lg bg-red-50/,
      paths[index],
    );
    assert.doesNotMatch(
      source,
      /query\.message \? <p className="mt-5 rounded-lg bg-emerald-50/,
      paths[index],
    );
  }
});
