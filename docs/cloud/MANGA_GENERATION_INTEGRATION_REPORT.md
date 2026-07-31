# 一般向け漫画生成 統合レポート

更新日: 2026-07-31

## 統合方針

- 基点: `feature/manga-canvas-mvp` (`ae1279e`)
- 統合ブランチ: `agent/manga-generation-integration-v1`
- 既存の積み上げPR #87〜#90は変更・Closeせず、機能commitだけを取り込む
- 一般向けCloud漫画制作だけを対象とし、成人向け、Desktop、Stripe、Marketplaceは変更しない

## 統合した変更

| 元PR | 元commit | 内容 |
| --- | --- | --- |
| #87 | `c5e54d7` | FLUXによる一般向けコマ画像生成 |
| #87 | `56ab885` | Provider準備状態と安全な停止処理 |
| #88 | `0de4895` | 100ページ制作計画 |
| #88 | `8beacfb` | Canvas／PDF／PNGの共通レイヤー合成 |
| #88 | `be6783c` | 2〜4候補の生成・比較・採用・失敗候補再実行 |
| #88 | `6a62f6b` | 8ページ原稿チェックと書き出し検証 |
| #88 | `b5495ba` | キャラクター設定表と作品全体進捗 |
| #89 | `32b7eb1` | 編集可能で版管理されたキャラクター設定 |
| #90 | `ee3bdea` | 画風・場所・小物の版管理設定 |

旧ブランチ固有のレビュー記録commit `412ef84`、`b89f938`、`049a0f2`、`7d236a2`は統合していない。統合後のレビュー状態は本書と新しいDraft PRを正とする。

## 現在使える範囲

- ネームから一般向けコマ画像生成Jobを作成
- 1コマ2〜4候補を比較し、採用画像を背景レイヤーへ配置
- 失敗候補だけを再実行
- コマ、画像、吹き出し、文字を同一規則でCanvas・PDF・PNGへ合成
- 8ページ作品の空コマ、画像不足、解像度、文字overflowを事前確認
- キャラクター設定を保存・版管理し、対象人物の生成条件へ自動反映
- 画風・場所・小物を保存・版管理し、対象コマの生成条件へ自動反映
- 作品単位で完成・生成中・要確認・未着手を表示

## Migration

1. `202607310004_cloud_general_image_provider.sql`
2. `202607310005_cloud_character_profiles.sql`
3. `202607310006_cloud_world_bible.sql`

各migrationには対応するrollback、manifest checksum、canonical schema検査がある。

## Feature Flagと設定

- `CLOUD_PANEL_IMAGE_GENERATION_ENABLED=true`
- `MANGAI_CLOUD_IMAGE_ENABLED=true`
- `MANGAI_CLOUD_AI_WORKER_ENABLED=true`
- `MANGAI_CLOUD_AI_WORKER_SECRET`: 32文字以上
- 一般向け画像ProviderのAPI keyとmodelは `/admin/cloud-ai` からSupabase Vaultへ保存

設定不足時は画像生成を開始せず、安全な準備案内を表示する。

## 品質確認

- `npm run build:packages`: PASS
- `npm run deps:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run research:eval`: PASS
- `npm run hub:test`: PASS（312/312）
- `npm run canvas:test`: PASS（26/26）
- `npm run ai:test`: PASS（44/44）
- `npm run desktop:test`: PASS（182/182）
- `npm run db:migrations:validate`: PASS（32/32）
- `npm run build`: PASS

Migration roundtripは新しいDraft PRのGitHub Actionsで確認する。

## 残タスク

### モニター公開前

1. stagingへ上記3 migrationを順に適用
2. 管理画面で一般向け画像Providerを保存
3. Preview限定でFeature FlagとWorkerを有効化
4. 実Providerで1コマ生成し、候補比較・採用・再実行を確認
5. 8ページ作品をPDF／PNGへ出力して目視比較
6. 390px、768px、1280pxで作品画面とEditorの横overflowを確認

### 100ページ制作へ向けた次期実装

1. キャラクター・場所・小物の参照画像とコマへの明示割当
2. ページ横断の顔・衣装・色・場所の継続性評価と警告
3. 章／話単位の生成キュー、優先度、一時停止、再開
4. 長編用の一括原稿チェックと部分再生成
5. API費用見積り、上限、利用枠、障害復旧
