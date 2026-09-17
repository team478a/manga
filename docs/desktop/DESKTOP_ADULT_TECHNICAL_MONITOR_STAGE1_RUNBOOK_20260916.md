# MANGAI Desktop Adult 技術モニターStage 1開始準備

作成日: 2026-09-16

## 1. 目的

運営側にWindows 11／NVIDIA VRAM 12GB以上の検証端末がない場合に、適格な1名の技術モニター端末で実機受入れを行う。ただし候補者選考、Stage 0受入れ、Stage 1招待を分離し、未署名installerや未固定Bundleを外部配布しない。

成人向けProject、Prompt、参照画像、mask、生成画像、完成PageはMANGAI Cloud、一般向けCloud AI、外部Provider、診断、候補者台帳へ送信しない。遠隔強制停止は未実装であり、既存の配布停止・個別連絡・利用者によるRuntime停止を維持する。

## 2. 現在開始できる範囲

技術モニター候補の募集と、内容非保持のPC適格性確認までは開始できる。候補判定が成功しても、アプリ配布、招待、Runtime取得、model取得、生成は許可されない。

Stage 0の実機受入れを開始するには、次が必要である。

- 信頼された証明書で署名した受入れ試験専用version
- installer、製品EXE、blockmap、SBOM、checksumの固定
- ComfyUI、checkpoint、VAE、ControlNet、4 workflowの固定Bundle検証
- 受入れ担当者との実施日時、停止連絡手段、削除期限を含む個別調整
- 受入れ試験専用artifactとStage 1招待配布物を別versionまたは別配布記録として管理

Stage 0の4方式、保存、Page配置、PDF、backup／別Project復元が合格し、12GB実機証跡を取り込んだ後にだけ、統合release readinessを再判定してStage 1へ進む。

## 3. 候補者条件

- 18歳以上
- Windows 11
- NVIDIA専用GPU、VRAM 12GB以上
- RAM 16GB以上（32GB以上推奨）
- 空き容量40GB以上（50GB以上推奨）
- 初回の支援付き実行と24時間観察が可能
- ComfyUIとmodelを公式配布元から本人が取得できる
- 架空の成人だけを扱い、未成年、年齢不明、実在人物、非同意・搾取表現を使用しない
- 作品内容を含まない技術情報だけを報告できる
- local backupと手動Runtime停止の手順を確認できる

## 4. 候補者preflight

実台帳はGitへ保存せず、アクセス制限された運用領域へ置く。氏名、メール、端末名、serial、IP、MAC address、作品名、Prompt、画像、自由記述、local絶対pathをJSONへ含めない。連絡先は既存の連絡管理で別に保持し、candidate IDとの対応表をGitや診断へ複製しない。

候補者JSONは手編集せず、専用generatorへ選択式のPC環境帯と、本人が確認した項目だけを渡す。generatorは氏名やメールから導出しないrandomな`candidate-` IDと確認日時を作り、Git管理外の既存directoryに新規保存する。氏名、メール、連絡先、自由記述を引数へ渡す機能はない。確認flagを省略した項目は`false`となり、preflight strictで停止する。

```powershell
$privateRoot = "<既存のアクセス制限されたGit管理外directory>"
$candidate = Join-Path $privateRoot "candidate.json"
$assessment = Join-Path $privateRoot "assessment.json"
npm run desktop:adult:technical-monitor:candidate:create -- `
  --windows windows_11 `
  --gpu-vendor nvidia `
  --vram-band 12gb `
  --ram-band 32gb_or_more `
  --free-disk-band 50gb_or_more `
  --confirm-assisted-first-run `
  --confirm-observation-24-hours `
  --confirm-age-18-or-older `
  --confirm-fictional-adults-only `
  --confirm-prohibited-content-policy `
  --confirm-local-only-boundary `
  --confirm-official-source-downloads `
  --confirm-content-free-diagnostics `
  --confirm-local-backup-responsibility `
  --confirm-manual-stop-procedure `
  --out $candidate
$env:MANGAI_ADULT_PILOT_TECHNICAL_MONITOR_CANDIDATE_PATH = $candidate
npm run desktop:adult:technical-monitor:preflight
npm run desktop:adult:technical-monitor:preflight:strict -- --result-out $assessment
$candidateId = (Get-Content -LiteralPath $assessment -Raw | ConvertFrom-Json).candidateId
```

