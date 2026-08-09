import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("Status badgeはspanとlinen visual shellだけを共有する", async () => {
  const source = await readSource("../src/components/StatusBadge.tsx");

  assert.match(source, /HTMLAttributes<HTMLSpanElement>/);
  assert.match(source, /<span/);
  assert.match(source, /rounded-full bg-linen px-3 py-1/);
  assert.match(source, /className/);
  assert.doesNotMatch(source, /statusLabel|公開|非公開|creator|admin/);
});

test("作品・商品・申請・ユーザー8画面はdomain labelを保持してStatus badgeを使う", async () => {
  const paths = [
    "../src/app/dashboard/goods-requests/page.tsx",
    "../src/app/dashboard/works/page.tsx",
    "../src/app/dashboard/products/page.tsx",
    "../src/app/admin/goods-requests/page.tsx",
    "../src/app/admin/works/page.tsx",
    "../src/app/admin/products/page.tsx",
    "../src/app/admin/users/page.tsx",
    "../src/app/admin/users/[id]/page.tsx",
  ];
  const sources = await Promise.all(paths.map(readSource));

  for (const [index, source] of sources.entries()) {
    assert.match(source, /import \{ StatusBadge \}/, paths[index]);
    assert.match(source, /<StatusBadge/, paths[index]);
  }

  assert.match(sources[0], /<StatusBadge className="w-fit text-sm">\{statusLabel\(request\.status\)\}/);
  assert.match(sources[1], /<StatusBadge>\{work\.is_public \? "公開" : "非公開"\}/);
  assert.match(sources[1], /<StatusBadge>\{statusLabel\(work\.status\)\}/);
  assert.match(sources[2], /<StatusBadge className="w-fit text-sm">\{statusLabel\(product\.status\)\}/);
  assert.match(sources[3], /<StatusBadge className="w-fit text-sm">\{statusLabel\(request\.status\)\}/);
  assert.match(sources[4], /<StatusBadge className="text-sm">\{work\.is_public \? "公開" : "非公開"\}/);
  assert.match(sources[4], /<StatusBadge className="text-sm">\{statusLabel\(work\.status\)\}/);
  assert.match(sources[5], /<StatusBadge className="text-sm">\{statusLabel\(product\.status\)\}/);
  assert.match(sources[6], /<StatusBadge className="text-sm">\{statusLabel\(user\.role\)\}/);
  assert.match(sources[7], /<StatusBadge className="mt-2 inline-flex text-sm">\{statusLabel\(user\.role\)\}/);
});
