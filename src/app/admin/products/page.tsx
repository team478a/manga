import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { statusLabel, yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type AdminProduct = {
  id: string;
  title: string;
  price: number;
  status: string;
  works: { title: string } | null;
  profiles: { display_name: string } | null;
};

export default async function AdminProductsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("digital_products")
    .select("id,title,price,status,works:work_id(title),profiles:creator_id(display_name)")
    .order("created_at", { ascending: false })
    .returns<AdminProduct[]>();

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">全デジタル商品管理</h1>
      <p className="mt-3 text-lg text-stone-600">登録済みのデジタル商品を確認できます。今回は削除や決済管理は行いません。</p>
      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-base">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="py-3">商品名</th>
              <th className="py-3">紐づく作品</th>
              <th className="py-3">クリエイター</th>
              <th className="py-3">価格</th>
              <th className="py-3">販売状態</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((product) => (
              <tr className="border-b border-stone-100" key={product.id}>
                <td className="py-3 font-semibold">{product.title}</td>
                <td className="py-3">{product.works?.title ?? "不明"}</td>
                <td className="py-3">{product.profiles?.display_name ?? "不明"}</td>
                <td className="py-3">{yen(product.price)}</td>
                <td className="py-3"><StatusBadge className="text-sm">{statusLabel(product.status)}</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
