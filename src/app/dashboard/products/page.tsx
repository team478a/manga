import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { FlashMessage } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { dateJa, statusLabel, yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  created_at: string;
  works: { title: string } | null;
};

function productTone(status: string): StatusTone {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "neutral";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("digital_products")
    .select("id,title,description,price,status,created_at,works:work_id(title)")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<ProductRow[]>();

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-7 xl:px-8">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader
          eyebrow="Commerce"
          title="デジタル商品管理"
          description="作品に紐づくPDF、画像、ZIPなどの販売ファイルと価格を管理します。"
          actions={
            <ButtonLink
              href="/dashboard/products/new"
              size="sm"
              variant="brand"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              商品を登録
            </ButtonLink>
          }
        />
        <FlashMessage
          className="mt-5"
          error={params.error}
          message={params.message}
        />

        {products?.length ? (
          <Card className="mt-6 overflow-hidden p-0 shadow-app">
            <div className="border-b border-brand-100 px-4 py-3 sm:px-5">
              <h2 className="font-bold">登録商品</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {products.length}件の商品
              </p>
            </div>
            <div className="divide-y divide-brand-100">
              {products.map((product) => (
                <article
                  className="grid gap-4 bg-white p-4 transition hover:bg-brand-50/50 md:grid-cols-[minmax(0,1fr)_120px_100px_auto] md:items-center sm:px-5"
                  key={product.id}
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">
                      {product.title}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-brand-700">
                      {product.works?.title ?? "紐づく作品は未設定"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                      {product.description || "説明はまだありません。"}
                    </p>
                    <p className="mt-2 text-xs text-text-muted">
                      {dateJa(product.created_at)}
                    </p>
                  </div>
                  <p className="text-lg font-black">{yen(product.price)}</p>
                  <StatusBadge
                    className="w-fit"
                    tone={productTone(product.status)}
                  >
                    {statusLabel(product.status)}
                  </StatusBadge>
                  <Link
                    className="ui-button ui-button-secondary ui-button-sm w-full md:w-auto"
                    href={`/dashboard/products/${product.id}/edit`}
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
              title="デジタル商品はまだありません"
              body="作品に紐づけて、販売用のPDFやZIPなどを登録できます。"
              href="/dashboard/products/new"
              action="商品を登録"
            />
          </div>
        )}
      </div>
    </main>
  );
}
