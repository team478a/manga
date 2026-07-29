import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { FlashMessage } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { dateJa, statusLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

function statusTone(status: Work["status"]): StatusTone {
  if (status === "published") return "success";
  if (status === "archived") return "neutral";
  return "warning";
}

export default async function DashboardWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: works } = await supabase
    .from("works")
    .select("*")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Work[]>();

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-7 xl:px-8">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader
          eyebrow="Creation"
          title="作品管理"
          description="登録した作品の公開状態を確認し、編集できます。"
          actions={
            <ButtonLink
              href="/dashboard/works/new"
              size="sm"
              variant="brand"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              作品をアップロード
            </ButtonLink>
          }
        />
        <FlashMessage
          className="mt-5"
          error={params.error}
          message={params.message}
        />

        {works?.length ? (
          <Card className="mt-6 overflow-hidden p-0 shadow-app">
            <div className="border-b border-brand-100 px-4 py-3 sm:px-5">
              <h2 className="font-bold">登録作品</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {works.length}件の作品
              </p>
            </div>
            <div className="divide-y divide-brand-100">
              {works.map((work) => (
                <article
                  className="grid gap-4 bg-white p-4 transition hover:bg-brand-50/50 sm:grid-cols-[104px_minmax(0,1fr)_auto] sm:items-center sm:px-5"
                  key={work.id}
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-brand-50">
                    {work.image_url ? (
                      <Image
                        src={work.image_url}
                        alt={work.title}
                        fill
                        className="object-cover"
                        sizes="104px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-brand-400">
                        <ImageIcon className="h-6 w-6" aria-hidden="true" />
                        <span className="sr-only">画像なし</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{work.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                      {work.description || "説明はまだありません。"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={work.is_public ? "info" : "neutral"}>
                        {work.is_public ? "公開" : "非公開"}
                      </StatusBadge>
                      <StatusBadge tone={statusTone(work.status)}>
                        {statusLabel(work.status)}
                      </StatusBadge>
                      <span className="text-xs text-text-muted">
                        {dateJa(work.created_at)}
                      </span>
                    </div>
                  </div>
                  <Link
                    className="ui-button ui-button-secondary ui-button-sm w-full sm:w-auto"
                    href={`/dashboard/works/${work.id}/edit`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    編集
                  </Link>
                </article>
              ))}
            </div>
          </Card>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="作品はまだありません"
              body="画像と説明を登録して、作品ページを作りましょう。"
              href="/dashboard/works/new"
              action="作品をアップロード"
            />
          </div>
        )}
      </div>
    </main>
  );
}
