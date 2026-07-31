export function csvCell(value:unknown){const text=value==null?"":String(value);return `"${text.replaceAll('"','""')}"`;}
export function buildGeneralMonitorCsv(rows:Record<string,unknown>[]){
  const headers=["表示名","状態","グループ","AI利用数","AI上限","開始日時","期限","初回案内完了","フィードバック数","平均評価"];
  const keys=["displayName","status","cohort","aiRequestsUsed","aiRequestLimit","startsAt","expiresAt","onboardingCompletedAt","feedbackCount","averageRating"];
  return "\uFEFF"+[headers.map(csvCell).join(","),...rows.map(row=>keys.map(key=>csvCell(row[key])).join(","))].join("\r\n");
}
