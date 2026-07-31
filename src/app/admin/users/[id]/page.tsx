import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { dateJa, statusLabel } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { grantCloudAdultWorkflowAccessAction, setCloudAdultAiPlanningGrantAction, setCloudAdultPlanningGrantAction, setCloudAdultScenarioGrantAction, setCloudAdultStoryboardGrantAction } from "./adult-feature-actions";
import { setCloudAdultResearchEntitlementAction } from "./adult-research-actions";
import {
  activateCloudGeneralMonitorAction,
  resendCloudGeneralMonitorInviteAction,
  stopCloudGeneralMonitorAction,
} from "./general-monitor-actions";
import {
  cloudGeneralMonitorBetaEnabled,
  type CloudGeneralMonitorEnrollment,
} from "@/lib/cloud-general-monitor";
import {
  activateCloudAdultMonitorAction,
  stopCloudAdultMonitorAction,
} from "./adult-monitor-actions";
import type { CloudAdultMonitorEnrollment } from "@/lib/cloud-adult-monitor";

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
  let generalMonitor: CloudGeneralMonitorEnrollment | null = null;
  let generalMonitorConfigured = true;
  const generalMonitorEnabled = cloudGeneralMonitorBetaEnabled();
  let adultAiPlanningGrant: AdultPlanningGrant | null = null;
  let adultAiPlanningConfigured = true;
  let adultScenarioGrant: AdultPlanningGrant | null = null;
  let adultScenarioConfigured = true;
  let adultStoryboardGrant: AdultPlanningGrant | null = null;
  let adultStoryboardConfigured = true;
  let adultMonitor: CloudAdultMonitorEnrollment | null = null;
  let adultMonitorConfigured = true;
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
    if (generalMonitorEnabled) {
      const generalMonitorResult = await admin
        .from("cloud_general_monitor_enrollments")
        .select("profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,onboarding_completed_at,updated_at")
        .eq("profile_id", user.id)
        .maybeSingle<CloudGeneralMonitorEnrollment>();
      generalMonitor = generalMonitorResult.data;
      generalMonitorConfigured = !generalMonitorResult.error;
    }
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
    const monitorResult = await admin
      .from("cloud_adult_monitor_enrollments")
      .select("profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,updated_at")
      .eq("profile_id", user.id)
      .maybeSingle<CloudAdultMonitorEnrollment>();
    adultMonitor = monitorResult.data;
    adultMonitorConfigured = !monitorResult.error;
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
      <section className="panel mt-6 border-violet-200">
        <p className="text-sm font-bold text-violet-700">一般向け・無料限定公開</p>
        <h2 className="mt-1 text-xl font-bold">モニター招待</h2>
        <p className="mt-2 text-sm text-stone-600">
          Stripeや購入状態には接続せず、一般向け制作フローの期限とAI利用数だけを管理します。
        </p>
        {!generalMonitorEnabled ? (
          <p className="mt-3 rounded-lg bg-stone-100 p-4 text-stone-700">
            Feature Flagが停止中です。migration適用後に対象Previewブランチだけで有効化してください。
          </p>
        ) : !hasSupabaseAdminEnv() ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">Supabase管理用設定が必要です。</p>
        ) : !generalMonitorConfigured ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-4 text-amber-950">一般向けモニターmigrationを適用してください。</p>
        ) : (
          <>
            {generalMonitor ? (
              <dl className="mt-5 grid gap-3 rounded-xl bg-violet-50 p-4 sm:grid-cols-4">
                <div><dt className="text-sm text-stone-500">状態</dt><dd className="font-bold">{generalMonitor.status}</dd></div>
                <div><dt className="text-sm text-stone-500">AI利用数</dt><dd className="font-bold">{generalMonitor.ai_requests_used} / {generalMonitor.ai_request_limit}</dd></div>
                <div><dt className="text-sm text-stone-500">期限</dt><dd className="font-bold">{new Date(generalMonitor.expires_at).toLocaleDateString("ja-JP")}</dd></div>
                <div><dt className="text-sm text-stone-500">初回案内</dt><dd className="font-bold">{generalMonitor.onboarding_completed_at ? "確認済み" : "未確認"}</dd></div>
              </dl>
            ) : null}
            {generalMonitor?.status === "active" &&
            email !== "未設定" && email !== "未取得" ? (
              <form action={resendCloudGeneralMonitorInviteAction.bind(null, user.id)} className="mt-4">
                <PendingSubmitButton className="button-secondary" pendingLabel="招待メールを送信中…">
                  招待メールを再送
                </PendingSubmitButton>
              </form>
            ) : null}
            <form action={activateCloudGeneralMonitorAction.bind(null, user.id)} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label" htmlFor="generalMonitorCohort">グループ名</label>
                  <input className="field" defaultValue={generalMonitor?.cohort ?? "general-preview-01"} id="generalMonitorCohort" maxLength={80} name="cohort" required />
                </div>
                <div><label className="label" htmlFor="generalMonitorLimit">AI利用上限</label>
                  <input className="field" defaultValue={generalMonitor?.ai_request_limit ?? 30} id="generalMonitorLimit" max={200} min={1} name="aiRequestLimit" type="number" required />
                </div>
                <div><label className="label" htmlFor="generalMonitorExpiry">利用期限</label>
                  <input className="field" id="generalMonitorExpiry" name="expiresAt" type="datetime-local" required />
                </div>
              </div>
              <div><label className="label" htmlFor="generalMonitorNote">管理者メモ</label>
                <textarea className="field min-h-20" id="generalMonitorNote" maxLength={500} name="adminNote" />
              </div>
              <PendingSubmitButton
                className="button bg-violet-700 hover:bg-violet-800"
                pendingLabel="招待処理中…"
              >
                {generalMonitor ? "招待条件を更新してメール送信" : "招待してメール送信"}
              </PendingSubmitButton>
            </form>
            {generalMonitor ? (
              <form action={stopCloudGeneralMonitorAction.bind(null, user.id)} className="mt-6 border-t border-stone-200 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label" htmlFor="generalMonitorStopStatus">終了状態</label>
                    <select className="field" id="generalMonitorStopStatus" name="status">
                      <option value="paused">一時停止</option><option value="completed">モニター完了</option><option value="revoked">招待取消</option>
                    </select>
                  </div>
                  <div><label className="label" htmlFor="generalMonitorStopNote">停止理由</label>
                    <input className="field" id="generalMonitorStopNote" maxLength={500} name="adminNote" required />
                  </div>
                </div>
                <PendingSubmitButton className="button-secondary mt-4" pendingLabel="停止処理中…">
                  利用を停止
                </PendingSubmitButton>
              </form>
            ) : null}
          </>
        )}
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
            <PendingSubmitButton
              className="button bg-violet-700 hover:bg-violet-800"
              pendingLabel="許可を更新中…"
            >
              成人向け分析の許可を更新
            </PendingSubmitButton>
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
            <PendingSubmitButton
              className="button bg-violet-700 hover:bg-violet-800"
              pendingLabel="許可を更新中…"
            >
              成人向け企画機能の許可を更新
            </PendingSubmitButton>
          </form>
        )}
      </section>
      <section className="panel mt-6 border-violet-300 bg-violet-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-violet-700">第2段階・限定公開</p>
            <h2 className="mt-1 text-xl font-bold">成人向け限定モニター</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              期間とAI利用上限を設定し、市場分析から作品管理までを一括許可します。
              停止時は全工程の許可も同時に停止します。
            </p>
          </div>
          <Link className="button-secondary" href="/admin/adult-monitors">モニター一覧</Link>
        </div>
        {!adultMonitorConfigured ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-950">
            限定モニターmigrationを適用してください。
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4">
                <p className="text-sm text-stone-500">状態</p>
                <p className="mt-1 font-bold">{adultMonitor?.status ?? "未登録"}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-sm text-stone-500">AI利用数</p>
                <p className="mt-1 font-bold">
                  {adultMonitor ? `${adultMonitor.ai_requests_used} / ${adultMonitor.ai_request_limit}` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-sm text-stone-500">期限</p>
                <p className="mt-1 font-bold">
                  {adultMonitor ? dateJa(adultMonitor.expires_at) : "—"}
                </p>
              </div>
            </div>
            <form action={activateCloudAdultMonitorAction.bind(null, user.id)} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="monitorSource">許可理由</label>
                  <select className="field" defaultValue="legacy_purchase" id="monitorSource" name="source">
                    <option value="legacy_purchase">既存購入者</option>
                    <option value="purchase">購入済み</option>
                    <option value="admin_grant">管理者付与</option>
                    <option value="campaign">キャンペーン</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="monitorCohort">モニター区分</label>
                  <input className="field" defaultValue={adultMonitor?.cohort ?? "adult-beta-1"} id="monitorCohort" name="cohort" required />
                </div>
                <div>
                  <label className="label" htmlFor="monitorLimit">AI利用上限</label>
                  <input className="field" defaultValue={adultMonitor?.ai_request_limit ?? 20} id="monitorLimit" max={100} min={1} name="aiRequestLimit" required type="number" />
                </div>
                <div>
                  <label className="label" htmlFor="monitorExpiresAt">有効期限</label>
                  <input className="field" defaultValue={adultMonitor?.expires_at?.slice(0, 16)} id="monitorExpiresAt" name="expiresAt" required type="datetime-local" />
                </div>
              </div>
              <textarea className="field min-h-20" defaultValue={adultMonitor ? "限定モニター設定を更新" : "限定モニター開始"} maxLength={500} name="adminNote" required />
              <button className="button bg-violet-700 hover:bg-violet-800" type="submit">
                モニター開始・全工程を一括許可
              </button>
            </form>
            {adultMonitor ? (
              <form action={stopCloudAdultMonitorAction.bind(null, user.id)} className="mt-6 border-t border-violet-200 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <select className="field" defaultValue="paused" name="status">
                    <option value="paused">一時停止</option>
                    <option value="completed">モニター完了</option>
                    <option value="revoked">許可取消</option>
                  </select>
                  <input className="field" maxLength={500} name="adminNote" placeholder="停止理由（必須）" required />
                </div>
                <button className="button-secondary mt-4 border-red-300 text-red-700" type="submit">
                  モニターと全工程を停止
                </button>
              </form>
            ) : null}
          </>
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
