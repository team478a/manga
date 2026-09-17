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

### Stage 1初回proposalのread-only監査

Stage 1初回proposalの作成後、apply前、適用中断後、適用後は、運用台帳へ書き込む前にread-only監査を実行する。監査は承認、消費receipt、候補assessment、台帳、proposal、backup、intent、適用receiptの組合せとdigestを検査するだけで、fileの作成・更新・削除、招待、配布、Runtime／model、生成、credit操作を行わない。

```powershell
npm run desktop:adult:stage1-invite-ledger:audit -- `
  --authorization $stage1Authorization `
  --assessment $assessment `
  --ledger $env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH
```

- `PROPOSAL_READY`: 現在の台帳が承認時点の原本で、適用証跡はまだない。承認有効期間内にproposalレビューへ進む。
- `APPLY_PREPARED`: backupとintentは一致するが、台帳は原本のままである。中断原因を確認し、対象付き承認が現在も有効な場合だけapplyを再実行する。
- `RECOVERY_REQUIRED`: 台帳はproposalと一致するがreceiptがない。backup、intent、proposalを変更せず、同じapplyコマンドでreceipt回復を行う。
- `APPLIED`: 台帳、backup、intent、receiptがすべて一致し、適用完了を確認できる。applyを再実行しない。

適用準備後はintentの準備時刻を承認境界として検証するため、承認期限後も中断状態と適用済み証跡を監査できる。ただし期限後に新しい適用を開始してよいという意味ではない。証跡の一部欠損、receiptと台帳の矛盾、改変、適用前後のどちらでもない台帳は終了コード1で停止する。監査成功はproposalレビュー、対象付き適用承認、再実行承認の代わりにならず、標準出力にはcandidate ID、monitor ID、pathを表示しない。

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

proposal作成は実台帳、Runtime、model、生成、配布、招待、creditを変更しない。元台帳の作成中変更、未来日時、配布前日時、同意前の終端遷移、個人情報・作品内容・local path、既存proposalの上書きをfail closedで拒否する。

### 状態遷移のread-only監査

proposal作成後、適用前、適用中断後、適用後のいずれでも、最初にread-only監査を実行する。監査は台帳、proposal、backup、intent、receiptの組合せとdigestを検査するだけで、fileの作成・更新・削除、状態遷移の適用、外部処理を行わない。

```powershell
npm run desktop:adult:pilot-ledger-status:audit -- `
  --ledger $env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH `
  --proposal $statusProposal
```

- `PROPOSAL_READY`: 現在の台帳がproposalの元台帳で、適用証跡はまだない。proposalレビューへ進む。
- `APPLY_PREPARED`: backupとintentは一致するが、台帳は元の状態である。中断原因を確認し、対象付き承認が現在も有効な場合だけapplyを再実行する。
- `RECOVERY_REQUIRED`: 台帳は更新後と一致するがreceiptがない。backup、intent、proposalを変更せず、同じapplyコマンドでreceipt回復を行う。
- `APPLIED`: 台帳、backup、intent、receiptがすべて一致し、適用完了を確認できる。applyを再実行しない。

証跡の一部欠損、receiptと台帳の矛盾、改変、適用前後のどちらでもない台帳は終了コード1で停止する。監査成功はproposalレビュー、対象付き適用承認、再実行承認の代わりにならない。標準出力にはmonitor IDとpathを表示しない。

### Stage 1運用ライフサイクルの統合read-only監査

初回招待から現在の状態までをまとめて確認する場合は、初回招待承認、候補assessment、現在の運用台帳と、状態遷移proposalを古い順に指定する。状態遷移がまだない場合は`--status-proposal`を省略する。

```powershell
npm run desktop:adult:stage1-lifecycle:audit -- `
  --authorization $stage1Authorization `
  --assessment $assessment `
  --ledger $env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH `
  --status-proposal $activeProposal `
  --status-proposal $completedProposal
```

統合監査は、初回招待の承認・消費receipt・assessment・proposal・backup・intent・適用receiptを起点に、各状態遷移の元台帳と更新後台帳を順番に連結する。途中のproposalは`APPLIED`でなければならず、最後のproposalだけが`PROPOSAL_READY`、`APPLY_PREPARED`、`RECOVERY_REQUIRED`、`APPLIED`のいずれかになれる。履歴の欠落、順序違い、同じproposalの重複、別monitorのproposal混入、証跡改変、監査中の台帳変更は終了コード1で停止する。

出力する`Current status`は検証済みの現在台帳に対応する。`RECOVERY_REQUIRED`では台帳置換後のtarget状態を示すが、receipt回復の承認を意味しない。統合監査はfileを作成・更新・削除せず、招待、配布、状態適用、Runtime／model、生成、credit操作を行わない。candidate ID、monitor ID、pathも標準出力へ表示しない。監査成功は個別proposalのレビュー、対象付き適用承認、再実行承認を代替しない。

### 状態遷移proposalの適用

レビュー済みproposalを運用台帳へ反映する場合は、対象proposalを明記した運用承認を得てから専用apply CLIを使用する。CLIの実装、テスト成功、過去の包括承認だけでは実proposalを適用できない。

```powershell
npm run desktop:adult:pilot-ledger-status-proposal:apply -- `
  --ledger $env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH `
  --proposal $statusProposal `
  --confirm-proposal-reviewed `
  --confirm-recovery-backup `
  --confirm-ledger-apply

npm run desktop:adult:pilot-ledger:check
npm run desktop:adult:pilot-ledger-status:audit -- `
  --ledger $env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH `
  --proposal $statusProposal
```

固定backupは`$statusProposal.ledger-before-apply.json`、intentは`$statusProposal.apply-intent.json`、適用receiptは`$statusProposal.applied.json`である。applyは元台帳の内容・場所、proposal全体、更新後台帳をSHA-256で固定し、対象entry以外の変更、対象状態の不一致、時系列不整合、既存証跡との衝突、二重適用、適用中の変更をfail closedで拒否する。同一directoryの一時fileをfsyncしてから台帳pathへ原子的に置換する。

台帳置換後かつreceipt確定前に中断した場合は、台帳、backup、intent、proposalを編集・削除せず、同じ引数と3つの確認flagでもう一度実行する。CLIは「現在の台帳=proposalの更新後台帳」「backup=proposalが固定した元台帳」「intent=同じproposalと各digest」を再確認し、台帳を再置換せずreceiptだけを確定する。

intentとreceiptにはmonitor ID、氏名、メール、作品内容、local pathを保存しない。apply CLIは招待、配布、メール、Runtime／model、生成、credit操作を実行しない。

## 保存禁止

氏名、メール、住所、電話、端末名、Project名、Prompt、Negative Prompt、参照画像、mask、生成画像、完成Page、作品説明、自由記述、秘密値、絶対pathを保存しない。問い合わせ内容は停止・復旧ランブックの内容非保持項目だけを別管理する。