候補者JSONとassessmentは相対path、UNC、repository内への出力、存在しない出力directory、既存fileの上書きを拒否する。通常preflightは適格／不適格と不足項目を表示する。strictは1項目でも不足すれば終了コード1となる。出力assessmentは環境帯、失敗check、warningだけを含み、常に`distributionAuthorized=false`である。`DESKTOP_ADULT_TECHNICAL_MONITOR_CANDIDATE.example.json`はfail-closedなschema例であり、実候補者用にcopy・編集しない。

RAM 16〜31GBと空き容量40〜49GBは最低条件内だがwarningとする。VRAM 12GB未満、Windows 11以外、NVIDIA以外、確認未完了は不適格である。自己申告は候補選考専用であり、Stage 0ではComfyUI `/system_stats`とMANGAI実機証跡で再検証する。

## 5. Stage 0: 支援付き実機受入れ

Stage 0を開始する前に、候補assessmentと実施計画をアクセス制限されたGit管理外の運用領域へ置く。計画は手編集せず、候補assessmentと同じrandom candidate ID、支援日時、14日以内の削除期限と3つの明示確認を専用generatorへ渡す。Desktop version、受入れ専用目的、Stage 1分離、配布未許可はgeneratorが固定する。氏名、メール、端末名、作品内容、Prompt、画像、絶対path、自由記述は計画へ記録しない。

```powershell
$stage0Plan = "<access-controlled-stage0-plan.jsonの絶対path>"
npm run desktop:adult:stage0-plan:create -- `
  --candidate-id $candidateId `
  --scheduled-start "<UTC ISO日時>" `
  --delete-by "<実施後14日以内のUTC ISO日時>" `
  --confirm-assisted-session `
  --confirm-stop-contact `
  --confirm-evidence-transfer `
  --out $stage0Plan
```

generatorは過去の実施日時、14日を超える保持、確認漏れ、相対path、repository内への出力、既存fileの上書きを拒否する。出力には候補者の本人情報や出力pathを含めず、成功しても`stage1DistributionAuthorized=false`を維持する。`DESKTOP_ADULT_STAGE0_PLAN.example.json`はfail-closedなschema例であり、実施計画としてそのまま使わない。

```powershell
$env:MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH = "<access-controlled-assessment.json>"
$env:MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH = $stage0Plan
$env:MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH = "<access-controlled-stage0-artifact-evidence.json>"
$env:MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH = "<access-controlled-bundle-evidence.json>"
npm run desktop:adult:stage0-readiness
npm run desktop:adult:stage0-readiness:strict
```

専用gateは候補assessment、Windowsコード署名、固定Bundle、責任者承認、支援・停止連絡・証跡回収計画をまとめて検査する。12GB実機4方式証跡はStage 0で採取するため開始条件には含めず、`COLLECT_DURING_STAGE0`と表示する。gateが成功しても`stage1DistributionAuthorized=false`を維持し、招待配布を許可しない。

2026-09-16時点ではGitHub Actionsに`WIN_CSC_LINK`／`WIN_CSC_KEY_PASSWORD`が登録されておらず、コード署名と固定Bundle実ファイル検証も未完了のため、Stage 0 gateは正しく`BLOCKED`となる。秘密値をGit、計画JSON、assessment、診断へ保存しない。

Stage 0受入れ専用artifactは、既存PFX方式に加えてWindows証明書ストア／ハードウェアトークン方式でローカル署名できる。`npm run desktop:signing:preflight`で資格情報を表示せず構成を確認し、詳細は`WINDOWS_INSTALLER.md`と`WINDOWS_CODE_SIGNING_DECISION_20260916.md`に従う。これは署名経路の準備であり、証明書購入、artifact署名、候補者への送付またはStage 0開始を許可しない。

署名後は、installer、blockmap、更新metadata、SBOM、checksumと、install後または展開後の製品EXEを同じWindows署名端末で検証する。証跡は既存fileを上書きせず、アクセス制限された運用領域へ出力する。

```powershell
$artifactEvidence = "<access-controlled-stage0-artifact-evidence.json>"
npm run desktop:adult:stage0-artifact-evidence -- `
  --directory "<Desktop内のStage 0 release directory名>" `
  --product-exe "<署名済みMANGAI Desktop.exeの絶対path>" `
  --out $artifactEvidence
$env:MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH = $artifactEvidence
```

