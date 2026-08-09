import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

const pageContracts = [
  ["../src/app/forgot-password/page.tsx", /params\.error[\s\S]*<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/checkout/[productId]/page.tsx", /<InlineErrorMessage>\{messages\.error\}<\/InlineErrorMessage>/, 2],
  ["../src/app/dashboard/goods-requests/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/goods-requests/new/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/works/[id]/edit/page.tsx", /<InlineErrorMessage>\{messages\.error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/devices/page.tsx", /<InlineErrorMessage>[\s\S]*\{params\.error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/dashboard/works/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/works/new/page.tsx", /<InlineErrorMessage>[\s\S]*\{params\.error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/update-password/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/login/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/signup/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/admin/users/page.tsx", /<InlineErrorMessage role="alert">\{error\}<\/InlineErrorMessage>/],
  ["../src/app/sales-packages/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/products/[id]/edit/page.tsx", /<InlineErrorMessage>\{messages\.error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/products/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/admin/goods-requests/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/creator/new/page.tsx", /<InlineErrorMessage>[\s\S]*\{params\.error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/creator/trash/page.tsx", /<InlineErrorMessage>[\s\S]*\{query\.error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/creator/[projectId]/page.tsx", /<InlineErrorMessage>[\s\S]*\{query\.error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/dashboard/products/new/page.tsx", /<InlineErrorMessage>\{params\.error\}<\/InlineErrorMessage>/],
  ["../src/app/admin/adult-research/page.tsx", /<InlineErrorMessage radius="lg" role="alert">[\s\S]*\{error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/admin/general-monitors/email/page.tsx", /<InlineErrorMessage radius="lg" role="alert">[\s\S]*\{query\.error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/admin/users/[id]/page.tsx", /<InlineErrorMessage radius="lg" role="alert">[\s\S]*\{error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/admin/provider-settings/page.tsx", /<InlineErrorMessage radius="lg" role="alert">\{query\.error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/monitor/welcome/page.tsx", /<InlineErrorMessage radius="lg" role="alert">\{error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/monitor/page.tsx", /<InlineErrorMessage radius="lg" role="alert">\{error\}<\/InlineErrorMessage>/],
  ["../src/app/dashboard/research/adult-access/page.tsx", /<InlineErrorMessage radius="lg" role="alert">[\s\S]*\{error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/dashboard/research/[reportId]/proposal/page.tsx", /<InlineErrorMessage radius="lg" role="alert">[\s\S]*\{error\}[\s\S]*<\/InlineErrorMessage>/, 2],
  ["../src/app/dashboard/research/new/page.tsx", /<InlineErrorMessage radius="lg" role="alert">[\s\S]*\{error\}[\s\S]*<\/InlineErrorMessage>/],
  ["../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/page.tsx", /<InlineErrorMessage radius="lg" role="alert">\{error\}<\/InlineErrorMessage>/],
];

test("Inline errorは既存のp要素とmd／lg visual classだけを共有する", async () => {
  const source = await readSource("../src/components/InlineErrorMessage.tsx");

  assert.match(source, /HTMLAttributes<HTMLParagraphElement>/);
  assert.match(source, /<p/);
  assert.match(source, /radius\?: "md" \| "lg"/);
  assert.match(source, /radius === "lg" \? "rounded-lg" : "rounded-md"/);
  assert.match(source, /mt-5 \$\{radiusClass\} bg-red-50 p-4 text-red-700/);
  assert.doesNotMatch(source, /role="alert"|params\.error|messages\.error|query\.error|canPurchase/);
});

test("30画面32箇所は表示条件・文言・ARIAを各画面に保持する", async () => {
  const sources = await Promise.all(pageContracts.map(([path]) => readSource(path)));

  for (const [index, source] of sources.entries()) {
    const [path, contract, expectedUsage = 1] = pageContracts[index];
    assert.match(source, /import \{ InlineErrorMessage \}/, path);
    assert.match(source, contract, path);
    assert.equal(
      source.match(/<InlineErrorMessage(?:\s|>)/g)?.length ?? 0,
      expectedUsage,
      path,
    );
    assert.doesNotMatch(
      source,
      /className="mt-5 rounded-(?:md|lg) bg-red-50 p-4 text-red-700"/,
      path,
    );
  }

  const usageCount = sources.reduce(
    (count, source) => count + (source.match(/<InlineErrorMessage(?:\s|>)/g)?.length ?? 0),
    0,
  );
  assert.equal(usageCount, 32);
  assert.match(sources[1], /!canPurchase \? <InlineErrorMessage>この商品は現在購入できません。<\/InlineErrorMessage>/);
});
