import Link from "next/link";
import { HeartHandshake, ImagePlus, ShoppingBag } from "lucide-react";

export default function Home() {
  return (
    <main>
      <section className="bg-linen">
        <div className="page grid gap-8 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-lg font-semibold text-leaf">AIクリエイターのための販売場所</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-ink sm:text-5xl">
              作品を見せる、売る、グッズ化を相談する。
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-relaxed text-stone-700">
              MANGAI Creator Platform は、AI作品を安心して公開し、デジタル商品として販売するためのMVPサービスです。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="button" href="/signup">
                クリエイター登録
              </Link>
              <Link className="button-secondary" href="/works">
                公開作品を見る
              </Link>
            </div>
          </div>
          <div className="panel">
            <div className="grid gap-4">
              {[
                { icon: ImagePlus, title: "作品を投稿", body: "画像と説明を入れて、下書きまたは公開で保存できます。" },
                { icon: ShoppingBag, title: "販売商品を登録", body: "デジタル商品を価格付きで登録できます。" },
                { icon: HeartHandshake, title: "グッズ化を申請", body: "管理者が内容を確認し、手動で対応します。" }
              ].map((item) => (
                <div className="rounded-md border border-stone-200 p-4" key={item.title}>
                  <item.icon className="h-7 w-7 text-leaf" />
                  <h2 className="mt-3 text-xl font-bold">{item.title}</h2>
                  <p className="mt-2 text-base text-stone-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