この証跡はversion、`Valid`判定、同一署名者判定、6ファイルのSHA-256だけを保持し、絶対path、証明書thumbprint、subject、PIN、作品内容を保持しない。Stage 0 gateはRC台帳の`passed`記載だけを署名証拠として信頼せず、この実artifact証跡を必須とする。証跡が成功しても`stage1DistributionAuthorized=false`であり、Stage 1の署名付き自動更新・release readinessは別に合格させる。

固定Bundleは`desktop:adult:pilot-local-bundle:verify -- --evidence-out`で作成した元証跡を、`desktop:adult:pilot-bundle-evidence:import`でmanifestへ取り込む。取込処理は元証跡全体のSHA-256、元manifestのSHA-256、4 artifactの容量・SHA-256、4 workflowとmappingのSHA-256を内容非保持の`verification`としてmanifestへ固定する。Stage 0 gateには取込に使用した同一の元証跡を指定する。

```powershell
$env:MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH = "<access-controlled-bundle-evidence.json>"
```

`fixed`という文字列だけを手作業で設定してもREADYにはならない。元証跡の改変、重複artifact ID、未知field、容量・digest不一致、workflow digest不一致、取込verification不一致はfail closedで拒否する。元証跡には実pathや作品内容を含めず、Gitへcommitしない。

readiness strict成功後は、同じ候補assessment、計画、署名artifact証跡、Bundle証跡と、現在の固定Bundle manifest、責任者承認を1つの内容非保持operation packageへSHA-256で固定する。operation packageはアクセス制限されたGit管理外の既存directoryへ新規作成し、実施直前に同じ6 sourceで再検証する。

```powershell
$stage0Package = Join-Path $privateRoot "stage0-operation-package.json"
npm run desktop:adult:stage0-operation-package:create -- `
  --assessment $assessment `
  --plan $stage0Plan `
  --artifact-evidence $artifactEvidence `
  --bundle-evidence $env:MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH `
  --out $stage0Package

npm run desktop:adult:stage0-operation-package:verify -- `
  --assessment $assessment `
  --plan $stage0Plan `
  --artifact-evidence $artifactEvidence `
  --bundle-evidence $env:MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH `
  --package $stage0Package
```

作成・再検証の両方でStage 0 readiness strictを再実行する。6 sourceはreadiness strictの前後で再読込し、byte単位で同一の場合だけ検査済みsnapshotとして使用する。candidate ID、Desktop version、実施日時、削除期限、6 sourceのいずれかが違う場合、sourceが検査中に改変された場合、現在のreadinessがBLOCKEDへ戻った場合はfail closedで停止する。operation packageは実path、氏名、メール、作品内容、Prompt、画像、署名者情報を保存せず、`stage1DistributionAuthorized=false`を固定する。成功はartifact送付やStage 0開始の承認ではない。

実施対象、署名artifact、固定Bundle、支援日時が確定し、責任者がその1回のStage 0開始を明示承認した後にだけ、開始承認fileを作成する。4つの確認flagは、責任者承認、受入れ試験限定、遠隔強制停止がなく手動停止である制約、Stage 1配布未許可をそれぞれ確認した記録である。実operation packageと同じアクセス制限領域へ新規作成し、copy、rename、上書き、再利用をしない。

