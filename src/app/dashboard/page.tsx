import Link from "next/link";
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
import { requireProfile } from "@/lib/auth";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">マイページ</h1>
          <p className="mt-2 text-lg text-stone-600">
            作品、販売商品、グッズ申請をここから管理します。
          </p>
        </div>
        <Link className="button" href="/dashboard/works/new">
          作品を投稿
        </Link>
      </div>
      {params.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">
          {params.message}
        </p>
      ) : null}
      {params.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">
          {params.error}
        </p>
      ) : null}
      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            className="panel block transition hover:-translate-y-0.5 hover:border-leaf"
            href={card.href}
            key={card.title}
          >
            <card.icon className="h-9 w-9 text-leaf" />
            <h2 className="mt-4 text-2xl font-bold">{card.title}</h2>
            <p className="mt-3 text-lg leading-relaxed text-stone-600">
              {card.body}
            </p>
          </Link>
        ))}
      </section>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <form action={updateProfile} className="panel space-y-5">
          <h2 className="text-2xl font-bold">プロフィール</h2>
          <div>
            <label className="label" htmlFor="displayName">
              表示名
            </label>
            <input
              className="field"
              id="displayName"
              name="displayName"
              defaultValue={profile.display_name}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="bio">
              自己紹介
            </label>
            <textarea
              className="field min-h-32"
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
            />
          </div>
          <button className="button" type="submit">
            保存する
          </button>
        </form>
        <section className="panel">
          <h2 className="text-2xl font-bold">はじめに</h2>
          <p className="mt-3 text-lg leading-relaxed text-stone-600">
            まずは「作品をアップロード」から作品ページを作成してください。公開した作品は「作品を探す」に表示されます。
          </p>
          <Link className="button mt-5" href="/dashboard/works/new">
            作品をアップロード
          </Link>
        </section>
      </div>
    </main>
  );
}
