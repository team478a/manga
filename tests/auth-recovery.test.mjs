import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("登録Actionはパスワード確認を要求する", async () => {
  const source = await readFile(
    new URL("../src/app/actions/auth-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /passwordConfirmation/);
  assert.match(source, /passwordSchema = z\.string\(\)\.min\(8\)/);
});

test("新規登録は送信中表示と二重送信防止を提供する", async () => {
  const source = await readFile(
    new URL("../src/app/signup/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /PendingSubmitButton/);
  assert.match(source, /pendingLabel="登録しています…"/);
});

test("パスワード再設定は利用者の存在を応答へ露出しない", async () => {
  const source = await readFile(
    new URL("../src/app/actions/auth-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /resetPasswordForEmail/);
  assert.match(source, /updateUser/);
  assert.match(source, /登録済みの場合は/);
  assert.doesNotMatch(
    source,
    /const\s+\{\s*error\s*\}\s*=\s*await\s+supabase\.auth\.resetPasswordForEmail/,
  );
});

test("認証callbackは許可した遷移先だけを使用する", async () => {
  const source = await readFile(
    new URL("../src/app/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /exchangeCodeForSession/);
  assert.match(source, /next === "\/update-password"/);
  assert.doesNotMatch(source, /NextResponse\.redirect\(next\)/);
});
