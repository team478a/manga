import assert from "node:assert/strict";
import test from "node:test";
import {
  actionFeedbackTarget,
  actionIdSchema,
  allowedInternalRedirect,
} from "../src/lib/action-contracts.ts";
import {
  formString,
  formText,
} from "../src/app/actions/shared/form-data.ts";

test("Action feedbackは既存のquery名とURL encodingを維持する", () => {
  assert.equal(
    actionFeedbackTarget("/admin/users", "error", "入力を確認してください。"),
    `/admin/users?error=${encodeURIComponent("入力を確認してください。")}`,
  );
  assert.equal(
    actionFeedbackTarget("/admin/users", "message", "保存しました"),
    `/admin/users?message=${encodeURIComponent("保存しました")}`,
  );
});

test("内部redirectは完全一致したallowlistだけを許可する", () => {
  const allowed = ["/update-password"];
  assert.equal(
    allowedInternalRedirect("/update-password", allowed, "/dashboard"),
    "/update-password",
  );
  for (const candidate of [
    null,
    "https://example.com",
    "//example.com",
    "/update-password?next=https://example.com",
    "/UPDATE-PASSWORD",
  ]) {
    assert.equal(
      allowedInternalRedirect(candidate, allowed, "/dashboard"),
      "/dashboard",
    );
  }
});

test("UUID validationは既存Zod uuid契約を維持する", () => {
  assert.equal(
    actionIdSchema.safeParse("de96a4d6-8f76-4500-a685-6c27e7e639a4").success,
    true,
  );
  assert.equal(actionIdSchema.safeParse("not-a-uuid").success, false);
  assert.equal(actionIdSchema.safeParse(123).success, false);
});

test("FormDataはrawとtrim済みの既存意味を区別する", () => {
  const form = new FormData();
  form.set("value", "  text  ");
  form.set("file", new Blob(["x"]), "x.txt");
  assert.equal(formString(form, "value"), "  text  ");
  assert.equal(formText(form, "value"), "text");
  assert.equal(formString(form, "missing"), "");
  assert.equal(formText(form, "file"), "");
});

