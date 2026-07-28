import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { WorkCard } from "@/components/WorkCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

type WorksSearchParams = { q?: string; tag?: string };

function safeSearchValue(value: string) {
  return value
    .replace(/[,%()]/g, " ")
    .trim()
    .slice(0, 100);
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<WorksSearchParams>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="page">
        <EmptyState
          title="Supabase設定が必要です"
          body=".env.local を設定すると、公開作品一覧が表示されます。"
        />
      </main>
    );
  }

  const params = await searchParams;
  const keyword = safeSearchValue(params.q ?? "");
  const selectedTag = (params.tag ?? "").trim().slice(0, 50);
  const supabase = await createClient();

  let worksQuery = supabase
    .from("works")
    .select("*")
    .eq("is_public", true)
    .eq("content_class", "general")
    .order("created_at", { ascending: false });

  if (keyword)
    worksQuery = worksQuery.or(
      `title.ilike.%${keyword}%,description.ilike.%${keyword}%`,
    );
  if (selectedTag) worksQuery = worksQuery.contains("tags", [selectedTag]);

  const [{ data: works }, { data: tagRows }] = await Promise.all([
    worksQuery.returns<Work[]>(),
    supabase
      .from("works")
      .select("tags")
      .eq("is_public", true)
      .eq("content_class", "general")
      .returns<Array<{ tags: string[] | null }>>(),
  ]);
  const tags = Array.from(
    new Set((tagRows ?? []).flatMap((row) => row.tags ?? [])),
  ).sort((a, b) => a.localeCompare(b, "ja"));
  const filtering = Boolean(keyword || selectedTag);

  return (
    <main className="page">
      <PageHeader
        title="公開作品"
        description="クリエイターが公開した作品を検索できます。"
      />

      <Card className="mt-7">
      <form action="/works" method="get">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <FormField id="works-search" label="作品を検索">
            <input
              className="ui-field"
              id="works-search"
              name="q"
              defaultValue={keyword}
              placeholder="タイトルや説明を入力"
              maxLength={100}
            />
          </FormField>
          {selectedTag ? (
            <input type="hidden" name="tag" value={selectedTag} />
          ) : null}
          <Button type="submit">
            検索する
          </Button>
        </div>
        {tags.length ? (
          <div className="mt-5">
            <p className="label">タグで絞り込む</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                className={`rounded-full px-3 py-2 text-sm ${!selectedTag ? "bg-leaf text-white" : "bg-linen text-stone-700"}`}
                href={
                  keyword ? `/works?q=${encodeURIComponent(keyword)}` : "/works"
                }
              >
                すべて
              </Link>
              {tags.map((tag) => {
                const query = new URLSearchParams();
                if (keyword) query.set("q", keyword);
                query.set("tag", tag);
                return (
                  <Link
                    className={`rounded-full px-3 py-2 text-sm ${selectedTag === tag ? "bg-leaf text-white" : "bg-linen text-stone-700"}`}
                    href={`/works?${query}`}
                    key={tag}
                  >
                    {tag}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </form>
      </Card>

      <div className="mt-7 flex items-center justify-between gap-4">
        <p className="text-stone-600">{works?.length ?? 0}件の作品</p>
        {filtering ? (
          <Link
            className="font-semibold text-leaf hover:underline"
            href="/works"
          >
            条件をクリア
          </Link>
        ) : null}
      </div>

      {works?.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            title={
              filtering
                ? "条件に一致する作品がありません"
                : "公開作品はまだありません"
            }
            body={
              filtering
                ? "検索語やタグを変えてお試しください。"
                : "最初の作品が公開されると、ここに表示されます。"
            }
          />
        </div>
      )}
    </main>
  );
}
