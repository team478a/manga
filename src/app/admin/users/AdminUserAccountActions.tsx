"use client";

import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  deleteAdminUserAction,
  restoreAdminUserAction,
  suspendAdminUserAction,
} from "./account-actions";

type Props = {
  accountState: "active" | "suspended" | "deleted" | "unknown";
  canManage: boolean;
  displayName: string;
  profileId: string;
};

export function AdminUserAccountActions({
  accountState,
  canManage,
  displayName,
  profileId,
}: Props) {
  if (!canManage) {
    return <span className="text-sm text-stone-500">保護対象</span>;
  }
  if (accountState === "deleted") {
    return <span className="text-sm font-semibold text-red-700">削除済み</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {accountState === "suspended" ? (
        <form action={restoreAdminUserAction.bind(null, profileId)}>
          <PendingSubmitButton
            className="button-secondary min-h-9 px-3 py-1 text-sm"
            pendingLabel="再開中…"
          >
            再開
          </PendingSubmitButton>
        </form>
      ) : (
        <form
          action={suspendAdminUserAction.bind(null, profileId)}
          onSubmit={(event) => {
            if (!window.confirm(`${displayName}さんのログインを停止しますか？`)) {
              event.preventDefault();
            }
          }}
        >
          <PendingSubmitButton
            className="button-secondary min-h-9 px-3 py-1 text-sm"
            disabled={accountState === "unknown"}
            pendingLabel="停止中…"
          >
            停止
          </PendingSubmitButton>
        </form>
      )}
      <form
        action={deleteAdminUserAction.bind(null, profileId)}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `${displayName}さんを削除しますか？この操作は元に戻せず、ログインできなくなります。`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <PendingSubmitButton
          className="button-secondary min-h-9 px-3 py-1 text-sm text-red-700"
          disabled={accountState === "unknown"}
          pendingLabel="削除中…"
        >
          削除
        </PendingSubmitButton>
      </form>
    </div>
  );
}
