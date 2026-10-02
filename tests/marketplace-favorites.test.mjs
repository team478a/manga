import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  marketplaceFavoriteFeedbackPath,
  resolveMarketplaceFavoriteReturnPath,
} from "../src/lib/marketplace-favorite-routing.ts";

test("お気に入りreturn pathはMarketplace内だけを許可する", () => {
  const workId = "00000000-0000-4000-8000-000000000001";
  assert.equal(
    resolveMarketplaceFavoriteReturnPath("/works?q=猫", workId),
    "/works?q=%E7%8C%AB",
  );
  assert.equal(
    resolveMarketplaceFavoriteReturnPath("/dashboard/favorites", workId),
    "/dashboard/favorites",
  );
  assert.equal(
    resolveMarketplaceFavoriteReturnPath("/admin", workId),
    `/works/${workId}`,
  );
  assert.equal(
    marketplaceFavoriteFeedbackPath(
      "/works?tag=SF",
      "favorite_message",
      "保存しました",
    ),
    "/works?tag=SF&favorite_message=%E4%BF%9D%E5%AD%98%E3%81%97%E3%81%BE%E3%81%97%E3%81%9F",
  );
});

test("お気に入りmigrationは本人限定RLS・重複防止・最小権限を持つ", async () => {
  const [migration, rollback, hardening, hardeningRollback, schema] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/202610020001_marketplace_favorites.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/rollbacks/202610020001_marketplace_favorites.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202610020002_marketplace_favorites_privilege_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/rollbacks/202610020002_marketplace_favorites_privilege_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /create table if not exists public\.marketplace_favorites/);
    assert.match(source, /unique \(profile_id, work_id\)/);
    assert.match(source, /enable row level security/);
    assert.match(source, /profile_id = public\.current_profile_id\(\)/);
    assert.match(source, /work\.is_public = true/);
    assert.match(source, /work\.content_class = 'general'/);
    assert.match(
      source,
      /grant select, insert, delete on public\.marketplace_favorites to authenticated/,
    );
    assert.doesNotMatch(
      source,
      /grant[^;]*update[^;]*marketplace_favorites to authenticated/,
    );
  }
  assert.match(rollback, /drop table if exists public\.marketplace_favorites/);
  for (const source of [hardening, hardeningRollback, schema]) {
    assert.match(
      source,
      /revoke all on public\.marketplace_favorites\s+from public, anon, authenticated, service_role/,
    );
    assert.match(
      source,
      /grant select, insert, delete on public\.marketplace_favorites to authenticated/,
    );
    assert.match(
      source,
      /grant select, insert, update, delete on public\.marketplace_favorites to service_role/,
    );
    assert.doesNotMatch(
      source,
      /grant[^;]*(?:truncate|references|trigger)[^;]*marketplace_favorites/i,
    );
  }
});

test("作品カード・詳細・専用一覧は同じお気に入り操作と状態設計を使用する", async () => {
  const [card, detail, favoritesPage, favoritesLoading, favoritesError, action] =
    await Promise.all([
    readFile(
      new URL(
        "../src/components/marketplace/MarketplaceWorkCard.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/app/works/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/dashboard/favorites/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/dashboard/favorites/loading.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/dashboard/favorites/error.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/actions/marketplace-favorite-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(card, /MarketplaceFavoriteButton/);
  assert.match(detail, /MarketplaceFavoriteButton/);
  assert.match(favoritesPage, /あとで読む/);
  assert.match(favoritesPage, /MarketplaceWorkCard/);
  assert.match(favoritesLoading, /MarketplaceLoadingState/);
  assert.match(favoritesError, /保存状態は失われていません/);
  assert.match(favoritesError, /reset/);
  assert.match(action, /error\.code !== "23505"/);
  assert.match(action, /\.delete\(\)/);
  assert.match(action, /if \(parsed\.data\.action === "add"\)[\s\S]*\.eq\("is_public", true\)/);
  assert.match(action, /\.delete\(\)[\s\S]*\.eq\("work_id", parsed\.data\.workId\)/);
  assert.match(action, /revalidatePath\("\/dashboard\/favorites"\)/);
  assert.doesNotMatch(
    `${card}\n${detail}\n${favoritesPage}\n${favoritesLoading}\n${favoritesError}\n${action}`,
    /ランキング|急上昇|レコメンド|レビュー|星評価|Creatorフォロー/,
  );
});
