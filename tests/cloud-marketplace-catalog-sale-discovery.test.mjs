import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { summarizeMarketplaceCatalogSale } from "../src/lib/marketplace-catalog.ts";

const products = [
  { price: 900, status: "active" },
  { price: 100, status: "paused" },
  { price: 500, status: "active" },
];

test("公開カタログは販売中商品だけから最低価格と件数を集計する", () => {
  assert.deepEqual(
    summarizeMarketplaceCatalogSale(products, {
      enabled: false,
      paymentMode: null,
    }),
    { label: "商品あり", lowestPrice: 500, productCount: 2 },
  );
  assert.equal(
    summarizeMarketplaceCatalogSale(
      [{ price: 500, status: "paused" }],
      { enabled: true, paymentMode: "test" },
    ),
    null,
  );
});

test("販売モードに応じてテスト販売と限定販売を区別する", () => {
  assert.equal(
    summarizeMarketplaceCatalogSale(products, {
      enabled: true,
      paymentMode: "test",
    })?.label,
    "テスト販売中",
  );
  assert.equal(
    summarizeMarketplaceCatalogSale(products, {
      enabled: true,
      paymentMode: "live",
    })?.label,
    "限定販売中",
  );
});

test("公開作品一覧はactive商品の最小情報だけを取得してカードへ渡す", async () => {
  const [page, card] = await Promise.all([
    readFile(new URL("../src/app/works/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/WorkCard.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /digital_products\(price,status\)/);
  assert.match(page, /\.eq\("digital_products\.status", "active"\)/);
  assert.match(page, /summarizeMarketplaceCatalogSale/);
  assert.match(page, /<WorkCard[\s\S]*?key=\{work\.id\}[\s\S]*?work=\{work\}[\s\S]*?sale=\{sale\}/);
  assert.match(card, /sale\.label/);
  assert.match(card, /yen\(sale\.lowestPrice\)/);
  assert.match(card, /sale\.productCount > 1 \? "から"/);
});
