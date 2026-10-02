import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  mapPublicWorkCreatorAttributions,
  publicCreatorName,
} from "../src/lib/public-creator-attribution.ts";

test("公開クリエイター表示名は空値を除外し作品IDごとに解決する", () => {
  const rows = [
    { work_id: "work-a", display_name: "  作者A  " },
    { work_id: "work-b", display_name: "" },
  ];

  assert.equal(mapPublicWorkCreatorAttributions(rows).get("work-a"), "作者A");
  assert.equal(publicCreatorName(rows, "work-a"), "作者A");
  assert.equal(publicCreatorName(rows, "work-b"), "クリエイター");
  assert.equal(publicCreatorName(null, "work-c"), "クリエイター");
});

test("公開用RPCは公開中の一般作品に限定し表示名以外のプロフィールを返さない", async () => {
  const [migration, rollback, schema] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/202609300002_public_marketplace_creator_attribution.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/rollbacks/202609300002_public_marketplace_creator_attribution.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /list_public_work_creator_attributions\(p_work_ids uuid\[\]\)/);
    assert.match(source, /returns table\(work_id uuid, display_name text\)/);
    assert.match(source, /to_jsonb\(profile\)->>'display_name'/);
    assert.match(source, /security definer/);
    assert.match(source, /work\.content_class='general'/);
    assert.match(source, /work\.is_public=true/);
    assert.match(source, /grant execute on function public\.list_public_work_creator_attributions\(uuid\[\]\) to anon,authenticated/);
    assert.doesNotMatch(
      source.match(/create or replace function public\.list_public_work_creator_attributions[\s\S]*?\$\$;/)?.[0] ?? "",
      /user_id|email|bio|avatar/i,
    );
  }
  assert.match(
    rollback,
    /drop function if exists public\.list_public_work_creator_attributions\(uuid\[\]\)/,
  );
});

test("公開一覧・詳細・購入準備は同じ安全な表示名RPCを使用する", async () => {
  const [catalog, detail, checkout, card] = await Promise.all([
    readFile(new URL("../src/app/works/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/works/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/checkout/[productId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/marketplace/MarketplaceWorkCard.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const source of [catalog, detail, checkout]) {
    assert.match(source, /list_public_work_creator_attributions/);
  }
  assert.match(catalog, /creatorName=\{creatorByWork\.get\(work\.id\) \?\? "クリエイター"\}/);
  assert.match(detail, /クリエイター：\{creatorName\}/);
  assert.match(checkout, /クリエイター：\{creatorName\}/);
  assert.doesNotMatch(checkout, /profiles:creator_id\(display_name\)/);
  assert.match(card, /\{creatorName\}/);
});
