# Open PR Classification 2026-08-04

調査日: 2026-08-04

正本: `feature/manga-canvas-mvp@6ccdfbe3a52f1c736c342e79ab0d690545e1297c`

Open PR: 82件

## 判定基準

- **A 正本へ統合済み**: head commitまたは必要実装が後続統合PRを通じて正本に存在する。追加マージしない。
- **B 最新正本へ載せ替えれば利用可能**: 意図は再利用可能だが、旧stack、成人向け境界、schema競合等があり、そのままマージしない。
- **C 独立レビュー可能**: 現行正本に未統合で、比較的小さく独立して再評価できる。
- **D 廃止候補**: 後続実装で代替済み、または旧製品方針・旧stackに依存する。
- **E Dependabot**: dependency更新。互換性とCIを別途確認する。

この分類は責任者判断用であり、既存PRへの操作を許可しない。

## A. 正本へ統合済み

| PR | 判定 |
| --- | --- |
| #50, #56〜#62 | Release 1統合PR #65を通じて市場分析の必要実装を統合済み |
| #66〜#73, #80 | 一般向けモニター本番統合PR #82へ収束。各headも正本の祖先 |
| #87〜#121 | PR #94およびPR #126へ必要実装を統合済み |

### PR #87〜#121の扱い

PR #87〜#90は旧stackのhead自体を追加マージせず、PR #94/#126へ移植された実装を正本とする。
PR #95〜#121のhead commitは正本の祖先である。

**PR #87〜#121はPR #126へ必要実装が統合済みのため、今後も個別に追加マージしない。**

## B. 最新正本へ載せ替えれば利用可能

| PR | 理由・載せ替え条件 |
| --- | --- |
| #74〜#79 | 成人向け企画〜作品管理の旧stack。一般向け正本と製品境界を分け、現行権限・Provider契約へ移植する場合だけ再利用 |
| #81 | 成人向けGrok Provider。現行Provider管理、許可、監査、外部利用規約を再確認して移植 |
| #86 | 成人向けmonitor運用。一般向けmonitor正本へ直接混ぜず、成人向け限定公開設計の承認後に移植 |
| #137 | 更新通知・公開センター。現行の更新情報管理とschemaに競合するため、必要差分だけ最新正本へ移植 |
| #161 | 内部link制限の安全化は再利用可能だが、#160および現行更新情報UIとの整合を取って移植 |

## C. 独立レビュー可能

| PR | 理由 |
| --- | --- |
| #132 | Cloudアカウント管理。現行正本にrouteがなく、独立した利用者機能として要件・削除境界を再レビュー可能 |
| #136 | monitor報告導線。現行報告UIとの重複を確認した上で小さなUX差分としてレビュー可能 |
| #151 | Dashboard操作中表示。対象formごとの現行実装を照合して独立レビュー可能 |
| #160 | 利用者向け更新履歴・詳細画面。現行更新情報schemaを前提に独立レビュー可能 |

## D. 廃止候補

| PR | 理由 |
| --- | --- |
| #48〜#49 | 広範Cloud UI先行刷新。現在の縦型workflowと後続UIに置換され、旧baseも失効 |
| #51〜#55 | 初期Release 2〜6 prototype stack。後続のProvider対応・縦型統合へ置換 |
| #63〜#64 | 旧proposal quality/evaluation stack。現行proposal生成・評価契約と分岐 |
| #122 | signup処理中表示は後続の認証操作feedbackで代替済み |

廃止は本PRでは実行しない。Closeは責任者の明示判断後に別作業で行う。

## E. Dependabot

| PR | 対象 |
| --- | --- |
| #4 | `@supabase/ssr` |
| #5 | Desktop React |
| #7 | Desktop `cross-env` |
| #8 | `better-sqlite3` |
| #9 | Desktop ESLint |
| #10 | root `@types/node` |
| #11 | Desktop `@types/node` |
| #12 | root ESLint |
| #13 | Desktop `wait-on` |
| #147 | `react-dom` / `@types/react-dom` |

major更新を含むため一括マージしない。Cloud/Desktopを分け、lockfile、Node対応範囲、native module、全CIを個別確認する。

## 件数照合

| 分類 | 件数 |
| --- | ---: |
| A | 48 |
| B | 10 |
| C | 4 |
| D | 10 |
| E | 10 |
| 合計 | 82 |

## 責任者判断

1. AをClose候補として扱うか（本PRではCloseしない）
2. Bの成人向けstackを将来の別正本へ移植するか
3. Cの優先順位と受入れ条件
4. Dを廃止してよいか
5. EをCloud/Desktop別のdependency更新PRへ再編するか
