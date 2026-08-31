# MANGAI Codex ⇄ Claude Code 引継ぎ台帳

## 0.0 Desktop Adult Pilot安全取得サービス（2026-08-31）

- 固定3 modelだけを取得できるMain process downloaderを追加した。公式HTTPS host、redirect上限、保存先、空き容量、Range再開、容量、SHA、atomic確定をfail closedで検査する。
- mock 2/2でresume、危険redirect、容量不足、hash不一致を検証。Wizard／IPCへは未接続で、実network downloadは行っていない。
- 次は端末・同意gateをMain processでも再評価し、保存先dialog、進捗／cancel、IPC、Wizard buttonを接続する。

---

## 0.0 Desktop Adult ローカルAIセットアップWizard基盤（2026-08-31）

- AI設定に4段階Wizardを追加し、端末診断→利用条件→公式取得→検証の利用者フローを可視化した。
- 共通domainで12GB VRAMと3確認を取得準備条件にし、低VRAM／GPU不明端末は大型artifact取得前に停止する。
- 自動取得は未接続でbuttonを無効化。次はMain processの保存先・容量・公式URL・resume・SHA契約を実装する。
- Production、Cloud、Provider、Project、Job、credit、artifact取得・生成操作0件。

---

## 0.0 Desktop Adult Pilot license・実行端末判定（2026-08-31）

- 責任者は内部PilotでのSDXL系ローカル利用とOpen RAIL++制限継承を承認した。ComfyUI／modelは同梱せず、公式配布元から利用者が取得する方式を採用する。再配布・一般公開・Cloud・外部Providerは未承認。
- 現端末はIntel Iris Xe、RAM約16GB、`nvidia-smi`なしで12GB NVIDIA GPU条件外。Dドライブ容量は十分だが、artifact取得と実生成は開始しなかった。
- 次は条件を満たす内部端末でartifact SHA、ComfyUI v0.34.0、4方式Runtimeを検証する。Production、Cloud、Provider、Project、Job、credit操作0件。

---

## 0.0 Desktop Adult Pilot 4方式workflow（2026-08-31）

- SDXL候補向け4方式のComfyUI API workflow／mappingをcustom nodeなしで追加し、SHA-256をmanifestへ固定した。
- preflightはpath、SHA、標準node、batch 1、tiled VAE、方式別mappingを検証する。実ComfyUI未検証なのでstatusは`pending`を維持する。
- 集中3/3、Desktop 186/186、lint、全型検査、通常preflight、diff check成功。モデル取得、install、生成、Production、Cloud、Provider、Project、Job、credit操作0件。

---

## 0.0 Desktop Adult Pilot model候補固定（2026-08-31）

- 初回12GB Pilot候補をComfyUI `v0.34.0`、SDXL base、FP16 VAE、Canny ControlNetへ限定した。
- 公式revision、配布URL、LFS SHA-256、容量をmanifestへ記録したが、license責任者確認と実file再計算前なのでstatusは全件`pending`を維持する。
- Desktop 186/186、lint、全型検査、通常preflight、diff check成功。download、install、生成、Production、Cloud、Provider、Project、Job、credit操作0件。

---

## 0.0 Desktop Adult Pilot bundle preflight（2026-08-31）

- ComfyUI、4方式workflow、checkpoint、VAE、ControlNetの固定一覧を`docs/desktop/DESKTOP_ADULT_PILOT_BUNDLE.json`へ追加した。
- 通常preflightは未確定項目を列挙し、strictは全8項目と12GB実機証跡が揃うまでfail closedで停止する。現在は0/8固定、12GB pending。
- 集中2/2、Desktop 185/185、lint、全型検査、diff check成功。Production、Cloud、Provider、Project、Job、credit、モデル取得・生成操作0件。

---

## 0.0 Desktop Adult招待制モニター公開計画（2026-08-31）

- 成人向けCloudの拒否境界を維持し、Windows Desktop Adultを最大5名へ段階公開する計画を追加した。
- 初回対象はWindows 11／VRAM 12GB以上、ローカルOllama／ComfyUI、1操作1枚。Cloud同期、外部Provider、販売は含めない。
- コード署名、署名済みversion、12GB以上の内部受入れ、固定workflow／model、同意・privacy・停止運用が揃うまで配布しない。
- 文書変更のみ。Production、Cloud、Provider、Project、Job、credit操作0件。

---

## 0.0 ダッシュボード品質確認の直接導線（2026-08-30）

- 一般モニター用ダッシュボードの「限定モニター」欄へ「品質確認」ボタンを追加した。
- 遷移先は既存の`/dashboard/monitor/quality-review`で、Feature Flag、利用状態、割当有無の安全境界は不変。
- 回帰7/7、Hub 940/940、lint、Hub/Desktop型検査、Production build、diff check成功。RC preflightは構造READY。Production、Provider、Job、credit操作0件。

---

## 0.0 23–24ページPilot readiness再確認（2026-08-29）

- Productionの23–24ページは各4コマ・画像0で、採用後も8コマPilot候補を維持する。
- 最新preflightは必要16 credit／残り16、最大予約`$1.44`、`flux-2-pro`、pricing `bfl-flux2-pro-2026-08`、Worker最短3回／約15分。
- 作品画風未設定、人物設定0/0、モニターAI残り確認不可のため開始不可。責任者承認だけでなく、Visual Readinessと本人枠の解消が必要。
- 一時選択は破棄済み。Production、Provider、Worker、Job、credit操作0件。

---

## 0.0 Production再利用候補2件の採用完了（2026-08-29）

- 責任者承認に基づき、19ページの空コマ向け候補2件だけを品質確認後に採用した。
- 確定状態は作品全体15/157、未配置142、19ページ2/4、要修正273、更新番号59、生成中0ページ。
- 2件目で保存競合表示が出たため追加上書きを止め、別タブと作品画面のread-only表示で2件とも永続化済みと確認した。
- credit表示は使用4・予約0・残り16で不変。Provider、Job、credit、候補却下、他ページ操作0件。

---

## 0.0 Production再利用候補2件の採用実行ランブック（2026-08-29）

- 19ページの空コマ向け夜間足場候補2件だけを、将来の採用対象として固定した。2ページ候補、重大不良4件、完成済み22ページの余剰4件は採用しない。
- 実行前read-only確認、1件ずつの採用、Canvas保存、採用後集計、異常時停止を定義した。期待値は配置済み15/157、未配置142、ページ19画像2/4。
- Provider生成、Job登録、credit予約・消費は採用作業に含めない。責任者の明示承認前はProductionへ書き込まない。
- 本変更は文書限定で、Production、候補、Canvas、Provider、Job、credit操作0件。

---

## 0.0 Production再利用候補3件の対象コマ最終比較（2026-08-29）

- 2ページ候補は時計・焼損証拠として画質上は利用可能だが、既存の同意図画像を置き換える候補だった。空コマを埋めず完成率を改善しないため見送る。
- 19ページ候補2件は夜間足場の同一場面、男女の対峙、奥行き構図に合い、空コマ向けであることを採用preflightの警告なし表示で確認した。
- 将来採用する候補は19ページ2件へ絞り込み、採用後の未配置見込みを142とした。採用前の確定値にはしない。
- Production書込み、品質確認checkbox、候補採用・却下、Canvas保存、Provider、Job、credit操作0件。

---

## 0.0 既存候補採用preflight（2026-08-29）

- 完成済みページの変更と、画像配置済みコマの背景／補正画像変更を、候補採用前に決定的に分類するdomain helperを追加した。
- 該当時は既存原稿への影響を品質確認dialogへ表示し、通常4項目とは別の明示確認を必須にした。人物・効果layerの追加や同一Assetは不要な上書き警告にしない。
- 別ページ候補拒否、採用処理、元Asset履歴、完成判定、Provider／credit契約は不変。
- 集中30/30、Hub 939/939、lint、全型検査、diff check成功。Production、候補、Canvas、Provider、Job、credit操作0件。

---

## 0.0 Production未配置候補11件read-only目視確認（2026-08-29）

- 原稿未配置の採用評価済み1件・未評価10件を、Production作品画面と署名付き画像表示で読み取り専用確認した。
- 再利用候補3件（2ページ1件、19ページ2件）、重大不良で再利用しない候補4件、完成済み22ページの余剰候補4件へ分類した。
- 重大不良は画像内文字／複数コマ焼込み3件、人体／接触／構図1件。22ページは4/4完成済みのため既存原稿を上書きしない。
- 3件を将来採用できれば未配置144から141へ減る見込みだが、候補採用前の確定値にはしない。
- Production書込み、候補採用・却下、Canvas保存、Provider実行、Job登録、credit予約・消費0件。

---

## 0.0 Production残コマ・既存候補read-only再集計（2026-08-29）

- Production SQL Editorの`SELECT`だけで対象作品を再集計し、32ページ／157コマ、配置済み13、未配置144を確認した。
- 完成候補47 Assetのうち33 Assetが原稿未配置。内訳は採用評価済み1、却下済み22、未評価10。
- 現行利用期間はcredit使用82／予約0、実原価1,245,000 micro USD／予約原価0。処理待ち・実行中Jobはいずれも0。
- 次は既存の採用評価済み1件と未評価10件を先に人間確認し、却下済み22件を除外してからPilot生成範囲を決める。
- Production書込み、Canvas修復、候補採用、Provider実行、Job登録、credit予約・消費0件。

---

## 0.0 Windows Narratorエディター英語ラベル修正（2026-08-29）

- PR #391反映版でHomeの英訳3点を確認し、English生成ジョブ／書き出しdialogを再表示した。
- エディター上部だけ残っていた日本語のコマンドパレットaria-label／titleを既存翻訳キーへ統一した。
- 利用者がEnglish書き出しdialogの実音声を確認した。表示言語は日本語へ復元済みで、Project、Production、Provider、DB、Queue、Job、Asset、credit操作0件。
- 集中27/27、Desktop 183/183、全型検査、diff check成功。

---

## 0.0 Windows Narrator拡張確認・英語表示修正（2026-08-29）

- 既存受入れProjectで素材、追加メニュー、生成ジョブ、書き出し、Inspector、その他メニューを非破壊確認した。日本語の書き出しdialogは実音声確認済み。
- Englishの生成ジョブ／書き出しdialogはUI Automationで英語名・役割・説明を確認し、書き出しdialogは利用者が実音声を確認した。
- Englishホームの未翻訳コマンド／最終確認と、自動バックアップ成功文が汎用エラーへ変換される問題を修正した。表示言語は日本語へ復元した。
- Production、Provider、DB、Queue、Job、Asset、credit操作0件。
- 集中27/27、Desktop 183/183、build:main、全型検査、diff check成功。

---

## 0.0 クリーンWindows証跡取り込み（2026-08-29）

- `rc:clean-windows-evidence:import`で、実機証跡を検証後に`CLEAN_WINDOWS_ACCEPTANCE.json`とRC台帳へ同期できるようにした。
- コード署名・署名付き自動更新gateがpassedになる前の取り込みを拒否し、7項目欠落、同一version、不正hash、非Windows 11、clean環境未確認をfail closedにする。
- operatorは固定roleだけを記録し、個人情報・秘密値・制作内容を証跡へ含めない。
- 現在の正本は外部前提待ちで`BLOCKED`。Production、Provider、credit操作0件。
- 集中9/9、Hub 938/938、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。
- 詳細: `docs/desktop/CLEAN_WINDOWS_ACCEPTANCE.md`

---

## 0.0 クリーンWindows最終受入れpreflight（2026-08-28）

- `rc:clean-windows-acceptance`とstrict判定、構造化status、受入れ手順を追加した。
- 合格にはクリーン環境、有効署名、install・起動、Project作成・PDF書き出し、署名付き旧版→新版更新、作品保持、uninstallの全証跡が必要。
- RC台帳のコード署名・署名付き自動更新がpassedになる前は、最終受入れをpassedへ変更できない。
- 現状は署名証明書と署名済み2version・公開更新URL待ちで`BLOCKED`。Production、Provider、credit操作0件。
- 集中7/7、Hub 936/936、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。
- 詳細: `docs/desktop/CLEAN_WINDOWS_ACCEPTANCE.md`

---

## 0.0 Windows Narrator主要導線受入れ（2026-08-28）

- Windows Narrator実機で日本語／Englishの主要Home／新規Project dialog導線を読み上げ、利用者が音声を識別できることを確認した。
- UI Automationで名前、役割、modal focus循環、Escape復帰を照合し、表示言語は日本語へ復元した。
- RC台帳はNarrator 2件をpassedへ更新し、7 passed／7 pending／2 blocked。拡張操作の実音声サンプル未実施範囲は証跡へ明記した。
- Project作成・編集・削除、Production、Provider、DB、Queue、Job、Asset、credit操作0件。
- RC acceptance 3/3、Hub 933/933、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_WINDOWS_NARRATOR_CORE_ACCEPTANCE_20260828.md`

---

## 0.0 RC read-only probe失敗契約（2026-08-28）

- Ollama／ComfyUIのread-only probeでtimeoutとその他の通信失敗を安定した理由コードへ分離した。
- transport例外の内容は結果へ含めず、秘密値非表示と既存のGET-only／redirect拒否契約を維持した。
- 実ネットワークprobe、Production、Provider、DB、Queue、Job、Asset、credit操作0件。
- 集中12/12、Hub 933/933、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_EXTERNAL_ENVIRONMENT_PREFLIGHT_20260828.md`

---

## 0.0 RC read-only probe redirect防止（2026-08-28）

- Ollama／ComfyUIのprobe関数自体で接続先を再検証し、同一originの絶対パスだけを許可した。
- HTTP redirectを追従せず、remote HTTP、資格情報埋込み、protocol-relative／別origin pathをfetch前に拒否する。
- 実ネットワークprobe、Production、Provider、DB、Queue、Job、Asset、credit操作0件。
- 集中11/11、Hub 932/932、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_EXTERNAL_ENVIRONMENT_PREFLIGHT_20260828.md`

---

## 0.0 RCローカル生成runtime URL安全化（2026-08-28）

- Ollama／ComfyUIのpreflightで、loopback HTTPまたはHTTPSだけをREADY対象にした。
- 無効URL、資格情報埋込みURL、remote HTTPは実接続前に拒否する。明示probeのread-only GET契約は不変。
- 実ネットワークprobe、Production、Provider、Queue、Job、Asset、credit操作0件。
- 集中10/10、Hub 931/931、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_EXTERNAL_ENVIRONMENT_PREFLIGHT_20260828.md`

---

## 0.0 一般向けモニター利用範囲の更新情報（2026-08-28）

- ダッシュボードの更新情報先頭へ、一般向けモニターで利用できる工程と対象外機能を追加した。
- 画像生成は利用設定、残りAI利用数、クレジット、安全確認を満たす場合だけ実行可能と明示した。
- DB由来の公開更新情報は維持し、DB障害時も固定案内だけは表示する。
- Production、DB、Provider、Queue、Job、Asset、credit操作0件。
- 集中6/6、Hub 928/928、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。

---

## 0.0 Windowsアニメーション効果OFF受入れ（2026-08-28）

- Windows実設定のアニメーション効果OFFでHome・command palette・新規Project dialog・Escape復帰を受入れた。
- 操作・状態理解のanimation依存なし。検証後はONへ復元した。
- Narrator日本語・Englishは利用者音声確認待ち。Ollama／ComfyUI実環境は未導入。
- Production、Provider、Job、Asset、credit、利用者データ操作0件。
- 集中3/3、Hub 920/920、deps、lint、RC acceptance、diff check成功。
- 詳細: `docs/RELEASE_CANDIDATE_WINDOWS_REDUCED_MOTION_ACCEPTANCE_20260828.md`

---

## 0.0 Windows実表示受入れ（2026-08-28）

- 実Windows設定で150%表示とコントラストテーマ「夕暮れ」を適用し、Home・command palette・Editorを目視とUI Automationで受入れた。
- 150%表示と高コントラストをRC台帳でpassedへ更新した。実機で検出したskip linkの視認性不具合はsystem color対応後に再確認した。
- Windows設定は100%・コントラストテーマ「なし」へ復元済み。Narrator日本語・Englishはpendingを維持する。
- Production、Provider、Job、Asset、credit、利用者データ操作0件。
- 集中3/3、Hub 919/919、Canvas 26/26、AI 48/48、Desktop 182/182、通常／2 variant各29画面blocking violation 0、migration 74件を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_WINDOWS_MANUAL_DISPLAY_ACCEPTANCE_20260828.md`

---

## 0.0 Windows表示受入れpreflight・強制カラー修正（2026-08-28）

- Desktopだけを150%相当／強制カラーで隔離実行する`desktop:test:display-acceptance`を追加した。
- runtime条件と横あふれをfail closedにし、既存29画面axeとvisual／keyboard 21項目を再利用する。
- 初回強制カラーで検出したsystem color未追従を修正し、両variantでblocking violation 0を確認した。
- 実Windows設定とNarrator音声は未確認なのでRC台帳4件はpendingのまま。Windows設定、Provider、credit操作0件。
- 契約2/2、Hub 919/919、Canvas 26/26、AI 48/48、Desktop 182/182、通常／2 variant各29画面blocking violation 0、migration 74件を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_WINDOWS_DISPLAY_PREFLIGHT_20260828.md`

---

## 0.0 RC受入れ台帳整合化（2026-08-28）

- `docs/desktop/RC_ACCEPTANCE_STATUS.json`を直近の受入れ証跡へ整合した。
- 初期ユーザー向けP0〜P4は7/7 passed。release-wideは11 pending／2 blockedを維持し、未検証項目を完了扱いにしていない。
- Hub Production残件はCloud text実Job、AIネーム由来8ページProduction E2E、Production owner isolation、Stripe test E2E。
- repository内の台帳・テスト・文書のみ更新し、Production、Provider、credit、利用者データ操作0件。
- 集中1/1、Hub 917/917、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_RC_LEDGER_RECONCILIATION_20260828.md`

---

## 0.0 モニター進行阻害フィードバック対応完了closeout（2026-08-28）

- PR #371対象のProductionモニター報告2件を`resolved`へ更新し、利用者の送信履歴で「修正済み」となる既存契約へ同期した。
- 非公開管理メモにはPR #371の修正範囲と検証成功だけを記録した。個別返信、メール、LINEは送信していない。
- 報告本文／添付／owner／評価、DB schema／migration、Feature Flag、Storage、Provider、Job、Asset、credit操作0件。Issue task未完了0件。
- 集中13/13、Hub 916/916、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_MONITOR_FEEDBACK_RESPONSE_CLOSEOUT_20260828.md`

---

## 0.0 Staging durable export受入れcloseout（2026-08-27）

- 隔離Supabase Preview branchとVercel Preview branchで、8ページ固定一般向けProjectのPDF中断再開、PNG ZIP、Project JSONを実Storage／Worker受入れした。
- PDFは4/8停止、停止中Worker idle、再開後8/8完了。3形式の順序／形式／schema／byte size、owner A／B、署名download、queue 0、active Job 0を確認した。
- Supabase Preview branch、受入れ用Git branch、対象2 branchの一時Vercel環境変数、一時Automation Bypassを削除・失効した。通常設定は維持した。
- Production、外部画像Provider、credit、利用者実データ操作0件。初期ユーザー向け7条件は7/7受入れ済み。
- 文書契約3/3、Hub 916/916、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。
- 詳細: `docs/RELEASE_CANDIDATE_STAGING_DURABLE_EXPORT_ACCEPTANCE_CLOSEOUT_20260827.md`

---

## 0.0 Production migration・BFL原価guard受入れcloseout（2026-08-27）

- Production project `vmdsyxykcrgxcdbrwlkv`の到達点をread-only照合し、`202608240001`〜`202608260002`の未適用13 migrationだけを正本順に適用した。
- Creatorのschema不足による読込失敗は解消し、固定一般向け作品とページ編集画面を確認した。
- 責任者承認済みBFL `flux-2-pro`参照付き1 Jobだけを実行し、pricing `bfl-flux2-pro-2026-08`、予約`$0.180`、実額`$0.045`、差額`$0.135`解放、Asset 1件、重複なし、queue 0を確認した。
- 旧参照はstyle参照であり、人物reference bindingへ誤変換していない。追加Job、retry、Production修復、秘密値変更、staging操作0件。
- 初期ユーザー向け残り外部gateはstaging durable export 1件。本PRはdocs-only証跡同期で、1案生成UIは後続UX候補として記録する。
- Hub 916/916、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。`rc:preflight`は外部設定と手動E2Eを未完了として正しく維持する。
- 詳細: `docs/RELEASE_CANDIDATE_PRODUCTION_BFL_ACCEPTANCE_CLOSEOUT_20260827.md`

---

## 0.0 モニター進行阻害フィードバック修正（2026-08-26）

- 生成ボタンの禁止表示へ理由と回復操作を追加し、コマ未選択、利用枠、生成停止、credit不足を区別する。
- 吹き出し外へずれたunlocked既存文字を、追加生成・credit消費なしで吹き出し内へ戻す。
- 市場分析へ4／8ページを追加し、scenario／storyboardの最小を4ページへ統一する。明示した4ページを32ページへ拡張しない。
- Production／staging、migration、Flag、Provider、Job、Storage、credit操作0件。モニター報告状態も未変更。
- 関連62/62、Hub／Canvas／AI／Desktop全件、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。

---

## 0.0 Staging durable export受入れ準備（2026-08-26）

- 初期ユーザー向け最後の外部gateを`STAGING_DURABLE_EXPORT_ACCEPTANCE_RUNBOOK_20260826.md`へ固定した。
- staging固定一般向けProject 1件だけでPDF／PNG ZIP／Project JSON、中断再開、owner分離、署名URL、cleanup、queue、Flag既定OFF復元を検証する。
- staging project一致、preflight、migration drift、既存queue、対象データを確認できなければ変更前に停止する。
- スマートフォン作業中かつ対象Supabaseアクセスなしのため、migration、Flag、Worker、Job、Storage、Provider、credit操作は行わない。
- 集中6/6、Hub／Canvas／AI／Desktop全件、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。

---

## 0.0 P0〜P4 Provider証跡訂正・Production受入れ準備（2026-08-26）

- PR #369のcloseout監査は、P3-Eで既に完了した責任者承認済みBFL参照付き10シーン比較を見落としていた。
- 人物重大不一致条件を`PROVIDER_ACCEPTANCE_PASSED`へ訂正する。重大な別人化防止10/10で、受入基準8/10以上を達成済み。
- 初期ユーザー向け7条件は6件受入れ済み。残る外部gateはstaging durable export実Storage／Worker受入れ1件。
- Production原価guard確認用BFL 1 Job（最大予約`$0.180`）は承認済みだが、対象Supabase projectへのアクセスがないため未実施。スマートフォン作業中はProductionを変更しない。
- `PRODUCTION_BFL_COST_ACCEPTANCE_RUNBOOK_20260826.md`を正本として、PC復帰後も対象project・migration・価格version・queueを読み取り確認してから1 Jobだけ実行する。
- 集中3/3、Hub／Canvas／AI／Desktop全件、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。

---

## 0.0 P0〜P4 closeout監査（2026-08-26）

- PR #368 merge commit `d208541`を基準に、初期ユーザー向け7完了条件をrepository／external gateへ分類した。
- 5件はrepository成功。人物重大不一致20%以下は実画像未評価、durable exportはstaging実Storage／Worker未受入れのため、初期ユーザー提供READYとはまだ判定しない。
- 次は承認後のstaging durable export、その後に費用上限付き10シーン実画像比較。Production／Provider／credit操作0件。
- 集中3/3、Hub全件、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。

---

## 0.0 P4-F 完成モード・書き出し総合受入（2026-08-26）

- PR #367 merge commit `eb9e9dd`を基準に、長編／Kindle解説／成人向けlocal-only固定3作品のrepository-only受入fixtureを追加した。
- 実寸2ページ、順序、PNG許可、JPEG、PDF、Project JSON、文字レイヤー保存再読込を検証する。
- KindleのPNG非許可、成人向けCloud拒否、Project作成／exportの認証owner境界をfail closedで確認する。
- 製品コード、API、DB／migration、UI、Production／staging、Provider／Worker、Job、credit、Storage操作0件。
- 集中4/4、Hub全件、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。

---

## 0.0 P4-E JPEG export adapter（2026-08-26）

- PR #366 merge commit `9b55f768`を基準に、Node専用`@mangai/export-core/jpeg`を追加した。
- quality 90、白背景flatten、4:4:4、`.jpg`／`image/jpeg`を固定し、寸法不一致を拒否する。
- manifestは順序、寸法、byte size、画像SHA-256とcanonical manifest SHA-256を決定論的に追跡する。
- 既存PNG既定、browser entrypoint、UI、DB、Production／staging、Provider／Worker、Job、credit、Storageは変更しない。
- 集中4/4、Hub全件、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 74件を含む全ローカル品質ゲート成功。

---

## 0.0 P4-A 完成モードprofile契約（2026-08-26）

- PR #362 merge commit `3b260a2`を基準に、3用途のversioned completion profileを`@mangai/shared`へ追加した。
- 成人向けはDesktop local-only、content boundary必須、重複検査／出力と不正範囲をfail closedにする。
- mode未設定の既存Projectはnullへ解決し、数値fixtureを製品presetとして公開しない。
- 集中8/8、Hub 893/893、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 72件、全ローカル品質ゲート成功。Production／staging、Provider、Job、credit、Storage操作0件。

---

## 0.0 P4 用途別完成モード・書き出しgap監査（2026-08-25）

- PR #361 merge commit `11e70b6`を基準に、Hub／Desktopのexport、完成preflight、Project JSON、成人向け境界を監査した。
- PNG、PDF、package、Desktop Project JSON、長編durable PDFは既存。主要gapは3用途のversioned mode profile、mode別推奨値／検査、Hub単体／durable JSON、JPEG。
- 既存exportを維持しP4-A〜Fへ分割する。成人向けはDesktop local-onlyから動かさない。
- 文書のみ。Hub 889/889、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 72件、全ローカル品質ゲート成功。Production／staging、Provider、Worker、Job、credit、Storage操作0件。

---

## 0.0 P3-F 品質検査・部分修正 受入fixture（2026-08-25）

- PR #360 merge commit `ebfab6f`を基準に、外部Providerなしの固定6コマfixtureで人数違い、衣装違い、文字切れを検出する。
- normalized region、対象コマ、修正案、`NOT_EVALUATED`を追跡し、修正準備でAsset／候補／Jobを変更しない。
- 既存KPIへ採用コマ費用、完成時間、人物重大不一致率、明示的生成失敗率を追加した。
- 集中13/13、Hub 889/889、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 72件、全ローカル品質ゲート成功。Production／staging、Provider、Job、credit、Storage操作0件。

---

## 0.0 BFL Image Editing原価計測・予約guard（2026-08-25）

- PR #359 merge commit `0174ef3`を基準に、BFL submitのProvider creditをUSD microsへ変換し、参照付きProのfallbackを`$0.045/MP`、最大4MP予約上限を`$0.180`へ更新した。
- Proだけ新pricing versionを使い、通常生成は安全側予約後にProvider実額との差額を解放する。内部credit数2は不変。
- 追加migration／rollbackはローカルのみ。Production／staging、Provider、Job、credit、Storage操作0件。
- 集中16/16、Hub 886/886、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 72件、全ローカル品質ゲート成功。

---

## 0.0 P3-E Provider再開・参照付き10シーン比較（2026-08-25）

- PR #358 merge commit `8fb863f`を基準に、無課金の再開／失敗解放34/34と、責任者承認済みBFL参照付き10シーンを実行した。
- 重大な別人化防止10/10で受入基準を達成。髪の軽微変動2、疑似文字3、色混入1はwarning。自動retry 0。
- 成功分見込み`$0.435`、拒否1件を含む最大見込み`$0.480`で承認上限`$0.50`内。Production、Supabase、MANGAI Job／credit／Storageは不変。
- 現行adapterがImage Editingも`$0.030`として返す一方、公式最低料金は`$0.045`。Provider返却costを取り込む修正後にstaging E2Eへ進む。
- 集中34/34、Hub 882/882、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 71件、全ローカル品質ゲート成功。

---

## 0.0 P3-C+D 品質Inspector・修正準備導線（2026-08-25）

- PR #357 merge commit `b5100f8`を基準に、選択コマの品質finding表示と既存修正UIへの明示導線を追加した。
- 準備操作はpreset／説明の設定、設計欄／参照画面／inpainting dialogの表示だけで、自動Job／credit／Asset削除は行わない。
- Production、Provider／Worker／Storage／credit操作0件。P3-E外部実行は明示承認待ち。
- 集中6/6、Hub 882/882、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 71件、全ローカル品質ゲート成功。

---

## 0.0 P3-A+B 品質finding基盤・決定論的rule検査（2026-08-25）

- PR #356 merge commit `cfa2ca9`を基準に、append-only inspection run／findingと決定論的rule変換を追加した。
- 未実行の視覚／意味検査は`NOT_EVALUATED`かつconfidence null。既存75点評価、採否ログ、Asset、Jobを置換・削除しない。
- Production、Provider／Worker／Job／Storage／credit操作0件。P3-Cはmerge後。
- 集中4/4、Hub 880/880、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 71件、全ローカル品質ゲート成功。

