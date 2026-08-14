# PR-R4-2C ページ完成判定・原稿プレビュー リリース候補

## 状態

- 状態: `READY_FOR_OWNER_REVIEW`
- Branch: `codex/feat-r4-2c-page-completion`
- Base: `ef5333071359a59a32678185f515194234ce1b51`（PR #257 merge commit）
- Implementation commit: `69634f0afb50a1eba5b8b93482d56c9e1e4c7d03`
- Draft PR: [#258](https://github.com/team478a/manga/pull/258)
- Vercel Preview: https://mangai-hub-staging-git-codex-feat-r4-859121-team478as-projects.vercel.app
- 対象: PR-R4-2Cのみ。PR-R4-2Dは未着手。

## 実装前に確認した契約

1. PR #257: 採用Storyboardの構造化dialogueを、画像自動採用完了後にCanvasのballoon／textObjectへ配置し、同一revisionのsnapshotとして保存する。
2. Canvas schema: `packages/canvas-core/src/types.ts`と`validation.ts`の既存`PageCanvas`（panels、panelLayers、balloons、textObjects）を正本とし、schemaは変更しない。
3. 保存契約: `save_cloud_page_snapshot`系RPCは`cloud_pages.revision`を進め、同じrevisionの`cloud_canvas_snapshots(page_id, revision)`を保存する。完成判定は最新page revisionと最新保存snapshot revisionの一致を要求する。
4. 必須dialogue: 採用済み`cloud_story_storyboard_projects.storyboard_version_id`が指す`cloud_story_storyboard_versions.result.pages[].panels[].dialogue[]`だけを本文の正本とする。自由文章やProvider出力から推測しない。正本を取得・検証できない場合はfail-closedにする。
5. PNG: `src/lib/cloud-canvas-svg.ts`と`src/lib/cloud-canvas-render.ts`の共通レンダラーを再利用する。Asset IDからowner RLS下のDB行を確認し、private Storageから直接取得してbyte sizeとSHA-256を検証する。
6. PDF: `@mangai/export-core`と既存durable exportを再利用し、新しいPDFレンダラーは追加しない。
7. checkpoint: `createCloudProjectCheckpoint`の`kind=release`入口へ共通completion guardを追加する。
8. 制作状態: 既存値`not_started`、`generating`、`review_required`、`revision_required`、`finalized`を維持する。新しいDB状態は追加せず、`incomplete`／`generating`／`review_required`／`complete`をapplicationの派生状態として扱う。

## 変更概要

- 純粋な`evaluateMangaPageCompletion`と作品集計を追加した。
- 最新保存Canvas、page revision、必須dialogue、対象ページの最新画像生成操作、配置台帳、Asset実体、PNG結果からサーバー側で完成状態を再計算する。
- ページ確定、release checkpoint、完成版PDF作成の入口へ共通completion guardを追加した。
- `/creator/[projectId]/preview`へ保存済み原稿のページ送り、一覧、50〜200%拡大縮小、幅フィット、モバイル表示、未完成警告、再試行、PNG取得を追加した。
- 原稿編集画面へ画像・セリフ・Job・revision・PNG・blockerのページ完成状況を追加した。
- 4ページfixtureから実PNG 4枚とPDFを生成し、Canvas／PNG／PDFの順序と寸法を検証した。

## Source of truthとblocker

完成判定の正本は、RLSで取得した最新保存snapshotとpage revision、採用Storyboardの構造化dialogue、ページ／コマへ関連付いた最新画像生成操作、project内の非削除Asset IDとStorage実体、配置台帳、実PNGレンダリング結果である。React state、署名URL、Job完了率、credit消費数は正本にしない。

blockerは次の11種を固定した。

- `PANEL_IMAGE_MISSING`
- `IMAGE_JOB_PENDING`
- `IMAGE_JOB_FAILED`
- `DIALOGUE_MISSING`
- `BALLOON_TEXT_EMPTY`
- `CANVAS_NOT_SAVED`
- `REVISION_CONFLICT`
- `ASSET_UNAVAILABLE`
- `PNG_RENDER_FAILED`
- `PAGE_DIMENSION_INVALID`
- `MANUAL_REVIEW_REQUIRED`

pendingが1件でもあれば`generating`、技術blockerがあれば`incomplete`、手動確認だけが残れば`review_required`、blocker 0件だけを`complete`とする。複数blockerは省略せず返す。

## 境界への影響

- DB／migration／RPC: 変更なし。
- Canvas schema／保存形式: 変更なし。
- API: 認証済みowner専用のprivate `GET /api/creator/projects/[projectId]/pages/[pageId]/preview`を追加。既存APIは変更しない。
- RLS／owner isolation: `cloudCreatorContext`と既存workspace owner境界を通し、project scope、soft delete、Assetのproject所属を再確認する。service role、公開URL、他owner Assetは使用しない。
- Storage: bucket、path、policyを変更しない。既存private Assetを読み取り、サイズ・hash不一致は利用不能とする。
- PNG／PDF: 既存共通レンダラーとdurable PDF基盤を再利用し、既存出力契約を変更しない。
- Provider／model／pricing／credit／retry／timeout／Scheduler／Feature Flag／成人向け境界／Desktop: 変更なし。

## 4ページfixture検証

- 4ページ、各800×1200 px、各2コマ・画像2件・必須dialogue 2件。
- 完成ページ: 4/4、作品完成率100%。
- 空白コマ、空白吹き出し、未配置dialogue、pending／failed Job、revision競合、Asset失敗、重複画像、重複dialogue: 0。
- PNG: 4/4生成成功、各800×1200 px、ページ全体・画像・吹き出し・縦書き本文を確認。
- PDF: 4ページ、118,236 bytes、各192×288 pt（800×1200 pxを300 dpi換算）。Popplerで全ページを再描画し、順序、欠落0、重複0、縦長切れ0、PNGとの一致を目視確認。

SHA-256:

- `001.png`: `ca4674b794a7b406a4c808a1edb5c314c4eac6088d8a0bcc749ed0b0771b7032`
- `002.png`: `9a74aabfe213eddeaa4263af29dff023bd41aebdb10ed5793e9037e9fb93af96`
- `003.png`: `6362ed59521fb91f243daafae1e1bd93d273918c0243c999b124434519d4f857`
- `004.png`: `f9ac8126d24c41a919f19a783a9b7ab88f1e0545ed20ff4a2a593c3bfbfc60e8`
- `four-page-manuscript.pdf`: `20c14fe2913da4af04d6481ad677baf28f85a66a02abd7d3c7d4edff56f91fd1`
- preview evidence: `ed502aff6aed007f5b3571de7ec0ef62639334bf5f402c2777396e2b960ea8d8`

証跡: [4ページ原稿プレビュー](evidence/R4_2C_FOUR_PAGE_PREVIEW.png)

## テスト

- Unit／integration fixture: 10/10成功。全blocker、複数blocker、状態優先順位、別ページJob除外、非表示画像／テキスト、画像未配置、重複Asset、4ページ集計を確認。
- PNG／PDF integration: 実共通PNG rendererと`@mangai/export-core`で4ページを生成し、寸法・順番・ページ数を確認。
- Preview／guard regression: owner RLS、保存snapshot、private Storage、`object-contain`、モバイル一覧、keyboard／aria、確定／checkpoint／PDFのserver guardを確認。
- 全品質ゲート: 集中10/10、Hub 702/702（並列高負荷時の一過性1件を単独再実行して成功）、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violations 0、deps、lint、Hub／Desktop typecheck、migration 58/58、research eval、Webpack Hub build、Desktop build、RC structure preflight、diff check成功。
- 通常のTurbopack Hub buildだけは、既知のWindows長パス上限で既存Storyboard routeの生成先が260文字を超えて停止した。同一sourceのWebpack buildはroute追加を含め成功し、VercelのLinux buildを正式なPreview gateとして確認する。
- CI: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsの5/5成功。Draft／MERGEABLE。
- Preview確認: ChromeでVercel Deployment Protectionを通過し、Preview上のMANGAIログイン画面への到達と未認証redirectを確認した。Preview domainにアプリ認証cookieはなく、既存作品／DBを操作していない。原稿4ページの実描画、ページ順、PNG、PDFは専用fixture証跡で確認した。

## Rollback

1. 本PRのcommitを通常のrevert PRで戻す。
2. 新規preview route／UI、completion application／domain、3入口のguardを同時に戻す。
3. DB、migration、RPC、Storage、Canvas snapshot、既存PNG／PDF成果物は本PRで変更しないため、データrollbackは不要。
4. 既存のpage finalize、release checkpoint、durable PDF入口は従来のmanuscript preflightだけへ戻る。

## Production変更なし

- Production DB、migration、Storage、環境変数、管理設定を変更していない。
- Productionの既存32ページ作品を開く、編集する、再生成する、確定する、exportする操作を行っていない。
- 外部Providerを呼び出しておらず、課金、credit予約、生成Jobを発生させていない。
- 検証はローカルfixtureとPreview環境だけで行う。

## 未解決事項と停止位置

- RC preflightの外部Secret／manual acceptanceはローカルに本番Secretを置かない既存方針どおりpendingであり、本PRのfixture受入れとは分離する。
- PR-R4-2Dは未着手。PR-R4-2Cの責任者確認前には進めない。
