import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudResearchSearchEnabled } from "@/lib/cloud-research-search";
import { cloudResearchSourceVerificationEnabled } from "@/lib/cloud-research-source-verification";
import { SourceDiscoveryForm } from "./source-discovery-form";

export default async function CloudResearchSourceDiscoveryPage() {
  const researchEnabled = cloudResearchFeatureEnabled();
  if (researchEnabled) await requireProfile();
  const enabled = researchEnabled && cloudResearchSearchEnabled();

  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/dashboard/research/new">
        ← 市場分析入力へ
      </Link>
      <p className="mt-5 text-sm font-bold text-violet-700">RESEARCH DISCOVERY</p>
      <h1 className="mt-2 text-3xl font-bold">出典候補を探す</h1>
      <p className="mt-2 text-stone-600">
        Web検索から候補を集め、原文を確認してから市場分析へ採用します。
      </p>
      <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
        検索snippetは確認済み事実ではありません。採用後も原文を読み、事実メモを自分で入力してください。
      </p>
      {!enabled ? (
        <p className="mt-4 rounded-lg bg-violet-50 p-4 text-sm text-violet-950">
          検索を利用できない場合も、市場分析入力画面で出典を手動入力できます。
        </p>
      ) : null}
      <SourceDiscoveryForm
        enabled={enabled}
        verificationEnabled={cloudResearchSourceVerificationEnabled()}
      />
    </main>
  );
}