---

## 0.0 P3 自動品質検査・部分再生成gap監査（2026-08-25）

- PR #355 merge commit `6e14d8b`を基準に、品質評価、Visual Judge、preflight、continuity、部分修正の既存経路を監査した。
- 主要gapはCreator向け統一finding、未評価の厳密保持、対象領域／修正案、既存inpainting等への明示接続。
- P3-A〜Fへ分割。文書のみでProduction、Provider／Worker／Job／Storage／credit操作0件。
- Hub 876/876、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 70件、全ローカル品質ゲート成功。

---

## 0.0 P2-E 10コマ編集受入fixture（2026-08-25）

- PR #354 merge commit `5a7ccbe`を基準に、P2の編集不変条件を外部Providerなしで検証する固定10コマfixtureを追加した。
- セリフ変更、単一コマ画像差し戻し、保存再読込、設計revision／修正元Asset追跡を決定論的に検証する。
- 製品コード、API／DB／migration、Production、Provider／Worker／Job／Storage／credit操作0件。
- P2-A〜E集中13/13、Hub 876/876、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 70件、全ローカル品質ゲート成功。

---

## 0.0 P2-D コマAsset版履歴・差し戻し（2026-08-25）

- PR #353 merge commit `182283b`を基準に、Canvas保存済みAsset layerを採用／修正の版履歴として表示し、過去版への明示差し戻しを追加した。
- 差し戻しは選択コマの背景／補正版系列だけ。元Asset、後続候補、Job、layer、人物／効果、他コマを削除・変更しない。
- API／DB／migration、Production、Provider／Worker／Job／Storage／credit操作0件。P2-Eはmerge後。
- 集中13/13、Hub 872/872、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 70件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。

---

## 0.0 P2-C コマ設計生成入力snapshot（2026-08-25）

- PR #352 merge commit `c91078f`を基準に、保存済みコマ設計revision／JSONを単一・batch生成入力へ固定した。
- Flag strict・既定OFF。OFF／設計未作成は従来Promptを維持し、履歴へPromptを公開せずrevisionだけを表示する。
- migration、Production、Provider／Worker実行、Job／Storage／credit操作0件。P2-Dはmerge後。

---

## 0.0 P2-B コマ設計materialization・Inspector（2026-08-25）

- PR #351 merge commit `90df975`を基準に、選択コマの意味設計Inspectorと明示materializationを追加した。
- 既存assignment／continuity／panel specificationは下書きにだけ使い、確認保存前には正本を変更しない。自動backfillなし。
- Canvas／Storyboard／Job／Prompt／Provider、Production／Storage／credit操作0件。P2-Cはmerge後。

---

## 0.0 P2-A コマ意味設計schema（2026-08-25）

- PR #350 merge commit `845df71`を基準に、現在panel設計とappend-only revision履歴を追加した。
- owner、現行Canvas panel、optimistic revisionをDBで検証し、自動backfillは行わない。
- Canvas／Storyboard／Job／Provider、Production／Storage／credit操作0件。P2-Bはmerge後。

---

## 0.0 P2 漫画設計データ・コマ単位編集gap監査（2026-08-25）

- PR #349 merge commit `1a85d5a`を基準に、P2の現行Canvas／生成／履歴を監査した。
- 編集UIの大半は既存。主要gapは編集可能なpanel意味データ正本と永続差し戻し履歴。
- P2-A〜Eへ分割。文書のみでProduction／Provider／Job／Storage／credit操作0件。

---

## 0.0 P1-F 固定10シーン追跡fixture（2026-08-25）

- PR #348 merge commit `d11ea3d`を基準に、外部Providerなしの10シーン追跡fixtureと採点表を追加した。
- 参照有無と人物／衣装driftを検出する。実画像の6視覚項目は`NOT_EVALUATED`。
- Production／Provider／Job／Storage／credit操作0件。外部比較は責任者の明示承認待ち。

---

## 0.0 P1-E 生成追跡情報（2026-08-25）

- PR #347 merge commit `94a4853`を基準に、漫画コマ生成のworkflow versionと型付きprovenanceを追加した。
- 人物／参照／画風／世界／連続状態／Provider／model／seedを追跡し、Promptや秘密情報は公開しない。
- migration、Production、Provider、Job、Storage、credit操作0件。次は外部Providerなしの固定10シーンfixture。

---

## 0.0 P1-D コマ連続状態（2026-08-25）

- PR #346 merge commit `9c80cbc`を基準に、subject別の時間／天候／左右／持ち手／視線／継続元panelを追加した。
- owner境界と現行canvas内panelをDBで検証し、単一／batch共通の生成入力へ構造化状態を固定する。
- Production／Provider／Job／Storage／credit操作0件。P1-Eはレビュー後。

---

## 0.0 P1-C 作品バイブル・人物参照UI（2026-08-25）

- PR #345 merge commit `7e49a87`を基準に、人物version／role／承認、warn/block、衣装・状態範囲UIを追加した。
- 旧参照と人物自由文は維持。範囲重複をDBで拒否し、migration未適用時は新UIだけ停止する。
- Production／Provider／Job／Storage／credit操作0件。P1-Dはレビュー後。

---

## 0.0 P1-B 人物参照resolver・生成準備方針（2026-08-25）

- PR #344 merge commit `552e0dc`を基準に、単一コマ／batch共通のversion付き人物参照resolverを追加した。
- Flag既定OFF。ON時はapprovedのfront／face不足を作品別warn／blockで扱い、解決結果と警告をJob入力へ固定する。
- Production／Provider／Job／Storage／credit操作0件。P1-Cはレビュー後。

---

## 0.0 P1-A 人物version付き参照画像binding（2026-08-24）

- PR #343 merge commit `7cd2e23`を基準に、version付き構造化人物参照table／RPCを追加した。
- 既存参照は非破壊で維持し、曖昧な自動backfillはしない。利用後の情報損失rollbackを停止する。
- Production／Provider／Job／Storage／credit操作0件。P1-Bはレビュー後。

---

## 0.0 P1作品バイブル・キャラクター固定gap監査（2026-08-24）

- PR #342 merge commit `53484ad`を基準にP1現行実装を監査した。
- versioned人物／画風／世界設定、参照Asset、panel割当、Job入力固定は既存。gapはversion付き参照role、衣装範囲、左右／時間状態、参照不足block policy。
- 実装はP1-A〜Fへ分割した。今回は文書のみでProduction／Provider／credit操作0件。

---

## 0.0 P0-E optional Provider interface（2026-08-24）

- PR #341 merge commit `6aaa5d9`を基準に、共通画像Providerのoptional拡張と既存adapter互換aliasを追加した。
- 現行generate／cancelとProvider通信は不変。新Provider追加、Production／Provider／credit操作0件。

---

## 0.0 P0-D 生成失敗・再開UI（2026-08-24）

- PR #340 merge commit `15c37ae`を基準に、工程／失敗工程／自動再開／checkpoint表示を追加した。
- Flag OFFでは従来DB SELECTを維持し、P0 migration未適用環境を壊さない。
- 生のProvider error、Prompt、秘密情報を表示しない。Production／Provider／Job／credit操作0件。

---

## 0.0 P0-C 生成run checkpoint・20ページ再開fixture（2026-08-24）

- PR #339 merge commit `a417db4`を基準に、完了targetのJob／Asset／digest／元revisionを固定するrun checkpointを追加した。
- Worker記録はFlag有効時だけのbest-effortで、失敗してもProvider処理を繰り返さない。
- 20ページ中断fixtureは完了13件を保持し、未完了7件だけを再開対象にする。
- Flag既定OFF。Production、Provider、Job、Storage、credit操作0件。詳細は`docs/RELEASE_CANDIDATE_P0C_GENERATION_RUN_CHECKPOINTS_20260824.md`。

---

## 0.0 P0-B 生成lifecycle・再試行系譜（2026-08-24）

- PR #338 merge commit `e6929d3`を基準にP0-Bを実装した。
- Flag有効時のWorker工程／retry／完了event、構造化failure、手動retry parent／root系譜を追加した。
- lifecycle記録障害で課金対象Provider処理を繰り返さず、retry系譜失敗時は新Jobをcancelする。
- migration／rollback／schema／manifest 64件と全ローカル品質ゲート成功。
- Flag既定OFF。Production、Provider、Job、credit操作0件。詳細は`docs/RELEASE_CANDIDATE_P0B_GENERATION_LIFECYCLE_EVENTS_20260824.md`。

---

## 0.0 P0-A 再開可能な生成基盤schema（2026-08-24）

- PR #337 merge commit `109bea3`を基準にP0-Aだけを実装した。
- 既存5 status、RPC、Worker、Providerを維持し、nullable工程列、retry系譜、append-only event、8状態写像を追加した。
- `CLOUD_GENERATION_RESUMABLE_V2_ENABLED`はstrict・既定OFF。今回の実装はv2 eventを書き込まない。
- migration／rollback／canonical schema／manifest 63件を同期し、利用開始後のrollbackを停止する。
- 全ローカル品質ゲート成功。Production、Provider、Job、credit操作0件。詳細は`docs/RELEASE_CANDIDATE_P0A_RESUMABLE_GENERATION_FOUNDATION_20260824.md`。

---

## 0.0 P0生成基盤・OSS比較調査（2026-08-24）

- PR #336 merge commit `4d7b9fa`を基準に、現行生成入力からAsset保存・品質後処理までをコード／schemaから監査した。
- P0基盤の多くは既存実装済み。追加対象を工程別状態、失敗区分、retry chain、HTTP status、生成run checkpointへ限定した。
- Inkstone `c34a214`、StoryDiffusion `8de45e4`、comicgeneration `3b10366`をLICENSE／依存／実装から比較した。ライセンス不明コードは転用しない。
- 既存経路を残す追加migration、Feature Flag、20ページ中断再開試験、5段階PR案を記録した。
- P0実装、Production、Provider、Job、credit操作0件。詳細は`docs/RESEARCH_P0_GENERATION_FOUNDATION_20260824.md`。

---

## 0.0 23–24ページPilot Visual Settings保存前下書き（2026-08-24）

- PR #335 merge commit `a042faa`を基準に既存正本を再監査した。
- 人物・画風・Storyboardはowner-only RLS。管理者からの空表示を設定消失と誤認しない。
- 過去に保存・preflight通過済みの作品画風v1、城戸真琴v1、榊圭吾v1を再利用候補とし、重複作成を禁止した。
- 有坂冬馬の外見正本は未確認。本人session、scenario、参考画像を確認するまで推測入力しない。
- Production入力、保存、Provider、Job、credit操作0件。詳細は`docs/RELEASE_CANDIDATE_PILOT_VISUAL_SETTINGS_DRAFT_20260824.md`。

---

## 0.0 追加creditなし8コマPilot候補選定（2026-08-24）

- PR #334 merge commit `ac30805`を基準に連続2ページ候補をread-only比較した。
- 推奨は23–24ページ。各4コマ、未着手、画像0、再実行待ち0。
- 8コマ、必要16 credit／残り16、最大予約$0.24、最短3 Worker回。monitor残り11内だがcredit余裕0。
- 必要人物は城戸真琴、有坂冬馬、榊圭吾。画風・場所／小物とVisual Readinessの正本化が必要。
- Production、Provider、Job、credit変更0件。詳細は`docs/RELEASE_CANDIDATE_EIGHT_PANEL_PILOT_CANDIDATE_20260824.md`。

---

## 0.0 2ページPilot 所有者・モニター枠診断（2026-08-24）

- PR #333 merge commit `9d2455a`を基準に管理画面をread-only確認した。
- 作品ownerは`test`。モニターはactive 89/100、残り11で正常。Cloud AIはTrial、使用80・予約0・残り16。
- 先のモニター確認不可は管理者`tanaka`が他ユーザー作品を開き、現在profileのenrollmentを参照したsession mismatchによる。
- 9コマはmonitor内だが18 credit必要で2不足。Visual Readiness、credit、migrationの承認前に生成しない。
- Production設定、DB、作品、Provider、Job、credit変更0件。詳細は`docs/RELEASE_CANDIDATE_PILOT_OWNER_MONITOR_DIAGNOSIS_20260824.md`。

---

## 0.0 2ページPilot停止条件の原因監査（2026-08-24）

- PR #332 merge commit `200b11e`を基準にProductionをread-only診断した。
- 画風5項目、人物、場所・小物が未設定で、対象作品にはシナリオ由来人物設定もない。
- storyboard materializationなしではpreflightが入力評価前に準備不可となるため、単純な設定入力だけでは解消しない可能性がある。
- monitor nullはFlag無効、enrollmentなし、Admin／DB障害を区別しない。次は管理者read-only確認とVisual Readiness契約判断が必要。
- Production書込み、Provider、Job、credit操作0件。詳細は`docs/RELEASE_CANDIDATE_PILOT_BLOCKER_ROOT_CAUSE_20260824.md`。

---

## 0.0 連続2ページPilot Production準備状況受入れ（2026-08-24）

- PR #331 merge commit `7e0603a`の新UIがProductionへ反映済み。
- 1–2ページは9コマ、必要18 credit、残り16、最大予約$0.27、最短3 Worker回と表示された。
- credit 2不足、人物・画風準備確認不可、モニター枠確認不可により開始ボタンは無効。選択は解除済み。
- 32ページ157コマ中13コマ配置、画像配置完了2/32、要修正275。書込み、Provider、Job、credit予約／消費0件。
- 詳細は`docs/RELEASE_CANDIDATE_TWO_PAGE_PILOT_PRODUCTION_READINESS_20260824.md`。

---

## 0.0 連続2ページ生成Pilot契約（2026-08-24）

- 最新基準はPR #330 merge commit `b9f07fd`。Branchは`codex/enable-two-page-generation-pilot`。
- 既存4〜8ページ通常batchに加え、ページ番号が連続する2ページだけをPilotとして許可する。3ページと非連続2ページは拒否する。
- 連番はアプリpreflightとDB RPCで二重検証し、既存の人物・画風、quota、費用、モニター枠、Provider・model・料金版、moderation guardを維持する。
- 集中15/15、deps、lint、全型検査、Hub 834/834、Canvas 26/26、AI 48/48、Desktop 182/182、a11y、migration 62件、両build、RC structure、diff check成功。
- Production migration、Provider実行、生成Job、credit予約／消費は行っていない。明示承認までは実行しない。
- 詳細は`docs/RELEASE_CANDIDATE_TWO_PAGE_GENERATION_PILOT_20260824.md`。

---

## 0.0 Production品質イベント5xx修正受入れ（2026-08-24）

- PR #329 merge commit `e8d9146`のProduction deployment Readyを確認した。
- 22ページを1回開き、複数回のJob polling後も`manga-quality-events`連続500は再発せず、Vercel Logsの直近30分はError 0。
- ページは正常表示・保存済み、credit使用4・予約0・残り16。Production書込み、Provider実行、credit予約／消費は0件。
- 詳細は`docs/RELEASE_CANDIDATE_PRODUCTION_QUALITY_EVENT_5XX_ACCEPTANCE_20260824.md`。

---

## 0.0 Production品質イベント5xx再送loop修正（2026-08-24）

- 最新基準はPR #327 merge commit `35c358f`。Branchは`codex/fix-production-quality-event-5xx`。
- Production 22ページから品質表示イベントが同時多発500となり、失敗IDを再送可能へ戻す処理と3秒Job更新が再送loopを作っていた。
- 表示イベントはsession内1回に固定し、`P0001 / cloud_generation_job_not_found`だけを非致命化した。採用・不採用と他障害はfail-closedを維持。
- 集中4/4、deps、lint、全型検査、Hub 833/833、diff check成功。Production、Provider、credit、DBは変更していない。
- 詳細は`docs/RELEASE_CANDIDATE_PRODUCTION_QUALITY_EVENT_5XX_RETRY_GUARD_20260824.md`。

---

## 0.0 採用画像Visual Judge連続性証跡監査（2026-08-24）

- 最新基準はPR #326 merge commit `e0e8aae`。Branchは`codex/audit-r4-3-visual-judge-evidence`。
- 採用layerの生成Jobに保存された`evaluation_details.continuityMatch`を厳格検証し、現行Evidence schema適合時だけ一貫性画面へ参考表示する。
- rule-based評価の未観測中立75点、旧形式、不正形式は表示しない。完成判定、自動不採用、自動再生成へ非接続。
- 集中7/7、deps、lint、全型検査、Hub 832/832、Canvas 26/26、AI 48/48、Desktop 182/182、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Production、Provider、credit、DB、Storage、Canvas、PNG／PDFは不変。詳細は`docs/RELEASE_CANDIDATE_ADOPTED_VISUAL_JUDGE_CONTINUITY_EVIDENCE_20260824.md`。

---

## 0.0 見た目の連続性・完全一致候補監査（2026-08-24）

- 最新基準はPR #325 merge commit `6b3e70d`。Branchは`codex/audit-r4-3-visual-continuity`。
- 一貫性チェックへ、同一／隣接ページの採用中生成画像で同一Asset IDまたは完全一致SHA-256となる組だけをread-only目視候補として追加した。
- 候補は履歴警告、完成判定、自動不採用、自動再生成に非接続。類似度推測やVisual Judgeの未確定閾値は使用しない。
- 集中6/6、deps、lint、全型検査、Hub 831/831、Canvas 26/26、AI 48/48、Desktop 182/182、migration 61件、Hub／Desktop build、diff check成功。
- Production、Provider、credit、DB、Storage、Canvas、PNG／PDFは不変。次担当は明示承認なしにProduction修復、Provider実行、credit予約を行わない。
- 詳細は`docs/RELEASE_CANDIDATE_VISUAL_CONTINUITY_EXACT_MATCH_REVIEW_20260824.md`。

---

## 0.0 Production人物連続性監査・残コマ生成計画（2026-08-24）

- `feature/manga-canvas-mvp`の最新基準はPR #324 merge commit `7f4ccf1fcc8226ce81881d81d1c5862a82ab8e08`。
- 作業ブランチは`codex/audit-r4-3-production-continuity`。文書監査のみで、Production、Provider、creditを変更していない。
- 現行`/creator/[projectId]/continuity`は生成履歴、設定版、参照画像、割当の整合を検査する。画像ピクセル上の顔・衣装・構図の一致は検査しない。
- 2026-08-20証跡では32ページ157コマ中13コマ配置、144コマ未配置。22ページには類似構図と人物・場面連続性の目視事項がある。値は次の実行前にread-only再集計する。
- 残コマは全件一括投入せず、連続2ページ・最大8〜12コマのPilot、以後4ページ単位を上限とする。各batchでcheckpoint、参照設定、credit予約、品質、PNGを検査する。
- 次担当は責任者承認なしにProduction修復、Provider実行、credit予約をしない。詳細は`docs/RELEASE_CANDIDATE_PRODUCTION_CONTINUITY_AND_REMAINING_GENERATION_PLAN_20260824.md`。

---

## 0.0 現在の優先タスク（セリフ出力の可読性、2026-08-20）

- 最新基準はPR #323 merge commit `ea302207328faee8a647029cf528e55143f2b206`。Branchは`codex/fix-r4-3-dialogue-output-readability`。
- Production既存22ページの必須セリフ`（証拠を）`はデータ上1/1配置済みだが、42px縦書きが横長吹き出し内で6列に分かれ、販売原稿として読みにくかった。EditorではContainer Query基準もviewportとなり、Canvas表示比より約1.78倍大きく見えていた。
- Container Query基準をCanvas rootへ移し、6文字以下の短文は横長吹き出しで24px以上の1行横書き中央を優先する。既存短文は追加生成なしの明示修復で同じ配置へ更新できる。
- 完成判定は`DIALOGUE_LAYOUT_UNREADABLE`を追加し、必須文字列が存在してもoverflowまたは短文の複数行・複数列ならfail closedする。
- セリフ内容、Canvas schema、PNG／PDF renderer、API、DB、Storage、Provider、creditは不変。Production操作なし。
- 集中53/53、deps、lint、全型検査、Hub 829/829、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#324](https://github.com/team478a/manga/pull/324)はDraft／MERGEABLE。実装HEAD `fc4c77d`の必須5チェックはすべて成功し、[Preview](https://mangai-hub-staging-git-codex-fix-r4-3-7d36ca-team478as-projects.vercel.app)はReady。
- 次: 証跡同期後の最終HEADの5チェック成功で停止する。責任者確認前にProductionを変更せず、次タスクへ進まない。

---

## 0.0 現在の優先タスク（生成進捗と販売原稿完成の表示契約、2026-08-20）

