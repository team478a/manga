import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Cloud区画は専用layoutと共通SectionShellを持つ", async () => {
  const [dashboard, creator, admin, shell] = await Promise.all([
    source("../src/app/dashboard/layout.tsx"),
    source("../src/app/creator/layout.tsx"),
    source("../src/app/admin/layout.tsx"),
    source("../src/components/layout/SectionShell.tsx"),
  ]);

  assert.match(dashboard, /SectionShell/);
  assert.match(creator, /CreatorSectionLayout/);
  assert.match(admin, /SectionShell/);
  assert.match(shell, /SectionNav/);
  assert.match(shell, /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/);
});

test("Creator区画layoutはCanvas Editorを新規Shellの対象外にする", async () => {
  const layout = await source(
    "../src/components/layout/CreatorSectionLayout.tsx",
  );
  assert.match(layout, /creator.*pages/);
  assert.match(layout, /return children/);
  assert.doesNotMatch(layout, /CloudCanvasEditor/);
});

test("共通UI部品は段階移行に必要なvariantと状態を公開する", async () => {
  const [button, card, alert, status, field, emptyState] = await Promise.all([
    source("../src/components/ui/Button.tsx"),
    source("../src/components/ui/Card.tsx"),
    source("../src/components/ui/Alert.tsx"),
    source("../src/components/ui/StatusBadge.tsx"),
    source("../src/components/ui/FormField.tsx"),
    source("../src/components/EmptyState.tsx"),
  ]);

  for (const variant of ["primary", "secondary", "ghost", "danger"]) {
    assert.match(button, new RegExp(`\\b${variant}\\b`));
  }
  for (const variant of ["default", "interactive", "muted"]) {
    assert.match(card, new RegExp(`\\b${variant}\\b`));
  }
  for (const tone of ["info", "success", "warning", "danger"]) {
    assert.match(alert, new RegExp(`\\b${tone}\\b`));
    assert.match(status, new RegExp(`\\b${tone}\\b`));
  }
  assert.match(field, /aria-hidden/);
  assert.match(emptyState, /components\/ui\/Card/);
  assert.match(emptyState, /<Card/);
});

test("公開・認証・業務区画の代表画面が共通UIを利用する", async () => {
  for (const relativePath of [
    "../src/app/works/page.tsx",
    "../src/app/login/page.tsx",
    "../src/app/signup/page.tsx",
    "../src/app/dashboard/page.tsx",
    "../src/app/creator/page.tsx",
    "../src/app/admin/page.tsx",
  ]) {
    const page = await source(relativePath);
    assert.match(page, /PageHeader/);
  }
});

test("共通HeaderはDesktopとモバイルのCloud導線を提供する", async () => {
  const header = await source("../src/components/Header.tsx");
  assert.match(header, /<span>MANGAI<\/span>/);
  assert.match(header, />\s*Cloud\s*</);
  assert.match(header, /aria-label="Cloud共通メニュー"/);
  assert.match(header, /aria-label="Cloud共通モバイルメニュー"/);
  assert.match(header, /lg:hidden/);
  assert.match(header, /hidden items-center gap-1 lg:flex/);
});
