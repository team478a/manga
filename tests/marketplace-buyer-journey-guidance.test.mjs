import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolvePostAuthRedirect } from "../src/lib/auth-redirect.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ログイン後の戻り先は同一originの内部pathだけを許可する", () => {
  assert.equal(
    resolvePostAuthRedirect("/checkout/11111111-1111-4111-8111-111111111111"),
    "/checkout/11111111-1111-4111-8111-111111111111",
  );
  assert.equal(
    resolvePostAuthRedirect("/dashboard/purchases?from=checkout#latest"),
    "/dashboard/purchases?from=checkout#latest",
  );
  for (const unsafe of [
    "https://example.com/checkout/item",
    "//example.com/checkout/item",
    "/\\example.com/checkout/item",
    "/login",
    "/auth/callback",
    "/checkout/item\nLocation: https://example.com",
    "",
  ]) {
    assert.equal(resolvePostAuthRedirect(unsafe), "/dashboard");
  }
});

test("指定購入者はログイン後に同じ購入準備画面へ戻る", async () => {
  const [checkout, login, authAction] = await Promise.all([
    read("src/app/checkout/[productId]/page.tsx"),
    read("src/app/login/page.tsx"),
    read("src/app/actions/auth-actions.ts"),
  ]);

  assert.match(checkout, /const loginRequired = Boolean/);
  assert.match(checkout, /指定購入者アカウントでログインしてください/);
  assert.match(checkout, /ログイン後、この購入準備画面へ戻ります/);
  assert.match(checkout, /`\/login\?next=\$\{encodeURIComponent\(`/);
  assert.match(login, /resolvePostAuthRedirect\(params\.next\)/);
  assert.match(login, /<input name="next" type="hidden" value=\{nextPath\} \/>/);
  assert.match(authAction, /resolvePostAuthRedirect\(formText\(formData, "next"\)\)/);
  assert.match(authAction, /redirect\(nextPath\)/);
  assert.match(authAction, /next=\$\{encodeURIComponent\(nextPath\)\}/);
});

test("購入準備から完了後の履歴・再ダウンロードまでを案内する", async () => {
  const [checkout, success, purchases, dashboard, guide] = await Promise.all([
    read("src/app/checkout/[productId]/page.tsx"),
    read("src/app/checkout/success/page.tsx"),
    read("src/app/dashboard/purchases/page.tsx"),
    read("src/app/dashboard/page.tsx"),
    read("src/app/dashboard/monitor/guide/page.tsx"),
  ]);

  for (const text of [
    "購入からダウンロードまで",
    "指定購入者アカウント",
    "Stripe画面へ進み",
    "購入履歴から5分間有効なURLを再発行",
    "購入履歴を見る",
  ]) {
    assert.match(checkout, new RegExp(text));
  }
  assert.match(success, /href="\/dashboard\/purchases"/);
  assert.match(purchases, /テスト購入/);
  assert.match(purchases, /実際の請求・売上・振込は発生しません/);
  assert.match(purchases, /公開作品を確認/);
  assert.match(dashboard, /href="\/dashboard\/purchases"/);
  assert.match(dashboard, /MANGAI内限定テスト販売と注文・売上確認/);
  assert.match(dashboard, /一般公開販売、振込、精算確定/);
  assert.match(guide, /ログイン後に同じ購入準備画面へ戻れます/);
});