- 最新基準はPR #322 merge commit `176facb48568809b4bf5461247de498942dfc84a`。Branchは`codex/fix-r4-3-project-progress-completion-contract`。
- Production作品画面は完成2/32と表示したが、完成原稿プレビューの正式完成判定は1/32（3%）、未完成30、確認待ち1だった。画像配置13/157、要修正276、credit 80/0/20。
- 原因は生成進捗の`complete`が画像Asset配置完了だけを意味し、必須セリフ・画像品質・revision・PNG・制作状態の販売原稿完成契約を含まないこと。
- 状態を`images_ready`、表示を「画像配置完了」へ改め、正式完成は原稿プレビューで確認する案内を追加した。全ページPNG完成判定の重複実行は追加しない。
- 22ページは技術的完成だが、出力画像では吹き出し内セリフが実用サイズで読めず、構図重複と連続性にも課題がある。20ページは4画像が品質確認待ち。
- Production、Provider、credit、DB、Canvas、PNG／PDF処理は不変。集中9/9、deps error 0（既存warning 2件）、lint、全型検査、Hub 827/827、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。100ページ受入れテストも新しい画像配置完了集計名へ同期した。
- Draft PR [#323](https://github.com/team478a/manga/pull/323)はDraft／MERGEABLE。実装HEAD `d31b6e1`の必須5チェックはすべて成功し、[Preview](https://mangai-hub-staging-6srpehoyl-team478as-projects.vercel.app)はReady。
- 次: 証跡同期後の最終HEADの5チェック成功で停止する。責任者確認前にセリフ出力修正や残り144コマ生成を開始しない。

---

## 0.0 現在の優先タスク（PR #321 Production完成受入れ、2026-08-20）

- 最新基準はPR #321 merge commit `c02fd0be0e9e1e9c7376801aa221c39fc068a1f9`。Branchは`codex/docs-r4-3-page-completion-production-acceptance`。
- Production deployment `5995191657`の成功後、責任者承認に基づき`test`の既存22ページで「修正完了として再確認」を1回だけ実行した。
- ページは「ページ完成」へ遷移し、画像4/4、セリフ1/1、生成中0、失敗0、revision 11、PNG成功を維持した。creditは使用80・予約0・残り20で不変。
- Provider実行、追加Job、追加Asset、Canvas保存、追加課金は0件。制作状態以外のProductionデータを変更していない。
- API、DB schema、migration、RPC、Storage、Provider、model、pricing、Canvas schema、PNG／PDF、成人向け、Desktop製品コードは不変。
- 次: 証跡の公開は明示承認後。次の実装判断前に、完成22ページの販売原稿目視品質と全32ページの完成率をread-only監査する。

---

## 0.0 現在の優先タスク（ページ要修正の再確認操作、2026-08-20）

- 最新基準はPR #320 merge commit `6095eadda7168a544118f080e154cb7b29bc0b84`。Branchは`codex/fix-r4-3-page-revision-review-action`。
- Production対象22ページの完成阻害理由は`cloud_pages.production_status=revision_required`に確定した。画像4/4、セリフ1/1、生成中0、失敗0、revision 11、PNG成功、credit 80/0/20は成立している。Production書込み・Provider実行なし。
- 完成判定を自動解除せず、阻害sourceがページ要修正の場合だけ編集画面に「修正完了として再確認」を表示し、既存の所有権検査済みrepositoryで`review_required`へ戻す。セリフ配置・候補採用の確認待ちではボタンを出さない。
- API、URL、DB、migration、RPC、Storage、Provider、credit、Canvas schema、PNG／PDF、成人向け、Desktop製品コードは不変。
- 集中18/18、deps、lint、全型検査、Hub 827/827、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#321](https://github.com/team478a/manga/pull/321)はDraft／MERGEABLE。実装HEAD `85c53ad`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-3bm8mokot-team478as-projects.vercel.app)。Vercel Authentication保護下。Production操作なし。
- 次: 証跡同期後の最終HEADの5チェック成功で停止する。merge前にProduction状態を変更しない。

---

## 0.0 現在の優先タスク（完成判定の手動確認理由可視化、2026-08-20）

- 最新基準はPR #319 merge commit `10f7b5c61efd755b405fb5f3a2c52861b2e74b3c`。Branchは`codex/fix-r4-3-completion-review-reasons`。
- PR #319のProduction反映後も対象22ページは画像4/4、セリフ1/1、生成中0、失敗0、revision 11、PNG成功、credit 80/0/20でgenericな手動確認待ちを継続した。Production書込み・Provider実行なし。
- 完成判定はセリフ配置台帳、ページ制作状態、候補採用台帳の3原因を1つのbooleanへ集約しており、画面から原因を区別できなかった。セリフ台帳はpage単位で一意、制作状態は`revision_required`だけが当該guard対象。
- guardを緩めず、セリフ配置確認／失敗、ページ要修正、コマ画像候補採用確認を原因別メッセージとして返す。既存generic入力との互換fallbackも維持する。
- API、DB、migration、RPC、Storage、Provider、credit、Canvas schema、PNG／PDF、成人向け、Desktop製品コードは不変。
- 集中18/18、deps、lint、全型検査、Hub 827/827、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure成功。
- 次: 明示承認後にstage／commit／push／Draft PRを作成し、5チェックとPreviewを確認して停止する。merge後、read-onlyで対象22ページに表示された原因を次の最小修正へ使う。

---

## 0.0 現在の優先タスク（表示Assetの品質承認と完成判定、2026-08-20）

- 最新基準はPR #318 merge commit `f9316ea2b41c2ec97a20aef6f6fcd32bdbcf3864`。Branchは`codex/fix-r4-3-visible-asset-quality-completion`。
- Production対象22ページは画像4/4、セリフ1/1、生成中0、失敗0、Canvas revision 11、PNG成功でも編集画面だけ手動確認待ちを継続した。credit 80/0/20、書込み・Provider実行なし。
- 原因はAsset承認経路の2欠落。`sourceJobId`なしの表示layerをAsset承認済みでも除外し、表示Assetの生成元が最新Jobでなければ品質ログ取得対象にも含めていなかった。
- 表示Assetを生成した過去Jobも品質ログ照合へ含め、JobまたはAssetで承認済みの表示layerとlegacy `panel.imageAssetId`をコマ単位で認識する。非表示・未承認は対象外。
- 未承認生成画像、不採用、Asset unavailable、画像・セリフ・revision・PNG・制作状態のguardは維持する。API、DB、migration、RPC、Storage、Provider、credit、Canvas schema、出力、成人向け、Desktop製品コードは不変。
- 集中17/17、deps、lint、全型検査、Hub 826/826、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure成功。
- Draft PR [#319](https://github.com/team478a/manga/pull/319)はDraft／MERGEABLE。初回HEAD `11fd4b7`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-mng02lj4r-team478as-projects.vercel.app)。`/login`正常、エラー境界なし。Production操作なし。
- 次: 証跡同期後の最終HEADの5チェック成功で停止する。merge後、追加Provider実行なしで対象22ページを再読込する。

---

## 0.0 現在の優先タスク（表示中の品質承認済み画像と完成判定、2026-08-20）

- 最新基準はPR #317 merge commit `0538c4f4f3b4668f963220af3f45fd7f22e5ce83`。Branchは`codex/fix-r4-3-visible-reviewed-completion`。
- Productionの対象22ページを再読込したが、画像4/4、セリフ1/1、生成中0、失敗0、Canvas revision 11、PNG成功でも編集画面だけ「手動確認待ち」を残した。creditは使用80・予約0・残り20で変化なし。
- セリフは`auto_placed`で、22ページは制作状態の要確認filter対象外だった。原因は、現在Canvasに表示され品質承認済みの画像と、同じコマに残る別生成単位の古いadoption確認待ちを完成判定が結び付けていないこと。
- 現在表示中で品質承認済みの生成画像があるコマでは、非表示の古い`review_required`／`placement_failed`を未解決として数えない。表示画像の品質・不採用・asset availabilityと他の完成guardは維持する。
- API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コードは変更していない。Production書込み0件。
- 集中16/16、deps、lint、全型検査、Hub 825/825、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure成功。
- Draft PR [#318](https://github.com/team478a/manga/pull/318)はDraft／MERGEABLE。初回HEAD `fbe59c5`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-mez84eq7v-team478as-projects.vercel.app)。`/login`正常、エラー境界なし。Production操作なし。
- 次: 証跡同期後の最終HEADの5チェック成功で停止する。merge後に追加Provider実行なしで対象22ページを再読込し「ページ完成」を確認する。

---

## 0.0 現在の優先タスク（品質承認済み候補の完成判定整合、2026-08-20）

- 最新基準はPR #316 merge commit `1cc2151996451d15ea00e7f9c8ab151939c33194`。Branchは`codex/fix-r4-3-selected-adoption-completion`。
- Productionの対象22ページをread-only監査し、セリフ`auto_placed`、ページ一覧「完成」、採用画像2件の品質確認済みを確認した。編集画面だけ「手動確認待ち」を残していた。
- 原因は、品質承認済み候補が存在しても、同一候補生成単位の古い`review_required`／`placement_failed` adoption台帳を完成判定が未解決として数えること。
- 同じ候補生成単位に品質承認済みかつ不採用でない候補があれば、古いadoption確認待ちを解決済みと判定する純粋domain helperを追加した。不採用・兄弟候補・全不採用の境界を回帰テストで固定した。
- API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コードは変更していない。Productionへの書込みも0件。
- 集中15/15、deps、lint、全型検査、Hub 824/824、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#317](https://github.com/team478a/manga/pull/317)はDraft／MERGEABLE。実装HEAD `e3f80a8`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-qht1tbga3-team478as-projects.vercel.app)。`/login`正常、ブラウザログ0件。Production操作なし。
- 次: 証跡同期後の最終HEADの5チェック成功で停止する。merge後、追加Provider実行なしで対象ページを再読込し、「ページ完成」表示を確認する。

---

## 0.0 現在の優先タスク（PR #315 Production受入れ、2026-08-20）

- 最新基準はPR #315 merge commit `09a3bfddc476d5a37f8821f2ec6cc767f531d9a3`。Branchは`codex/docs-r4-3-provider-layout-production-acceptance`。
- `test`の既存22ページで、修正前のコマ2元失敗JobをPR #315の最初の一般向け安全再構成に1回だけ通した。旧安全再構成Jobは選ばず、第2段階retryは未実行。
- [Worker run 32313830268](https://github.com/team478a/manga/actions/runs/32313830268)が成功し、BFL `flux-2-pro`で1画像が完成した。`request_moderated`は再発せず、使用credit 78→80、予約0、残り22→20。
- 新画像は正立、疑似文字・ロゴなし、目立つ人体破綻なし、場面成立を目視確認し、販売原稿チェック4項目を承認してコマ2へ採用した。
- Canvas revision 10→11、画像4/4、セリフ1/1、生成中0、失敗0、PNG成功。4コマPreviewとブラウザログ0件を確認した。
- ページ一覧は22ページを「完成・画像配置4/4」と表示するが、編集画面の完成バナーだけは「手動確認待ち」を残す。採用画像2件は品質確認済み。次工程でadoption／dialogue placement／production statusのどれがsourceかをread-only監査し、推測修正しない。
- API、DB schema、migration、RPC、Storage設定、Feature Flag、Provider、model、pricing、retry回数、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードは変更していない。
- Draft PR [#316](https://github.com/team478a/manga/pull/316)はDraft／MERGEABLE。初回HEAD `9f70280`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-2hg5soz33-team478as-projects.vercel.app)。`/login`正常、ブラウザログ0件。Production操作なし。
- 次: 最終証跡同期HEADの5チェック成功で停止する。責任者確認前に追加Provider実行を行わない。

---

## 0.0 現在の優先タスク（不採用画像修復後の自動再読込loop修正、2026-08-20）

- 最新基準はPR #313 merge commit `f9f2b544fe0ffc0cc5c23064097ccce089f1073d`。Branchは`codex/fix-r4-3-rejected-reload-loop`。
- Production対象22ページで既存原稿修復を1回実行し、Canvas revision 8→9、保存済み、PNG成功を確認した。不採用画像3件・逆転背景2コマを修復し、creditは24のまま、Provider呼出し0件。
- 修復後は画像2/4、生成中0、失敗1、コマ1・2未配置の未完成状態。画像内文字を含む不採用画像を完成扱いにしない目的は達成した。
- 不採用Jobが`auto_placed`履歴を保持するため、layer不在を未読込と誤認したeffectが約3秒ごとに再読込してedit lock確認へ戻る阻害を実機で特定した。page-lock APIはRuntime Logsで200でありDB障害ではない。
- 自動反映の再読込候補へ`quality_review_status !== "rejected"`を追加する。不採用履歴、通常auto placement、完成guard、Canvas schemaは変更しない。
- 集中18/18、deps error 0（既存warning 2件）、lint、Hub／Desktop typecheck、Hub 821/821、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#314](https://github.com/team478a/manga/pull/314)を作成。初期HEAD `c53baed`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-git-codex-fix-r4-3-6d2c28-team478as-projects.vercel.app)。`/login`を読取確認し、ブラウザエラー・警告0件。Productionデータへの操作は行っていない。
- 次は本証跡同期HEADの5チェックを再確認して停止する。
- merge前にProduction再生成は行わない。merge後にloop停止を確認し、不足コマだけの生成へ進む。

---

## 0.0 現在の優先タスク（既存原稿の明示修復、2026-08-20）

- 最新基準はPR #312 merge commit `54d621ddb06c58e5753842e54afd6698ee171917`。Branchは`codex/fix-r4-3-existing-manuscript-repair`。
- Production 22ページの読取受入れで、PR #312の完成guardは有効だが、既存保存済みCanvasは自動移行されず、不採用layer、短い縦書き2列、逆転背景順が残ることを確認した。
- 編集画面に「既存原稿を修復」を追加。不採用layer除去、短文縦書き1列化、日時で安全に判断できる背景順修復を、追加生成・credit消費なしの明示操作で行う。Undoと既存autosaveを使用する。
- 新規背景採用も旧背景より前面、人物・効果等より背面になるよう修正した。日時欠損の既存背景は推測変更しない。
- DB、migration、RPC、Storage、API、URL、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コード、Productionデータは変更していない。
- 集中60/60、deps、lint、全型検査、Hub 820/820、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#313](https://github.com/team478a/manga/pull/313)はDraft／MERGEABLE。実装HEAD `b334502`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-git-codex-fix-r4-3-322148-team478as-projects.vercel.app)。対象ページ直URLは未認証時に`/login`へ遷移した。Production DBを参照する修復ボタンは押していない。
- 次: 本証跡同期HEADの5チェックを確認して停止する。merge前にProduction Canvasを変更しない。merge後、`test`本人が対象22ページで修復、保存、再読込、完成判定、PNGを確認する。

---

## 0.0 現在の優先タスク（Production原稿の不採用画像・短い縦書き品質修正、2026-08-19）

- 最新基準はPR #311 merge commit `29744d3a720ce6c270face0b29768b746b33f239`。Branchは`codex/fix-r4-3-production-text-quality`。
- Production作品22ページの不要な画像内文字と、Canvas短文「証拠を」の不自然な縦2列を確認した。
- 不採用の品質状態がCanvas採用状態へ反映されない不整合を解消し、不採用Job由来layerを外して直前の背景へ戻す。不採用画像が残るページは完成不可にした。
- 6文字以下・改行なしの縦書きは、可読下限内で1列になるfont sizeを優先する。既存原稿の短文複数列は販売前検査で`text_layout` errorにする。
- DB、migration、RPC、Storage、Provider、credit、Canvas schema、PNG／PDF処理、Productionデータは変更していない。
- 集中55/55、deps、lint、Hub型検査、Hub全件、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#312](https://github.com/team478a/manga/pull/312)はDraft／MERGEABLE。実装HEAD `156ccb2`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- Previewは[Ready](https://mangai-hub-staging-git-codex-fix-r4-3-bbdcdb-team478as-projects.vercel.app)。`/login`正常、error boundary／console errorなし。
- 次: 最終証跡同期HEADの5チェックを確認して停止する。merge後にProduction 22ページで不採用操作、保存完了、縦書き再配置、完成判定／PNGを実機確認する。

---

## 0.0 現在の優先タスク（Production品質フィードバック保存復旧、2026-08-19）

- 最新基準はPR #310 merge commit `5752227219cd87f2b77cdbe5fe306fb91972a3cc`。Branchは`codex/fix-production-quality-feedback-schema-fallback`。
- Productionの`test`で原稿画像48/48読込、broken 0、704x1024、Canvas上4コマの表示を確認した。Sharp復旧はProductionで有効。
- 原因はProduction DBで既存migration `202608020002_cloud_general_monitor_quality_feedback.sql`だけが未反映だったこと。適用前は品質列0/15、後続運用列9/9だった。
- 正本のmigrationをProductionへ適用し、品質列15/15、index、constraint、owner INSERT policyを確認した。アプリコード、migrationファイル、API契約は変更していない。
- Productionの既存コードで品質評価を1回保存し、UI成功表示とDB行`72665ec0-8093-410b-a5a3-1ca4efae761e`を確認した。`page / needs_revision / image_quality / minor`、page 22、generation_count 28、panel null。
- Production変更は既存migration適用と検証用フィードバック1行のみ。画像生成、credit消費、作品、画像、Storage、Provider、Canvas、PNG／PDF、成人向け境界、Desktop変更はない。
- PR #311の中間fallback実装は不要と確定したため撤回し、復旧証跡文書だけを残す。
- Draft PR [#311](https://github.com/team478a/manga/pull/311)はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- 次: 責任者確認待ち。追加のProduction送信、PR merge、次工程へは進まない。

---

## 0.0 現在の優先タスク（Production Sharp Runtime復旧、2026-08-19）

- 最新基準はPR #309 merge commit `27f29fec96104ca60dd736f2c9781ab09dcb8b50`。Branchは`codex/fix-production-sharp-runtime`。
- Productionの主要Route 500は、Vercel FunctionsにLinux x64版Sharp native binding／libvipsが同梱されず、`libvips-cpp.so.8.18.3`の`ERR_DLOPEN_FAILED`になったことが原因。
- `next.config.ts`のoutput file tracingへ既存optional dependency 2件を明示した。Sharpは`0.35.3`のままで、Providerや画像処理契約は変えていない。
- 回帰テストを追加し、Linux package配置build simulationではApp Router 110/110 traceにnative bindingとlibvipsの両方を確認した。
- deps error 0、lint、全型検査、Hub 811/811、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Production、DB、Storage、API、Provider、Canvas、PNG／PDF、成人向け境界、Desktop製品コードは変更していない。
- Draft PR [#310](https://github.com/team478a/manga/pull/310)はDraft／MERGEABLE。最終実装HEAD `bf13659`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。
- Preview `Aki2dWcfbW1U1ZmF7jyjzhBH9Jgv`はReady。`/login`、`/works`、`/sales-packages`、`/`は200、500とSharp／libvips errorは0件。
- 初回Core qualityの回帰テスト誤検査は、package rootではなく公開subpathのnative binding／libvips binaryを解決する形へ修正済み。
- 次: 最終証跡同期HEADの5チェックを再確認して停止する。merge前にProductionへ反映しない。

---

## 0.0 現在の優先タスク（原稿未生成表示・品質フィードバック保存阻害修正、2026-08-19）

- 最新基準はPR #308 merge commit `24da38c8632d3f36cf364bf616f3af668322cd4a`。Branchは`codex/fix-r4-3-monitor-manuscript-blockers`。
- 利用者写真で、原稿がコマ枠・吹き出し・文字だけの状態と、品質フィードバックの保存失敗を確認した。
- 空白原稿は画像未生成のネーム状態を画面が明示していない問題として扱う。未生成／生成中／失敗／配置確認待ちを上部表示し、明示操作が必要な一括画像生成へ導く。自動課金は開始しない。
- 品質評価はcaller-scoped ownership検証後、一般報告と同じserver-only infrastructure repositoryで保存する。RLS・schema fallback・利用者向け秘密非表示を維持する。
- DB、migration、RPC、Storage、Provider、model、credit、Scheduler、Canvas schema、PNG／PDF、成人向け境界、Desktop製品コード、Productionは変更していない。
- 集中6/6、deps、lint、Hub型検査、Hub 810/810、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub build、diff check成功。
- Draft PR [#309](https://github.com/team478a/manga/pull/309)はDraft／MERGEABLE。初回HEAD `a0701c5`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-fix-r4-3-babd9e-team478as-projects.vercel.app)。
- 次: 証跡同期後の最終HEADで5チェックを再確認して停止する。merge前にProductionでの評価送信や画像生成を行わない。

---

## 0.0 現在の優先タスク（PR-R4-3A-15 Production Panel Rollout Guard、2026-08-19）

- 最新基準はPR #307 merge commit `5f37817c681b6a8592aee4d5c485b09c46dd1606`。Branchは`codex/docs-r4-3a15-production-panel-rollout`。
- Productionの品質確認Flagはon、deployment `FyCvjRpzXDuxsTKq9yU5S5Ntv91U`はReady。Batchはactive、画像28、assignment 0、response 0。
- Reviewer A=`test`の割当失敗は重複ではなく、Batch開始日時が2026-08-20 00:00 JSTで現在は開始前だったため。正本は開始前割当を拒否する。
- 管理画面へ開始前案内と日本時間を表示し、利用期間外と重複を別エラーにする。保存契約、期間、DB、migration、RPCは変更しない。
- 予定割当はA=`test`、B=`青木隆康`、C=`なっかん`、D=`加藤周星`、E=`松浦周平`。開始時刻と本PRのmerge後にProduction管理画面から実施する。
- 正式Benchmarkは0/140。A/B回答を正式採用せず、C〜Eは補助票として分離する。
- deps error 0、lint、全型検査、Hub 808/808、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- PR #308初回Core qualityのReact purity failureは、repositoryが返す固定`loadedAt`を画面判定へ使う修正で解消し、ローカルlint・型・集中11/11を再確認した。

---

## 0.0 現在の優先タスク（PR-R4-3A-14 Production Panel Migration Acceptance、2026-08-18）

- 最新基準はPR #306 merge commit `a390091d590146b7a3f2496763ac2c0118e453ce`。Branchは`codex/docs-r4-3a14-production-panel-migration`。
- Productionへ既存migration `202608180002_cloud_monitor_quality_review_panel`を1回適用した。事前はpanel列なし、assignment 0、response 0。
- 適用後の`batch_private_01`はactive、`PILOT_INTRINSIC_ONLY`、目標5名、画像28、assignment 0、response 0。
- 目標外slot拒否関数とtriggerは存在し、`authenticated`の関数直接実行権限はない。
- Feature Flagはoffのまま。モニター割当、回答、作品、Canvas、Storage object、Provider、creditは変更していない。正式Benchmarkは0/140。
- 新規Production管理画面タブは認証セッションが共有されず、画面表示だけ未確認。DB受入れ条件はSQLで確認済み。
- deps error 0、lint、全型検査、Hub 806/806、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#307](https://github.com/team478a/manga/pull/307)はDraft／MERGEABLE。初回HEAD `dc51874`の5チェックはすべて成功。Previewは[Ready](https://mangai-hub-staging-if8el55ia-team478as-projects.vercel.app)。
- 次: 最終証跡同期HEADでも同じ5チェックを確認して停止する。責任者確認と管理画面表示確認前にFlag有効化、A〜E割当、Human Review、R4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-13 Multi-Reviewer Panel、2026-08-18）

- 最新基準はPR #305 merge commit `8ae9beaa334c0621f80fc30d72527a7a031bfa8e`。Branchは`codex/feat-r4-3a13-multi-reviewer-panel`。
- Human Reviewを既定5名、Batchごとに2〜9名へ拡張する。正式BenchmarkのPrimary A/B契約は変更せず、Panel C〜Iを別schemaへ分離した。
- Batch目標人数を超えるslotはapplicationとDB triggerの二重検査で拒否。同一人物／同一slotの重複拒否、blind表示、private画像、本人限定RPC、Feature Flagを維持する。
- 管理画面はBatch単位の目標／割当数と未割当slotだけを扱い、回答payloadを取得しない。
- Productionはactive Batch 1件、画像28、assignment 0、response 0、Flag offのまま。migration、Flag、割当、作品、Provider、creditは変更していない。
- 集中17/17、deps error 0、lint、全型検査、Hub 806/806、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 61件、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#306](https://github.com/team478a/manga/pull/306)はDraft／MERGEABLE。初回HEAD `252fe55`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-57ac78-team478as-projects.vercel.app)。
- 次: 最終証跡同期HEADでも同じ5チェックを確認して停止する。責任者確認前にProduction migration、Flag有効化、A〜E割当、R4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-12 Production Batch Activation Acceptance、2026-08-18）

- 最新基準はPR #304 merge commit `0c6f8f9e6d380334d6605ad78ed11f64925fada8`。Branchは`codex/docs-r4-3a12-production-batch-activation`。
- 責任者のmergeと管理者ログイン確認後、Production管理画面から`batch_private_01`を検査付きで1回だけ`draft -> active`へ変更した。
- 画面上の事前条件は画像28枚、割当0件、Feature Flag off。成功後は`active`、画像28枚、担当者未割当、Flag off、割当ボタン無効を確認した。
- assignment 0、response 0、Human A/B 0/56、正式Benchmark 0/140。Batch有効化だけではモニターへ公開されていない。
- Production作品、Canvas、Provider、credit、DB schema、migration、RPC、Storage、API、URL、PNG／PDF、成人向け境界、Desktopは変更していない。
- Draft PR [#305](https://github.com/team478a/manga/pull/305)はDraft／MERGEABLE。初回HEAD `a5cab7c`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-docs-r4-836d87-team478as-projects.vercel.app)。
- 次: Docs-only Draft PRの全CIとVercel Preview成功後に停止する。Reviewer AのProduction表示名と別人のReviewer Bが責任者から指定されるまで、Feature Flag変更、担当割当、Human Review、R4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-11 Controlled Batch Activation、2026-08-18）

- 最新基準はPR #303 merge commit `03fe58c9fc22631d15407bf1fd82b77039bbfcb2`。Branchは`codex/feat-r4-3a11-controlled-batch-activation`。
- 管理者`/admin/general-monitors/quality-review`へ、Benchmark Batchの検査付き有効化／停止／再開を追加した。手動SQLを通常運用にしない。
- `draft -> active`はscope、元package SHA、人間の権利確認、未失効期間、画像28枚、割当0件をfail closedで検査し、旧状態一致条件付きで更新する。
- Feature Flag停止中でもBatchの検査と有効化はできるが、担当割当は無効。有効化だけではモニターへ公開されない。
- Productionの`batch_private_01`は現在も`draft`、assignment 0、response 0、Flag off。Human A/B 0/56、正式Benchmark 0/140。外部状態は変更していない。
- 集中4/4、deps、lint、全typecheck、Hub 801/801、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 60本、Hub／Desktop build、RC structure、diff check成功。
- Draft PR [#304](https://github.com/team478a/manga/pull/304)はDraft／MERGEABLE。初回HEAD `07a8b8c`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-c7e6e3-team478as-projects.vercel.app)。
- 次: 最終証跡同期HEADでも同じ5チェックを再確認して停止する。責任者確認前にProduction有効化、Flag変更、A/B割当、R4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-10 Production Draft Acceptance、2026-08-18）

- 最新基準はPR #302 merge commit `2da179c1b4c5534cf6eee182caeede773c932c7a`。Branchは`codex/docs-r4-3a10-production-draft-acceptance`。
- 責任者承認により、Productionへ`202608180001_cloud_monitor_quality_review`を適用し、private bucket、4テーブル、RLS、専用RPC、直接権限なしを確認した。
- 権利確認済み28画像を`batch_private_01`へ非公開`draft`、`PILOT_INTRINSIC_ONLY`として登録した。期間は2026-08-20 00:00 JST〜2026-09-20 00:00 JST。
- Production直接検査はcase 28、Storage 28、assignment 0、response 0。Storageから28画像を再取得し、DB記録のSHA-256と28/28一致、不一致0件だった。
- Production secret keyは現在の処理内だけで使用し、画面、stdout、環境ファイル、Gitへ保存せず、使用後にクリップボードを消去した。
- Batch active化、A/B割当、Feature Flag有効化は未実施。Human A/Bは0/56、正式Benchmarkは0/140。通常作品、Canvas、公開Storage、Provider、creditは不変。
- Draft PR [#303](https://github.com/team478a/manga/pull/303)はDraft／MERGEABLE。初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-docs-r4-5a9ce0-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認する。
- 責任者が異なる2名の有効モニターと有効化順序を確認する前にactive化、割当、R4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-9 Production Draft Admission、2026-08-18）

- 最新基準はPR #301 merge commit `8650c12ba9009652cebc00e9cb8247807e1c4b2c`。Branchは`codex/feat-r4-3a9-production-draft-admission`。
- 責任者判断によりStaging専用Supabaseは準備しない。Production内のBenchmark専用4テーブルとprivate bucketへ、権利確認済み28画像を非公開`draft`としてだけ登録できる入口を追加する。
- 既定dry-runとstaging互換を維持し、Productionは専用URL／service role／project ref、対象project ref、Batch code、固定確認句の三重確認が揃った場合だけapply可能にする。一般Supabase環境変数へfallbackしない。
- apply後も`draft`、`PILOT_INTRINSIC_ONLY`、割当0件を強制し、DB case setとprivate Storageから再取得した画像SHA-256を検査する。失敗時は当該BatchのStorageとDBだけcleanupする。
- 今回はProduction apply、active化、A/B割当、Feature Flag変更を行わない。通常作品、Canvas、公開Storage、Provider、credit、DB schema、migration、RPC、API、PNG／PDF、成人向け境界、Desktopは不変。
- 実package Production dry-runは28件で`PRODUCTION_BATCH_ADMISSION_READY`、外部変更0件。集中5/5、deps、lint、型検査、Hub 797/797、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、Hub／Desktop build、migration 60本、RC structure、diff check成功。Human権利確認28/28、A/B 0/56、正式Benchmark 0/140。
- Draft PR [#302](https://github.com/team478a/manga/pull/302)はDraft／MERGEABLE。実装HEAD `e6e87d7ebf59cb95b19898a2432ce9a613d8a538`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-pmolc68ia-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認し、責任者確認前にapplyしない。

---

## 0.0 現在の優先タスク（Benchmark Batch 01 匿名権利確認受入れ、2026-08-18）

- 最新基準はPR #300 merge commit `47fe03d3ecbe90f1fd45f7708bc49423cc17fd57`。Branchは`codex/docs-r4-3a-rights-review-acceptance`。
- 責任者が28画像を確認し、実名を保存せず`anonymous`として全権利確認項目を承認した。モニターA/Bは既存どおりログインプロフィールIDを内部識別にだけ使用し、氏名入力を要求しない。
- 元の権利確認ZIPを上書きせずGit外へ完了版を作成した。`--require-complete`は28/28、Provider規約、Benchmark評価用途、顧客／Production素材不使用、個人情報なし、成人向けなし、PNG、SHA-256、寸法、Content Credentials、重複なしに成功。package SHA-256は`05cf95e530d6ff699ade2a1237c882eb518281e15b9dcfb74f99a120f8a7ff59`。
- staging取込dry-runは`STAGING_BATCH_ADMISSION_READY`、28件で成功。DB、Storage、Productionの変更は0件。
- 関連回帰4/4、dependency／module boundary、lint、diff check成功。既知warning 2件は差分外。
- staging専用URL、service role、staging project ref、Production project refは現在の実行環境に未設定。一般Supabase環境変数へfallbackせずapplyを停止した。
- Draft PR [#301](https://github.com/team478a/manga/pull/301)はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-docs-r4-661158-team478as-projects.vercel.app)。
- Human権利確認28/28、A/B 0/56、正式Benchmark 0/140。staging専用4設定、実在する管理者profile ID、期間、migration適用先を確認するまでapply、active化、A/B割当、R4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-8 Review Batch Admission、2026-08-18）

- 最新基準はPR #299 merge commit `2ab608b799c1c8092adad589fc0ae2df3d664bd6`。Branchは`codex/feat-r4-3a8-review-batch-admission`。
- 権利確認packageの構造検査とHuman完了検査を分離し、完了時は確認者、offset付き日時、Provider規約、Benchmark利用、顧客／Production作品不使用、個人情報なし、成人向けなし、全件approvedを必須にする。空templateは従来どおり構造検査と暗号化に使用できる。
- staging取込CLIは既定dry-run。28件、package／画像SHA-256、PNG、寸法、必須Content Credentialsを再検査し、専用staging URL／service role／project ref、明示確認、Production project ref不一致が揃った場合だけapplyできる。
- apply時もBatchは`draft`。private bucketへ上書きせずuploadし、途中失敗は対象Storage pathとBatchだけをcleanupする。active化、Reviewer A/B割当、Production経路は実装しない。
- Production、DB schema、migration、RPC、既存作品、Provider、credit、runtime Judge、Canvas、PNG／PDF、成人向け境界、Desktopは不変。staging／Productionの外部状態は未変更。
- 集中15/15、deps、lint、Hub型検査、Hub 796/796、Canvas 26/26、AI 48/48、migration 60本、研究評価、Cloud漫画repository、owner isolation、100ページ4/4、Webpack Hub build、RC structure、diff check成功。通常Turbopackは既知Windows path length、Desktop 4ゲートは差分外のローカル`@napi-rs/keyring`型宣言不足で停止し、GitHub Windows CIで正式判定する。
- Draft PR [#300](https://github.com/team478a/manga/pull/300)はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-e9ad91-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認する。
- 人間の権利確認0/28、A/B 0/56、正式Benchmark 0/140。完了rights package受領前にstaging applyせず、責任者確認前にProduction登録やR4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-7 Monitor Review Portal、2026-08-18）

- 最新基準はPR #298 merge commit `d154895cc04e198a60090ae4c74ea90ed1e7299b`。Branchは`codex/feat-r4-3a7-monitor-review-portal`。
- 招待モニター向け`/dashboard/monitor/quality-review`へ、同意、1画像判定、確信度、欠陥分類、下書き自動保存／再開、画像確定、全件送信を追加する。
- 管理者`/admin/general-monitors/quality-review`は異なるReviewer A/Bの割当、確定数、開始確認、最終送信だけを扱い、回答payload、正解label、AI監査を取得しない。
- private bucket、120秒署名URL、本人assignment再確認、専用fail-closed Flag、authenticatedへの直接テーブル権限なし、本人限定RPCを追加する。既存`mangai-human-review-v2`の判定規則を再利用する。
- 顧客／Production／モニター作品、権利未確認画像を使用しない。private Batch 01は人間の権利確認完了まで登録しない。Production変更なし。
- 集中13/13、deps、lint、Hub型検査、Hub 792/792、Canvas 26/26、AI 48/48、migration 60本、Webpack Hub build、RC structure、diff check成功。通常Turbopackは既知Windows path length、Desktop 4ゲートは差分外のローカル`@napi-rs/keyring`型宣言不足で停止し、GitHub CIで正式判定する。責任者確認前にProduction登録とR4-3Bへ進まない。
- Draft PR [#299](https://github.com/team478a/manga/pull/299)はDraft／MERGEABLE。実装HEAD `f213ff4`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。Previewは[Ready](https://mangai-hub-staging-git-codex-feat-r4-377b35-team478as-projects.vercel.app)。最終証跡同期HEADでも同じ5チェックを再確認して停止する。

---

## 0.0 現在の優先タスク（PR-R4-3A-6 Secure Human Review Transfer、2026-08-17）

- 最新基準はPR #296 merge commit `ba9b31ad7cbe731870fd1edab2f7eb01206c92fc`。Branchは`codex/feat-r4-3a6-secure-review-transfer`。
- private ZIPを公開URLへ置かずに渡すため、PBKDF2-HMAC-SHA-256 310,000回＋AES-256-GCMの自己完結型HTML封筒、パスフレーズ生成、暗号化、復号validator、権利確認ZIP validatorを追加した。
- パスフレーズは24文字以上のファイル入力限定。別Reviewerごとに異なるsalt／IV／パスフレーズを使い、秘密値をstdout、HTML、receipt、Gitへ出さない。元ZIP SHAと長さをAADへ束縛し、誤パスフレーズ、改ざん、slot不一致、上書きをfail closedで拒否する。
- 外向けHTMLは中立名で、Reviewer slot／package ID／元名を含まない。役割対応はGit外private mappingだけにあり、CSP `connect-src 'none'`で復号画面の外部通信を禁止する。
- 実Batchの権利確認／Reviewer A／Reviewer B各28件を3つの暗号化HTMLへ変換し、全件復号、SHA、package version、件数を確認。画像、ZIP、mapping、パスフレーズ、receiptはGit外。外部upload／共有0件、Production変更なし。
- 集中3/3、実権利package 28件、実暗号化／復号3/3、deps、lint、Hub型検査、Hub 784/784、Canvas 26/26、AI 48/48、migration 59本、Webpack build、RC structure、diff check成功。Turbopackは既知Windows path length。`file://`実ブラウザ操作は安全ポリシーで停止し、受領端末確認へ残す。
- Draft PR [#298](https://github.com/team478a/manga/pull/298)はDraft／MERGEABLE。Previewは[Ready／SSO保護](https://mangai-hub-staging-mb4xx3i63-team478as-projects.vercel.app)。実装HEAD `1a06e46`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。最終証跡同期HEADでも同じ5チェックを再確認する。
- 正式Benchmark 0/140、人間の権利確認0/28、Human A/B 0/56。責任者確認と受取人／別経路指定まで外部送信せずR4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-5 Mobile Offline Human Review、2026-08-17）

- 最新基準はPR #297 merge commit `f9aff56666731f25a1c678d65a080c15b7da46ae`。Branchは`codex/feat-r4-3a5-mobile-offline-review`で、通常mergeにより取り込み済み。
- Reviewer ZIPへCSPで外部通信を禁止した`review.html`を追加する。スマートフォン幅で画像、判定、確信度、欠陥、コメントを操作し、既存`mangai-human-review-v2`回答JSONを端末保存できる。
- 正解label、相手の回答、AI監査、Prompt、source group／family、split、URL、秘密値をUIへ含めない。package validatorはembedded manifest／template／order／intendedの改ざん、remote resource、network policy欠落を拒否する。
- 既存v2 packageは`review_ui`なしでも有効。Batch 01 A/B各28件のmobile packageをprivate rootへ生成し、validator、sidecar、leakage、C2PA保持に成功。390×844で28件の操作とJSON生成を確認したが、テスト回答をHuman labelへ使わない。
- 集中16/16、実A/B validator、dependency、lint、Hub型検査、Hub 781/781、Canvas 26/26、AI 48/48、migration 59本、Webpack Hub build、RC structure成功。通常Turbopackは既知Windows path length、Desktop 4ゲートは既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub CIで正式判定する。
- 正式Benchmarkは0/140、人間の権利確認0/28、Human A/B 0/56。安全なスマートフォン配布経路は未決定で、外部uploadしていない。
- Draft PR [#296](https://github.com/team478a/manga/pull/296)はDraft／MERGEABLE。Previewは[Ready／SSO保護](https://mangai-hub-staging-pzf49iulq-team478as-projects.vercel.app)。
- PR #297を通常mergeしたHEAD `d3dc0d8`でCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsがすべて成功し、旧Desktop期限切れblockerは解消した。最終証跡同期HEADでも同じ5チェックを確認して停止する。安全な配布経路とHuman Reviewer A/B割当てが決まるまでR4-3Bへ進まない。

---

## 0.0 現在の優先タスク（PR-R4-3A-5 prerequisite: Desktop期限契約、2026-08-17）

- PR #296のCore quality／Windows buildは再実行を含め同じ既存Desktop 4テストで失敗した。2026-08-17 00:00 UTCにDezgo pricing有効期限とテスト用成人Provider policyが同時失効し、成功系fixtureが実時刻でfail-closedになったことが原因。
- Branchは`codex/fix-desktop-expired-clock-contracts`、BaseはPR #295 merge commit `f989d61`。PR #296へ混在させない先行修正とする。
- `AIService`費用guardと成人Provider policy状態／適用へoptionalな基準時計を追加し、該当4テストだけ固定日時を明示する。Productionは引数を渡さず実時刻を使うため、期限切れ価格の`pricing_stale`と成人policy失効を維持する。
- pricing version／金額／期限、Provider、model、署名、DB、API、IPC、Production、creditは変更しない。
- 費用guard 1/1、署名policy 1/1、deps、lint、Hub型検査、Hub 778/778、Canvas 26/26、AI 48/48、migration 59本、Webpack build、RC structure成功。Desktopローカルnative環境不足はGitHub Linux／Windows CIで正式判定する。
- PR [#297](https://github.com/team478a/manga/pull/297)はmerge commit `f9aff56666731f25a1c678d65a080c15b7da46ae`で基準ブランチへマージ済み。Previewは[Ready／SSO保護](https://mangai-hub-staging-qpkmz2lp4-team478as-projects.vercel.app)。Core quality、Migration roundtrip、Windows build、Vercel、Preview Commentsは成功し、Linux／Windows Desktop 182/182を確認した。
- PR #296へ通常mergeで取り込み、R4-3Bへ進まず同PRの全CIを再確認する。

---

## 0.0 現在の優先タスク（PR-R4-3A-4 follow-up: Content Credentials保全、2026-08-17）

- 最新基準はPR #294 merge commit `c6bce94`。Branchは`codex/fix-r4-3a4-benchmark-provenance`。
- Draft PRは[#295](https://github.com/team478a/manga/pull/295)（Draft／MERGEABLE）。Previewは[Ready](https://mangai-hub-staging-git-codex-fix-r4-3-336c71-team478as-projects.vercel.app)。実装HEAD `7389b67`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsは成功。最終証跡同期HEADでも再確認して停止する。
- Batch 01のProvider原PNG 28/28にC2PA `caBX`が存在したが、最初の再エンコード正規化で除去されていた。原PNGから追加課金なしで復旧し、Content Credentialsなしの派生画像・report・ZIPはprivate quarantineへ隔離した。
- private source／assemblyへ`required_provenance_chunks`を追加し、review package生成、package検証、正式assemblyで`caBX`保持を強制した。未指定fixtureは`[]`で後方互換を維持する。
- 修正版Reviewer A/B ZIPは各28件、validator成功、`caBX` 28/28。権利確認packageも28件作成済み。画像、Prompt、Provider Job ID、秘密値、権利資料はGitへ入れていない。
- 集中22/22、実A/B validator、依存境界、lint、Hub型検査、Hub 778/778、Canvas 26/26、AI 48/48、migration 59本、Webpack Hub build、RC structure成功。Turbopackは既知Windows path length、Desktop 4ゲートは既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub CIで判定する。
- 正式Benchmarkは0/140。人間の権利確認0/28、独立Human Review 0/56。機械検査だけでは正式採用せず、R4-3Bへ進まない。
- Production、DB、Storage、Provider設定、credit、runtime Judge、Canvas、PNG／PDF、Desktopは変更していない。最終HEADの全CI／Vercel Preview確認後、責任者review待ちで停止する。

---

## 0.0 現在の優先タスク（PR-R4-3A-4 Human Review Package、2026-08-17）

- 最新基準はPR #293 merge commit `61fcaf3`。Branchは`codex/fix-r4-3a4-review-package-context-schema`。
- Draft PRは[#294](https://github.com/team478a/manga/pull/294)（Draft／MERGEABLE）。Previewは[Ready](https://mangai-hub-staging-git-codex-fix-r4-3-0772e8-team478as-projects.vercel.app)。実装／PR同期HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsは成功。最終証跡同期HEADでも再確認して停止する。
- Human Reviewを`intrinsic_only`／`referential`へ分離し、Human response v2、mode別category、Panel Specification／identity reference binding、中立UUID、blind ZIP、private source sidecar、package／response validator、A/B比較を実装した。
- 正式v2.1の`img_0001`を変更せず、Reviewer ZIPだけ`case_000001`へ変換する。対応とsource groupはZIP外private sidecarへ保持する。同一source familyはdev／holdoutへ分けない。
- 既存12画像からReviewer A/BのR4-3A-4版Pilot ZIPを新規生成し、両方validator成功。`PILOT_INTRINSIC_ONLY / NOT_COUNTED_IN_FORMAL_BENCHMARK`、正解labelなし、Human回答なし。正式fixtureは0/140のまま。
- AI監査は`reviewer_kind: ai_audit`としてHumanと分離し、Human A/Bの代替にしない。不一致は自動多数決せずadjudicationを要求する。
- 集中20/20、Hub 776/776、Canvas 26/26、AI 48/48、deps、lint、Hub型検査、migration 59本、research eval、repository、owner isolation、packages／Webpack Hub build、RC structure、実Pilot A/B validator成功。Turbopackは既知Windows path length、Desktop 4ゲートは差分外の既知`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub CIで判定する。Production、DB、Storage、Provider、runtime Judge、repair、Canvas、出力は変更していない。
- 全品質ゲート、Draft PR、CI／Preview確認後に停止し、責任者確認前に正式reviewやR4-3Bへ進まない。詳細は`docs/CURRENT_TASK.md`と`docs/quality-benchmark-human-review.md`。

---

## 0.0 現在の優先タスク（PR-R4-3A-3 Fixture Assembly、2026-08-16）

- 最新基準はPR #292 merge commit `3f121f5da1e998bce3d595ad1ba77261d2b08253`（PR #291 `355ebfd`を含む）。Branchは`codex/feat-r4-3a3-benchmark-assembly`。
- PR #291のEvidence／Visual Judge境界、PR #292のpublic cases／private labels、dev 112／private holdout 28、Production-native profile、Panel Specification、6不良群、strict preflightを維持する。
- checkerは`tests/fixtures/manga-quality/tools/bench_leak_check_v2_1.py`、SHA-256は`3FB2030AAC0884D8051BE45B98F48A5725D7850CDD47A62805E7F865B97213E0`。v1は`overall=false`のnegative control。
- 画像IDはPR #292の4桁契約を維持する。今回指示の6桁表記は中立命名の例と解釈し、versioned contractを無断変更しない。
- 実画像0/140、独立review 0/280。顧客、Production、モニター、権利不明、成人向け、PII、v1、placeholderを使わない。ローカルfixture root環境変数と、権利・family・二重review・adjudication・分割assembly基盤だけを今回の範囲とした。
- ローカルroot、3台帳、AI review拒否、第三者adjudication、family split、exact／near duplicate、合意率／kappa、no-overwrite assemblyを実装した。集中7/7、Hub 763/763、Canvas 26/26、AI 48/48、長編4/4、主要Core gate、Webpack build成功。strictは不足を理由に期待どおり停止。
- Production、DB、Storage、Provider、credit、既存作品、runtime Judge、自動修復は変更していない。Draft PRとCI／Preview確認後に停止し、R4-3Bへ進まない。
- Draft PR [#293](https://github.com/team478a/manga/pull/293)はDraft／MERGEABLE。Previewは[Ready／SSO保護](https://mangai-hub-staging-git-codex-feat-r4-87ad37-team478as-projects.vercel.app)。実装HEAD `e10b1c0`のCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsは成功。最終文書同期HEADでも再確認する。

---

## 0.0 現在の優先タスク（PR-R4-3A2 Benchmark v2.1契約修正、2026-08-16）

- 最新基準はPR #291 merge commit `355ebfd095297acee34cf32ef4469eeae2958501`。Branchは`codex/fix-r4-3a2-benchmark-v2-1-contract`。
- 旧30〜50件の公開ラベル入りmanifestを廃止し、public cases/private labels、dev/private holdout、合計140件のv2.1契約へ修正した。
- 旧v1結果はleakを検出したnegative control。v2.1実画像0/140、ローカルscikit-learnなしのため最終精度Acceptanceは未実施。
- Production、既存作品、DB、Storage、Provider、Canvas、PNG／PDFは変更していない。Draft PR [#292](https://github.com/team478a/manga/pull/292)の初回5チェックは成功。最終文書同期HEADのCI／Preview確認後に停止し、R4-3Bへ進まない。
- 詳細は`docs/CURRENT_TASK.md`と`docs/quality-engine-benchmarks.md`。

---

## 0. 現在の優先タスク（PR-R4-3A 漫画品質ベンチマーク基盤、2026-08-16）

- Branch: `codex/feat-r4-3a-quality-benchmark`
- Base: `origin/feature/manga-canvas-mvp` @ `75eb8582ceedf1b2c5cd78a515b79b02201a20e0`（PR #290 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW / BLOCKED_FIXTURE_SHORTAGE`
- Draft PR: [#291](https://github.com/team478a/manga/pull/291)（Draft／MERGEABLE）
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-feat-r4-c36bff-team478as-projects.vercel.app)
- 未評価を点数にせず`unknown / not_evaluated`として保持するEvidence契約、provider-neutral Judge、非公開fixture schema、readiness／実ファイル検証、精度・coverage・費用・遅延集計を追加した。既存runtime判定は不変。
- 現行Judgeは画像内容を解析せず、欠損scoreを75、failure判定の欠損を100としている。完了Jobから渡る実観測はAsset有無と寸法だけであり、保存scoreをVisual Judge実測値として扱えない。
- 権利確認済み実画像は0/30、採用可能0/15、主要6群0/5。fixture不足を`BLOCKED_FIXTURE_SHORTAGE`として可視化し、推測精度を記録しない。
- Production、DB／Storage、既存作品、Provider／pricing／credit、Canvas、出力は変更せず、外部VLMと画像生成Providerを呼び出していない。
- 集中8/8、Hub 750/750、Canvas 26/26、AI 48/48、長編4/4、依存境界、lint、Hub型検査、59 migration／rollback、research eval、Cloud漫画repository、owner isolation、workspace packages／Webpack build成功。TurbopackはWindowsパス長、Desktop 3ゲートは既知型宣言不足でローカル停止し、GitHub CIで正式判定する。
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。最終文書同期HEADでも同じ5チェックを確認して停止する。責任者承認前にR4-3Bへ進まない。
- 詳細: `docs/quality-engine-benchmarks.md`、`docs/RELEASE_CANDIDATE_R4_3A_QUALITY_BENCHMARK.md`

---

## 0. 現在の優先タスク（PR-R4-2AG 正方向だけのProvider安全再構成、2026-08-16）

- Branch: `codex/fix-r4-2ag-positive-only-safe-retry`
- Base: `origin/feature/manga-canvas-mvp` @ `7cb9f02`（PR #289 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#290](https://github.com/team478a/manga/pull/290)（Draft／MERGEABLE）
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-2-b9d25a-team478as-projects.vercel.app)
- PR #289反映後、Productionページ22・コマ1の最新失敗Jobを1件だけ再実行した。Worker [31932216482](https://github.com/team478a/manga/actions/runs/31932216482)は`requests=2 processed=1`で成功したが、Jobは`provider_moderation_blocked`、Assetなし、Provider課金0。Creditは使用76／予約0／残24へ全額復元。
- 第1段階安全再構成に禁止対象の回避説明と携帯品・ポケット表現が残っていた。通常生成と第1・第2段階安全再構成を、穏やかな人物・背景・衣服・手・自然光だけの正方向Promptへ統一する。
- 旧版第1段階Jobも後方互換で認識し、旧い禁止説明を除去して第2段階へ進める。
- 集中54/54、Hub 742/742、Canvas 26/26、AI 48/48、依存境界、lint、Hub型検査、59 migration／rollback、research eval、100ページfixture、Cloud漫画repository acceptance、owner isolation、package／Next.js build、diff check成功。RC preflightはstructure ready。Desktop 3ゲートは差分外の既知の`@napi-rs/keyring`型宣言不足でローカル停止し、GitHub Windows buildで正式判定する。
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功。Windows CIではDesktop test、Accessibility、Windows application buildも成功。最終文書同期HEADでも同じ5チェックを確認し、責任者レビューまで停止する。merge前にProduction追加生成・再実行を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AG_POSITIVE_ONLY_SAFE_RETRY.md`

---

## 0. 現在の優先タスク（PR-R4-2AF moderation安全な衣服表現、2026-08-16）

- Branch: `codex/fix-r4-2af-moderation-safe-garment-cue`
- Base: `origin/feature/manga-canvas-mvp` @ `713bb47`（PR #288 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#289](https://github.com/team478a/manga/pull/289)
- Vercel Preview: [確認済み](https://mangai-hub-staging-git-codex-fix-r4-2-b509b2-team478as-projects.vercel.app)
- PR #288反映後、Productionページ22・コマ1で2候補を1回だけ生成した。Worker [31930333853](https://github.com/team478a/manga/actions/runs/31930333853)は`requests=3 processed=2`で成功したが、2 Jobとも`provider_moderation_blocked`、Assetなし、Provider課金0。Creditは使用76／予約0／残24へ全額復元。
- PR #288の限定差分で追加した`concealed prop`を最有力原因と判断した。端末・画面・UI・`concealed`を使わず、胸ポケットの縫い目、自然な布のふくらみ、手の位置と視線だけで表現する。
- 同じ無害な衣服表現を通常生成と第1・第2段階安全再実行へ適用し、再実行で端末・表示面語を戻さない。
- 集中53/53、Hub 741/741、Canvas 26/26、AI 48/48、依存境界、lint、型検査、migration検証、Cloud受入れfixture、package／Next.js build成功。Desktop 3ゲートは差分外の既知の`@napi-rs/keyring`型宣言不足でローカル停止したが、GitHub Windows buildは成功。Core quality、Migration roundtrip、Vercel、Vercel Preview Commentsも成功。責任者レビューまで停止し、merge前にProduction追加生成・再実行を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AF_MODERATION_SAFE_GARMENT_CUE.md`

---

## 0. 現在の優先タスク（PR-R4-2AE 端末を直接描かず編集要素を分離、2026-08-16）

- Branch: `codex/fix-r4-2ae-concealed-prop-overlay`
- Base: `origin/feature/manga-canvas-mvp` @ `b9ac507`（PR #287 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#288](https://github.com/team478a/manga/pull/288)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-aq6n206s3-team478as-projects.vercel.app
- PR #287反映後、Productionページ22・コマ1で手動比較最小値の2候補を1回だけ生成した。Worker [31928823358](https://github.com/team478a/manga/actions/runs/31928823358)は`requests=3 processed=2`で成功し、Creditは使用72／予約0／残28から使用76／予約0／残24。
- 候補1は端末背面と胸ポケットを維持したが日本語風・疑似文字を生成。候補2は端末表示面、英字氏名、通話UIを生成。2件とも追加生成なしで不採用。Canvas revision 8、PNG、公開・販売状態は不変。
- 端末を含む短縮クローズアップの`layout`と人物`action`から端末・画面・UI語を除き、位置anchorと衣服・手の輪郭だけで隠れた小物を示す。文字・効果音は`overlay_stage`で後段追加と明示する。
- 集中53/53、Hub 741/741、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、diff check成功。Desktopローカルは既知型宣言不足で停止し、Windows CIを正式判定にする。
- 実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。merge前にProduction追加生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AE_CONCEALED_PROP_OVERLAY_STAGE.md`

---

## 0. 現在の優先タスク（PR-R4-2AD ネーム構図から端末表示面を除外、2026-08-16）

- Branch: `codex/fix-r4-2ad-device-safe-layout`
- Base: `origin/feature/manga-canvas-mvp` @ `a3d957a`（PR #286 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#287](https://github.com/team478a/manga/pull/287)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-f5e0c4-team478as-projects.vercel.app
- PR #286反映後、Productionページ22・コマ1で2候補を1回だけ生成した。1候補では目視前にautoAdoptされる既存契約のため、手動比較を保つUI最小値を使った。Worker [31926041721](https://github.com/team478a/manga/actions/runs/31926041721)は`requests=3 processed=2`で成功し、1候補完成、1候補失敗・返金。Creditは使用70／予約0／残30から使用72／予約0／残28。
- 完成候補は胸ポケットと端末のクローズアップを復元したが、端末表示面に日本語・疑似文字・通話UIが生成されたため追加生成なしで不採用。Canvas revision 8、PNG、公開・販売状態は不変。失敗候補は再実行していない。
- raw `layout`が位置anchorと「表示面をカメラへ向ける」意味を同時に渡し、端末背面品質契約と競合していた。端末・画面語があるクローズアップだけ、語より前の位置anchorを保持し、端末の背面／側面をカメラへ、表示面を人物側／画面外へ向ける短い契約へ変換する。
- 集中53/53、Hub 741/741、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。Desktopローカルは既知型宣言不足で停止し、Windows CIを正式判定にする。
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。merge前にProduction追加生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AD_DEVICE_SAFE_LAYOUT.md`

---

## 0. 現在の優先タスク（PR-R4-2AC 安全再構成でネーム構図を維持、2026-08-16）

- Branch: `codex/accept-r4-2ac-conservative-retry`
- Base: `origin/feature/manga-canvas-mvp` @ `035c2a6`（PR #285 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#286](https://github.com/team478a/manga/pull/286)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-accept-r-b227a0-team478as-projects.vercel.app
- PR #285反映後、Productionページ22・コマ1の失敗Jobを1件だけ再実行した。Worker [31923479315](https://github.com/team478a/manga/actions/runs/31923479315)は`requests=2 processed=1`で成功し、Creditは使用68／予約0／残32から使用70／予約0／残30へ確定した。
- 704×1024 PNGは正立、顔、手、人体、描画面を満たしたが、汎用的な室内人物画となり元ネームの場面と構図を失ったため不採用。Canvas revision 8、PNG、公開・販売状態は不変。品質承認、配置、追加生成なし。
- 第2段階再構成の安全性は機能したが、短縮Provider契約に元ネームの構図がなく、背景と構図を一律に日常場面へ置換したことが品質低下の原因だった。
- 短縮契約へ安全な`layout`を追加し、危険描写を除きながら画角、人物数、人物・背景の相対配置を維持する。危険な`layout`は長さ制限、危険語検査、ローカルmoderationによりfallbackへ置換する。
- 集中52/52、Hub 740/740、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。Desktopローカルは既知型宣言不足で停止し、Windows CIを正式判定にする。
- 実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。merge前にProduction追加生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AC_STORYBOARD_LAYOUT_SAFE_RETRY.md`

---

## 0. 現在の優先タスク（PR-R4-2AB Provider moderation後の第2段階安全再構成、2026-08-16）

- Branch: `codex/fix-r4-2ab-conservative-moderation-retry`
- Base: `origin/feature/manga-canvas-mvp` @ `d44fc8d`（PR #284 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#285](https://github.com/team478a/manga/pull/285)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-cb5583-team478as-projects.vercel.app
- PR #284反映後、Productionページ22・コマ1を1件だけ再実行した。Worker [31921455570](https://github.com/team478a/manga/actions/runs/31921455570)は`requests=2 processed=1`で成功したが、Jobは`provider_moderation_blocked`でAssetなし。Creditは使用68／予約0／残32へ全額復元された。
- 第1段階安全再構成と端末背面契約は適用済みだった。Production DBは分類、Prompt長、契約適用有無、置換対象項目の有無だけを読み取り、本文・画像・秘密情報は取得せず、書込も行っていない。
- 背景、場所、構図、演出、動作、表情を穏やかな日常場面へ置換する第2段階を1回だけ許可する。第2段階済みJobが再拒否された場合は停止する。対話型と一括生成へ共通適用する。
- 人物設定、衣装、参照Asset、対象コマ、Panel Specification、端末背面契約、Provider、model、pricing、credit単価、Worker自動retry、timeout、Scheduler、DB、Canvas、PNG／PDFを維持する。
- 集中20/20、Hub 739/739、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。
- 実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADでも同じ5チェックを再確認して停止する。
- merge前にProduction再実行を行わない。merge後、同じ失敗コマを1回だけ再実行し、第2段階再構成の完成画像と漫画品質を確認する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AB_CONSERVATIVE_MODERATION_RETRY.md`

---

## 0. 現在の優先タスク（PR-R4-2AA 端末表示面を描かせない正方向契約、2026-08-16）

- Branch: `codex/fix-r4-2aa-concealed-device-surface`
- Base: `origin/feature/manga-canvas-mvp` @ `59b8377`（PR #283 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#284](https://github.com/team478a/manga/pull/284)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-1bdb66-team478as-projects.vercel.app
- PR #283反映後、Productionページ22・コマ1を1件だけ安全再実行した。Worker `31920132648`は`requests=2 processed=1`で成功し、Creditは使用66／予約0／残34から使用68／予約0／残32へ確定した。
- 新候補は正立、人体、小物1個を満たしたが、端末に時刻、UI風文字・アイコンが生成され、顔上端も大きく切れたため不採用にした。Canvas revision 8、PNG成功、生成中0、失敗0、公開・販売状態は不変。
- BFLはnegative promptを受け取らないため、空画面を描かせる指定から、端末の無地の背面または側面だけをカメラへ向けて表示面を描かせない正方向契約へ変更する。通常生成と安全再実行へ共通適用する。
- 集中47/47、Hub 737/737、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsもすべて成功。最終文書同期HEADを再確認して停止し、merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2AA_CONCEALED_DEVICE_SURFACE.md`

---

## 0. 現在の優先タスク（PR-R4-2Z 安全再実行への最新画像品質契約継承、2026-08-16）

- Branch: `codex/fix-r4-2z-retry-quality-contract`
- Base: `origin/feature/manga-canvas-mvp` @ `e52540c`（PR #282 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#283](https://github.com/team478a/manga/pull/283)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-031855-team478as-projects.vercel.app
- PR #282反映後、Productionページ22・コマ1の失敗Jobを1件だけ再実行した。Worker `31918003768`は`requests=2 processed=1`で成功し、Creditは使用64／予約0／残36から使用66／予約0／残34へ確定した。
- 新候補は正立、人体、小物単一性は改善したが、端末画面、衣装、画面端に文字状模様があり不採用とした。Canvas revision 8、PNG成功、生成中0、失敗0、予約0、公開・販売状態は不変。
- 古い失敗Jobの安全再実行が、新規生成の最新端末・小物・画像内文字品質契約へ追従していないことを原因と特定した。安全再実行だけへ正方向品質条件と現行negative promptを補強し、元Job固有の条件と参照Assetを維持する。
- 集中39/39、Hub 737/737、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsもすべて成功。最終文書同期HEADを再確認して停止し、merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2Z_RETRY_QUALITY_CONTRACT.md`

---

## 0. 現在の優先タスク（PR-R4-2Y 失敗候補の再実行デッドロック解消、2026-08-16）

- Branch: `codex/accept-r4-2y-page22-device-quality`
- Base: `origin/feature/manga-canvas-mvp` @ `be7ae34`（PR #281 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#282](https://github.com/team478a/manga/pull/282)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-accept-r-5e2140-team478as-projects.vercel.app
- Productionページ22・コマ1を2案だけ生成した。Worker `31916441291`は成功したが2 JobともAssetなしで失敗し、Creditは使用64／予約0／残36へ全額復元した。Canvas revision 8、PNG、公開・販売状態は不変。
- queued／running Jobが0でも、completed確認候補を同じ未解決判定へ含めるため、すべての失敗Job再実行ボタンが無効になる境界を確認した。
- 失敗Jobの再実行だけをqueued／running排他へ分離する。候補の作り直し等で使う従来のcompleted候補排他は維持する。
- 集中12/12、Hub 737/737、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。Desktopローカルは既知`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。merge前にProduction再実行を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2Y_FAILED_CANDIDATE_RETRY.md`

---

## 0. 現在の優先タスク（PR-R4-2X 端末無記名・小物単一化契約、2026-08-16）

- Branch: `codex/accept-r4-2x-page22-quality-gate`
- Base: `origin/feature/manga-canvas-mvp` @ `e844143`（PR #280 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#281](https://github.com/team478a/manga/pull/281)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-accept-r-1189f2-team478as-projects.vercel.app
- PR #280反映後のProductionページ22で、コマ3の合格1案を4項目品質確認して配置した。Canvas revision 7→8、保存、PNG成功を確認した。コマ1は計4案中3案完成・1 Job失敗で、完成案はいずれも不採用とした。
- コマ1では端末画面の疑似文字と端末重複が構図調整後も再現した。追加課金生成を止め、短縮・長文Promptへ端末の無記名ガラス面と小物単一化の正方向契約を追加する。
- Worker 3回は成功。Creditは使用56／予約0／残44から使用64／予約0／残36。保留Job、予約残、公開・販売変更なし。
- 集中31/31、Hub 735/735、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build、RC structure、diff check成功。Desktopローカルは既存型宣言不足で停止し、Windows CIを正式判定にする。
- URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADの同じ5チェックを再確認して停止する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2X_BLANK_DEVICE_SINGLE_PROP.md`

---

## 0. 現在の優先タスク（PR-R4-2W 生成画像の採用品質ゲート、2026-08-16）

- Branch: `codex/fix-r4-2w-generation-quality-gate`
- Base: `origin/feature/manga-canvas-mvp` @ `3bd3488`（PR #279 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#280](https://github.com/team478a/manga/pull/280)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-fd5441-team478as-projects.vercel.app
- PR #279はマージ済み。ページ22は合格した4コマ目とCanvas revision 7を維持し、コマ1の不自然な上下方向、コマ3の画像内疑似文字、未配置候補2件への再発防止を行う。
- 現行rule-based quality judgeは画像ピクセルのOCR・天地・人体意味解析を行わない。自動検査を装わず、短縮Promptの正立品質条件と採用前4項目必須確認を追加する。
- 未配置候補は追加生成なしで明示却下できる。全候補が明示却下された生成群だけ未配置blockerを解除し、一部未確認候補と画像なしコマは未完成のまま維持する。
- URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- Hub 735/735、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository、owner isolation、packages／Webpack build成功。Desktopローカル型宣言不足は既存制約で、Windows CIを正式判定にする。
- 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Draft／MERGEABLE。
- Preview deploymentは成功。ブラウザ直アクセスはVercel Deployment Protectionのチーム所有者承認で停止したため、認証後画面の手動確認は未実施。アクセス要求は送信せず、4項目dialog、採用ボタン無効／有効、不採用、完成判定をHub自動テストで確認した。
- Production変更なし。最終文書同期HEADの全CIを再確認して停止し、merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2W_GENERATION_QUALITY_GATE.md`

---

## 0. 現在の優先タスク（PR-R4-2V 確認済み生成Assetの完成判定同期、2026-08-16）

- Branch: `codex/fix-r4-2v-reviewed-asset-completion`
- Base: `origin/feature/manga-canvas-mvp` @ `fcaca93`（PR #278 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#279](https://github.com/team478a/manga/pull/279)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-cf4c4b-team478as-projects.vercel.app
- PR #278反映後、Productionの`test`モニターでページ22・4コマ目を1案だけ再制作した。Worker [31909535792](https://github.com/team478a/manga/actions/runs/31909535792)は`requests=2 processed=1`で成功し、使用54／予約0／残46から使用56／予約0／残44となった。
- 新規704×1024 PNGは頭髪全体、両目、首、肩、胴体、手、左右背景を含み、吹き出し、疑似文字、口内文字がなく合格。品質確認と配置を行い、Canvas revision 6→7、保存済み、PNG成功を確認した。
- 原稿プレビューではコマ4の改善を確認したが、コマ1の不自然な上下方向、コマ3の画像内疑似文字、未配置候補2件、自動配置確認が残り、ページ全体は未完成。
- 同じ生成画像Assetでも候補Job IDとCanvas layerの`sourceJobId`が異なる場合、品質確認済み表示と完成判定が不一致になる。最新`selected`品質イベントから確認済みAsset IDも解決し、同一Assetにだけ確認結果を引き継ぐ。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中12/12、Hub 732/732、Canvas 26/26、AI 48/48、100ページ長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure、diff check成功。Desktopローカルは既存`@napi-rs/keyring`型宣言不足で停止し、Windows CIを正式判定にする。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 次: 責任者のmerge判断待ち。追加Production生成を行わず、PR-R4-2Wへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2V_REVIEWED_ASSET_COMPLETION.md`

---

## 0. 現在の優先タスク（PR-R4-2U 台詞安全な再制作フレーミング、2026-08-16）

- Branch: `codex/fix-r4-2u-dialogue-safe-rework-framing`
- Base: `origin/feature/manga-canvas-mvp` @ `72f1d0d`（PR #277 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#278](https://github.com/team478a/manga/pull/278)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-f5a9b7-team478as-projects.vercel.app
- Productionの`test`モニターでページ22・4コマ目を1案だけ再制作した。Worker [31906333027](https://github.com/team478a/manga/actions/runs/31906333027)は`requests=2 processed=1`で成功し、使用52／予約0／残48から使用54／予約0／残46となった。
- 新規704×1024 PNGは顔・首付近だけの極端なcropとなり、口内と胸元付近に原台詞と一致する「証拠を」が描画されたため不採用。候補採用、配置、品質承認、Canvas、公開・販売状態は変更していない。
- Provider向け場面記述だけから引用発話と既知台詞を除外し、台詞混入を検知した`extreme_close_up`／`detail`を58%短縮安全フレームへ切り替える。台詞のない意図的な寄りとPanel Specification原文は維持する。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中35/35、Hub 731/731、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。通常Turbopackは既知のWindows path長、Desktop typecheckは既存型宣言不足のためWindows CIを正式判定にする。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。最終文書同期HEADを再確認後に停止し、merge前に追加Production生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2U_DIALOGUE_SAFE_TIGHT_FRAMING.md`

---

## 0. 現在の優先タスク（PR-R4-2T 顔面無記名・引き構図の正方向契約、2026-08-15）

- Branch: `codex/fix-r4-2t-clean-face-safe-framing`
- Base: `origin/feature/manga-canvas-mvp` @ `faeef67`（PR #276 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#277](https://github.com/team478a/manga/pull/277)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-cb03d2-team478as-projects.vercel.app
- Productionの`test`モニターでページ22・4コマ目を1案だけ再制作した。Worker [31886026453](https://github.com/team478a/manga/actions/runs/31886026453)は`requests=2 processed=1`で成功し、704×1024 PNGを生成した。使用50／予約0／残50から使用52／予約0／残48となった。
- moderation、両目、顔、首、肩は改善したが、頭頂が上端に接し、人物が画面高の約9割を占め、左右背景余白不足と口元の疑似文字が残った。配置、採用、品質承認、Canvas、公開・販売状態は変更せず、追加Provider実行を停止した。
- 構図座標をJSON先頭へ移し、被写体高58%、髪上端18%、衣服下端82%、左右環境余白18%の引いた環境ポートレートへ変更する。台詞fallbackの`speaking`を除去し、顔面と描画面を線画・陰影だけで完成させる正方向契約を追加する。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsもすべて成功。最終文書同期HEADの5チェックを再確認して停止し、merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2T_CLEAN_FACE_SAFE_FRAMING.md`

---

## 0. 現在の優先タスク（PR-R4-2S Provider安全な座標フレーミング、2026-08-15）

- Branch: `codex/fix-r4-2s-provider-safe-frame-coordinates`
- Base: `origin/feature/manga-canvas-mvp` @ `4728941`（PR #275 merge commit）
- 状態: `MERGED`
- PR: [#276](https://github.com/team478a/manga/pull/276)（merge commit `faeef67`）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-b52cd0-team478as-projects.vercel.app
- Production限定受入れで、ページ22・4コマ目の再制作を1案だけ登録した。Worker [31883817067](https://github.com/team478a/manga/actions/runs/31883817067)は`requests=2 processed=1`で処理したがProvider moderation拒否となり、予約2 creditを全額解放した。
- 画面から一般向け安全再実行を1回だけ行い、Worker [31883888494](https://github.com/team478a/manga/actions/runs/31883888494)も`requests=2 processed=1`で処理したが同じく拒否された。最終creditは使用50／予約0／残50、新規Assetなし。追加Provider実行を停止した。
- PR #274の安全再実行は成功し、PR #275で追加した身体部位の英語列挙だけが主な差分だった。過去にも同種の列挙でProvider moderationが再現しているため、列挙を避け、被写体高72%、髪上端15%、上着下端92%、左右環境余白12%の座標契約へ置換する。
- FLUX.2公式のJSON `position`／`composition`／`camera.distance`構造を維持し、初回生成と保存済み旧短縮JSONの安全再実行を同じ契約へ正規化する。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsもすべて成功。最終文書同期HEADの5チェックを再確認して停止し、merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2S_PROVIDER_SAFE_FRAME_COORDINATES.md`

---

## 0. 現在の優先タスク（PR-R4-2R 短縮クローズアップの一枚絵・画面内ランドマーク契約、2026-08-15）

- Branch: `codex/fix-r4-2r-compact-output-framing`
- Base: `origin/feature/manga-canvas-mvp` @ `ebc9107`（PR #274 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#275](https://github.com/team478a/manga/pull/275)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-2-7249f5-team478as-projects.vercel.app
- PR #274反映後、Productionの`test`モニターでページ22・4コマ目を1案だけ再制作した。初回は`provider_moderation_blocked`で課金なし、安全再実行はWorker `31873352419`で704×1024 PNGを生成し2 creditを確定した。
- 画像は口元から胸元だけの過度な接写で頭頂・髪・両目が画面外、顔中央に不要な矩形線があり不採用。配置、承認、Canvas、公開・販売状態は変更していない。
- BFLはnegative promptをサポートしない。短縮JSONへ一続きの一枚絵を示す`output_type`／`canvas`を追加し、腰上中景、髪上端約15%、両肩を左右余白内、腰を画面下部へ置くランドマークを固定する。
- 保存済み旧短縮JSONの一般向け安全再実行も同じ契約へ正規化する。Provider、model、pricing、DB、migration、RPC、Storage、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。通常TurbopackとDesktopローカル依存は既知制約のためCIを正式判定にする。初回HEADの5チェックはすべて成功。次: 最終文書同期HEADの全CI／Vercel Preview成功後に停止する。merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2R_COMPACT_OUTPUT_FRAMING.md`

---

## 0. 現在の優先タスク（PR-R4-2Q クローズアップ構図優先度・公式JSON契約、2026-08-15）

- Branch: `codex/fix-r4-2q-closeup-framing-priority`
- Base: `origin/feature/manga-canvas-mvp` @ `9519bfc`（PR #273 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#274](https://github.com/team478a/manga/pull/274)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-tnt1bshvg-team478as-projects.vercel.app
- PR #273反映後、Productionの`test`モニターでページ22・4コマ目の失敗Jobを1回だけ安全再実行した。Worker `31870804091`は`status=idle requests=2 processed=1`で成功した。
- 使用46／予約0／残54 → 使用46／予約2／残52 → 使用48／予約0／残52。新規候補1件、重複なし。候補採用、配置、Canvas、公開・販売状態は変更していない。
- 704×1024 PNGはmoderation通過、両目・顔・無記名面を満たしたが、顔が画面全体を占め、頭頂、首、両肩、背景余白が不足したため不採用。
- 短縮JSON先頭の`portrait`が後段の65%構図より優先された可能性が高い。先頭を胸元から上の`medium shot`へ変更し、頭部、髪、首、両肩、背景、55%を固定する。cameraは公式例の`lens-mm: 50`へ合わせる。
- 保存済み旧短縮JSONの一般向け安全再実行も同じ契約へ正規化する。Provider、model、pricing、DB、migration、RPC、Storage、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中32/32、Hub 728/728、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure、diff check成功。
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 次: 最終文書同期HEADの全CI／Vercel Preview成功後に停止する。merge前にProduction再生成を行わない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2Q_CLOSEUP_FRAMING_PRIORITY.md`

---

## 0. 現在の優先タスク（PR-R4-2P 短縮クローズアップの一般向け安全再実行、2026-08-15）

- Branch: `codex/fix-r4-2p-compact-closeup-safe-retry`
- Base: `origin/feature/manga-canvas-mvp` @ `e16e001`（PR #272 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#273](https://github.com/team478a/manga/pull/273)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-5cgcg63dm-team478as-projects.vercel.app
- PR #272反映後、Productionの`test`モニターでページ22・4コマ目を1案だけ再制作した。Job `d0eb56b3-50b9-4bf3-b618-2a7251c6ab56`、Worker `31869411513`は`status=idle requests=2 processed=1`。
- Jobは`provider_moderation_blocked`、試行1/2、進捗1%、actual cost 0、Assetなし。使用46、予約0→2→0、残り54→52→54で全額復元し、重複Jobはない。
- R4-2Oで場面情報を短縮JSON内へ移した一方、既存安全再実行は旧来の行単位Promptだけを変換していた。短縮JSONの動作、表情、背景、候補演出が未変換のまま再送される回帰を確認した。
- Provider拒否後だけ短縮JSONの直接描写を一般向けの間接表現へ変換する。人物同一性、衣装、style、position、camera、70mm相当、65%構図、無記名面、参照役割、target panel、reference Asset IDを維持する。
- 初回生成Prompt、URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中32/32、Hub 726/726、Canvas 26/26、AI 48/48、deps、lint、Hub typecheck、migration 59/59、packages／Webpack build、diff check成功。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更は上記1 Jobだけで課金なし。merge前に追加の実Provider E2Eを行わない。最終文書同期HEADの5チェック成功後に停止する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2P_COMPACT_CLOSEUP_SAFE_RETRY.md`

---

## 0. 現在の優先タスク（PR-R4-2O クローズアップProvider Prompt短縮・安定化、2026-08-15）

- Branch: `codex/fix-r4-2o-compact-closeup-provider-prompt`
- Base: `origin/feature/manga-canvas-mvp` @ `9047f40`（PR #271 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#272](https://github.com/team478a/manga/pull/272)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-l6vr8i9ca-team478as-projects.vercel.app
- PR #271反映後、Productionの`test`モニターでページ22・4コマ目を1案だけ再制作した。Job `230eac0d-e1d3-4813-bd43-bb6830c492ba`、Worker `31867709945`は`status=idle requests=2 processed=1`。使用44→46、予約0→2→0、残り56→54、重複なし。
- Provider moderationは解消したが、704×1024画像は鼻・口・顎だけの極端なcropで両目と頭頂がなく、口元に`証拠を`が生成された。配置、承認、Canvas、公開・販売状態は変更していない。
- Jobは`text_to_image`／`source_asset_id=null`、画風参照は清潔な無記名画像。長く重複したPromptが構図と無記名面を希釈した可能性が高い（推論）。
- 人物あり新規`close_up`だけを短いJSON契約にし、中距離portrait、被写体高約65%、完全なsilhouette、70mm相当、清潔な無記名面を固定する。Storyboardの台詞本文と引用発話を送信対象から除外する。参照役割と2〜4候補の制作差分を維持する。
- revision／Image-to-Image／Inpainting／Outpainting、人物なし、他画角は変更しない。URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopも変更しない。
- 集中31/31、Hub 726/726、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。全体typecheckは既存Desktopの`@napi-rs/keyring`型宣言不足だけで停止し、Windows CIを正式判定とする。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- Production変更は上記1 Job／2 creditだけ。merge前に追加の実Provider E2Eを行わない。最終文書同期HEADの5チェック成功後に停止する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2O_COMPACT_CLOSEUP_PROVIDER_PROMPT.md`

---

## 0. 現在の優先タスク（PR-R4-2N Provider moderation安全な構図契約、2026-08-15）

- Branch: `codex/fix-r4-2n-provider-moderation-safe-framing`
- Base: `origin/feature/manga-canvas-mvp` @ `ff5ea38`（PR #270 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#271](https://github.com/team478a/manga/pull/271)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-kg3ib7at3-team478as-projects.vercel.app
- PR #270反映後、Productionの`test`モニターでページ22・4コマ目を1案だけ再制作した。初回Job `8bf051c1-3f08-4ec9-8a63-f3a553d30f14`と一般向け安全再実行Job `d5eaed83-1c10-45a0-94ec-bcda1b7ac219`はいずれも`provider_moderation_blocked`。Workerは`31866069529`／`31866237664`、各`requests=2 processed=1`。
- 両JobはAssetなし、actual cost 0。creditは各回44／予約0→2→0／残り56→54→56へ全額復元し、最終44／0／56。配置、承認、Canvas、公開・販売状態は変更していない。
- 同じコマ・参照のR4-2L生成は完了しており、R4-2MでProvider JSON先頭へ追加した身体部位の英語列挙が初回と安全再実行へ共通して残った。構造化Promptを維持し、この重複語彙だけを非cropの頭肩構図へ置換する。
- 新規PromptとProvider拒否後の保存済み旧Promptの両方で、JSON構図を身体部位列挙なしのuncropped medium close-up、frame内収容、10% marginへ変換する。後段の日英構図契約、参照役割、Panel Specificationは維持する。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry回数、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中30/30、Hub、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- R4-2N実装後のProduction Provider E2Eは行わない。最終文書同期HEADの5チェックを再確認して停止する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2N_PROVIDER_MODERATION_SAFE_FRAMING.md`

---

## 0. 現在の優先タスク（PR-R4-2M Provider構図契約・参照役割の構造化、2026-08-15）

- Branch: `codex/fix-r4-2m-provider-framing-contract`
- Base: `origin/feature/manga-canvas-mvp` @ `c7615a6`（PR #269 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#270](https://github.com/team478a/manga/pull/270)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-9d6nqnlbl-team478as-projects.vercel.app
- PR #269反映後のProductionで失敗候補を1回だけ再制作した。Worker `31864612499`で1 Jobが完了し、使用42→44、予約0→2→0、残り56、重複登録なし。
- 704×1024画像は頭頂、髪、両目が切れ、鼻下から肩だけになり、生成文字`証拠を`が混入した。配置・承認・追加生成は行っていない。保存済み画風参照は頭部全体を含む清潔な無記名画像であり、参照自体の汚染ではない。
- 原因は、Prompt後半の単純な`クローズアップ`再指定が頭肩・余白契約と競合し、送信順の`input_image_N`別役割が未指定で、長い自然言語Prompt内の優先度が不足していたこと。
- Prompt先頭へJSON Provider契約を置き、`close_up`を頭部全体・首・両肩・約10%余白を含むミディアムクローズアップへ統一する。各参照へ`Input image N`と人物／画風／場所／小物の限定役割を付け、構図・crop・配置はProvider契約を優先する。
- BFL公式の構造化Promptと複数入力画像の役割明示に従う。FLUX.2はnegative prompt非対応のため既存の非送信を維持する。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中27/27、Hub、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- R4-2M実装後のProduction変更とProvider E2Eはない。最終文書同期HEADの5チェックを再確認して停止し、merge前に追加生成しない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2M_PROVIDER_FRAMING_CONTRACT.md`

---

## 0. 現在の優先タスク（PR-R4-2L クローズアップ余白・無記名描画面、2026-08-15）

- Branch: `codex/fix-r4-2l-closeup-clean-output`
- Base: `origin/feature/manga-canvas-mvp` @ `7f3dc73`（PR #268 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#269](https://github.com/team478a/manga/pull/269)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-ju48odwjq-team478as-projects.vercel.app
- PR #268反映後のProductionで失敗候補を1回だけ再制作した。Worker `31860725448`で1 Jobが完了し、使用40→42、予約2→0、残り58、重複登録なし。先行run `31860684723`はcheck-onlyでProvider requestを送っていない。
- 704×1024画像は両目・鼻・口・顎を含むまで改善したが、頭頂と髪が切れ、口元へ`証拠をさ`という生成文字が混入した。販売品質未達のため配置・承認・追加生成は行っていない。
- 人物あり`close_up`を頭と肩の構図へ固定し、髪全体、首、肩、頭部周囲約10%余白を日英Promptへ追加する。参照素材からは同一性等だけを再構成し、肌・口元・衣服・背景を自然な輪郭と陰影だけの清潔な無記名描画面へ固定する。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中27/27、Hub、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。
- 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- R4-2L実装後のProduction Provider E2Eは行わない。最終文書同期HEADの全CI／Vercel Preview成功で停止する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2L_CLOSEUP_CLEAN_OUTPUT.md`

---

## 0. 現在の優先タスク（PR-R4-2K クローズアップの顔フレーミング固定、2026-08-15）

- Branch: `codex/fix-r4-2k-closeup-framing`
- Base: `origin/feature/manga-canvas-mvp` @ `0d987a0`（PR #267 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#268](https://github.com/team478a/manga/pull/268)
- Vercel Preview: https://mangai-hub-staging-gmukjl68x-team478as-projects.vercel.app
- PR #267反映後のProductionで、安全化した失敗Jobを1回だけ再実行した。Worker `31859031742`で1 Jobが完了し、使用40、予約0、残り60、重複POSTなし。生成文字は解消した。
- 新しい704×1024画像は鼻・口・顎だけの極端な寄りで、両目と顔全体が切れたため販売品質未達。配置・承認・追加生成は行っていない。
- 人物を含む実効画角`close_up`だけへ、頭頂から顎までの顔全体、両目・鼻・口・顎、わずかな頭上・顎下余白を日英Promptで固定する。wide上書き、背景／効果、extreme close-up／detailは変更しない。
- URL、API、DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。
- 集中26/26、Hub、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。
- 標準Turbopackは既知のWindowsパス長、Desktopは既存keyring型宣言不足。GitHub Windows CIとVercelを正式結果とする。
- 実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2K_CLOSEUP_FRAMING.md`
- 次: 最終文書同期HEADの全CI、Vercel Preview成功で停止。責任者merge前にProduction追加生成を行わない。

---

## 0. 現在の優先タスク（PR-R4-2J Provider拒否後の対話型安全再実行、2026-08-15）

- Branch: `codex/fix-r4-2j-interactive-safe-retry`
- Base: `origin/feature/manga-canvas-mvp` @ `193f0ae`（PR #266 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#267](https://github.com/team478a/manga/pull/267)（Draft／MERGEABLE）
- Vercel Preview: https://mangai-hub-staging-p3ch4z2xg-team478as-projects.vercel.app
- Productionの参照付き不良コマ再制作は初回と画面再実行の2回ともProvider終端失敗。両回とも同一Provider Job poll、重複POSTなし、予約credit全額解放。最終は使用38、予約0、残り62で追加生成を停止した。
- 根因はページ編集画面が失敗Jobの保存済み入力を使わず、同じパネルから元Promptを再構築していたこと。
- 失敗Job専用POST routeを追加し、本人所有、画像、対象コマ、保存済みinputを検証する。Provider投入後拒否だけ、人物／画風／参照Asset／revisionを維持して動作・感情・演出を一般向け間接表現へ一度だけ安全化する。
- BFL公式moderation statusを非retry拒否へ分類し、長編batchにも同じDomain policyを適用する。安全化済み入力の再拒否は同一条件を再登録しない。
- DB、migration、RPC、Storage、Provider、model、pricing、retry、timeout、Scheduler、Canvas、PNG／PDF、成人向け境界、Desktopは変更しない。旧PR #254はOPENのまま変更しない。
- 集中27/27、Hub、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、owner isolation、packages／Webpack build、RC structure成功。
- 初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2J_INTERACTIVE_SAFE_RETRY.md`
- 次: 文書同期後の最終HEADでも全CI、Vercel Preview成功を確認して停止。merge前にProduction再実行を行わない。

---

## 0. 現在の優先タスク（PR-R4-2H 参照付き単一コマ生成、2026-08-15）

- Branch: `codex/quality-r4-2h-grounded-panel-generation`
- Base: `origin/feature/manga-canvas-mvp` @ `78eccff`（PR #264 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#265](https://github.com/team478a/manga/pull/265)
- Vercel Preview: https://mangai-hub-staging-jk5shubps-team478as-projects.vercel.app
- Productionページ22の問題3コマを各1案だけ生成し、Worker `31809744470`で3/3完了。使用38、予約0、残り62、重複Jobなし。3枚は複数場面＋生成文字、顔切れ、人体・接触破綻で販売品質未達のため未配置・未承認。追加課金を停止した。
- Panel SpecificationをProviderの一枚場面契約へ昇格し、登場人数、人物、動作、表情、場所、小物、構図、画角をPrompt先頭と末尾へ同じ正本から固定する。
- 参照画像を人物優先のDomain policyで選び、参照の役割と生成契約優先をProviderへ明示する。Provider、model、pricing、DB、migrationは変更しない。
- 集中24/24、Hub、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、repository受入れ、packages／Webpack build、RC structure成功。
- Desktopは既存keyring型宣言不足。差分なしのためWindows CIを正式結果とする。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Windows CIのDesktop TypeScript、tests、Accessibility、unpacked buildも成功した。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2H_GROUNDED_PANEL_GENERATION.md`
- 次: Draft PRと全CI／Vercel Preview成功で停止。merge前にProduction追加生成を行わない。

---

## 0. 現在の優先タスク（PR-R4-2G Prompt moderation語彙衝突、2026-08-14）

- Branch: `codex/fix-r4-2g-prompt-moderation-collision`
- Base: `origin/feature/manga-canvas-mvp` @ `6fb9bf0`（PR #263 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#264](https://github.com/team478a/manga/pull/264)（Draft／MERGEABLE）
- Vercel deployment: https://vercel.com/team478as-projects/mangai-hub-staging/84qDxxD1emsNu6s18yQ6ZNsbPiL5
- Productionページ22の再制作入口で、R4-2F追加Promptの`explicitly described`が既存成人向け検知の`explicit`へ一致し、Provider登録前に`adult_content`で拒否された。
- 使用32／予約0／残り68で、新規Job、Provider課金、Assetは0。残り2件は未操作。誤配置1件はUndo・保存済みまで復元した。
- 成人向け検知とfail-closed境界を変更せず、非正立動作の英語表現だけを`clearly described`へ変更し、完成Prompt全体のmoderation回帰を追加する。
- 集中23/23、Hub 714/714、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、research eval、Cloud漫画repository受入れ、Webpack build、RC structure成功。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2G_PROMPT_MODERATION_COLLISION.md`
- 次: 責任者review／merge待ち。merge前にProduction再生成しない。

---

## 0. 現在の優先タスク（PR-R4-2F Provider生成コマの再制作品質、2026-08-14）

- Branch: `codex/fix-r4-2f-provider-panel-quality`
- Base: `origin/feature/manga-canvas-mvp` @ `9fbf228`（PR #262 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#263](https://github.com/team478a/manga/pull/263)（Draft／MERGEABLE）
- Vercel deployment: https://vercel.com/team478as-projects/mangai-hub-staging/3WsM1i1ZiJBujvajZh46Gv4zQLwB
- Productionページ22で不良2画像を各1回だけ再制作した。Worker run `31802403441`は成功し、使用32／予約0／残り68。生成物は人体・小物融合と疑似文字が残ったため配置・承認せず、追加課金を停止した。
- 正方向Promptへ非正立動作の安全な例外、小物接触、衣服との境界、無地・非記号表面を追加する。品質再制作には前候補と異なる修正条件を付ける。
- 未配置候補の却下、承認済み品質確認の取消し、同じコマの生成中／候補確認待ちに古いJobから重複登録しない導線を追加する。
- DB、migration、RPC、Storage、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Desktopは変更しない。
- 集中41/41、Hub 714/714、Canvas 26/26、AI 48/48、長編4/4、deps、lint、Hub typecheck、migration 59/59、Webpack build、repository preflight、diff check成功。Desktopは既存keyring型宣言不足のためWindows CIで判定する。
- Productionの2候補は手動確認待ちのまま保全。merge前に追加の有料再生成を行わない。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Windows CIのDesktop tests、Accessibility tests、unpacked buildも成功した。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2F_PROVIDER_PANEL_QUALITY.md`

---

## 0. 現在の優先タスク（PR-R4-2E 生成原稿の最終品質ゲート、2026-08-14）

- Draft PR [#262](https://github.com/team478a/manga/pull/262) はDraft／MERGEABLE。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。責任者review前にProduction反映・有料再生成を行わない。

- Branch: `codex/quality-r4-2e-final-manuscript-gate`
- Base: `origin/feature/manga-canvas-mvp` @ `51a9864`（PR #261 merge commit）
- 状態: `IMPLEMENTED_LOCAL_VALIDATION`
- Productionページ22の目視で、上下反転、画像内疑似文字、過大な文字、人物連続性の弱さを確認した。
- 正立方向と自然な人体をBFL向け正方向Promptへ追加し、自動吹き出しを縮小・左右分散する。
- 自動配置した生成画像は既存owner限定品質ログの`selected`まで完成扱いにせず、対象コマだけ1案を作り直せる。
- 未確認画像は既存完成guardを通じてcheckpoint、PNG／PDF、公開・販売を停止する。
- OpenAI Visionは未計上のコマ単位費用を生むためruntimeへ追加しない。DB、migration、Provider、model、pricing、credit、Scheduler等は変更しない。
- 集中54/54、Hub 711/711、deps、lint、Hub typecheck、workspace package build、4ページPNG／PDF fixture、diff check成功。
- ProductionのDB、作品、Job、creditは変更していない。Draft PRと全CI／Vercel Preview後に停止する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_2E_FINAL_MANUSCRIPT_QUALITY_GATE.md`

---

## 0. 現在の優先タスク（PR-R4-1ab 長編一括生成登録阻害の解消、2026-08-13）

- Branch: `codex/fix-r4-1ab-batch-registration-diagnostics`
- Base: `origin/feature/manga-canvas-mvp` @ `09da196`（PR #249 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#250](https://github.com/team478a/manga/pull/250)
- Vercel Preview: [deployment](https://vercel.com/team478as-projects/mangai-hub-staging/9xJFUBsRdwSi41RhpvSBD6rFNNd5)
- Productionの`test`で、阻害要因0の19〜22ページ（4ページ／16コマ）を1回だけ開始したが、永続登録前にfail-closedになった。一括生成履歴、利用／予約credit、Provider Jobはいずれも0で、再試行していない。
- 準備、入力schema、RPC永続登録を別の安全な段階へ分類した。RPC signatureと原子性を維持して検証失敗を固定code化し、PostgREST schema cache reloadを追加した。
- 未知のDB情報、Prompt、画像、payloadは表示しない。Provider、model、pricing、credit、rate limit、Scheduler、Canvas、PDF／PNG、成人向け境界、Desktopの契約は変更していない。
- 集中16/16、Hub 662/662、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、deps、lint、全typecheck、migration 55/55、Hub／Desktop build、RC structure、diff check成功。Hub buildは短い物理worktreeの同一commitで確認した。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1AB_BATCH_REGISTRATION_DIAGNOSTICS.md`
- 次: 責任者のreview／merge判断まで停止。merge後にProduction migrationを適用して同じ4ページを1回だけ再受入れする。

---

## 0. 現在の優先タスク（PR-R4-1aa-3 長編一括生成条件固定、2026-08-13）

- Branch: `codex/fix-r4-1aa-batch-prompt-freeze`
- Base: `origin/feature/manga-canvas-mvp` @ `3b5b7da`（PR #248 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#249](https://github.com/team478a/manga/pull/249)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-cd467b-team478as-projects.vercel.app
- 一括生成の全target準備後、durable登録RPCより前に、preflight時点のProvider／model／pricing、画風ID／version、同一人物profileのversionが混在していないことを検証する。
- 準備中に設定が更新された場合はfail-closedで再確認を求め、target、Provider Job、credit予約を作らない。
- 公開契約、DB、migration、Provider値、credit、Scheduler、Canvas、PDF／PNG、成人向け境界、Desktopは変更していない。
- 集中・関連21/21、Hub 658/658、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、deps、lint、全typecheck、migration 54/54、Hub／Desktop build、diff check成功。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- Productionの`test`は画風／主要人物設定済みだが、必要32 creditに対し残り8で24不足。実Provider Job、batch target、credit消費は追加していない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1AA_BATCH_PROMPT_FREEZE.md`
- 次: 責任者のreview／merge判断まで停止。merge後、管理者がTrial 30日を付与し、blocker 0を確認して4ページ生成を1回だけ行う。

---

## 0. 現在の優先タスク（PR-R4-1aa-2 Productionビジュアル設定受入れ、2026-08-13）

- Branch: `codex/release-r4-1aa-visual-setup`
- Base: `origin/feature/manga-canvas-mvp` @ `bf6e86e`（PR #247 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#248](https://github.com/team478a/manga/pull/248)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-dfd32f-team478as-projects.vercel.app
- Productionの`test`作品へモノクロ犯罪サスペンス画風v1と`城戸真琴`／`榊圭吾`／`城戸湊`の外見設定v1を保存した。
- 19〜22ページのpreflightは作品画風設定済み、人物3/3名設定済み。ビジュアルblockerは解消した。
- 必要32 creditに対して残り8で24不足。生成ボタンは無効で、実Provider Job、batch target、credit消費は追加していない。
- deps、RC structure、diff check、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1AA_VISUAL_SETUP.md`
- 次: 責任者のreview／merge判断まで停止。merge後、管理者が`test`へTrial 30日を付与し、credit blocker 0を確認して4ページ生成を1回だけ行う。

---

## 0. 現在の優先タスク（PR-R4-1aa-1 長編一括生成ビジュアル準備、2026-08-13）

- Branch: `codex/fix-r4-1aa-visual-readiness`
- Base: `origin/feature/manga-canvas-mvp` @ `914f127`（PR #246 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#247](https://github.com/team478a/manga/pull/247)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-ff0747-team478as-projects.vercel.app
- Productionの`test`作品を監査し、画風、人物設定、参考画像、連続性台帳が未設定であることを確認した。19〜22ページで必要な主要人物は`城戸真琴`、`榊圭吾`、`城戸湊`。
- 有料長編一括生成preflightが、採用storyboard／scenarioと人物・画風の現行versionを確認する。必要設定が不足する場合は不足人物名と設定導線を表示し、Server側でもbatch登録前に拒否する。
- 単一コマ生成、DB、migration、RPC、Storage、公開API、Provider、model、pricing、credit、Scheduler、Canvas、PDF／PNG、成人向け境界、Desktopは変更しない。
- 集中・関連29/29、Hub 657/657、Canvas 26/26、AI 48/48、Desktop、Desktop a11y violations 0、deps、lint、全typecheck、migration 54/54、Hub／Desktop build、RC structure、diff check成功。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 実Provider Job、batch target、credit消費は追加していない。生成前バックアップ作成済み。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1AA_VISUAL_READINESS.md`
- 次: 責任者のreview／merge判断まで停止。merge後にTrial付与と画風・3人物設定を完了し、blocker 0を確認して4ページ生成を1回だけ実施する。

---

## 0. 現在の優先タスク（PR-R4-1aa 4ページ限定Production受入れ、2026-08-13）

- Branch: `codex/release-r4-1aa-four-page-acceptance`
- Base: `origin/feature/manga-canvas-mvp` @ `a5e903d`（PR #245 merge commit）
- 状態: `CREDIT_ENTITLEMENT_UI_IMPLEMENTED_LOCAL_VALIDATION`
- Draft PR: [#246](https://github.com/team478a/manga/pull/246)
- Vercel Preview: https://mangai-hub-staging-be38wgjhu-team478as-projects.vercel.app
- PR #245はmerge済み。Productionのdurable target table／4 RPC／RLS／ACL境界は16/16成功。
- Productionの一般向けモニター`test`で、19〜22ページの4ページ／16コマを1案ずつ生成する計画。
- preflightは32 credit、最大予約費用$0.48、Worker最短6回／約30分、1分Job化上限3コマ。現状は残り8 creditで24不足し、開始はfail-closed。
- 現行管理画面に個別Cloud AI Plan付与がなく、接続中のブラウザー／CLIにもProduction Supabase管理者認証がないため、正本のcredit準備を安全に実行できなかった。Provider Jobは追加していない。
- 管理者ユーザー詳細へ既存Free／Trial／Creatorの個別期間付与を追加した。Stripe管理中、予約credit、queued／running Job、停止中Planは拒否し、管理監査へ記録する。DB、全体Plan値、Provider契約は変更しない。
- 集中10/10、Hub 654/654、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、全typecheck、migration 54/54、Hub／Desktop build、RC structure、diff check成功。Hub buildは短い物理worktreeで同一commitを検証した。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。最終文書commit後の全CI再確認で停止する。
- merge後、`test`へTrial 30日を付与して32 credit以上を確認し、初めて4ページ生成を開始する。R4-1aa合格前にR4-1abへ進まない。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1AA_FOUR_PAGE_PRODUCTION_ACCEPTANCE.md`

---

## 0. 現在の優先タスク（PR-R4-1z 長編一括生成 durable登録、2026-08-13）

- Branch: `codex/fix-r4-1z-durable-batch-registration`
- Base: `origin/feature/manga-canvas-mvp` @ `394707b`（PR #243 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#244](https://github.com/team478a/manga/pull/244)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-4ba5a7-team478as-projects.vercel.app
- 4〜8ページ／最大64コマの全対象を先に非公開DB targetへ原子的に保存し、Workerが既存Schedulerから1件ずつJob化する。
- 既存monitor枠、user／project rate limit、plan／作品／global予算を同一transactionで利用する。rate limit時はpendingを保持して次回Schedulerへ委ねる。
- targetのPromptはauthenticatedへ直接読取権限を与えず、画面、通常query、ログへ返さない。元revision／pricing変更はfail-closedとする。
- pause／cancel／恒久失敗の再試行、Job化待ち／済み進捗をCreator画面へ反映する。
- 公開URL／API、Storage、Provider、model、pricing値、credit、retry、timeout、Scheduler頻度、Canvas、PDF／PNG、成人向け境界、Desktop codeは変更しない。
- PostgreSQL 16で53 migrationのforward／rollback／reapplyと既存quota経由の原子的dispatchを確認。集中26/26、Hub 650/650、Canvas 26/26、AI 48/48、deps、lint、全typecheck、migration manifest、Hub／Desktop build、diff check成功。Hub buildは短い物理worktreeで完走した。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1Z_DURABLE_BATCH_REGISTRATION.md`
- 次: 責任者のreview／merge判断まで停止し、Production migration適用前にR4-1aaへ進まない。

---

## 0. 現在の優先タスク（PR-R4-1y 長編一括生成 合算preflight、2026-08-13）

- Branch: `codex/fix-r4-1y-longform-batch-preflight`
- Base: `origin/feature/manga-canvas-mvp` @ `cbb0d74`（PR #242 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#243](https://github.com/team478a/manga/pull/243)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-00d2ff-team478as-projects.vercel.app
- 4〜8ページ一括生成の開始前に、対象コマ、1候補、model／pricing、必要credit、最大予約費用、plan／作品／global／monitor容量、Scheduler下限、1分登録上限を表示する。
- 容量不足、現在snapshot欠損、空ページ、64コマ超、現行同期処理で登録可能な1分上限超過はbatch作成前にfail-closedで拒否する。
- 全件登録だけを成功表示し、部分登録は要求／登録／未登録件数を赤い警告にする。履歴のJob数は「登録済み」と明記する。
- DB、migration、RPC、Storage、Provider、model、pricing、rate limit、Scheduler頻度等の外部契約は変更しない。
- 集中17/17、Hub 650/650、Canvas 26/26、AI 48/48、deps、lint、全typecheck、migration 52/52、Hub／Desktop build、RC structure、diff check成功。Hub buildは元worktreeのWindows長path上限を短いworktreeで回避した。Desktop統合はElectron終了待ち、Windows CIで最終判定する。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1Y_LONGFORM_BATCH_PREFLIGHT.md`
- 次: 責任者のreview／merge判断まで停止し、責任者確認前にR4-1zや有料4ページ受入れへ進まない。

---

## 0. 現在の優先タスク（PR-R4-1x 長編漫画credit・段階生成成立条件監査、2026-08-13）

- Branch: `codex/audit-r4-1x-longform-credit-plan`
- Base: `origin/feature/manga-canvas-mvp` @ `96f27b6`（PR #241 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#242](https://github.com/team478a/manga/pull/242)
- Vercel Preview: https://mangai-hub-staging-git-codex-audit-r4-5dcaff-team478as-projects.vercel.app
- 現行一括生成は4〜8ページ／最大64コマを受け付けるが、全対象を同期loopで1 Jobずつ登録する。作品rate limitはFree 3、Trial 6、Creator 20件/分で、途中拒否後は部分batchを成功値として返し得る。
- 画面は要求件数と登録件数の差、必要credit、最大予約費用、残容量、Scheduler回数を開始前後に表示しない。長編Production受入れの前に修正が必要。
- 157コマをProで初回1候補なら314 credit。推奨式は全コマ初回、選択比較、選択Fillの`2P + 4C + 6F` credit。
- 次工程案はR4-1y合算preflight／表示、R4-1z durable登録、R4-1aa 4ページ限定実Provider受入れ、R4-1ab 8ページ完成原稿／販売品質受入れ。
- 本PRは文書限定で、有料Jobとapplication／外部契約変更を行わない。
- 集中20/20、deps、RC repository structure、diff check成功。RC外部設定とmanual E2Eはローカル秘密情報なしのためPENDING。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1X_LONGFORM_CREDIT_AND_STAGING_AUDIT.md`
- 次: 責任者のreview／merge判断まで停止し、責任者承認前にR4-1yを実装しない。

---

## 0. 現在の優先タスク（PR-R4-1w FLUX単一コマProduction受入れ、2026-08-13）

- Branch: `codex/release-r4-1w-flux-production-acceptance`
- Base: `origin/feature/manga-canvas-mvp` @ `d0091a0`（PR #240 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#241](https://github.com/team478a/manga/pull/241)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-f980ec-team478as-projects.vercel.app
- Productionの`test`モニターで未生成コマ1つへ2候補を登録し、Scheduler run 31647042128は`idle requests=3 processed=2`で成功した。
- 2候補とも単一の全面モノクロ場面で、複数コマ、枠、吹き出し、文字、疑似文字なし。FLUX正方向Promptの限定実Provider受入れは合格した。
- creditは残12／使用8／予約0から、登録時残8／使用8／予約4、完了時残8／使用12／予約0へ遷移した。
- 候補1を採用し、`保存済み`、再読込後の3コマ目`AI背景レイヤー`復元を確認した。
- 本PRは文書限定。人物連続性、4〜8ページ一括生成、完成原稿、PDF／PNG、販売品質を成功扱いにしない。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1W_FLUX_PRODUCTION_ACCEPTANCE.md`
- 次: 責任者のreview／merge判断まで停止。責任者確認後、長編credit／候補数／段階生成の成立条件を監査する。

---

## 0. 現在の優先タスク（PR-R4-1v FLUX単一コマ正方向Prompt、2026-08-13）

- Branch: `codex/fix-r4-1v-flux-positive-panel-prompt`
- Base: `origin/feature/manga-canvas-mvp` @ `92f379e`（PR #239 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#240](https://github.com/team478a/manga/pull/240)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-b536a9-team478as-projects.vercel.app
- Productionでは2候補のcompleted、credit確定、比較、採用、保存、再読込を確認し、timeout／Scheduler復旧は合格した。
- 候補1は単一コマ・文字なし、候補2は複数コマ・吹き出し・疑似文字を含んだため、品質は2件中1件だけ合格した。
- FLUX.2はnegative prompt非対応だが、BFL adapterが共通禁止語を`Avoid:`として送信していた。BFLへは正方向Promptだけを送り、単一場面、1 camera view／1 moment、文字のない絵を指定する。
- Provider、model、pricing、credit、retry、timeout、Scheduler、DB、migration、RPC、Storage、Canvas、成人向け境界、Desktopは変更しない。
- 集中29/29、Hub 645/645、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Hub／Desktop build、RC preflight、diff check成功。Desktop統合／a11yのローカルElectron終了待ちはWindows CIで最終判定する。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Core初回のElectron取得HTTP 503は同一commit再実行で成功。Draft／MERGEABLE。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1V_FLUX_POSITIVE_PANEL_PROMPT.md`
- 次: 責任者のreview／merge判断まで停止。merge前に有料Jobを追加せず、merge後に未生成コマ1つ・2候補を再受入れする。

---

## 0. 現在の優先タスク（PR-R4-1u 漫画画像生成timeout／Scheduler復旧、2026-08-12）

- Branch: `codex/fix-r4-1u-image-generation-recovery`
- Base: `origin/feature/manga-canvas-mvp` @ `c98e5b1`（PR #238 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#239](https://github.com/team478a/manga/pull/239)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-2e4013-team478as-projects.vercel.app
- Productionの画像2候補は約126〜128秒でfailedとなり、BFLの120秒poll上限と一致した。BFL submit拒否ではなく生成待機timeoutを根因候補として扱う。
- BFL 210秒、Scheduler request 230秒、Worker 240秒へ整合させ、`failed`を既知終端として後続Jobへ進む。PromptやProvider本文を含まないtimeout診断を追加する。
- Provider、model、request、pricing、credit、retry、Scheduler頻度、DB、migration、RPC、Storage、Canvas、成人向け境界、Desktopは変更しない。
- 検証: 集中27/27、Hub 645/645、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Hub／Desktop build、RC preflight、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: `docs/RELEASE_CANDIDATE_R4_1U_IMAGE_GENERATION_RECOVERY.md`
- 次: 責任者のreview／merge判断まで停止。merge後にProductionの未生成コマ1つ、2候補、比較、採用、保存、再読込を必ず再受入れする。

---

## 0. 現在の優先タスク（PR-R4-1t 販売下書き完成原稿preflight、2026-08-12）

- Branch: `codex/fix-r4-1t-marketplace-readiness-preflight`
- Base: `origin/feature/manga-canvas-mvp` @ `209d7a6`（PR #237 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#238](https://github.com/team478a/manga/pull/238)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-6729b3-team478as-projects.vercel.app
- 未完成原稿でも販売下書きを作成できた原因は、Marketplace artifact生成がdurable PDFの完成原稿preflightを使っていなかったこと。
- 販売artifact生成前に既存preflightを必須化し、全ページ確定、revision一致、再確認、生成中なし、必須修正0を満たさない場合はStorage upload前に`ValidationError`で拒否する。Creator画面も同じ条件で無効化する。
- DB、migration、RPC、Storage契約、Provider、pricing、Scheduler、Canvas、PDF形式、Stripe、Desktop codeは変更しない。
- 検証: 集中13/13、Hub 643/643、Canvas 26/26、AI 48/48、migration 52/52、deps、lint、全typecheck、Hub／Desktop build、RC preflight、diff check成功。Desktop統合はElectron終了待ちのためWindows CIで最終判定する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: `docs/RELEASE_CANDIDATE_R4_1T_MARKETPLACE_READINESS_PREFLIGHT.md`
- 次: 責任者のreview／merge判断まで停止。merge後はProduction未完成作品で拒否を再確認し、その後に画像Provider失敗を別PRで扱う。

---

## 0. 現在の優先タスク（PR-R4-1s Production市場分析→販売E2E監査、2026-08-12）

- Branch: `codex/release-r4-1s-market-to-sale-e2e`
- Base: `origin/feature/manga-canvas-mvp` @ `2afae10`（PR #236 merge commit）
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#237](https://github.com/team478a/manga/pull/237)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-faa8ee-team478as-projects.vercel.app
- Productionの一般モニター`test`で、市場分析、選択企画、採用シナリオ、採用32ページネーム、Creator 32ページ／157コマまでの連続性を確認した。
- merge後の画像2候補は両方failed。予約4 creditは全解放。単一コマ品質の実Provider再受入れは未合格。
- 原稿は画像1/157、完成0/32、確定0/32、必須修正267。完成PDFは正しく無効だが、販売下書きは作成できてしまう。作成物は非公開／販売停止で、公開一覧とcheckoutは安全側に閉じている。
- Workerの正規終端`failed`をSchedulerが未知状態としてworkflow failureにする。後続Job処理を妨げるため別修正が必要。
- 未生成156コマへ最低2候補を作るだけで追加624 creditが必要。残16では32ページ完成不可。
- ローカル検証: Scheduler／marketplace policy／durable export 14/14、deps、RC preflight、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 次: 文書限定Draft PRと全CI／Preview後に停止。販売準備preflight、実画像生成、Scheduler、credit成立条件を責任者確認後の別PRで修正する。
- 詳細: `docs/RELEASE_CANDIDATE_R4_1S_MARKET_TO_SALE_E2E_EVIDENCE.md`

---

## 0. 現在の優先タスク（PR-R4-1r 漫画生成Production E2E・単一コマ品質修正、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `d3441a4`（PR #235 merge commit）
- Branch: `codex/fix-r4-1r-single-panel-image-quality`
- Draft PR: [#236](https://github.com/team478a/manga/pull/236)
- 状態: `READY_FOR_OWNER_REVIEW`
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-c6c81b-team478as-projects.vercel.app
- Production: `test`モニターで32ページネームを約2分で生成し、全32ページ、採用、Canvas下書き32ページ／157コマ、BFL画像2候補、4 credit確定、候補比較・採用、自動保存、再読込復元まで成功した。
- 品質問題: 2候補中1候補に複数コマ風構成と読めない疑似文字が混入した。別候補は採用可能だった。
- 修正: 共通画像Promptとnegative promptへ、単一コマ全面描画、漫画ページ／複数コマ／枠／余白禁止、文字／疑似文字／吹き出し禁止を日英で追加する。
- 不変: Provider、model、pricing、credit、retry、timeout、Scheduler、API key、DB、migration、RPC、Storage、API、URL、Feature Flag、Canvas schema、PDF／PNG、成人向け境界、Stripe、Desktop。
- 検証: 専用21/21、Hub 640/640、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 52/52、deps、lint、全typecheck、research eval、Hub／Desktop build、RC preflight、diff check成功。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1R_MANGA_PRODUCTION_E2E_AND_IMAGE_QUALITY.md`](RELEASE_CANDIDATE_R4_1R_MANGA_PRODUCTION_E2E_AND_IMAGE_QUALITY.md)
- 停止: 責任者のreview／merge判断まで停止し、merge前に追加の実Provider生成や次工程へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1q モニター制作阻害要因修正、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `924b833`
- Branch: `codex/fix-r4-1q-monitor-blockers`
- Draft PR: [#235](https://github.com/team478a/manga/pull/235)
- 状態: `READY_FOR_OWNER_REVIEW`
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-da7543-team478as-projects.vercel.app
- Productionで32ページAIネームtimeoutと失敗時利用回数増加、品質評価保存失敗、一般報告保存・履歴読込失敗を確認した。
- ネームは同じGPT-5.6 Terra、Responses API、`store:false`を維持する。9〜48ページは全体連続性設計後に8ページ単位を並列生成し、結合後の全体schema成功時だけ保存・利用回数消費する。8ページ以下の既存1応答契約も維持する。
- モニター保存は列不足だけ基本列へ退避し、本人履歴と管理者一覧も読める。RLS、制約、接続障害は成功扱いにしない。
- DB／migrationは変更していない。完全な構造化運用には既存`202608020002`、`202608030001`、`202608030002`のProduction適用確認が必要。
- 長編分割の集中25/25、Hub 639/639、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、deps、lint、全typecheck、research eval、migration 52/52、RC preflight、Hub／Desktop build成功。詳細は[`RELEASE_CANDIDATE_R4_1Q_MONITOR_BLOCKER_FIX.md`](RELEASE_CANDIDATE_R4_1Q_MONITOR_BLOCKER_FIX.md)。
- 長編分割実装HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 停止: Draft PRの全CI／Vercel Preview成功後に停止し、merge前にProduction再実行やR4-2を行わない。

---

## 0. 現在の優先タスク（PR-R4-1o 対象ユーザー市場分析受入れ完了、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `44b99dd`（PR #232 merge commit）
- Branch: `codex/release-r4-1o-research-user-acceptance`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#233](https://github.com/team478a/manga/pull/233)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-e6ee4a-team478as-projects.vercel.app
- 本人E2E: MANGAI責任者から、対象ユーザー本人による市場分析のユーザー検証完了報告を受領した。
- 完了範囲: 既存Report表示、新規市場分析保存、詳細表示、再読込後の本人履歴再表示。PR-R4-1mの非blocking保留を解除する。
- 証拠境界: 本人操作を責任者報告で受入れる。Codexは本人session、Report本文、Prompt、件数、費用を取得しない。
- 不変: Codexによる追加の本番操作なし。製品コード、DB、Storage、Provider、credit、外部契約を変更しない。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、一般ユーザー所有生成成果物・署名付き書き出しURLのowner isolation、Stripe test E2E。
- ローカル検証: `rc:acceptance`成功（2 passed／11 pending／2 blocked）、full `rc:validate`成功（Desktop 182/182、Hub 632/632、migration 52/52、Hub／Desktop production build）、diff check成功。
- CI: Draft PR初回HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1O_RESEARCH_USER_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1O_RESEARCH_USER_ACCEPTANCE_EVIDENCE.md)
- 停止: 文書限定Draft PRの全CI／Preview後に停止し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1n Production所有者分離受入れ、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `ff9e0d5`（PR #231 merge commit）
- Branch: `codex/release-r4-1n-owner-isolation`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#232](https://github.com/team478a/manga/pull/232)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-0fef78-team478as-projects.vercel.app
- Production: read only transactionで2人の一般ユーザーclaimを再現し、市場分析Reportの双方向分離と一般向け非公開Cloud作品の所有者1件／相手0件を確認した。
- 成果物分離: 既存の非公開生成Job、Asset、`cloud-assets` objectは所有側1件／一般ユーザー側0件。ただし既存所有者はadminで、一般ユーザー所有の成果物は0件だった。
- 不変: transactionは`ROLLBACK`済み。DB／Storage／Provider／credit／利用者data／製品コード／外部契約を変更していない。
- 未実施: 非公開`works`、一般ユーザー所有生成成果物、Cloud書き出しJob／`cloud-exports`が0件のため、marketplace作品と署名付き書き出しURLの実データ比較は未実施。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、一般ユーザー所有生成成果物・書き出しURLのowner isolation、Stripe test E2E。対象本人の市場分析E2Eは非blocking保留でpassedではない。
- 検証: owner isolation契約7/7、RC JSON、full `rc:validate`成功（Desktop 182/182、Hub 632/632、migration 52/52、Hub／Desktop production build）、diff check、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1N_OWNER_ISOLATION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1N_OWNER_ISOLATION_EVIDENCE.md)
- 停止: 文書限定Draft PRの全CI／Preview後に停止し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1m Production反映後確認・本人E2E保留、2026-08-12）

- Base: `feature/manga-canvas-mvp` / `8fe3888`（PR #230 merge commit）
- Branch: `codex/release-r4-1m-production-closeout`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#231](https://github.com/team478a/manga/pull/231)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-a6dc7b-team478as-projects.vercel.app
- Production: 管理画面TOPとユーザー一覧は11人で一致。対象モニターはactive、13/50、期限内。Dashboard、Creator、市場分析履歴に汎用エラーなし。
- 責任者判断: 対象本人の市場分析E2Eは2026-08-12付で非blocking保留。未確認のためpassedにはしないが、本人確認だけを理由に後続を止めない。
- 不変: 読み取り専用。Provider、credit、AI利用、Report、作品、Asset、設定、注文を変更していない。製品コードと外部契約も変更しない。
- 検証: full `rc:validate`成功（Hub 632/632、Desktop 182/182、migration 52/52、Hub／Desktop production build）。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 残件: Cloud text実Job、AIネーム由来8ページE2E、2利用者owner isolation、Stripe test E2E。
- 証跡: [`RELEASE_CANDIDATE_R4_1M_PRODUCTION_CLOSEOUT_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1M_PRODUCTION_CLOSEOUT_EVIDENCE.md)
- 停止: 文書限定Draft PRの全CI／Preview後に停止し、merge後は実行可能なR4残件へ進む。

---

## 0. 現在の優先タスク（PR-R4-1l 管理画面ユーザー件数整合性、2026-08-11）

- Base: `feature/manga-canvas-mvp` / `3fd2d54`（PR #229 merge commit）
- Branch: `codex/fix-admin-user-count-consistency`
- 状態: `READY_FOR_OWNER_REVIEW`
- Draft PR: [#230](https://github.com/team478a/manga/pull/230)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-admi-61f545-team478as-projects.vercel.app
- Production診断: 管理画面TOPはProfile 12件、ユーザー一覧は削除済みAuthアカウントを除く11人を表示した。
- 修正: ProfileとAuth directoryの共通可視判定をapplicationへ追加し、TOPと一覧を同じ集計条件へ統一する。取得障害時は不正確な件数を表示しない。
- 変更しない範囲: DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、Scheduler、Canvas、出力、成人向け境界、Stripe、Desktop。
- 検証: 集中13/13、full `rc:validate`成功（Hub 632/632、Desktop 182/182、migration 52/52、Hub／Desktop production build）。Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1L_ADMIN_USER_COUNT_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1L_ADMIN_USER_COUNT_EVIDENCE.md)
- 停止: Draft PRの全CI／Preview後に停止し、市場分析の本人確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1k Production市場分析RLS受入れ、2026-08-11）

- Base: `feature/manga-canvas-mvp` / `acac27a`（PR #228 merge commit）
- Branch: `codex/release-r4-1k-research-acceptance`
- Draft PR: [#229](https://github.com/team478a/manga/pull/229)
- Preview: `https://mangai-hub-staging-git-codex-release-9642ee-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（Production受入れ・全品質ゲート・Draft PR完了）
- Production: RLS再帰修正migration適用済み。definer、固定search path、authenticated EXECUTEを確認。
- 対象モニターclaim: 自profile 1件、所有Report 4件、他owner 0件、直近Report構造をRLS経由で参照できた。
- 不変確認: active、AI利用9、usage 9件、Report 4件。Provider／credit／新規Report変更なし。
- UI回帰: ユーザー管理、モニター管理、マイページ、Cloud制作画面成功。
- 検証: 集中14/14、full `rc:validate`成功（Desktop 182/182、Hub 629/629、migration 52/52、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1K_RESEARCH_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1K_RESEARCH_ACCEPTANCE_EVIDENCE.md)
- 停止: Draft PRの全CI／Preview後に停止し、対象本人の既存Report再表示まで市場分析受入れをpendingとする。R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1j 市場分析RLS再帰修正、2026-08-11）

- Base: `feature/manga-canvas-mvp` / `0255968e7783c0fa6b055dd970746a72c77a42c0`（PR #227 merge commit）
- Branch: `codex/fix-profile-rls-admin-recursion`
- Draft PR: [#228](https://github.com/team478a/manga/pull/228)
- Preview: `https://mangai-hub-staging-git-codex-fix-prof-a5b7c1-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（修正・非永続Production検証・全品質ゲート・Draft PR完了）
- Production: 対象モニターはactive／招待完了／期限内で、市場分析Report 4件が保存済み。Report JSON型も正常。
- 原因: `profiles` RLSが呼ぶinvoker版`is_admin()`が`profiles`を再参照し、認証利用者のReport readで`stack depth limit exceeded`となる。
- 修正: `is_admin()`を固定search pathの`SECURITY DEFINER`へ変更する追加migration。admin判定条件と既存RLS／外部契約は変更しない。
- 非永続検証: 対象利用者claimで所有Report 4件・直近1件を取得後にROLLBACKし、Production定義が未変更であることを確認。
- 検証: 集中14/14、full `rc:validate`成功（Desktop 182/182、Hub 629/629、migration 52/52、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1J_RESEARCH_RLS_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1J_RESEARCH_RLS_EVIDENCE.md)
- 停止: Draft PRの全CI／Vercel Preview後に停止する。merge後のmigration適用と対象本人E2Eまで市場分析受入れはpending、R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1i Production checkpoint受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `f9544035a82256ce2128f4ec1c6b4473cd4b9404`（PR #226 merge commit）
- Branch: `codex/release-r4-1i-checkpoint-acceptance`
- Draft PR: [#227](https://github.com/team478a/manga/pull/227)
- 状態: `READY_FOR_OWNER_REVIEW`（checkpoint受入れ合格、R4-1全体はpending）
- Production migration: `202608100001_cloud_project_checkpoint_digest_schema.sql`を対象Supabaseへ適用し、`extensions.digest`、RPC契約、権限を確認した。
- Production実機: checkpoint作成、作品基本設定の差分、復元前自動checkpoint、復元、再読込後の元説明復帰に成功した。
- DB: checkpoint 2件、restore 1件、checkpoint page 16行。生成Job／cost ledgerは受入れ中に変更なし。Asset内容と有効状態はcheckpoint manifestと一致した。
- 検証: AI単独30/30とfull `rc:validate`再実行成功（Desktop 182/182、Hub 627/627、migration 51/51、Hub／Desktop production build）。初回Desktop 181/182のtimeout mock競合は再現しなかった。
- 証跡: [`RELEASE_CANDIDATE_R4_1I_CHECKPOINT_ACCEPTANCE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1I_CHECKPOINT_ACCEPTANCE_EVIDENCE.md)
- 残件: Cloud text実Job、対象モニター本人の市場分析、AIネーム由来8ページE2E、2利用者実owner isolation、Stripe test E2E。
- 停止: 文書限定Draft PRの全CI／Vercel Previewを確認し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1h Production checkpoint digest修正、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `c1660e21b13d5e9a11e1f2a56e9df9329e828ab5`（PR #225 merge commit）
- Branch: `codex/fix-r4-checkpoint-digest-schema`
- Draft PR: [#226](https://github.com/team478a/manga/pull/226)
- Preview: `https://mangai-hub-staging-git-codex-fix-r4-c-7d4b6b-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Production: checkpoint作成が42883で失敗し、checkpoint、Provider Job、Asset、credit、費用は増加していない。
- 診断: 対象DBにはRPC／table／RLS／権限が存在し、Production作品も同じDBに存在する。ROLLBACK付き実行で`digest(bytea,unknown)`未解決を確定した。
- 修正: 追加migrationで2箇所を`extensions.digest`へ明示修飾し、canonical schemaとmigration assertionを同期する。RPC signature、権限、固定search path、hash仕様は変更しない。
- 検証: Production DBのROLLBACK付き修正後RPC成功、永続変更0、集中21/21、migration manifest 51件、full `rc:validate`成功（Hub 627/627、Hub／Desktop production build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1H_CHECKPOINT_DIGEST_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1H_CHECKPOINT_DIGEST_EVIDENCE.md)
- 停止: Draft PRの最終HEADで全CI／Vercel Previewを確認し、merge後のProduction migration適用とcheckpoint作成・差分・復元を未完了としてR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1g Cloud Canvas編集lease確認ゲート、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `0f704d80095edcac41d7279e2f5236489f52e1f0`（PR #224 merge commit）
- Branch: `codex/fix-page-edit-lock-checking-gate`
- Draft PR: [#225](https://github.com/team478a/manga/pull/225)
- Preview: `https://mangai-hub-staging-git-codex-fix-page-aa7b79-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Production: ページ遷移直後のlease `checking`中も編集UIが操作できるfail-openと、確認通知消失時のレイアウト移動を再現した。一時変更したコマ名は元へ戻して保存済み。
- 修正: `acquired`以外は編集UIを`inert`化し、Undo／Redo／削除のwindow shortcutも遮断する。`checking`／`locked`／`unavailable`を固定overlayで案内する。
- 外部契約: API、DB、migration、RPC、Storage、Feature Flag、lease token／時間、Canvas schema、Provider、model、pricing、retry、timeout、Scheduler、PDF／PNG、成人向け境界、Stripe、Desktopを変更しない。
- 検証: 集中15/15、lint、Hub／Desktop typecheck、deps、research eval、full `rc:validate`成功（Hub 626/626、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1G_PAGE_LOCK_GATE_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1G_PAGE_LOCK_GATE_EVIDENCE.md)
- 停止: Draft PRの最終HEADで全CI／Vercel Previewを確認し、R4-1はpending、R4-2は未着手を維持する。

---

## 0. 現在の優先タスク（PR-R4-1f 一括生成開始拒否の本番再現・修正、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `0754e0b09b7b530fb6de64974d5d1e1099c6887a`（PR #223 merge commit）
- Branch: `codex/fix-empty-generation-batch-on-rejection`
- Draft PR: [#224](https://github.com/team478a/manga/pull/224)
- Preview: `https://mangai-hub-staging-juvn34ftl-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- Production: 既存一般向け検証作品を8ページ／9コマへ拡張。手動作品からの7コマ一括生成はAIネーム関連境界でJob登録前に拒否され、Provider、Asset、credit、外部費用の増加なし。
- 検出: 拒否前にBatchだけが作成され、「処理中0/0」が残る。検証Batchは製品UIで中止済み。
- 修正: 最初のQueue拒否時にBatchを`canceled`へ補償し、未紐付けJobをキャンセルする。Job 0件のcanceled Batchは利用者履歴から除外し、DB記録は保持する。
- 市場分析: 現sessionは一般モニター資格境界で拒否され、保存・Provider呼出し・費用なし。対象モニター本人session待ち。
- 検証: 集中15/15、lint、Hub／Desktop typecheck、full `rc:validate`成功（Hub 625/625、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 証跡: [`RELEASE_CANDIDATE_R4_1F_BATCH_REJECTION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1F_BATCH_REJECTION_EVIDENCE.md)
- 停止: Draft PRの全CI／Vercel Previewを確認し、checkpoint、Cloud text、市場分析、AIネーム由来8ページE2E、2利用者owner isolation、Stripe test E2Eを未完了としてR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1e Production Scheduler受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `2e3a1d5350ae2db3d1c0f158020e573e6f6267d5`（PR #222 merge commit）
- Branch: `codex/release-r4-1e-scheduler-acceptance`
- Draft PR: [#223](https://github.com/team478a/manga/pull/223)
- Preview: `https://mangai-hub-staging-git-codex-release-47537d-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`（R4-1全体はpending）
- 外部設定: Vercel Production／PreviewとGitHub ActionsのWorker secretを同値ローテーションし、Worker URL secretとScheduler enabled variableを設定。値は記録しない。
- Production: `2e3a1d5`を再deployしReady。通信なしcheck成功後、Queue 0件／Worker正常を確認してSchedulerを有効化した。
- 限定run: [31359171708](https://github.com/team478a/manga/actions/runs/31359171708)は`idle`、requests 1、processed 0。Provider生成・credit消費なし。
- 定期run: [31359786321](https://github.com/team478a/manga/actions/runs/31359786321)が`event=schedule`で成功。`idle`、requests 1、processed 0。実行後もQueue 0件／Worker正常。
- 検証: RC台帳2 passed／11 pending／2 blocked、full `rc:validate`成功（Hub 624/624、Desktop 182/182、Canvas 26/26、AI 48/48、migration 50/50、Hub／Desktop build）。
- 証跡: [`RELEASE_CANDIDATE_R4_1E_SCHEDULER_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1E_SCHEDULER_EVIDENCE.md)
- 停止: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、残るcheckpoint、Cloud text、市場分析、8ページE2E、2利用者owner isolation、Stripe test E2Eを未完了としてR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1d Production外部構成照合、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `84773f75c9f42715a33b540dd96dcde4fe6e74cd`（PR #221 merge commit）
- Branch: `codex/release-r4-1d-checkpoint-acceptance`
- Draft PR: [#222](https://github.com/team478a/manga/pull/222)
- Preview: `https://mangai-hub-staging-git-codex-release-68a981-team478as-projects.vercel.app`
- 状態: `EXTERNAL_CONFIGURATION_REQUIRED`
- checkpoint: 対象Supabase project `vmdsyxykcrgxcdbrwlkv`は現在のDashboard accountから参照できず、別projectだけが表示される。SQLや本番DBは変更していない。
- Cloud text: Vercelにはenabledだけがあり、model、pricing version、Gateway endpoint/keyがProject／Sharedともにない。Production価格台帳はBFL画像13行だけでtext価格0行。
- 境界: OpenAI市場分析設定は設定済み・有効だがCloud text Gatewayとは別経路。Provider呼出し、Job、credit、課金、外部設定変更なし。
- 証跡: [`RELEASE_CANDIDATE_R4_1D_EXTERNAL_CONFIGURATION_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1D_EXTERNAL_CONFIGURATION_EVIDENCE.md)
- 停止: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、外部構成の責任者確認前に値を推測設定しない。R4-1はpendingを維持し、R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1c Production編集ロック再受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `d40d8d4f4e30ff57fcb160f7842afb7b780069d5`（PR #220 merge commit）
- Branch: `codex/release-r4-1c-page-lock-acceptance`
- Draft PR: [#221](https://github.com/team478a/manga/pull/221)
- Preview: `https://mangai-hub-staging-git-codex-release-61ff0c-team478as-projects.vercel.app`
- 状態: `READY_FOR_OWNER_REVIEW`
- Production合格: 同一タブ即時再読込、作品画面からの再入場、別タブ排他、元タブ継続、保存済み表示、既存生成Asset表示。
- Production変更: 編集lease取得のみ。ページ内容、Canvas、Asset、作品状態、Provider、credit、課金、外部設定は変更していない。
- 証跡: [`RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md)
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功。Draft／MERGEABLE。
- 残件: checkpoint migration、Cloud text readiness、対象モニター本人の市場分析、8ページE2E、Scheduler、2利用者owner isolation、Stripe test E2E。
- 停止: 文書限定Draft PRの最終HEADで全CI／Vercel Previewを確認し、R4-1はpendingを維持する。R4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1b Production API追加受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `7a304834fd1ccea553590f922f132b4d99b7be01`（PR #218 merge commit）
- Branch: `codex/release-r4-1b-production-api-acceptance`
- Draft PR: [#219](https://github.com/team478a/manga/pull/219)
- 状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`
- 完了: production BFL背景画像1件、Queue／credit／手動Worker／cost settlement、private Asset、Canvas配置・保存・再読込、1ページPNG。
- 判明: productionは作品checkpoint migration不足。同一タブ再読込後のpage lock待機、Cloud Editor文章Job登録前拒否も再現。市場分析は対象モニター本人sessionがなく未確認。
- 検証: RC台帳、Cloud漫画repository、migration 50/50、全`rc:validate`成功。Desktop初回一時失敗は単独／全体再実行で182/182成功、Hub 620/620、production build成功。
- 証跡: [`RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1B_PRODUCTION_API_EVIDENCE.md)
- 停止: 文書限定Draft PRと最終HEADの全CI／Vercel Preview後に停止する。R4-1はpartialを維持し、責任者確認前に修正PRやR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-1 Cloud統合受入れ、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `ba93db0429ce1abc66a89b35deb8d1648ebc60ec`（PR #217 merge commit）
- Branch: `codex/release-r4-1-cloud-acceptance`
- Draft PR: [#218](https://github.com/team478a/manga/pull/218)
- 状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`
- 完了: production Vercel／Hubの読み取り実機確認、既存Cloud生成結果、repository受入れ、owner isolation、100ページ、研究評価、migration manifest。
- 外部不足: Stripe変数0件・Dashboard未ログイン、Scheduler Worker URL／secretなし、対象Supabase projectへDashboard accessなし。本番市場分析保存、8ページexport、2利用者実owner isolationは未実施。
- 証跡: [`RELEASE_CANDIDATE_R4_1_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1_EVIDENCE.md)
- 制限: secret、外部設定、本番data、Provider、決済を変更／実行せず、未実施をpassedにしない。
- 停止: 文書限定Draft PRと最終HEADの全CI／Vercel Preview確認後に停止し、責任者確認前にR4-2へ進まない。

---

## 0. 現在の優先タスク（PR-R4-0 Release Candidate統合監査・計画、2026-08-10）

- Base: `feature/manga-canvas-mvp` / `78f4503f6ca235c1c949cddc33c91e7efcc34fa3`（PR #216 merge commit）
- Branch: `codex/release-r4-0-acceptance-plan`
- Draft PR: [#217](https://github.com/team478a/manga/pull/217)
- Preview: `https://mangai-hub-staging-git-codex-release-e49113-team478as-projects.vercel.app`
- R3: PR-R3-1〜R3-5bはすべてマージ済みで、実装残件は0。
- 今回: `docs/RELEASE_CANDIDATE_R4_PLAN.md`を作成し、現在地、RC台帳、実環境受入れ、証拠、rollback、停止条件を統合する文書限定PR。
- 後続: R4-1へHub／Supabase／Vercel／Stripe、R4-2へDesktop実AI／アクセシビリティ／Windows署名・更新／最終RCをまとめる。
- RC状態: 2 passed、11 pending、2 blocked。資格情報、費用承認、実端末、信頼された証明書がない項目を成功扱いしない。
- 対象外: 成人向けDezgo production接続、依存更新、旧PR整理、新機能、UI redesign。
- 検証: 完全ローカルRCゲート、補助受入れ、初回HEADのCore quality／Migration roundtrip／Windows build／Vercel／Vercel Preview Comments成功。
- 停止: 最終文書同期後のHEADでも全CI／Vercel Previewを再確認して停止し、責任者確認前にR4-1へ進まない。

---

## 0. 現在の優先タスク（M6-1 限定モニター品質フィードバック、2026-08-02）

- Branch: `codex/manga-monitor-quality-feedback-v1`
- Base: `codex/manga-100-page-acceptance-v1`（Draft PR #120）
- 実装: Editor内のページ／コマ評価、生成Job由来の品質・費用指標、管理者集計
- migration: `202608020002_cloud_general_monitor_quality_feedback.sql`（未適用）
- 環境変数／外部Provider実行: 追加なし
- 詳細: `docs/cloud/MANGA_MONITOR_QUALITY_FEEDBACK_V1.md`
- 状態: 実装と静的検証済み。Supabase適用、認証済みPreview、実モニター試験、責任者承認待ち

---

## 0. 現在の優先タスク（M5-11 100ページ決定的受入れfixture、2026-08-02）

- Branch: `codex/manga-100-page-acceptance-v1`
- Base: `codex/manga-longform-readiness-v1`（Draft PR #119）
- Draft PR: [#120](https://github.com/team478a/manga/pull/120)
- Preview: `https://mangai-hub-staging-git-codex-manga-10-9b7089-team478as-projects.vercel.app`
- Fixture: 100ページ、10章、10話、20シーン、100コマ・100素材、全ページ確定済み
- 検査: 長編集約、24ページ段階表示、原稿preflight、制作進捗、固定版差分、4ページ×25分割PDF結合
- migration／環境変数／外部Provider: 追加なし
- 詳細: `docs/cloud/MANGA_100_PAGE_ACCEPTANCE_V1.md`
- 状態: 専用受入れ4/4、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ、実画像、実DB復元訓練、責任者承認待ち

---

## 0. 現在の優先タスク（M5-10 長編完成準備チェック、2026-08-02）

- Branch: `codex/manga-longform-readiness-v1`
- Base: `codex/manga-checkpoint-diff-preview-v1`（Draft PR #118）
- Draft PR: [#119](https://github.com/team478a/manga/pull/119)
- Preview: `https://mangai-hub-staging-git-codex-manga-lo-109f0d-team478as-projects.vercel.app`
- 実装: 原稿確定、復旧用固定版、完成版固定、完成PDFの4段階判定と次アクションUI
- migration／環境変数／外部Provider: 追加なし
- DB: `202608020001`はSupabase staging適用・table／function／RLS確認済み
- 詳細: `docs/cloud/MANGA_LONGFORM_READINESS_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ、100ページfixture、責任者承認待ち

---

## 0. 現在の優先タスク（M5-9 復元前の差分確認、2026-08-02）

- Branch: `codex/manga-checkpoint-diff-preview-v1`
- Base: `codex/manga-checkpoint-restore-v1`（Draft PR #117）
- Draft PR: [#118](https://github.com/team478a/manga/pull/118)
- Preview: `https://mangai-hub-staging-git-codex-manga-ch-52453e-team478as-projects.vercel.app`
- 実装: ページrevision、構成ID、素材ID、作品基本設定の決定的な差分集計と日本語UI
- 情報境界: manifest、ハッシュ、Canvas、Storage path、Provider情報は非表示
- migration／環境変数／外部Provider: 追加なし
- 詳細: `docs/cloud/MANGA_CHECKPOINT_DIFF_PREVIEW_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ、100ページ実データ、責任者承認待ち

---

## 0. 現在の優先タスク（M5-8 チェックポイント復元、2026-08-02）

- Branch: `codex/manga-checkpoint-restore-v1`
- Base: `codex/manga-version-freeze-v1`（Draft PR #116）
- Draft PR: [#117](https://github.com/team478a/manga/pull/117)
- Preview: `https://mangai-hub-staging-git-codex-manga-ch-e4a0cd-team478as-projects.vercel.app`
- 実装: 復元前自動バックアップ、作品構造／Canvas復元、復元監査、明示確認UI
- 安全条件: 生成中／編集中は拒否、別作品拒否、revision単調増加、復元ページは要再確認
- migration: `202608020003_cloud_project_checkpoint_restore.sql`（旧ファイル名`202608020001`でSupabase staging適用・構造確認済み。招待追跡とのID競合解消のためリポジトリ上で改番）
- 詳細: `docs/cloud/MANGA_PROJECT_CHECKPOINT_RESTORE_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。Supabase staging、実ブラウザ、責任者承認待ち

---

## 0. 現在の優先タスク（M5-7 増分バックアップと完成版固定、2026-08-01）

- Branch: `codex/manga-version-freeze-v1`
- Base: `codex/manga-cost-budget-v1`（Draft PR #115）
- Draft PR: [#116](https://github.com/team478a/manga/pull/116)
- Preview: `https://mangai-hub-staging-git-codex-manga-ve-2950ce-team478as-projects.vercel.app`
- 実装: Canvas SHA-256重複排除、作品manifest、作業バックアップ、完成版固定、固定履歴
- 完成版条件: 生成停止中、全ページsnapshot、全ページ確定、revision／Context一致
- migration: `202608010011_cloud_project_checkpoints.sql`（Supabase staging適用・構造確認済み）
- 詳細: `docs/cloud/MANGA_PROJECT_CHECKPOINTS_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI、Supabase staging適用成功。実ブラウザ、責任者承認待ち

---

## 0. 現在の優先タスク（M5-6 作品別リソース予算、2026-08-01）

- Branch: `codex/manga-cost-budget-v1`
- Base: `agent/manga-chapter-production-plans-v1`（Draft PR #114）
- Draft PR: [#115](https://github.com/team478a/manga/pull/115)
- Preview: `https://mangai-hub-staging-git-codex-manga-co-1eab8d-team478as-projects.vercel.app`
- 実装: 作品別月間クレジット・概算費用・容量上限、警告割合、生成停止、コックピット集計
- DB: owner/admin保存RPC、owner read RLS、JobとAssetへの強制上限trigger
- migration: `202608010010_cloud_project_resource_budgets.sql`（Supabase staging適用済み）
- DB確認: table／RPC／RLS／生成Job trigger／Storage trigger／既存作品backfillがすべて正常
- 表示境界: 利用者には合計だけを表示し、Provider／モデル／料金計算ロジックを公開しない
- 詳細: `docs/cloud/MANGA_PROJECT_RESOURCE_BUDGET_V1.md`
- 状態: 全ローカル品質ゲート、Draft PR、Preview、全GitHub CI、Supabase staging適用成功。実Provider・実ブラウザ・責任者承認待ち

---

## 0. 現在の優先タスク（M5-5 章単位の制作計画、2026-08-01）

- Branch: `agent/manga-chapter-production-plans-v1`
- Base: `agent/manga-cockpit-navigation-v1`（Draft PR #113）
- Draft PR: [#114](https://github.com/team478a/manga/pull/114)
- Preview: `https://mangai-hub-staging-git-agent-manga-ch-9a2d97-team478as-projects.vercel.app`
- 実装: 章ごとの優先度・担当名・期限・メモ、期限超過、優先章数、次着手章
- migration: `202608010009_cloud_chapter_production_plans.sql`（Supabase staging適用・構造確認済み）
- DB適用: 長編制作関連の未適用10項目を一括監査し、すべて正常。`202608010002`は既適用
- 利用者マニュアル: `/dashboard/monitor/guide`とMarkdown版へ、短編試作から100ページ制作・PDF出力までの実操作手順を反映
- 状態: 実装、DB適用、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実ブラウザ・Worker実行・責任者承認待ち

---

## 0. 現在の優先タスク（M5-4 100ページナビゲーション、2026-08-01）

- Branch: `agent/manga-cockpit-navigation-v1`
- Base: `agent/manga-longform-cockpit-v1`（Draft PR #112）
- Draft PR: [#113](https://github.com/team478a/manga/pull/113)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-4977d4-team478as-projects.vercel.app`
- 目的: 長編コックピットのDOMと認知負荷を100ページ規模で抑える
- 実装: 章／状態絞り込み、未割当抽出、折りたたみ、24ページ段階表示
- migration／環境変数／外部Provider: 追加なし
- 詳細: `docs/cloud/MANGA_COCKPIT_NAVIGATION_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。100ページ実データ確認と責任者承認待ち

---


## 0. 現在の優先タスク（M5-3 長編作品コックピット、2026-08-01）

- Branch: `agent/manga-longform-cockpit-v1`
- Base: `agent/manga-continuity-suggestions-v1`（Draft PR #111）
- Draft PR: [#112](https://github.com/team478a/manga/pull/112)
- Preview: `https://mangai-hub-staging-git-agent-manga-lo-7b90ee-team478as-projects.vercel.app`
- 目的: 32〜100ページ作品の構成、進捗、伏線、人物関係を横断確認する
- 実装: `/creator/[projectId]/cockpit` と決定的な集計helper
- 安全境界: 既存の保存済み情報だけを集計し、Providerや外部AIは利用しない
- migration／環境変数: 追加なし
- 詳細: `docs/cloud/MANGA_LONGFORM_COCKPIT_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実作品確認と責任者承認待ち

---


## 0. 現在の優先タスク（M5-2 連続性設定候補、2026-08-01）

- Branch: `agent/manga-continuity-suggestions-v1`
- Base: `agent/manga-continuity-foundation-v1`（Draft PR #110）
- Draft PR: [#111](https://github.com/team478a/manga/pull/111)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-2eb954-team478as-projects.vercel.app`
- 目的: 確定済みの構造化設定を候補化し、利用者が確認した項目だけM5-1台帳へ保存する
- 実装: キャラクター／場所／小物／ページ割当済みシーン候補、登録済み除外、確認登録UI
- 安全境界: Promptや画像を解析せず、外部AIを呼ばず、候補は未確認のまま保存しない
- migration／環境変数: 追加なし
- 詳細: `docs/cloud/MANGA_CONTINUITY_SUGGESTIONS_V1.md`
- 状態: 実装、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。実作品確認と責任者承認待ち

---

## 0. 現在の優先タスク（M5-1 物語の連続性台帳、2026-08-01）

- Branch: `agent/manga-continuity-foundation-v1`
- Base: `agent/manga-storage-lifecycle-v1`（Draft PR #109）
- Draft PR: [#110](https://github.com/team478a/manga/pull/110)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-654703-team478as-projects.vercel.app`
- 目的: 長編の事実と伏線をページ範囲付きで管理し、決定的に検出できる矛盾を表示する
- 実装: `cloud_continuity_facts`、`cloud_plot_threads`、owner-only RPC、事実・伏線UI、矛盾・回収漏れ評価
- migration: `202608010008_cloud_narrative_continuity.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_NARRATIVE_CONTINUITY_V1.md`
- 状態: 実装、migration実DB往復、全ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。外部環境適用と責任者承認待ち

---


## 0. 現在の優先タスク（M4 Storageライフサイクル、2026-08-01）

- Branch: `agent/manga-storage-lifecycle-v1`
- Base: `agent/manga-durable-export-v1`（Draft PR #108）
- Draft PR: [#109](https://github.com/team478a/manga/pull/109)
- Preview: `https://mangai-hub-staging-git-agent-manga-st-723bbf-team478as-projects.vercel.app`
- 目的: 長編作品のページサムネイル生成と不要な派生ファイルの安全な整理を追加する
- 実装: `cloud-cache`、ページrevision別WebP、署名URL、thumbnail／cleanup Queue、lease Worker
- 保護対象: 採用済み生成画像、Canvas保存データ、完成`manuscript.pdf`はcleanup対象外
- migration: `202608010007_cloud_storage_lifecycle.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_STORAGE_LIFECYCLE_V1.md`
- 状態: 実装、ローカル品質ゲート、Draft PR、Preview、全GitHub CI成功。外部環境適用と責任者承認待ち

---


## 0. 現在の優先タスク（M4 永続PDFエクスポート、2026-08-01）

- Branch: `agent/manga-durable-export-v1`
- Base: `agent/manga-production-status-v1`（Draft PR #107）
- Draft PR: [#108](https://github.com/team478a/manga/pull/108)
- Preview: `https://mangai-hub-staging-git-agent-manga-du-4a6dbe-team478as-projects.vercel.app`
- 目的: 32〜100ページ原稿を4ページsegmentで永続処理し、完成PDFへ安全に結合する
- 実装: Export Job／segment、停止・再開・中止・retry、private Storage、署名download、厳格preflight
- migration: `202608010006_cloud_durable_export.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/MANGA_DURABLE_EXPORT_V1.md`
- 状態: 実装、ローカル検証、Draft PR、Preview完了。GitHub CI確認中

---


## 0. 現在の優先タスク（M4制作管理 ページ状態・確定ロック、2026-08-01）

- Branch: `agent/manga-production-status-v1`
- Base: `agent/manga-batch-production-v1`（Draft PR #106）
- Draft PR: [#107](https://github.com/team478a/manga/pull/107)
- Preview: `https://mangai-hub-staging-git-agent-manga-pr-7ff6fc-team478as-projects.vercel.app`
- 目的: 長編制作のページ状態、全体進捗、確認・修正・確定を制作ボードで管理する
- 実装: 5状態、Job連動、確定編集ロック、設定変更revision、絞り込み、migration未適用fallback
- migration: `202608010005_cloud_production_status.sql`、rollback、canonical schema同期
- 詳細: `docs/cloud/CLOUD_PRODUCTION_STATUS_V1.md`
- 検証: deps、lint、Hub 363/363、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y、migration forward／rollback／reapply／canonical、build成功
- 状態: 実装・Draft PR・Preview完了。Supabase staging適用、実ブラウザ確認、責任者承認待ち

---


## 0. 現在の優先タスク（M4後半 一括生成・編集ロック、2026-08-01）

- Branch: `agent/manga-batch-production-v1`
- Base: `agent/manga-32page-foundation-v1`（Draft PR #105）
- Draft PR: [#106](https://github.com/team478a/manga/pull/106)
- Preview: `https://mangai-hub-staging-git-agent-manga-ba-fd5369-team478as-projects.vercel.app`
- 目的: 4〜8ページ単位の永続生成Queueと、Canvas同時編集の安全境界を追加する
- 実装: Batch永続化、Job紐付け、進捗集計、停止／再開／中止、失敗分retry、120秒の編集lease
- migration: `202608010004_cloud_batch_production.sql`、rollback、canonical schema同期済み
- 詳細: `docs/cloud/MANGA_BATCH_PRODUCTION_V1.md`
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: コード、DB往復、Draft PR、Preview完了。Supabase staging適用、実Provider、実ブラウザ、責任者承認待ち

---

## 0. 現在の優先タスク（M4前半 32ページ制作基盤、2026-08-01）

- Branch: `agent/manga-32page-foundation-v1`
- Base: `agent/manga-transparent-layers-v1`（Draft PR #104）
- Draft PR: [#105](https://github.com/team478a/manga/pull/105)
- Preview: `https://mangai-hub-staging-git-agent-manga-32-fc91ac-team478as-projects.vercel.app`
- 目的: 32ページ読切を章・話・シーン単位で整理し、ページ一覧のDOM負荷を制限する
- 実装: Chapter／Scene schemaとRLS、既存作品backfill、階層追加、同一話内drag reorder、単ページ／見開き、12ページずつ追加表示
- fallback: migration未適用時は旧画面を継続し、構造編集だけ停止
- migration: `202608010003_cloud_longform_structure.sql`、rollbackとcanonical schema同期済み
- 詳細: `docs/cloud/MANGA_32_PAGE_FOUNDATION_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 354/354、Canvas 26/26、AI 48/48、Desktop 182/182、migration往復、production build成功
- CI: Core quality、Migration roundtrip、Windows accessibility/build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。Supabase staging適用、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-8 人物・効果レイヤー白背景透明化、2026-08-01）

- Branch: `agent/manga-transparent-layers-v1`
- Base: `agent/manga-layered-generation-v1`（Draft PR #103）
- Draft PR: [#104](https://github.com/team478a/manga/pull/104)
- Preview: `https://mangai-hub-staging-git-agent-manga-tr-46b68e-team478as-projects.vercel.app`
- 目的: 分離生成した人物・効果を白い矩形ではなく透明PNGレイヤーとして保存する
- 実装: `outputAlphaMode`の許可値検証、人物・効果Jobへの固定、Sharpによる白地除去、Worker保存前変換
- 互換性: 既定値は`preserve`。完成コマ、背景、修正、既存Jobは変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_TRANSPARENT_LAYER_OUTPUT_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 350/350、Canvas 26/26、AI 48/48、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。実Provider、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-7 背景・人物・効果の分離生成、2026-08-01）

- Branch: `agent/manga-layered-generation-v1`
- Base: `agent/manga-composition-control-v1`（Draft PR #102）
- Draft PR: [#103](https://github.com/team478a/manga/pull/103)
- Preview: `https://mangai-hub-staging-git-agent-manga-la-a0ee14-team478as-projects.vercel.app`
- 目的: 通常のコマ生成を完成コマ、背景、人物、効果へ分け、非破壊レイヤーとして採用する
- 実装: 対象選択UI、対象別Job・Prompt・参照分離、背景の下層配置、人物・効果の乗算合成
- 互換性: `generationTarget`未指定時は完成コマ。既存の修正生成は変更しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_LAYERED_GENERATION_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 348/348、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・全自動検証・Preview完了。実Provider、実ブラウザ確認、責任者承認待ち

---

## 0. 現在の優先タスク（M3-6 ポーズ・構図制御、2026-08-01）

- Branch: `agent/manga-composition-control-v1`
- Base: `agent/manga-smart-mask-v1`（Draft PR #101）
- Draft PR: [#102](https://github.com/team478a/manga/pull/102)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-048dc2-team478as-projects.vercel.app`
- 目的: 通常のコマ画像生成で、画角・カメラ位置・人物配置・視線方向を選択可能にする
- 実装: 4項目の選択UI、500文字以内の追加指定、API enum検証、生成Promptへの構図調整追加
- 互換性: すべて「ネームどおり」が初期値。修正生成には自動適用しない
- migration / Feature Flag / Provider / 料金: 追加なし
- 詳細: `docs/cloud/MANGA_COMPOSITION_CONTROL_V1.md`
- 検証: deps、lint、Hub/Desktop typecheck、Hub 345/345、Canvas 26/26、AI 47/47、Desktop 182/182、migration 34/34、production build成功
- CI: Core quality、Migration roundtrip、Windows build、Vercel成功
- 状態: 実装・自動検証完了。実ブラウザ確認と責任者承認待ち

---

## 0. 現在の優先タスク（M3-5 修正領域おすすめ、2026-08-01）

- Branch: `agent/manga-smart-mask-v1`
- Base: `agent/manga-revision-comparison-v1`（Draft PR #100）
- Draft PR: [#101](https://github.com/team478a/manga/pull/101)
- 目的: Inpaintingの修正範囲を修正内容からワンタップ提案し、手描き調整を残す
- 実装: 顔・表情・手・衣装・背景・全体の比率ベース初期マスク、候補切替、手動補正
- 境界: v1は画像認識ではなく目安。外部Vision API、DB、Provider、料金の変更なし
- 詳細: `docs/cloud/MANGA_SMART_MASK_V1.md`
- 状態: ローカル全品質ゲート成功。Draft PR、GitHub CI、Vercel、責任者確認待ち
- 未実施: 実ブラウザのマウス・タッチ確認、責任者承認、親PR #100後のマージ

---

## 0. 現在の優先タスク（M3-4 修正前後の比較表示、2026-08-01）

- Branch: `agent/manga-revision-comparison-v1`
- Base: `agent/manga-panel-outpainting-v1`（Draft PR #99）
- Draft PR: [#100](https://github.com/team478a/manga/pull/100)
- 目的: 修正候補を採用する前に元画像との差分を視覚的に確認する
- 実装: range比較スライダー、Outpainting方向・寸法に応じた元画像位置補正、比較からの非破壊採用
- API: private inputは返さず、本人所有Jobの比較用Asset IDと拡張方向だけを安全に公開
- migration / Feature Flag: 追加なし
- 詳細: `docs/cloud/MANGA_REVISION_COMPARISON_V1.md`
- 注意: 一般向けCloudの表示機能のみ。成人向け、Desktop、生成Providerは対象外
- 状態: ローカル全品質ゲート成功。GitHub CI、Vercel、責任者確認待ち
- 未実施: 実ブラウザ確認、責任者承認、親PR #99後のマージ

---

## 0. 現在の優先タスク（M3-3 コマ画角拡張、2026-08-01）

- Branch: `agent/manga-panel-outpainting-v1`
- Base: `agent/manga-panel-inpainting-v1`（Draft PR #98）
- Draft PR: [#99](https://github.com/team478a/manga/pull/99)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-f7bc01-team478as-projects.vercel.app`
- 目的: 採用済みコマを非破壊で左・右・上・下・全方向へ延長する
- 実装: 方向UI、Outpainting operation、Worker内余白・白黒マスク生成、BFL Fill、correction layer採用
- Feature Flag: `CLOUD_PANEL_OUTPAINTING_ENABLED`。未設定時は認証・DB・Providerより前に停止
- migration: なし。既存Fill Providerと価格設定を再利用
- 詳細: `docs/cloud/MANGA_PANEL_OUTPAINTING_V1.md`
- 注意: 一般向けCloudのみ。成人向け、Desktop、自動マスクは対象外
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 未実施: 実Provider有料生成、実ブラウザ確認、責任者承認、親PR #98後のマージ

---

## 0. 現在の優先タスク（M3-2 マスク付きコマ部分修正、2026-08-01）

- Branch: `agent/manga-panel-inpainting-v1`
- Base: `agent/manga-panel-revision-v1`（Draft PR #97）
- Draft PR: [#98](https://github.com/team478a/manga/pull/98)
- Preview: `https://mangai-hub-staging-jnew2urfq-team478as-projects.vercel.app`
- 目的: 採用画像の利用者が塗った範囲だけを修正候補として生成する
- 実装: タッチ対応マスク、専用inpainting operation、BFL Fill、private Asset再検証、correction layer採用
- Feature Flag: `CLOUD_PANEL_INPAINTING_ENABLED`。未設定時はUI・サーバー・Provider registryで停止
- migration: `202608010002_cloud_panel_inpainting.sql`
- 詳細: `docs/cloud/MANGA_PANEL_INPAINTING_V1.md`
- 注意: 一般向けCloudのみ。Outpainting、自動マスク、成人向け、Desktopは対象外
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 未実施: staging migration、実Provider有料生成、実ブラウザ確認、責任者承認、親PR #97後のマージ

---

## 0. 現在の優先タスク（M3-1 コマ修正候補生成、2026-08-01）

- Branch: `agent/manga-panel-revision-v1`
- Base: `agent/manga-continuity-review-v1`（Draft PR #96）
- Draft PR: [#97](https://github.com/team478a/manga/pull/97)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-2b4a4e-team478as-projects.vercel.app`
- 目的: 採用済みコマ画像を残したまま、気になる部分の修正候補を生成する
- 実装: 6修正preset、任意追加要望、元画像先頭参照、設定version継承、2〜4候補、非破壊レイヤー採用
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_PANEL_REVISION_V1.md`
- 注意: マスク付きInpaintingではなく、参照画像を使うガイド付きImage-to-Image
- 未実施: 実Provider生成、実ブラウザ確認、責任者承認、親PR #96後のマージ

---

## 0. 現在の優先タスク（M2-4 生成履歴の一貫性チェック、2026-08-01）

- Branch: `agent/manga-continuity-review-v1`
- Base: `agent/manga-reference-assets-v1`（Draft PR #95）
- Draft PR: [#96](https://github.com/team478a/manga/pull/96)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-df707f-team478as-projects.vercel.app`
- 目的: 採用済み生成画像が人物・衣装・場所・小物・画風の現在設定と参照画像を継続使用しているか確認する
- 実装: 設定版・参照asset・Job追跡の照合、混在警告、ページ／設定修正導線
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_CONTINUITY_REVIEW_V1.md`
- 注意: v1は画像ピクセルを解析せず、見た目の一致を保証しない
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace

---

## 0. 現在の優先タスク（M2-3 参照画像・コマ明示割当、2026-08-01）

- Branch: `agent/manga-reference-assets-v1`
- Base: `agent/manga-generation-integration-v1`（Draft PR #94）
- 目的: 人物・画風・場所・小物の参照画像と明示割当を一般向けコマ生成へ安全に反映する
- 実装: 非公開asset関連付け、コマ割当、Job監査入力、短時間署名URL、BFL FLUX.2 multi-reference
- migration: `202608010001_cloud_visual_references.sql`
- 詳細: `docs/cloud/MANGA_VISUAL_REFERENCES_V1.md`
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace、自動参照昇格

---

## 0. 現在の優先タスク（一般向け漫画生成の統合、2026-07-31）

- Branch: `agent/manga-generation-integration-v1`
- Base: `feature/manga-canvas-mvp` (`ae1279e`)
- Draft PR: [#94](https://github.com/team478a/manga/pull/94)
- Preview: `https://mangai-hub-staging-git-agent-manga-ge-907c74-team478as-projects.vercel.app`
- 目的: PR #87〜#90の一般向け漫画生成機能を最新Cloud基盤へ安全に統合する
- 範囲: FLUXコマ生成、候補比較、レイヤー合成、原稿検査、作品進捗、
  キャラクター設定、画風・場所・小物設定
- 状態: ローカル品質ゲート、GitHub全CI、Vercel Preview成功。責任者確認待ち
- 詳細: `docs/cloud/MANGA_GENERATION_INTEGRATION_REPORT.md`
- 未実施: migration適用、実Provider有料生成、実ブラウザ確認、マージ
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace

---

## 0. 現在の優先タスク（一般向けモニターWebマニュアル同期、2026-07-31）

- Branch: `codex/cloud-monitor-guide-sync-v1`
- Base: `feature/manga-canvas-mvp` (`ee6e2ca`、PR #92 merge後)
- 目的: モニターが現在の8工程と利用可能範囲を迷わず理解し、制作画面からいつでもマニュアルを開けるようにする
- 対象: `/dashboard/monitor/guide`、`/admin/general-monitors/guide`、Cloud共通サイドバー
- Draft PR: [#93](https://github.com/team478a/manga/pull/93)
- Preview: `https://mangai-hub-staging-git-codex-cloud-mo-eaf18e-team478as-projects.vercel.app`
- 状態: 実装・ローカル全品質ゲート・実装commitの全CI・Vercel成功、責任者確認待ち
- 変更しない範囲: DB、migration、認証、AI生成・保存ロジック、Feature Flag、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の利用入口修正、2026-07-31）

- Branch: `codex/cloud-workflow-entrypoints-v1`
- Base: `feature/manga-canvas-mvp` (`38c1481`、PR #91 merge後)
- 目的: 市場分析以外の実装済み工程を、共通メニューから実際に利用可能にする
- 対象: Cloud共通サイドバー、工程入口Route、利用者本人の進行先解決
- Draft PR: [#92](https://github.com/team478a/manga/pull/92)
- 状態: 実装・ローカル主要品質ゲート完了、CI・Vercel Preview確認中
- 変更しない範囲: DB、migration、AI生成・保存ロジック、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の表示整理、2026-07-31）

- Branch: `codex/cloud-workflow-labels-v1`
- Base: `feature/manga-canvas-mvp` (`7eb783f`)
- 目的: 一般向けモニターへ、実装済み工程と準備中工程を誤解なく案内する
- 対象: Cloud共通サイドバー、Dashboard、`/creator`、シナリオ採用画面
- 状態: 実装・ローカル主要品質ゲート完了、Draft PR作成前
- 変更しない範囲: DB、API、認証、制作・保存ロジック、Feature Flag、Desktop

---

## 0. 現在の優先タスク（クラウド制作の日本語化・初回ガイド、2026-07-31）

- Branch: `codex/cloud-creator-ja-guide-v1`
- Base: `feature/manga-canvas-mvp` (`3d16839`)
- 目的: モニターが英語の内部用語に迷わず、新しい紫基調UI上で
  最初の制作操作を理解できるようにする
- 対象: `/creator`と関連する作品作成・構成・ゴミ箱・ページ編集
- 状態: 実装とローカル主要品質ゲート完了、Draft PR #85で確認中
- 変更しない範囲: DB、API契約、認証、制作・保存ロジック、Desktop

---

## 0. 現在の優先タスク（招待メール文面編集、2026-07-31）

- Branch: `codex/cloud-monitor-email-template-v1`
- Base: `feature/manga-canvas-mvp` (`506cf2b`)
- 目的: 管理画面からモニター招待メールの件名・本文を安全に変更する
- 管理画面: `/admin/general-monitors/email`
- migration: `202607310003_cloud_general_monitor_email_template.sql`
- 状態: 実装とローカル主要品質ゲート完了、Draft PR準備中

---

## 0. 現在の優先タスク（モニター操作の処理中表示、2026-07-31）

- Branch: `codex/cloud-action-pending-feedback-v1`
- Base: `feature/manga-canvas-mvp` (`6ebdbaa`)
- 目的: ボタンクリック直後に処理中表示を出し、無反応に見える状態と二重送信を防ぐ
- 対象: モニター招待・運用・設定・フィードバック・初回開始
- 変更範囲: 表示層のみ。Server Action、認証、DB、API、Desktopは変更しない
- Draft PR: [#83](https://github.com/team478a/manga/pull/83)
- Preview:
  `https://mangai-hub-staging-hvbsecmo4-team478as-projects.vercel.app`
- 状態: 実装、ローカル品質ゲート、全CI、Vercel Preview成功。責任者確認待ち

---

## 0. 現在の優先タスク（一般向けモニター本番統合、2026-07-31）

- Branch: `codex/cloud-monitor-production-v1`
- Base: `feature/manga-canvas-mvp`
- 本番URL: `https://app.mang-ai.com`
- 目的: 一般向けRelease 1〜6を約10名へ本番招待制で段階公開する
- 除外: Stripe、販売、Marketplace、成人向け公開、Desktop
- 状態: 統合済み、品質ゲートとDraft PR作成中
- 正本:
  [`cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md`](cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md)

成人向け市場分析・企画のコードが統合履歴に含まれても、Productionの成人向け
Feature Flagは未設定または`false`を必須とする。本番マージ、migration適用、
Feature Flag有効化、redeploy、実招待はDraft PRの全CIと責任者承認後に行う。

---

## 0. 現在の優先タスク（Release 2 AI企画提案・限定公開準備、2026-07-30）

- Branch: `codex/cloud-proposal-generation-v1`
- Base: `codex/cloud-research-ai-auto-ux-v1` (`a21fd94`)
- Draft PR: [#69](https://github.com/team478a/manga/pull/69)
- 目的: 完了した一般向け市場分析から3企画を生成・比較・選択し、シナリオ生成へ引き継ぐ
- 状態: 実装・限定公開前ハードニング・ローカル品質ゲート完了。更新Preview CIと責任者実機受入れ待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_PROPOSAL_GENERATION_V1.md`、`docs/cloud/CLOUD_RELEASE2_LIMITED_RELEASE_RUNBOOK.md`

管理画面で設定済みのOpenAI接続とSupabase Vaultを再利用する。APIキーをローカル・Vercelへ複製しない。成人向けReportを外部AIへ送信しない。

---

## 0. 現在の優先タスク（売れ筋優先・AIおまかせ市場分析、2026-07-30）

- Branch: `codex/cloud-research-ai-auto-ux-v1`
- Base: `codex/cloud-adult-planning-option-v1` (`58a18b9`)
- 目的: 簡単な希望だけで「今、どんな漫画が買われる可能性が高いか」を具体的に提示する
- 状態: local実装済み。migrationと管理者キー登録は責任者申告で完了。更新Preview実機E2E、責任者承認待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`

成人向け内容は外部AIへ送信しない。APIキーは通常テーブル、Client、URL、ログ、監査へ出さない。既存stacked PRをrebase、force push、Close、mergeしない。

---

## 0. 現在の優先タスク（成人向け企画ブリーフ、2026-07-29）

本節を、直後に残る成人向け市場分析と一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-planning-option-v1`
- Base: `codex/cloud-adult-research-option-v1` (`a9969ac`)
- 親Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- Draft PR: [#67](https://github.com/team478a/manga/pull/67)
- 目的: 成人向け市場分析を完了した許可利用者へ、外部AIを使わない企画ブリーフを機能単位権限付きで提供する
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-95f9df-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_PLANNING_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_PLANNING_IMPLEMENTATION_REPORT.md`

この段階では利用者入力の保存・履歴・再表示だけを提供する。成人向け文章・画像の自動生成、外部Provider送信、Stripe自動許可、作品公開・販売は行わない。migration適用とFeature Flag有効化は責任者承認まで禁止する。

---

## 0. 現在の優先タスク（成人向け市場分析オプション、2026-07-29）

本節を、直後に残る一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-research-option-v1`
- Base: `codex/cloud-release1-integration-v1` (`6491a7d`)
- 親Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- 目的: 成人向け市場分析を購入者・管理者許可利用者へ提供できる許可制Cloudオプション
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-7158e2-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_IMPLEMENTATION_REPORT.md`

一般向け市場分析は成人向け権限に依存させない。成人向けの画像・本文生成、Stripe自動連携、作品公開・販売は対象外。migration適用、Feature Flag有効化、DB Kill Switch有効化、本番公開は責任者承認まで行わない。

---

## 0. 現在の優先タスク（2026-07-29）

過去の引継ぎ記録より本節を優先する。

- Branch: `codex/cloud-release1-integration-v1`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- 目的: 市場分析だけを限定公開できるRelease 1統合
- 統合元: PR #50、#56〜#62
- 除外: PR #48〜#49、#51〜#55、#63〜#64
- 状態: 公開前ハードニングと全品質ゲートを実行中。merge・本番反映は禁止
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RELEASE1_INTEGRATION_REPORT.md`、`docs/cloud/CLOUD_RELEASE1_BETA_ACCEPTANCE.md`

既存PRは統合元としてそのまま保持し、rebase、force push、Closeを行わない。以下の節は保守性改善・Desktop作業時点の履歴として残す。

## 1. 引継ぎ情報

- 更新日: 2026-07-26
- リポジトリ: `team478a/manga`
- デフォルトブランチ: `feature/manga-canvas-mvp`
- デフォルト最新コミット: `c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`（`Merge pull request #32 from team478a/codex/creator-workflow`）
- 保守性改善統合ブランチ: `integration/maintenance-stack-20260726`
- 統合PR: **#34**（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`、Draft、mergeable、責任者レビュー待ち）
- デザイン仕様PR: **#33**（`design/mangai-ui-refresh` → `handoff/codex-to-claude-20260725`、Draft、文書のみ）
- 現在状態: `READY_FOR_REVIEW`（PR #34のレビュー・マージ判断待ち）

**この文書が正本です。会話履歴・過去のセッション要約を正本として扱わないでください。**

## 2. 製品構成

| 製品 | 主な配置 | 責務 |
| --- | --- | --- |
| MANGAI Hub / Cloud | リポジトリルート、`src/` | 一般漫画制作、Project/Canvas、認証、公開、販売、Stripe、管理 |
| MANGAI Desktop | `apps/desktop/` | Windowsローカル制作、成人向け制作、Ollama、ComfyUI、書き出し、更新 |
| 共通Domain | `packages/` | Canvas、AI、Project、Export、IPC schema等の共通処理 |
| Hub DB | `supabase/` | PostgreSQL、RLS、Storage、migration |

製品方針は、一般漫画をCloud、成人向け漫画をDesktopで扱う分離構成です。成人向け処理と人物・参照画像・完成Pageはローカル優先・fail-closedを維持します。

## 3. 現在のブランチ構造

```text
feature/manga-canvas-mvp (デフォルト)
  ├─ PR #30〜#32: Vercel workspace package build修正、パスワード確認・再設定フロー、
  │                Creatorプロフィール・作品アップロード安全性強化（merge済み）
  │
  ├─ integration/maintenance-stack-20260726 (Draft PR #34)
  │    保守性改善PR #14〜#28（15コミット、stacked）をcherry-pickし、
  │    PR #30〜#32の機能と統合済み。責任者レビュー・マージ判断待ち。
  │
  └─ handoff/codex-to-claude-20260725
       └─ design/mangai-ui-refresh (Draft PR #33)
            「MANGAI Creative Studio」デザイン仕様（docs/design/配下、文書のみ）
            責任者が方向性を承認済み。画面別「デザイン承認条件」は未了。
```

PR #14〜#28（元のstacked Draft PR、`codex/pr-09-desktop-migration-runner`〜`codex/pr-23-hub-structured-logging`）は、PR #34への統合作業の元データとしてそのまま残存しています。個別にmerge・rebase・closeはしていません。

## 4. 保守性改善スタックの統合状況（PR #34）

2026-07-24時点で完了していた保守性改善PR-01〜PR-23（GitHub Draft PR #14〜#28）を、2026-07-26に`feature/manga-canvas-mvp`の最新状態へ統合しました。

- 統合方法: 古い順に1コミットずつ`git cherry-pick`（一括cherry-pickではない）
- 競合: 3件（`src/app/actions.ts`＝PR#19、`package.json`＝PR#20、`src/app/actions/{auth,profile,work}-actions.ts`＝PR#27）。いずれも分割構造（薄い互換entrypoint＋機能別ファイル）を採用しつつ、PR #30〜#32由来の新機能（パスワード確認、sharp画像形式検証、旧画像Storage削除等）を保持する形で解決
- 品質ゲート: lint/typecheck/deps:check/hub:test(116/116)/canvas:test(26/26)/ai:test(44/44)/desktop:test(98/98)/migration検証/Hub build/Desktop build/rc:preflight/git diff --check、すべてPASS
- CI（PR #34）: Required Quality PASS、Migration roundtrip PASS、Desktop Windows PASS（Accessibility testsを含む）、Vercel Preview Ready

詳細・競合解決の判断根拠は[`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](../docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)を参照してください。

## 5. Claude Code / Codexが最初に行うこと

```bash
git fetch origin
git checkout integration/maintenance-stack-20260726
git pull origin integration/maintenance-stack-20260726

git status --short
git log --oneline --decorate -15
git diff feature/manga-canvas-mvp...HEAD --stat
```

その後、以下を読みます。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`（本ファイル）
4. `docs/CURRENT_TASK.md`
5. `docs/HANDOFF_LOG.md`
6. 対象機能の設計文書

## 6. 現在の次工程

1. PR #34の責任者レビュー・マージ判断を待つ（本ブランチでの新規変更は、レビュー指摘への対応以外は行わない）。
2. PR #34が`feature/manga-canvas-mvp`へmergeされたら、PR #33（`docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`）のビジュアル仕様承認（§4各画面末尾・§8）が揃っているか確認する。
3. 上記2点が揃った時点で、**merge後の最新`feature/manga-canvas-mvp`から新しい実装ブランチを作成**し、Phase D1（デザイントークン導入）へ着手する。`design/mangai-ui-refresh`をそのまま実装ブランチとして流用しない。
4. hosting環境決定後、Hub Structured Loggingのlog sink、alert通知先、保持期間、担当者を設定する。
5. Supabase stagingへmigrationを適用し、Desktop端末認証を確認する。
6. Stripe test決済、失敗、返金、download E2Eを実施する。
7. 実Ollama、実ComfyUI、承認済みDezgo safe素材試験を実施する。
8. Windowsコード署名、署名済み自動更新、クリーンPC受入れを実施する。

外部環境や契約が必要な作業を、mockや静的確認だけで完了扱いにしないでください。

## 7. 外部環境待ち・責任者判断待ち

| 項目 | 状態 | 必要条件 |
| --- | --- | --- |
| Desktop Accessibility（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT | Xサーバー（ディスプレイ）を持つ実行環境。GitHub ActionsのDesktop Windows workflowでは`npm run test:a11y`が成功済み |
| Vercel Preview deployment | PASS（CI確認済み） | ― |
| Vercel本番環境の通し受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Vercel/Supabase/Stripe本番設定 |
| Windows実署名 | BLOCKED_EXTERNAL_ENVIRONMENT | 信頼されたコード署名証明書 |
| 署名付き更新E2E | BLOCKED_EXTERNAL_ENVIRONMENT | 署名済み2version、公開更新URL |
| クリーンWindows受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Windows VMまたは新規PC |
| Ollama実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Ollama、対象モデル |
| ComfyUI実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | ComfyUI、モデル、workflow JSON |
| Dezgo実API E2E | BLOCKED_EXTERNAL_ENVIRONMENT | BYOK key、課金承認、safe素材条件 |
| Supabase staging | BLOCKED_EXTERNAL_ENVIRONMENT | staging DB、接続情報、`psql` |
| Stripe E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Stripe test、Webhook endpoint |
| log sink/alert | DECISION_REQUIRED | hosting、通知先、保持期間、担当者 |
| Desktopブランドカラー・テーマ・Tailwind非移行 | 確定済み（責任者指示、2026-07-26） | ― |
| Hubの配色・ダークモード方針 | DECISION_REQUIRED | Desktopデザイン確定後に判断（`docs/design/DESIGN_SYSTEM.md`§5） |

## 8. 壊してはいけない境界

- `feature/manga-canvas-mvp`へ直接pushしない。
- PR #34、PR #33を無断でrebase、force push、squashしない。
- 既存migrationを書き換えない。
- API responseの互換フィールドを削除しない。
- Desktop IPC schema、backup version、Project保存形式を無断変更しない。
- `MangaiDatabase`、`service.ts`、`actions.ts`等の互換entrypointを利用箇所確認前に削除しない。
- Domain Errorを生のError message判定へ戻さない。
- 未知例外、Supabase error詳細、Stripe error、token、Prompt、画像、メールをクライアントやlogへ露出しない。
- 成人向け、人物、参照画像、完成Pageの外部送信制限を緩和しない。
- `design/mangai-ui-refresh`（PR #33）でUIコード・CSS・Reactコンポーネントを変更しない。

## 9. 標準品質ゲート

```bash
npm run deps:check
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run desktop:test:a11y
npm run db:migrations:validate
npm run build
npm run desktop:build
npm run rc:preflight
git diff --check
```

環境依存で実行できない項目は、コマンド、error、必要環境を`docs/CURRENT_TASK.md`へ記録します。`desktop:test:a11y`はローカルの実行可否とGitHub Actions Windows CIの結果を区別して記録してください。

## 10. Codex ⇄ Claude Code間で引き継ぐ場合

利用上限または作業区切りで引き継ぐ場合:

1. 新規変更を開始しない。
2. `docs/CURRENT_TASK.md`を更新する。
3. `docs/HANDOFF_LOG.md`へ追記する。
4. テスト結果と未完了項目を記録する。
5. 小さなcheckpoint commitを作成し、現在branchへpushする。
6. 次の担当者へ以下の指示を渡す。

```text
AGENTS.md、CLAUDE.md、docs/AI_HANDOFF.md、docs/CURRENT_TASK.md、
docs/HANDOFF_LOG.mdを読み、git status、直近15コミット、
feature/manga-canvas-mvpとの差分を確認してください。
CURRENT_TASK.mdの未完了項目から継続し、完了済み変更を作り直さないでください。
```
# 2026-08-26 P4-B handoff

- `codex/p4b-mode-presets`は共有3用途preset、Cloud新規作品の長編／Kindle選択・preview、nullable profile保存migrationを追加した。
- 既存Projectはnullのまま変更しない。成人向けはDesktop local-onlyでCloud DB保存も拒否する。
- Production／staging migration、Provider、Job、credit、Storageは未実施。詳細は`docs/RELEASE_CANDIDATE_P4B_COMPLETION_MODE_PRESETS_20260826.md`。

---
# 2026-08-26 P4-C handoff

- `codex/p4c-mode-preflight`はmode guidance warningとP3 finding read-only判定を既存原稿preflightへ統合した。
- P3 FAILだけをerror、WARNING／NOT_EVALUATEDをwarningとし、既存Asset・文字・確定状態errorは弱めない。
- mode未設定Projectは従来動作。Production／Provider／Job／credit／Storage操作なし。

---
# 2026-08-26 P4-D handoff

- `codex/p4d-durable-export-formats`は既存durable PDF状態機械へ連番PNG ZIPとversioned Project JSONを追加した。
- 新2形式はstrict Flag既定OFF。既存PDF、Storage prefix、lease／再開は不変。
- migration／Flag未適用、Worker／Job／Storage／Provider／credit操作なし。

---
# 0.0 RC外部環境preflight（2026-08-28）

- Ollama、ComfyUI、Supabase stagingの実E2E開始条件を秘密値なしで判定するpreflightを追加した。
- 通常実行は接続なし。明示probeもOllama／ComfyUIの状態確認GETだけで、生成・Queue・Job・Asset・credit操作を行わない。
- `mangai-hub-staging`はHealthyだがSupabase Branchは`No branches`で、ローカル接続契約も未設定。表示中mainはProduction扱いのため変更せず停止した。
- 現在の3対象はPENDING。詳細: `docs/RELEASE_CANDIDATE_EXTERNAL_ENVIRONMENT_PREFLIGHT_20260828.md`
- 集中3/3、Hub 923/923、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。

---
# 0.0 RC外部環境preflight統合（2026-08-28）

- `rc:preflight`へOllama、ComfyUI、Supabase staging隔離接続のconfiguration-only判定を統合した。
- 通常RC確認は接続・probe・生成を行わず、秘密値も表示しない。3対象は現状どおりPENDING。
- Production、DB、Provider、Queue、Job、Asset、credit操作0件。
- 集中4/4、Hub 924/924、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。

---
# 0.0 RC隔離Staging identity guard（2026-08-28）

- 外部E2E判定はSupabase Branch refと親Project refの両方を要求し、同一refなら接続前にPENDINGとする。
- 通常のstagingスキーマpreflightは変更せず、release-wide隔離E2Eだけを厳格化した。
- Production、Supabase、DB、Provider、Queue、Job、Asset、credit操作0件。集中5/5、Hub 925/925、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。

---
# 0.0 RC Staging接続先identity guard（2026-08-28）

- Branch／親Project refの形式と、`PGHOST`／`PGUSER`の隔離Branch ref一致を外部E2E READY条件へ追加した。
- refだけ隔離Branchへ見せかけ、接続先が親mainのままになる設定を接続前に拒否する。
- Production、Supabase、DB、Provider、Queue、Job、Asset、credit操作0件。集中7/7、Hub 927/927、Canvas 26/26、AI 48/48、Desktop 182/182、a11y 29画面blocking violation 0、migration 74/74を含む全ローカル品質ゲート成功。
