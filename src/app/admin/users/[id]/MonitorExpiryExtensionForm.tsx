"use client";

import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export function MonitorExpiryExtensionForm({
  action,
  currentExpiry,
  defaultExpiryValue,
  displayName,
}: {
  action: (formData: FormData) => Promise<void>;
  currentExpiry: string;
  defaultExpiryValue: string;
  displayName: string;
}) {
  return (
    <form
      action={action}
      className="mt-5 space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-4"
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const nextExpiry = String(formData.get("expiresAt") ?? "");
        const notify = formData.get("notify") === "yes";
        if (!window.confirm(
          `${displayName}さんの利用期限だけを ${nextExpiry}（日本時間）へ延長します。\n` +
          `AI利用数・上限・開始日は変更しません。\n` +
          `案内メール: ${notify ? "送信する" : "送信しない"}\n\n実行しますか？`,
        )) event.preventDefault();
      }}
    >
      <div>
        <p className="text-sm font-bold text-violet-800">期限だけを延長</p>
        <p className="mt-1 text-sm text-stone-700">
          現在の期限: {new Date(currentExpiry).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </p>
        <p className="mt-2 rounded-lg bg-white p-3 text-sm text-stone-700">
          AI利用数・利用上限・開始日・グループは保持します。利用期限の短縮はできません。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="generalMonitorExtendedExpiry">新しい利用期限（日本時間）</label>
          <input className="field" defaultValue={defaultExpiryValue} id="generalMonitorExtendedExpiry" name="expiresAt" step="1" type="datetime-local" required />
        </div>
        <div>
          <label className="label" htmlFor="generalMonitorExtensionNote">管理者メモ</label>
          <input className="field" id="generalMonitorExtensionNote" maxLength={500} name="adminNote" required />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-lg bg-white p-3 text-sm text-stone-700">
        <input className="mt-1" name="notify" type="checkbox" value="yes" />
        <span>利用者へ期限延長の案内メールを送信する（初期値は送信しない）</span>
      </label>
      <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" pendingLabel="期限を延長中…">
        期限だけを延長
      </PendingSubmitButton>
    </form>
  );
}
