export type CloudAiWorkerHealthInput = {
  workerReady: boolean;
  queued: number;
  running: number;
  failedLast24Hours: number;
  staleLeases: number;
  oldestQueuedAt?: string | null;
  now?: Date;
};

export type CloudAiWorkerHealth = {
  status: "stopped" | "critical" | "warning" | "active" | "idle";
  label: string;
  message: string;
  oldestQueueMinutes: number | null;
};

function queueAgeMinutes(value: string | null | undefined, now: Date) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 60_000));
}

export function getCloudAiWorkerHealth(
  input: CloudAiWorkerHealthInput,
): CloudAiWorkerHealth {
  const oldestQueueMinutes = queueAgeMinutes(
    input.oldestQueuedAt,
    input.now ?? new Date(),
  );
  if (!input.workerReady)
    return {
      status: "stopped",
      label: "停止中",
      message: "Worker設定が揃っていないため、自動生成処理は開始されません。",
      oldestQueueMinutes,
    };
  if (input.staleLeases > 0)
    return {
      status: "critical",
      label: "要対応",
      message: `処理期限を過ぎたJobが${input.staleLeases}件あります。WorkerとProviderの状態を確認してください。`,
      oldestQueueMinutes,
    };
  if (input.failedLast24Hours >= 3)
    return {
      status: "critical",
      label: "要対応",
      message: `24時間以内に${input.failedLast24Hours}件失敗しています。Provider設定と失敗理由を確認してください。`,
      oldestQueueMinutes,
    };
  if (oldestQueueMinutes !== null && oldestQueueMinutes >= 10)
    return {
      status: "warning",
      label: "滞留あり",
      message: `最も古いJobが${oldestQueueMinutes}分待機しています。Schedulerの稼働を確認してください。`,
      oldestQueueMinutes,
    };
  if (input.failedLast24Hours > 0)
    return {
      status: "warning",
      label: "失敗あり",
      message: `24時間以内に${input.failedLast24Hours}件失敗しています。Job一覧を確認してください。`,
      oldestQueueMinutes,
    };
  if (input.queued > 0 || input.running > 0)
    return {
      status: "active",
      label: "処理中",
      message: "Workerは処理可能な状態です。Queueの完了を監視してください。",
      oldestQueueMinutes,
    };
  return {
    status: "idle",
    label: "正常",
    message: "処理待ち・実行中・直近失敗のJobはありません。",
    oldestQueueMinutes,
  };
}
