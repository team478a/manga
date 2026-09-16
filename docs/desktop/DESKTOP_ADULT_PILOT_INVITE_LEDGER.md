# MANGAI Desktop Adult Pilot 招待台帳

作成日: 2026-09-01

## 目的

招待対象、配布日時、Desktop version、対応環境、同意日時、停止状態を、作品内容と個人情報を保持せず追跡する。実台帳はGitへcommitせず、アクセス制限された運用領域へ保存する。

## 作成と検査

`DESKTOP_ADULT_PILOT_INVITE_LEDGER.example.json`を運用領域へcopyし、環境変数で実台帳を指定して検査する。

```powershell
$env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH = "<access-controlled-ledger.json>"
npm run desktop:adult:pilot-ledger:check
```

検査成功だけで招待や配布は行われない。招待開始、Stage追加、停止解除は責任者の明示承認が必要である。

Stage 1の最初の1名は、`DESKTOP_ADULT_TECHNICAL_MONITOR_STAGE1_RUNBOOK_20260916.md`の一回限定招待承認を配布直前に消費してから手動配布する。消費receiptは配布を自動実行せず、台帳も自動更新しない。配布後は専用generatorで、receiptのrandom monitor ID、署名済みPilot version、実際の配布日時、候補assessmentの確認済み環境帯から、現在の台帳へ`INVITED` entryを追加した別fileのproposalを作成する。proposalを本検査で確認し、専用apply CLIで固定backupとintentを作成してから運用台帳へ反映する。適用後は内容非保持receiptを残し、二重適用を拒否する。candidate ID、承認fileのpath、氏名、メールは台帳・backup・intent・receiptへ転記しない。

技術モニター候補のPC適格性確認は、この招待台帳へ登録する前に`DESKTOP_ADULT_TECHNICAL_MONITOR_STAGE1_RUNBOOK_20260916.md`の候補preflightで行う。候補assessmentと招待台帳を混在させず、Stage 0合格とrelease readiness strict成功前に`INVITED` entryを作成しない。

## Entry契約

```json
{
  "monitorId": "monitor-012345abcdef",
  "stage": 1,
  "status": "INVITED",
  "desktopVersion": "0.1.0-beta.1",
  "environment": {
    "windows": "windows_11",
    "vramBand": "12gb"
  },
  "distributedAt": "2026-09-01T00:00:00.000Z",
  "consentedAt": null,
  "stoppedAt": null
}
```

- `monitorId`: 氏名、メール、既存account IDから導出しないrandom ID。
- `stage`: 1、2、3のみ。
- `status`: `INVITED`、`ACTIVE`、`STOPPED`、`COMPLETED`、`WITHDRAWN`。
- `environment`: Windows 11と`12gb`／`16gb_or_more`だけ。端末名やlocal pathは保存しない。
- `ACTIVE`／`COMPLETED`: ISO 8601の`consentedAt`が必須。
- `STOPPED`: ISO 8601の`stoppedAt`が必須。

## 状態遷移proposal

台帳entryの状態変更は、運用台帳を直接編集せず、アクセス制限領域へ別fileのproposalを作成してレビューする。許可する遷移は次だけである。

- `INVITED` → `ACTIVE`: 同意記録を確認し、`consentedAt`へ実確認日時を記録する。
- `INVITED` → `WITHDRAWN`: 利用開始前の辞退を記録する。
- `ACTIVE` → `STOPPED`: 停止措置を確認し、`stoppedAt`へ実停止日時を記録する。
- `ACTIVE` → `COMPLETED`: Pilot観察完了を記録する。
- `ACTIVE` → `WITHDRAWN`: 利用開始後の辞退を記録する。

`STOPPED`、`COMPLETED`、`WITHDRAWN`は終端状態であり、再開、停止解除、同一状態への再記録は行わない。再開が必要な場合は既存entryを書き換えず、責任者の対象付き承認を伴う新しい招待として設計する。

```powershell
$statusProposal = "<access-controlled-status-proposal.jsonの絶対path>"
$occurredAt = "<状態遷移を確認したUTC ISO日時>"

npm run desktop:adult:pilot-ledger-status-proposal:create -- `
  --ledger $env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH `
  --out $statusProposal `
  --monitor-id "<random monitor ID>" `
  --target-status ACTIVE `
  --occurred-at $occurredAt `
  --confirm-status-evidence-reviewed `
  --confirm-content-remained-local `
  --confirm-consent-recorded
```

対象状態に応じ、最後の確認flagを`--confirm-stop-action-recorded`、`--confirm-completion-reviewed`、`--confirm-withdrawal-recorded`へ置き換える。CLIは元台帳の内容と場所をSHA-256で結び、対象monitor、遷移前後の状態、遷移日時、固定evidence種別、更新後台帳を1つのproposalへ保存する。`COMPLETED`／`WITHDRAWN`の遷移日時は現行台帳に専用fieldがないため、proposalを運用証跡として保持する。

proposal作成は実台帳、Runtime、model、生成、配布、招待、creditを変更しない。元台帳の作成中変更、未来日時、配布前日時、同意前の終端遷移、個人情報・作品内容・local path、既存proposalの上書きをfail closedで拒否する。proposalの実台帳への反映はこのCLIの範囲外であり、専用applyと対象付き運用承認が整うまで手動反映しない。

## 保存禁止

氏名、メール、住所、電話、端末名、Project名、Prompt、Negative Prompt、参照画像、mask、生成画像、完成Page、作品説明、自由記述、秘密値、絶対pathを保存しない。問い合わせ内容は停止・復旧ランブックの内容非保持項目だけを別管理する。
