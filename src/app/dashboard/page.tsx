import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CircleDollarSign,
  Images,
  PackagePlus,
  PanelsTopLeft,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { updateProfile } from "@/app/actions";
import { FlashMessage } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { CREATOR_INPUT_LIMITS } from "@/lib/creator-input";
import { dateJa, statusLabel, yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

type RecentWork = Pick<
  Work,
  "id" | "title" | "status" | "is_public" | "created_at"
>;

function workTone(status: Work["status"]): StatusTone {
  if (status === "published") return "success";
  if (status === "archived") return "neutral";
  return "warning";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();

  const [
    worksResult,
    publicWorksResult,
    productsResult,
    ordersResult,
    recentWorksResult,
    notificationsResult,
  ] = await Promise.all([
    supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profile.id),
    supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profile.id)
      .eq("is_public", true),
    supabase
      .from("digital_products")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", profile.id)
      .eq("status", "active"),
    supabase
      .from("orders")
      .select("creator_revenue,status")
      .eq("creator_id", profile.id),
    supabase
      .from("works")
      .select("id,title,status,is_public,created_at")
      .eq("creator_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("cloud_ai_notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
  ]);

  const paidOrders =
    ordersResult.data?.filter((order) => order.status === "paid") ?? [];
  const totalRevenue = paidOrders.reduce(
    (sum, order) => sum + (order.creator_revenue ?? 0),
    0,
  );
  const recentWorks = (recentWorksResult.data ?? []) as RecentWork[];
  const isCreator = profile.role === "creator" || profile.role === "admin";

  const metrics = [
    {
      label: "管理中の作品",
      value: String(worksResult.count ?? 0),
      note: "下書きを含む",
      icon: Images,
      tone: "text-brand-600 bg-brand-50",
    },
    {
      label: "公開作品",
      value: String(publicWorksResult.count ?? 0),
      note: "作品ページで公開中",
      icon: BookOpen,
      tone: "text-status-success bg-green-50",
    },
    {
      label: "販売中の商品",
      value: String(productsResult.count ?? 0),
      note: "デジタル商品",
      icon: ShoppingBag,
      tone: "text-status-info bg-blue-50",
    },
    {
      label: "累計売上",
      value: yen(totalRevenue),
      note: `支払い済み ${paidOrders.length}件`,
      icon: CircleDollarSign,
      tone: "text-status-warning bg-amber-50",
    },
  ];

  const quickActions = [
    {
      title: "新しい作品を投稿",
      description: "画像・説明・タグを登録",
      href: "/dashboard/works/new",
      icon: Plus,
    },
    {
      title: "デジタル商品を登録",
      description: "価格と販売ファイルを設定",
      href: "/dashboard/products/new",
      icon: ShoppingBag,
    },
    {
      title: "グッズ販売を申請",
      description: "作品から販売相談を開始",
      href: "/dashboard/goods-requests/new",
      icon: PackagePlus,
    },
  ];

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-7 xl:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-brand-200 bg-white px-2.5 py-1 text-xs font-bold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          MANGAI Cloud 制作環境
        </div>
        <PageHeader
          title="ダッシュボード"
          description="作品の公開状況、販売、アカウント情報を一画面で確認できます。"
          actions={
            <ButtonLink href="/dashboard/works/new" size="sm" variant="brand">
              <Plus className="h-4 w-4" aria-hidden="true" />
              作品を投稿
            </ButtonLink>
          }
        />

        <FlashMessage
          className="mt-5"
          error={params.error}
          message={params.message}
        />

        <section
          aria-label="活動サマリー"
          className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric) => (
            <Card className="p-4 shadow-app" key={metric.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-text-muted">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-2xl font-black tracking-tight text-ink">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {metric.note}
                  </p>
                </div>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}
                >
                  <metric.icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Card>
          ))}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
          <Card className="overflow-hidden p-0 shadow-app">
            <div className="flex items-center justify-between gap-3 border-b border-brand-100 px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-bold text-ink">最近の作品</h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  更新した作品を新しい順に表示
                </p>
              </div>
              <Link
                className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:text-brand-700"
                href="/dashboard/works"
              >
                すべて見る
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            {recentWorks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-brand-50/70 text-xs text-text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">作品名</th>
                      <th className="px-4 py-2.5 font-semibold">状態</th>
                      <th className="px-4 py-2.5 font-semibold">公開</th>
                      <th className="px-5 py-2.5 text-right font-semibold">
                        登録日
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100">
                    {recentWorks.map((work) => (
                      <tr className="bg-white hover:bg-brand-50/50" key={work.id}>
                        <td className="px-5 py-3.5">
                          <Link
                            className="font-bold text-ink hover:text-brand-700"
                            href={`/dashboard/works/${work.id}/edit`}
                          >
                            {work.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge tone={workTone(work.status)}>
                            {statusLabel(work.status)}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3.5 text-text-secondary">
                          {work.is_public ? "公開" : "非公開"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-text-muted">
                          {dateJa(work.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Images className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-bold">作品はまだありません</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  最初の作品を投稿すると、ここで状況を確認できます。
                </p>
                <ButtonLink
                  className="mt-4"
                  href="/dashboard/works/new"
                  size="sm"
                  variant="brand"
                >
                  作品を投稿
                </ButtonLink>
              </div>
            )}
          </Card>

          <div className="grid content-start gap-5">
            {(notificationsResult.count ?? 0) > 0 ? (
              <Link
                className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-100/70 px-4 py-3 text-brand-700 transition hover:bg-brand-100"
                href="/dashboard/notifications"
              >
                <span className="flex items-center gap-3">
                  <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>
                    <strong className="block text-sm">
                      未読のお知らせが{notificationsResult.count}件あります
                    </strong>
                    <span className="text-xs">内容を確認する</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}

            <Card className="p-0 shadow-app">
              <div className="border-b border-brand-100 px-4 py-3">
                <h2 className="font-bold">次にできること</h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  よく使う作業へすぐ移動
                </p>
              </div>
              <div className="divide-y divide-brand-100">
                {quickActions.map((action) => (
                  <Link
                    className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-brand-50"
                    href={action.href}
                    key={action.href}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                      <action.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm text-ink">
                        {action.title}
                      </strong>
                      <span className="block text-xs text-text-muted">
                        {action.description}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-brand-500"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </Card>

            {isCreator ? (
              <Card className="border-brand-200 bg-gradient-to-br from-brand-700 to-brand-500 p-5 text-white shadow-app">
                <PanelsTopLeft className="h-6 w-6" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-bold">Cloud Creator</h2>
                <p className="mt-1 text-sm leading-relaxed text-white/80">
                  Project、Episode、Pageをブラウザーで制作できます。
                </p>
                <ButtonLink
                  className="mt-4 border-white/30 bg-white text-brand-700 hover:bg-brand-50"
                  href="/creator"
                  size="sm"
                  variant="secondary"
                >
                  制作画面を開く
                </ButtonLink>
              </Card>
            ) : null}
          </div>
        </div>

        <Card className="mt-5 shadow-app">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">
                Account
              </p>
              <h2 className="mt-2 text-xl font-bold">プロフィール</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
                表示名と自己紹介は、公開作品のクリエイター情報として使われます。
              </p>
            </div>
            <form action={updateProfile} className="grid gap-4">
              <FormField id="displayName" label="表示名" required>
                <input
                  className="ui-field"
                  id="displayName"
                  name="displayName"
                  defaultValue={profile.display_name}
                  maxLength={CREATOR_INPUT_LIMITS.displayName}
                  required
                />
              </FormField>
              <FormField id="bio" label="自己紹介">
                <textarea
                  className="ui-field min-h-28"
                  id="bio"
                  name="bio"
                  defaultValue={profile.bio ?? ""}
                  maxLength={CREATOR_INPUT_LIMITS.bio}
                />
              </FormField>
              <div>
                <Button size="sm" type="submit" variant="brand">
                  保存する
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </main>
  );
}
