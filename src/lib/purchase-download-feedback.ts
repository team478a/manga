const purchaseDownloadFailureMessages = {
  RESOURCE_NOT_FOUND:
    "購入済みファイルを確認できませんでした。購入履歴を再読み込みして、もう一度お試しください。",
  REVISION_CONFLICT:
    "購入状態が更新されました。購入履歴を再読み込みして、現在の状態を確認してください。",
  STORAGE_TRANSACTION_ERROR:
    "ダウンロードファイルを準備できませんでした。時間をおいて、もう一度お試しください。",
  INTERNAL_ERROR:
    "ダウンロード情報を確認できませんでした。時間をおいて、もう一度お試しください。",
} as const;

export function purchaseDownloadFailureMessage(errorCode?: string) {
  if (!errorCode) return null;
  return (
    purchaseDownloadFailureMessages[
      errorCode as keyof typeof purchaseDownloadFailureMessages
    ] ?? null
  );
}
