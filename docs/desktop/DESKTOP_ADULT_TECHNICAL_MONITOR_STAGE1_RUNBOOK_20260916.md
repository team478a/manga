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

`DESKTOP_ADULT_TECHNICAL_MONITOR_CANDIDATE.example.json`を運用領域へcopyし、氏名やメールから導出していないrandomな`candidate-` IDを設定する。exampleは誤配布防止のため全条件を不適格にしてあり、そのままではstrict成功しない。

```powershell
$candidateId = "candidate-$((New-Guid).Guid.Replace('-', '').Substring(0, 12))"
```

```powershell
$env:MANGAI_ADULT_PILOT_TECHNICAL_MONITOR_CANDIDATE_PATH = "<access-controlled-candidate.json>"
$assessment = "<access-controlled-assessment.json>"
npm run desktop:adult:technical-monitor:preflight -- --result-out $assessment
npm run desktop:adult:technical-monitor:preflight:strict -- --result-out "<new-assessment-path.json>"
```

通常preflightは適格／不適格と不足項目を表示する。strictは1項目でも不足すれば終了コード1となる。出力assessmentは環境帯、失敗check、warningだけを含み、常に`distributionAuthorized=false`である。既存fileを上書きしない。

RAM 16〜31GBと空き容量40〜49GBは最低条件内だがwarningとする。VRAM 12GB未満、Windows 11以外、NVIDIA以外、確認未完了は不適格である。自己申告は候補選考専用であり、Stage 0ではComfyUI `/system_stats`とMANGAI実機証跡で再検証する。

## 5. Stage 0: 支援付き実機受入れ

Stage 0を開始する前に、候補assessmentと実施計画をアクセス制限された運用領域へ置く。`DESKTOP_ADULT_STAGE0_PLAN.example.json`をcopyし、候補assessmentと同じrandom candidate ID、Desktop version、支援日時、14日以内の削除期限を設定する。氏名、メール、端末名、作品内容、Prompt、画像、絶対path、自由記述は記録しない。

```powershell
$env:MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH = "<access-controlled-assessment.json>"
$env:MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH = "<access-controlled-stage0-plan.json>"
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

1. 候補者preflight strict成功とStage 0 readiness strict成功を確認する。
2. 署名済み受入れ試験専用artifactの署名、checksum、SBOMを確認し、内容非保持のartifact証跡をStage 0 gateへ接続する。
3. 初回は支援付きでinstallし、公式配布元から固定ComfyUI／modelを取得する。MANGAIから再配布しない。
4. AI一括診断でWindows、GPU、VRAM、ComfyUI version、model、workflowを確認する。
5. 内容を特定しない架空の成人用fixtureでText-to-Image、Image-to-Image、ControlNet、Inpaintingを各1回だけ実施する。
6. 素材保存、Page配置、再起動復元、PDFまたは画像書き出し、backupから別Project復元を確認する。
7. Prompt、画像、Project名、絶対pathを含まない実機証跡JSONだけを安全な受渡し領域で回収する。
8. `phase5:hardware-evidence:import`で12GB profileへ取り込み、統合release readinessを再実行する。
9. 24時間以上、データ消失、意図しない通信、起動不能、安全境界違反がないことを確認する。

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
