# PR-R4-2W 生成画像の採用品質ゲート

作成日: 2026-08-16
Branch: `codex/fix-r4-2w-generation-quality-gate`
Base: `origin/feature/manga-canvas-mvp` @ `3bd3488`（PR #279 merge commit）
Draft PR: [#280](https://github.com/team478a/manga/pull/280)

## 目的

ページ22で残った意図しない上下方向、画像内疑似文字、未配置候補を、外部契約を変えずに販売原稿の採用工程で止める。PR #279で合格した4コマ目の画像、Canvas revision 7、使用56／予約0／残44は維持し、本PR中はProduction生成を行わない。

## 監査結果

- `cloud_manga_quality_evaluations`の現行rule-based judgeはAsset有無、寸法、明示的に渡されたsemantic evidenceを判定する。画像ピクセルのOCR・天地・人体意味解析は行わない。
- FLUX.2のBFL adapterはnegative promptをProviderへ送らない。短縮クローズアップPromptにも正方向の品質条件を含める必要がある。
- 完成判定は最新候補群がCanvasへ未配置ならblockerを返すが、利用者が全候補を明示的に不採用としても解除する契約がなかった。
- 自動OCRや画像理解を実施していない状態で「自動検査済み」と表示する実装は採用しない。

## 実装

1. 短縮クローズアップのProvider JSONへ、正立、自然な重力、顔・手・関節、清潔な絵画面をまとめた短い`quality_gate`を追加する。2,000文字未満の既存上限を維持する。
2. 生成画像の配置、品質承認、修正前後比較からの採用前に、画像を拡大表示する必須確認dialogを開く。
3. 正立、画像内疑似文字等なし、人体・小物、ネームに沿う一場面の4項目をすべて確認するまで採用ボタンを無効にする。
4. 未配置候補を「追加生成なし」で明示的に不採用にできるようにする。既存の`rejected`品質イベントだけを使用し、API・DB契約は変更しない。
5. 最新候補群の全Jobが明示的に`rejected`の場合だけ未配置blockerと自動配置確認を解除する。一部候補だけが不採用ならblockerを維持し、画像のないコマは従来どおり未完成とする。

## 回帰境界

- 変更なし: URL、API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、公開・販売、成人向け境界、Desktop。
- Prompt本文、署名URL、利用者画像、APIキーをログ・文書へ記録しない。
- 本PRは既存の不良画像ピクセル自体を置換しない。merge後にページ22のコマ1・コマ3を必要最小限で再制作し、本ゲートで確認する。
- Productionの既存作品、DB、credit、公開・販売状態は本PR中に変更しない。

## 検証

- 集中: 生成Prompt、採用UI、4ページ完成判定、PNG／PDF fixture
- Hub全体: 735 tests
- Canvas: 26 tests
- AI: 48 tests
- 100ページ長編: 4 tests
- dependency／module boundary、lint、Hub typecheck
- migration: 59 migrations／rollback
- research eval、Cloud漫画repository、owner isolation
- workspace packages、Webpack production build
- Desktopローカルtypecheckは既存`@napi-rs/keyring`配布物の型宣言不足を再確認した。変更範囲外のためWindows CIを正式判定とする。
- Draft PR [#280](https://github.com/team478a/manga/pull/280)はDraft／MERGEABLE。実装・Draft PR記録HEADのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功した。
- Vercel Previewは`https://mangai-hub-staging-git-codex-fix-r4-2-fd5441-team478as-projects.vercel.app`へdeployment成功。ブラウザ直アクセスはVercel Deployment Protectionのチーム所有者承認で停止したため、アクセス要求は送信していない。認証後画面の手動確認は未実施で、4項目dialog、採用ボタン無効／有効、不採用、完成判定はHub自動テストで確認した。
- Production変更なし。Provider生成、DB、credit、Canvas、PNG／PDF、公開・販売状態を変更していない。

## 停止条件

- 最終文書同期HEADでCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの成功を再確認する。
- Deployment Protection下の認証後画面確認は責任者が必要な場合だけ行い、本PRではアクセス要求を送信しない。
- Production変更なしを確認して停止する。責任者のmerge前にProduction再生成と次工程へ進まない。