```powershell
$stage0Authorization = Join-Path $privateRoot "stage0-start-authorization.json"
npm run desktop:adult:stage0-start-authorization:create -- `
  --assessment $assessment `
  --plan $stage0Plan `
  --artifact-evidence $artifactEvidence `
  --bundle-evidence $env:MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH `
  --package $stage0Package `
  --confirm-owner-approved `
  --confirm-acceptance-only `
  --confirm-manual-stop `
  --confirm-stage1-blocked `
  --out $stage0Authorization
```

支援付き実施の開始直前に、同じsource、operation package、開始承認を再検証して1回だけ消費する。消費記録は固定operation packageの隣へ排他的に作成され、同じpackageの再消費、別pathへcopyしたpackage、削除期限切れ、承認前の時計、承認後のsource改変を拒否する。

```powershell
npm run desktop:adult:stage0-start-authorization:consume -- `
  --assessment $assessment `
  --plan $stage0Plan `
  --artifact-evidence $artifactEvidence `
  --bundle-evidence $env:MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH `
  --package $stage0Package `
  --authorization $stage0Authorization
```

`consume`は承認消費記録を作るだけで、Runtime起動、model取得、artifact送付、生成を自動実行しない。消費成功後も、承認済みの支援付き手順だけを手動で開始する。開始できなかった場合に消費記録を削除して再利用せず、新しい日時、operation package、開始承認を作り直して責任者の明示承認を取り直す。開始承認と消費記録はいずれも本人情報、実path、作品内容を保存せず、`stage1DistributionAuthorized=false`を固定する。

1. 候補者preflight strict成功とStage 0 readiness strict成功を確認する。
2. 署名済み受入れ試験専用artifactの署名、checksum、SBOMを確認し、内容非保持のartifact証跡をStage 0 gateへ接続する。
3. 固定operation packageを検証し、対象の1回に限る責任者承認から開始承認を作成する。
4. 実施直前に開始承認を1回だけ消費する。
5. 初回は支援付きでinstallし、公式配布元から固定ComfyUI／modelを取得する。MANGAIから再配布しない。
6. AI一括診断でWindows、GPU、VRAM、ComfyUI version、model、workflowを確認する。
7. 内容を特定しない架空の成人用fixtureでText-to-Image、Image-to-Image、ControlNet、Inpaintingを各1回だけ実施する。
8. 素材保存、Page配置、再起動復元、PDFまたは画像書き出し、backupから別Project復元を確認する。
9. Prompt、画像、Project名、絶対pathを含まない実機証跡JSONだけを安全な受渡し領域で回収する。
10. 同じoperation package、開始承認と実機証跡からStage 0完了証跡を作成する。
11. 完了証跡を指定して`phase5:hardware-evidence:import`で12GB profileへ取り込み、統合release readinessを再実行する。
12. 24時間以上、データ消失、意図しない通信、起動不能、安全境界違反がないことを確認する。

```powershell
$hardwareEvidence = "<回収したphase5-hardware-evidence.jsonの絶対path>"
$stage0Completion = "${stage0Package}.stage0-completion.json"

npm run desktop:adult:stage0-completion-evidence -- `
  --assessment $assessment `
  --plan $stage0Plan `
  --artifact-evidence $artifactEvidence `
  --bundle-evidence $env:MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH `
  --package $stage0Package `
  --authorization $stage0Authorization `
  --hardware-evidence $hardwareEvidence

npm run phase5:hardware-evidence:import -- `
  $hardwareEvidence `
  --stage0-completion $stage0Completion `
  --stage0-package $stage0Package
npm run desktop:adult:pilot-release-readiness:strict
```

完了証跡は固定operation packageの隣に排他的に作成され、取込時にも元packageの内容SHA-256と場所SHA-256を再照合する。開始承認の消費前に作成された実機証跡、予定開始前の消費、別packageへ移動した開始記録、別pathへ移動した実機証跡、改変された証跡、期限切れを拒否する。同じpackageへ完了証跡を上書きできないため、別セッションの結果を流用しない。完了証跡と受入れ表には内容や実pathを保持せず、合格後も`stage1DistributionAuthorized=false`を維持する。

