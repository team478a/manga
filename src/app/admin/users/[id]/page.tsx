import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { dateJa, statusLabel } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { grantCloudAdultWorkflowAccessAction, setCloudAdultAiPlanningGrantAction, setCloudAdultPlanningGrantAction, setCloudAdultScenarioGrantAction, setCloudAdultStoryboardGrantAction } from "./adult-feature-actions";
import { setCloudAdultResearchEntitlementAction } from "./adult-research-actions";

type AdminUser = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  role: string;
  created_at: string;
};

type AdultResearchEntitlement = {
  status: "approved" | "suspended" | "expired";
  source: "purchase" | "legacy_purchase" | "admin_grant" | "campaign";
  valid_until: string | null;
  admin_note: string | null;
};

type AdultPlanningGrant = AdultResearchEntitlement;

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data: user } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<AdminUser>();

  if (!user) notFound();

  let email = "未取得";
  let adultEntitlement: AdultResearchEntitlement | null = null;
  let adultPlanningGrant: AdultPlanningGrant | null = null;
  let adultEntitlementConfigured = true;
  let adultPlanningConfigured = true;
  let adultAiPlanningGrant: AdultPlanningGrant | null = null;
  let adultAiPlanningConfigured = true;
  let adultScenarioGrant: AdultPlanningGrant | null = null;
  let adultScenarioConfigured = true;
  let adultStoryboardGrant: AdultPlanningGrant | null = null;
  let adultStoryboardConfigured = true;
  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(user.user_id);
    email = data.user?.email ?? "未設定";
    const entitlementResult = await admin
      .from("cloud_adult_research_entitlements")
      .select("status,source,valid_until,admin_note")
      .eq("profile_id", user.id)
      .maybeSingle<AdultResearchEntitlement>();
    adultEntitlement = entitlementResult.data;
    adultEntitlementConfigured = !entitlementResult.error;
    const planningResult = await admin
      .from("cloud_adult_feature_grants")
      .select("status,source,valid_until,admin_note")
      .eq("profile_id", user.id)
      .eq("feature_key", "adult_planning")
      .maybeSingle<AdultPlanningGrant>();
    adultPlanningGrant = planningResult.data;
    adultPlanningConfigured = !planningResult.error;
    const aiPlanningResult = await admin
      .from("cloud_adult_feature_grants")
      .select("status,source,valid_until,admin_note")
      .eq("profile_id", user.id)
      .eq("feature_key", "adult_ai_planning")
      .maybeSingle<AdultPlanningGrant>();
    adultAiPlanningGrant = aiPlanningResult.data;
    adultAiPlanningConfigured = !aiPlanningResult.error;
    const scenarioResult = await admin
      .from("cloud_adult_feature_grants")
      .select("status,source,valid_until,admin_note")
      .eq("profile_id", user.id)
      .eq("feature_key", "adult_scenario")
      .maybeSingle<AdultPlanningGrant>();
    adultScenarioGrant = scenarioResult.data;
    adultScenarioConfigured = !scenarioResult.error;
    const storyboardResult = await admin
      .from("cloud_adult_feature_grants")
      .select("status,source,valid_until,admin_note")
      .eq("profile_id", user.id)
      .eq("feature_key", "adult_storyboard")
      .maybeSingle<AdultPlanningGrant>();
    adultStoryboardGrant = storyboardResult.data;
    adultStoryboardConfigured = !storyboardResult.error;
  }

  return (
    <main className="page max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">ユーザー詳細</h1>
          <p className="mt-3 text-lg text-stone-600">登録情報を確認できます。編集・削除機能はまだ実装していません。</p>
        </div>
        <Link className="button-secondary" href="/admin/users">一覧へ戻る</Link>
      </div>
      {error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="mt-5 rounded-lg bg-green-50 p-4 text-green-800"
          role="status"
        >
          {message}
        </p>
      ) : null}
      <section className="panel mt-6 space-y-4">
        <div>
          <p className="text-sm text-stone-500">表示名</p>
          <p className="text-2xl font-bold">{user.display_name || "未設定"}</p>
        </div>
        <div>
          <p className="text-sm text-stone-500">メールアドレス</p>
          <p className="text-lg">{email}</p>
        </div>
        <div>
          <p className="text-sm text-stone-500">権限</p>
          <span className="mt-2 inline-flex rounded-full bg-linen px-3 py-1 text-sm">{statusLabel(user.role)}</span>
        </div>
        <div>
          <p className="text-sm text-stone-500">登録日</p>
          <p className="text-lg">{dateJa(user.created_at)}</p>
        </div>
        <div>
          <p className="text-sm text-stone-500">自己紹介</p>
          <p className="whitespace-pre-wrap text-lg">{user.bio || "未設定"}</p>
        </div>
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">成人向け市場分析オプション</h2>
        {!hasSupabaseAdminEnv() ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">
            権限操作にはSupabase管理用設定が必要です。
          </p>
        ) : !adultEntitlementConfigured ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">
            Release 1.1 migrationが未適用のため権限を操作できません。
          </p>
        ) : (
          <form
            action={setCloudAdultResearchEntitlementAction.bind(null, user.id)}
            className="mt-5 space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="adultResearchStatus">
                  利用状態
                </label>
                <select
                  className="field"
                  defaultValue={adultEntitlement?.status ?? "approved"}
                  id="adultResearchStatus"
                  name="status"
                >
                  <option value="approved">利用許可</option>
                  <option value="suspended">一時停止</option>
                  <option value="expired">期限切れ</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adultResearchSource">
                  許可理由
                </label>
                <select
                  className="field"
                  defaultValue={adultEntitlement?.source ?? "admin_grant"}
                  id="adultResearchSource"
                  name="source"
                >
                  <option value="legacy_purchase">既存購入者</option>
                  <option value="purchase">購入済み</option>
                  <option value="admin_grant">管理者付与</option>
                  <option value="campaign">キャンペーン</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adultResearchValidUntil">
                  有効期限（任意）
                </label>
                <input
                  className="field"
                  defaultValue={adultEntitlement?.valid_until?.slice(0, 16)}
                  id="adultResearchValidUntil"
                  name="validUntil"
                  type="datetime-local"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="adultResearchAdminNote">
                管理者メモ
              </label>
              <textarea
                className="field min-h-24"
                defaultValue={adultEntitlement?.admin_note ?? ""}
                id="adultResearchAdminNote"
                maxLength={500}
                name="adminNote"
              />
            </div>
            <p className="text-sm text-stone-600">
              利用許可後も、本人が18歳以上の確認と専用規約への同意を完了するまで成人向け分析は実行できません。
            </p>
            <button
              className="button bg-violet-700 hover:bg-violet-800"
              type="submit"
            >
              成人向け分析の許可を更新
            </button>
          </form>
        )}
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">成人向け企画機能</h2>
        <p className="mt-2 text-sm text-stone-600">
          成人向け市場分析の基本許可に加えて、この機能単位の許可が必要です。
        </p>
        {!hasSupabaseAdminEnv() ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">
            権限操作にはSupabase管理用設定が必要です。
          </p>
        ) : !adultPlanningConfigured ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">
            成人向け企画migrationが未適用のため権限を操作できません。
          </p>
        ) : (
          <form
            action={setCloudAdultPlanningGrantAction.bind(null, user.id)}
            className="mt-5 space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="adultPlanningStatus">
                  利用状態
                </label>
                <select
                  className="field"
                  defaultValue={adultPlanningGrant?.status ?? "approved"}
                  id="adultPlanningStatus"
                  name="status"
                >
                  <option value="approved">利用許可</option>
                  <option value="suspended">一時停止</option>
                  <option value="expired">期限切れ</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adultPlanningSource">
                  許可理由
                </label>
                <select
                  className="field"
                  defaultValue={adultPlanningGrant?.source ?? "admin_grant"}
                  id="adultPlanningSource"
                  name="source"
                >
                  <option value="legacy_purchase">既存購入者</option>
                  <option value="purchase">購入済み</option>
                  <option value="admin_grant">管理者付与</option>
                  <option value="campaign">キャンペーン</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adultPlanningValidUntil">
                  有効期限（任意）
                </label>
                <input
                  className="field"
                  defaultValue={adultPlanningGrant?.valid_until?.slice(0, 16)}
                  id="adultPlanningValidUntil"
                  name="validUntil"
                  type="datetime-local"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="adultPlanningAdminNote">
                管理者メモ
              </label>
              <textarea
                className="field min-h-24"
                defaultValue={adultPlanningGrant?.admin_note ?? ""}
                id="adultPlanningAdminNote"
                maxLength={500}
                name="adminNote"
              />
            </div>
            <button
              className="button bg-violet-700 hover:bg-violet-800"
              type="submit"
            >
              成人向け企画機能の許可を更新
            </button>
          </form>
        )}
      </section>
      <section className="panel mt-6 border-violet-200 bg-violet-50">
        <h2 className="text-xl font-bold">成人向け制作機能を一括許可</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">
          市場分析、企画、AI企画、AIシナリオ、AIネームを1回の操作で許可します。
          Canvasと作品管理はAIネーム許可を引き継ぎます。
        </p>
        {!hasSupabaseAdminEnv() ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-950">
            権限操作にはSupabase管理用設定が必要です。
          </p>
        ) : (
          <form
            action={grantCloudAdultWorkflowAccessAction.bind(null, user.id)}
            className="mt-5 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="adultWorkflowSource">
                  許可理由
                </label>
                <select className="field" id="adultWorkflowSource" name="source" defaultValue="admin_grant">
                  <option value="legacy_purchase">既存購入者</option>
                  <option value="purchase">購入済み</option>
                  <option value="admin_grant">管理者付与</option>
                  <option value="campaign">キャンペーン</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adultWorkflowValidUntil">
                  有効期限（任意）
                </label>
                <input className="field" id="adultWorkflowValidUntil" name="validUntil" type="datetime-local" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="adultWorkflowAdminNote">
                管理者メモ
              </label>
              <textarea
                className="field min-h-20"
                defaultValue="成人向け制作ワークフロー一括許可"
                id="adultWorkflowAdminNote"
                maxLength={500}
                name="adminNote"
              />
            </div>
            <button className="button bg-violet-700 hover:bg-violet-800" type="submit">
              全工程を一括許可
            </button>
          </form>
        )}
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">成人向けAI企画機能</h2>
        <p className="mt-2 text-sm text-stone-600">
          成人向け市場分析とは別に、外部AIへ送信する企画生成を個別許可します。
        </p>
        {!adultAiPlanningConfigured ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">成人向けAI企画migrationを適用してください。</p>
        ) : (
          <form action={setCloudAdultAiPlanningGrantAction.bind(null, user.id)} className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="adultAiPlanningStatus">利用状態</label>
                <select className="field" defaultValue={adultAiPlanningGrant?.status ?? "approved"} id="adultAiPlanningStatus" name="status">
                  <option value="approved">利用許可</option>
                  <option value="suspended">一時停止</option>
                  <option value="expired">期限切れ</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adultAiPlanningSource">許可理由</label>
                <select className="field" defaultValue={adultAiPlanningGrant?.source ?? "admin_grant"} id="adultAiPlanningSource" name="source">
                  <option value="legacy_purchase">既存購入者</option>
                  <option value="purchase">購入済み</option>
                  <option value="admin_grant">管理者付与</option>
                  <option value="campaign">キャンペーン</option>
                </select>
              </div>
            </div>
            <input name="validUntil" type="hidden" value="" />
            <textarea className="field min-h-24" defaultValue={adultAiPlanningGrant?.admin_note ?? ""} maxLength={500} name="adminNote" placeholder="管理者メモ" />
            <button className="button bg-rose-700 hover:bg-rose-800" type="submit">成人向けAI企画の許可を更新</button>
          </form>
        )}
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">成人向けAIシナリオ機能</h2>
        <p className="mt-2 text-sm text-stone-600">
          成人向けAI企画を利用できるユーザーへ、シナリオ工程を追加で個別許可します。
        </p>
        {!adultScenarioConfigured ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">成人向けAIシナリオmigrationを適用してください。</p>
        ) : (
          <form action={setCloudAdultScenarioGrantAction.bind(null, user.id)} className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="adultScenarioStatus">利用状態</label>
                <select className="field" defaultValue={adultScenarioGrant?.status ?? "approved"} id="adultScenarioStatus" name="status">
                  <option value="approved">利用許可</option>
                  <option value="suspended">一時停止</option>
                  <option value="expired">期限切れ</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adultScenarioSource">許可理由</label>
                <select className="field" defaultValue={adultScenarioGrant?.source ?? "admin_grant"} id="adultScenarioSource" name="source">
                  <option value="legacy_purchase">既存購入者</option>
                  <option value="purchase">購入済み</option>
                  <option value="admin_grant">管理者付与</option>
                  <option value="campaign">キャンペーン</option>
                </select>
              </div>
            </div>
            <input name="validUntil" type="hidden" value="" />
            <textarea className="field min-h-24" defaultValue={adultScenarioGrant?.admin_note ?? ""} maxLength={500} name="adminNote" placeholder="管理者メモ" />
            <button className="button bg-rose-700 hover:bg-rose-800" type="submit">成人向けAIシナリオの許可を更新</button>
          </form>
        )}
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">成人向けAIネーム機能</h2>
        <p className="mt-2 text-sm text-stone-600">成人向けAIシナリオ利用者へ、ページ・コマ構成工程を追加で個別許可します。</p>
        {!adultStoryboardConfigured ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">成人向けAIネームmigrationを適用してください。</p>
        ) : (
          <form action={setCloudAdultStoryboardGrantAction.bind(null, user.id)} className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className="label" htmlFor="adultStoryboardStatus">利用状態</label><select className="field" defaultValue={adultStoryboardGrant?.status ?? "approved"} id="adultStoryboardStatus" name="status"><option value="approved">利用許可</option><option value="suspended">一時停止</option><option value="expired">期限切れ</option></select></div>
              <div><label className="label" htmlFor="adultStoryboardSource">許可理由</label><select className="field" defaultValue={adultStoryboardGrant?.source ?? "admin_grant"} id="adultStoryboardSource" name="source"><option value="legacy_purchase">既存購入者</option><option value="purchase">購入済み</option><option value="admin_grant">管理者付与</option><option value="campaign">キャンペーン</option></select></div>
            </div>
            <input name="validUntil" type="hidden" value="" />
            <textarea className="field min-h-24" defaultValue={adultStoryboardGrant?.admin_note ?? ""} maxLength={500} name="adminNote" placeholder="管理者メモ" />
            <button className="button bg-rose-700 hover:bg-rose-800" type="submit">成人向けAIネームの許可を更新</button>
          </form>
        )}
      </section>
    </main>
  );
}
