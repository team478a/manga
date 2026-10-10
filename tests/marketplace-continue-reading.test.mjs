import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  marketplaceReadingProgressKey,
  resolveMarketplaceReadingPage,
} from "../src/lib/marketplace-reading-progress-utils.ts";

test("続きから読むページは明示URL、現公開版の保存値、先頭の順に解決する", () => {
  assert.equal(resolveMarketplaceReadingPage([1, 2, 3], 2, 3), 2);
  assert.equal(resolveMarketplaceReadingPage([1, 2, 3], null, 3), 3);
  assert.equal(resolveMarketplaceReadingPage([1, 2, 3], null, 8), 1);
  assert.equal(resolveMarketplaceReadingPage([1, 2, 3], 8, 3), 1);
  assert.equal(resolveMarketplaceReadingPage([], null, 3), null);
  assert.notEqual(
    marketplaceReadingProgressKey("work", "publication-v1"),
    marketplaceReadingProgressKey("work", "publication-v2"),
  );
});

test("閲覧進捗migrationは版固定・本人限定・RPC経由更新を強制する", async () => {
  const [migration, rollback, schema] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/202610020003_marketplace_reading_progress.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/rollbacks/202610020003_marketplace_reading_progress.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /create table if not exists public\.marketplace_reading_progress/);
    assert.match(source, /primary key \(profile_id, work_id, publication_id\)/);
    assert.match(source, /enable row level security/);
    assert.match(source, /profile_id = public\.current_profile_id\(\)/);
    assert.match(source, /grant select on public\.marketplace_reading_progress to authenticated/);
    assert.doesNotMatch(
      source,
      /grant[^;]*(?:insert|update|delete)[^;]*marketplace_reading_progress to authenticated/i,
    );
    assert.match(source, /save_marketplace_reading_progress/);
    assert.match(source, /work\.current_publication_id=p_publication_id/);
    assert.match(source, /purchase\.status='paid'/);
    assert.match(source, /page\.is_sample/);
    assert.match(source, /work\.content_class='general'/);
    assert.match(source, /security definer/);
  }
  assert.match(rollback, /drop function if exists public\.save_marketplace_reading_progress/);
  assert.match(rollback, /drop table if exists public\.marketplace_reading_progress/);
});

test("Readerと本棚はDB未適用時にも既存閲覧を維持して続きへ誘導する", async () => {
  const [reader, service, beacon, action, purchases, repository] = await Promise.all([
    readFile(new URL("../src/app/works/[id]/read/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../src/modules/publication/application/work-publication-service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/marketplace/MarketplaceReadingProgressBeacon.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/actions/marketplace-reading-progress-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/app/dashboard/purchases/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../src/modules/purchases/infrastructure/purchase-query-repository.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(reader, /query\.page[\s\S]*: null/);
  assert.match(reader, /MarketplaceReadingProgressBeacon/);
  assert.match(reader, /前回の\{publication\.pageNumber\}ページから再開/);
  assert.match(service, /resolveMarketplaceReadingPage/);
  assert.match(service, /progress\.pagesByPublication\.get/);
  assert.match(beacon, /useEffect/);
  assert.match(action, /rpc\("save_marketplace_reading_progress"/);
  assert.match(action, /catch \{[\s\S]*ok: false/);
  assert.match(purchases, /続きから読む/);
  assert.match(purchases, /publication=\$\{fixedPublicationId\}/);
  assert.match(purchases, /&page=\$\{savedPage\}/);
  assert.match(repository, /current_publication_id/);
});