Stage 0 artifactはPilot招待物ではない。同じ候補者をStage 1へ進める場合も、責任者確認後にStage 1用の配布記録と招待台帳entryを新規作成する。

## 6. Stage 1: 1名招待

Stage 0合格後、次をすべて満たす場合だけ1名へ招待する。

- `npm run desktop:adult:pilot-release-readiness:strict`成功
- 署名済みPilot versionと更新経路を固定済み
- 招待台帳検査成功
- 18歳以上、禁止入力、local-only、内容非保持診断、backup、手動停止へ同意済み
- 配布version、配布日時、停止状態を内容非保持台帳へ記録済み
- 責任者がStage 1開始を確認済み

最初の1枚は支援付きで実施する。24時間以上の観察後、重大障害0件の場合だけStage 2を提案する。Stage 2／3を自動開始しない。

### 6.1 一回限定の招待承認

Stage 1の実招待では、会話上の継続指示や過去のPilot開始承認を流用しない。統合release readiness strictが成功し、同じ候補者のStage 0完了証跡が12GB受入れ表へ取り込まれ、進行中のStage 1招待がないことを確認した後に、その1名・そのPilot version・24時間以内の1回だけを責任者が明示承認する。

承認fileは候補assessment、Stage 0 operation packageと完了証跡、招待台帳、RC状態、固定Bundle、12GB受入れ表、責任者承認の内容と場所をSHA-256で固定する。候補IDから導出しないrandomなmonitor IDを割り当てるが、標準出力へ候補ID、monitor ID、実pathを表示しない。氏名、メール、作品内容、Prompt、画像、端末識別情報、絶対pathは保存しない。

```powershell
$stage1Authorization = Join-Path $privateRoot "stage1-invitation-authorization.json"
$stage1ExpiresAt = "<作成から24時間以内かつStage 0証跡削除期限より前のUTC ISO日時>"
$pilotVersion = "<署名済みStage 1 Pilot version>"
$ledger = "<access-controlled-invite-ledger.jsonの絶対path>"

npm run desktop:adult:stage1-invitation-authorization:create -- `
  --assessment $assessment `
  --stage0-package $stage0Package `
  --stage0-completion $stage0Completion `
  --ledger $ledger `
  --pilot-version $pilotVersion `
  --expires-at $stage1ExpiresAt `
  --confirm-owner-approved `
  --confirm-signed-pilot-artifact `
  --confirm-assisted-first-panel `
  --confirm-observation-24-hours `
  --confirm-manual-stop `
  --out $stage1Authorization
```

配布直前に同じsourceで再検証し、承認を1回だけ消費する。source改変、承認fileのcopy・移動、期限切れ、release readiness後退、候補不一致、進行中Stage 1、個人情報または作品内容を含む台帳をfail closedで拒否する。

```powershell
npm run desktop:adult:stage1-invitation-authorization:consume -- `
  --assessment $assessment `
  --stage0-package $stage0Package `
  --stage0-completion $stage0Completion `
  --ledger $ledger `
  --authorization $stage1Authorization
```

`consume`は固定sidecar receiptを排他的に作るだけで、artifact送信、招待メール、Runtime／model取得、生成、台帳更新を自動実行しない。消費後にだけ承認対象へ手動配布し、6.2の手順で実際の配布日時を含むproposalを作成・検査してから別途運用台帳へ反映する。配布できなかった場合はreceiptを削除して再利用せず、新しい承認を責任者へ依頼する。

### 6.2 配布後の招待台帳proposal

手動配布が実際に完了した後、配布先、停止連絡、作品内容のlocal保持を確認してから、運用台帳を直接編集せず別fileのproposalを作成する。generatorは承認fileと固定sidecar receipt、候補assessment、承認時点の台帳を照合し、candidate IDや個人情報を含めず、random monitor IDの`INVITED` entryだけを追加する。

```powershell
$distributedAt = "<実配布日時のUTC ISO日時>"
$ledgerProposal = "$stage1Authorization.ledger-proposal.json"

