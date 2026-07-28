import {
  FileArchive,
  FileUp,
  ImagePlus,
  Images,
  PackagePlus,
  ReceiptText,
  ShoppingBag,
  MonitorSmartphone,
  PanelsTopLeft,
  CreditCard,
  Library,
  Bell,
} from "lucide-react";
import { updateProfile } from "@/app/actions";
import { FlashMessage } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";
import { CREATOR_INPUT_LIMITS } from "@/lib/creator-input";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const cards = [
    {
      title: "Cloud Creator",
      body: "一般漫画のProject、Episode、Pageをブラウザーで制作します。",
      href: "/creator",
      icon: PanelsTopLeft,
    },
    {
      title: "Cloud AIプラン",
      body: "生成credit、契約状態、Stripe請求を確認します。",
      href: "/dashboard/billing",
      icon: CreditCard,
    },
    {
      title: "通知",
      body: "Cloud AI利用枠、生成失敗、重要なお知らせを確認します。",
      href: "/dashboard/notifications",
      icon: Bell,
    },
    {
      title: "購入履歴",
      body: "購入したデジタル商品を確認し、安全に再ダウンロードします。",
      href: "/dashboard/purchases",
      icon: Library,
    },
    {
      title: "作品管理",
      body: "投稿した作品を見直し、公開状態を確認できます。",
      href: "/dashboard/works",
      icon: Images,
    },
    {
      title: "作品をアップロード",
      body: "新しい作品画像、説明、タグを登録します。",
      href: "/dashboard/works/new",
      icon: ImagePlus,
    },
    {
      title: "デジタル商品管理",
      body: "ダウンロード販売の商品と価格を登録します。",
      href: "/dashboard/products",
      icon: ShoppingBag,
    },
    {
      title: "グッズ販売申請",
      body: "Tシャツやポスターなどの販売相談を送れます。",
      href: "/dashboard/goods-requests",
      icon: PackagePlus,
    },
    {
      title: "売上管理",
      body: "注文と受取予定額を確認できます。",
      href: "/dashboard/sales",
      icon: ReceiptText,
    },
    {
      title: "販売用パッケージ",
      body: "販売サイトへ出品するための説明文とファイル一式を作ります。",
      href: "/sales-packages",
      icon: FileArchive,
    },
    {
      title: "Desktopパッケージを確認",
      body: "Desktopで書き出した販売パッケージの内容と整合性を確認します。",
      href: "/dashboard/import-package",
      icon: FileUp,
    },
    {
      title: "Desktop端末認証",
      body: "Desktopから自分の作品状態を安全に確認する端末を管理します。",
      href: "/dashboard/devices",
      icon: MonitorSmartphone,
    },
  ];

  return (
    <main className="page">
      <PageHeader
        title="マイページ"
        description="作品、販売商品、グッズ申請をここから管理します。"
        actions={
          <ButtonLink href="/dashboard/works/new">
          作品を投稿
          </ButtonLink>
        }
      />
      <FlashMessage
        className="mt-5"
        error={params.error}
        message={params.message}
      />
      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <ButtonLink
            className="h-auto items-start justify-start whitespace-normal p-0 text-left"
            href={card.href}
            key={card.title}
            variant="ghost"
          >
            <Card className="h-full w-full" variant="interactive">
              <card.icon className="h-9 w-9 text-leaf" />
              <h2 className="mt-4 text-2xl font-bold">{card.title}</h2>
              <p className="mt-3 text-lg leading-relaxed text-text-secondary">
                {card.body}
              </p>
            </Card>
          </ButtonLink>
        ))}
      </section>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <form action={updateProfile} className="space-y-5">
          <h2 className="text-2xl font-bold">プロフィール</h2>
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
              className="ui-field min-h-32"
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              maxLength={CREATOR_INPUT_LIMITS.bio}
            />
          </FormField>
          <Button type="submit">
            保存する
          </Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-2xl font-bold">はじめに</h2>
          <p className="mt-3 text-lg leading-relaxed text-text-secondary">
            まずは「作品をアップロード」から作品ページを作成してください。公開した作品は「作品を探す」に表示されます。
          </p>
          <ButtonLink className="mt-5" href="/dashboard/works/new">
            作品をアップロード
          </ButtonLink>
        </Card>
      </div>
    </main>
  );
}
