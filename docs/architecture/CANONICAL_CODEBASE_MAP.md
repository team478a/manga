# MANGAI Canonical Codebase Map

判定日: 2026-08-04

正本repository: `team478a/manga`

正本branch: `feature/manga-canvas-mvp`

PR-R0開始時HEAD: `6ccdfbe3a52f1c736c342e79ab0d690545e1297c`

## 1. 正本判定

実装判断、受入れ、後続refactorの基準は最新の`feature/manga-canvas-mvp`とする。
旧feature branchやOpen PRのheadを正本として扱わない。

基準commit`fe5347813cd1b20a4ed5c7e67459d52321e1d279`は現在の正本HEADの祖先である。
その後、PR #167の本番公開ルートsmokeまで正本へ統合されている。

## 2. 実装領域

| 領域 | 正本path | 責務 |
| --- | --- | --- |
| Cloud/Web routes | `src/app` | Next.js App Router。公開、認証、Dashboard、Creator、Admin、API |
| 共通Web UI | `src/components` | Header、Cloud workflow shell、共通表示部品 |
| Web domain/service | `src/lib` | Cloud AI、制作、研究、monitor、export等のserver-sideロジック |
| Supabase接続 | `src/lib/supabase` | browser/server/admin client境界 |
| Desktop | `apps/desktop` | Electron、ローカルDB、ローカルAI、Desktop UI。Cloud refactorから分離 |
| 共有型・契約 | `packages/shared` | Cloud/Desktop間の共有データ契約 |
| Project core | `packages/project-core` | project domain |
| Export core | `packages/export-core` | export domain |
| AI core | `packages/ai-core` | provider非依存AI契約と処理 |
| Canvas core | `packages/canvas-core` | 漫画Canvas、描画、export |
| DB正本 | `supabase/migrations` | forward migration 48件と`manifest.json` |
| rollback | `supabase/rollbacks` | migration対応rollback |
| canonical schema検査 | `supabase/schema.sql`, `supabase/tests` | schema、RLS、forward/rollback整合性 |
| 運用・preflight | `scripts` | migration、release、worker、Cloud受入れの安全な検査 |
| 回帰テスト | `tests` | Hub、Cloud、認証、AI、受入れ回帰 |
| 設計・運用文書 | `docs` | Cloud/Desktop設計、runbook、acceptance、handoff |

## 3. Web route境界

| route | 区分 |
| --- | --- |
| `/works`, `/login`, `/signup`, `/forgot-password`, `/update-password` | 公開・認証 |
| `/dashboard` | 利用者向け管理、制作ワークフロー、monitor、通知 |
| `/creator` | Cloud漫画制作・原稿編集 |
| `/admin` | 管理者運用、Provider、monitor、Cloud AI、更新情報 |
| `/api` | 認証済みserver API、worker、monitor、Cloud AI |
| `/sales-packages`, `/checkout` | 既存販売導線。今回のrefactor対象外 |

## 4. 現在のCloud制作正本

正本には次の一般向け縦型フローが存在する。

1. 市場分析
2. AI企画提案
3. シナリオ生成
4. ネーム・ページ構成
5. Canvas原稿編集と一般向けコマ画像生成
6. 作品管理、長編構造、制作状態
7. PDF/PNGを含む出力・保存

長編制作では、人物・画風・世界観・参照画像、部分修正、複数候補、batch、編集lock、連続性、章計画、予算、checkpoint、100ページfixtureまで正本に統合済みである。

PR #87〜#121の必要実装はPR #126へ統合済みである。旧PRを個別に追加マージしない。

## 5. 現在の検証正本

- dependency boundary: `npm run deps:check`
- Hub typecheck: `npm run typecheck:hub`
- 全体typecheck: `npm run typecheck`
- lint: `npm run lint`
- Hub regression: `npm run hub:test`
- Canvas/AI/Desktop: `npm run canvas:test`, `npm run ai:test`, `npm run desktop:test`
- migration: `npm run db:migrations:validate`
- production build: `npm run build`
- Cloud受入れ: `cloud:manga:acceptance:*`, `cloud:manga:owner-isolation:*`, `cloud:production:routes:*`

repository-only検査は実ブラウザ、実Provider、staging RLS、長編実負荷の代替ではない。

## 6. 文書正本

- 現在作業: [`docs/CURRENT_TASK.md`](../CURRENT_TASK.md)
- 最新引継ぎ: [`docs/HANDOFF_LOG.md`](../HANDOFF_LOG.md)
- Open PR: [`OPEN_PR_CLASSIFICATION_20260804.md`](OPEN_PR_CLASSIFICATION_20260804.md)
- 外部受入れ: [`EXTERNAL_ACCEPTANCE_BACKLOG.md`](EXTERNAL_ACCEPTANCE_BACKLOG.md)
- 文書整理案: [`DOCUMENT_REORGANIZATION_PROPOSAL.md`](DOCUMENT_REORGANIZATION_PROPOSAL.md)
- Cloud統合監査: [`CLOUD_MANGA_CANONICAL_INTEGRATION_AUDIT.md`](../cloud/CLOUD_MANGA_CANONICAL_INTEGRATION_AUDIT.md)

旧`CURRENT_TASK`と`HANDOFF_LOG`の全文は本PRでは変更しない。履歴保全と1,500行上限を両立する分割案を別文書に記録し、責任者承認後の文書専用PRで実施する。

## 7. 後続refactorの境界

PR-R0では構造を変更しない。`src/lib`からdomain moduleへの再配置、dependency boundaryの固定、Cloud AIや市場分析の整理は責任者承認後のPR-R1以降で行う。

各後続PRは直前PRのマージ後、最新正本から新しいbranchを作る。