npm run desktop:adult:stage1-invite-ledger-proposal:create -- `
  --authorization $stage1Authorization `
  --assessment $assessment `
  --ledger $ledger `
  --distributed-at $distributedAt `
  --confirm-manual-distribution-completed `
  --confirm-recipient-matched `
  --confirm-stop-contact-shared `
  --confirm-content-remained-local

$previousLedgerPath = $env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH
$env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH = $ledgerProposal
npm run desktop:adult:pilot-ledger:check
$env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH = $previousLedgerPath
```

proposal作成は既存台帳を変更せず、配布、招待メール、Runtime／model、生成も実行しない。承認file／receiptのcopy・改変、承認時点から変化したassessment／台帳、配布前日時、未来日時、期限切れ、個人情報、重複monitor ID、進行中Stage 1、proposal上書きをfail closedで拒否する。

### 6.3 検査済みproposalの運用台帳反映

6.2の検査が成功した同じproposalだけを、最初にread-only監査する。監査は承認、消費receipt、候補assessment、台帳、proposal、backup、intent、適用receiptを再検証し、fileを変更しない。

```powershell
npm run desktop:adult:stage1-invite-ledger:audit -- `
  --authorization $stage1Authorization `
  --assessment $assessment `
  --ledger $ledger
```

`PROPOSAL_READY`は未適用、`APPLY_PREPARED`はbackup／intent作成後かつ台帳置換前、`RECOVERY_REQUIRED`は台帳置換後かつreceipt確定前、`APPLIED`は証跡を含む適用完了を表す。適用準備後はintentの準備時刻を境界に検証するため承認期限後も中断・完了状態を監査できるが、新しい適用開始を許可しない。監査は対象付き承認を作成・代替せず、不完全・矛盾・改変証跡を安全側で停止し、candidate ID、monitor ID、pathを標準出力へ表示しない。

監査で`PROPOSAL_READY`を確認し、対象proposalを明記した運用承認を得た場合だけ、次のCLIで運用台帳へ反映する。proposal、承認、消費receipt、候補assessment、承認時点の原本台帳を再検証し、固定backupと適用intentをアクセス制限領域へ保存してから、同じdirectoryの一時fileを使って原本台帳を置換する。

```powershell
npm run desktop:adult:stage1-invite-ledger-proposal:apply -- `
  --authorization $stage1Authorization `
  --assessment $assessment `
  --ledger $ledger `
  --confirm-proposal-reviewed `
  --confirm-recovery-backup `
  --confirm-ledger-apply

$env:MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH = $ledger
npm run desktop:adult:pilot-ledger:check
npm run desktop:adult:stage1-invite-ledger:audit -- `
  --authorization $stage1Authorization `
  --assessment $assessment `
  --ledger $ledger
```

固定backupは`$stage1Authorization.ledger-before-apply.json`、intentは`$stage1Authorization.ledger-apply-intent.json`、適用receiptは`$stage1Authorization.ledger-applied.json`である。candidate ID、氏名、メール、作品内容、local pathを保存しない。原本、proposal、承認source、backup、intentの不一致、期限外、二重適用、適用中の変更をfail closedで拒否する。

台帳置換後かつreceipt確定前に中断した場合は、backup、intent、proposalを削除・編集せず、同じ引数と3つの確認flagでもう一度実行する。CLIは「現在の台帳=検査済みproposal」「backup=承認時点の原本」「intent=同じ承認とdigest」を再確認し、台帳を再置換せずreceiptだけを確定する。backup、intent、receiptの削除は通常の再実行手段にしない。

apply CLIは招待、配布、メール、Runtime／model、生成、credit操作を実行しない。現在の正本でCLIを実行してよいことを意味せず、実proposal適用は外部前提完了と対象付き運用承認を必要とする。

### 6.4 招待後の状態遷移proposal

同意確認、停止、完了、辞退を記録する場合は、運用台帳を直接編集せず、`DESKTOP_ADULT_PILOT_INVITE_LEDGER.md`の状態遷移proposalを作成する。許可する遷移は`INVITED→ACTIVE/WITHDRAWN`と`ACTIVE→STOPPED/COMPLETED/WITHDRAWN`だけである。終端状態からの再開は行わない。

```powershell
$statusProposal = Join-Path $privateRoot "stage1-status-proposal.json"
$occurredAt = "<状態遷移を確認したUTC ISO日時>"

npm run desktop:adult:pilot-ledger-status-proposal:create -- `
  --ledger $ledger `
  --out $statusProposal `
  --monitor-id "<招待台帳のrandom monitor ID>" `
  --target-status ACTIVE `
  --occurred-at $occurredAt `
  --confirm-status-evidence-reviewed `
  --confirm-content-remained-local `
  --confirm-consent-recorded
```

`ACTIVE`以外では対象状態に対応する`--confirm-stop-action-recorded`、`--confirm-completion-reviewed`、`--confirm-withdrawal-recorded`を指定する。proposalは元台帳の内容・場所、対象monitor、遷移時刻、更新後台帳を固定するが、運用台帳を変更しない。氏名、メール、問い合わせ本文、作品内容、端末識別情報、local pathは記録しない。

proposal作成後とapplyの前後は、まずread-only監査で現在状態を確認する。

```powershell
npm run desktop:adult:pilot-ledger-status:audit -- `
  --ledger $ledger `
  --proposal $statusProposal
```

`PROPOSAL_READY`は未適用、`APPLY_PREPARED`はbackup／intent作成後かつ台帳置換前、`RECOVERY_REQUIRED`は台帳置換後かつreceipt確定前、`APPLIED`は証跡を含む適用完了を表す。監査はfileを変更せず、対象付き承認を作成・代替しない。不完全・矛盾・改変証跡は安全側に停止し、monitor IDとpathを標準出力へ表示しない。

対象proposalを明記した運用承認とレビュー完了後だけ、次の専用applyを実行する。

```powershell
npm run desktop:adult:pilot-ledger-status-proposal:apply -- `
  --ledger $ledger `
  --proposal $statusProposal `
  --confirm-proposal-reviewed `
  --confirm-recovery-backup `
  --confirm-ledger-apply

npm run desktop:adult:pilot-ledger:check
npm run desktop:adult:pilot-ledger-status:audit -- `
  --ledger $ledger `
  --proposal $statusProposal
```

固定backup、intent、receiptはproposal pathから導出される。中断時は各fileを変更せず同じコマンドを再実行し、検査済み台帳への置換後であればreceiptだけを復旧する。CLIの実装完了は実proposalの適用承認を意味しない。

現在の正本は署名、固定Bundle、12GB Stage 0実機証跡が未完了であり、release readiness strictが失敗するため、実承認の作成・消費はできない。CLIの実装完了はStage 1配布許可を意味しない。

## 7. 停止条件

次のいずれかで受入れと新規配布を停止する。

- 未署名、署名不正、checksum不一致
- 成人向けデータのCloud／外部Provider送信の疑い
- 未成年、年齢不明、実在人物、非同意・搾取表現の拒否を迂回可能
- Project、素材、Page、backupの回復不能な消失
- Prompt、画像、秘密値、絶対pathが診断またはassessmentへ混入
- 起動不能、書き出し不能、または同一重大障害が2端末以上

停止時は新規配布を止め、利用者へ生成キャンセル、Runtime停止、アプリ終了を依頼する。Projectとlocal AI rootを自動削除しない。詳細は`DESKTOP_ADULT_PILOT_STOP_RECOVERY_RUNBOOK_20260901.md`に従う。

## 8. 完了判定

この準備で技術モニター候補の内容非保持screeningを`READY`とする。Desktop Adult Pilot配布は、署名、固定Bundle、12GB Stage 0実機証跡、統合release readiness strict成功まで`BLOCKED`を維持する。
