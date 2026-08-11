# PR-R4-1n Production所有者分離 受入れ証跡

## 結論

Productionの実データを変更しない読み取り専用transactionで、2人の一般ユーザーをauthenticated roleとJWT claimで再現した。市場分析Reportは双方向に本人1件・相手0件、一般向け非公開Cloud作品は所有者1件・相手0件となり、一般ユーザー間の主要なowner isolationは成功した。

既存の非公開Cloud作品に紐づく生成Job、生成Asset、`cloud-assets` Storage objectも、既存所有側1件・一般ユーザー側0件を確認した。ただし対象成果物の既存所有者はadminであり、一般ユーザー所有の生成成果物はProductionに存在しなかった。`cloud_export_jobs`と`cloud-exports` objectも0件だったため、一般ユーザー所有の生成成果物と署名付き書き出しURLは未実施のまま成功扱いにしない。

## 基準と範囲

- Base: `origin/feature/manga-canvas-mvp` / `ff9e0d5`（PR #231 merge commit）
- Branch: `codex/release-r4-1n-owner-isolation`
- Draft PR: [#232](https://github.com/team478a/manga/pull/232)
- Vercel Preview: https://mangai-hub-staging-git-codex-release-0fef78-team478as-projects.vercel.app
- 確認日: 2026-08-12（Asia/Tokyo）
- 環境: Production Supabase `main`
- 操作: aggregate inventory、authenticated role、JWT claim切替、RLS select
- transaction: `BEGIN TRANSACTION READ ONLY`から開始し、結果取得後に`ROLLBACK`
- 対象外: application code、DB schema、migration、RPC、Storage object、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas、PDF／PNG、成人向け境界、Stripe、Desktop

利用者のUUID、メールアドレス、表示名、Report本文、Prompt、Storage path、署名情報は取得結果と文書へ残していない。

## Production実データ inventory

個人を識別しない件数だけをpostgres roleで確認した。

| 対象 | 件数 | 所有者数 |
|---|---:|---:|
| Profile | 12 | - |
| 非admin Profile | 11 | - |
| 一般向け市場分析Report | 12 | 4 |
| 削除されていない一般向け非公開Cloud作品 | 4 | 2 |
| 生成Job | 5 | 1 |
| 削除されていない生成Asset | 2 | 1 |
| `cloud-assets` object | 2 | - |
| 非公開`works` row | 0 | 0 |
| Cloud書き出しJob | 0 | 0 |
| `cloud-exports` object | 0 | - |

非admin所有者は、市場分析Reportが4人、非公開Cloud作品が1人だった。生成Jobと生成Assetの既存所有者はadminだけだった。

## 2一般ユーザーRLS結果

一般ユーザーAは、一般向け市場分析Reportと一般向け非公開Cloud作品を両方持つ非admin Profileから選択した。一般ユーザーBは、別の一般向け市場分析Reportを持ち、Aの作品の承認済み共同編集者ではない非admin Profileから選択した。

| 検査 | A | B | 判定 |
|---|---:|---:|---|
| `current_profile_id()`がclaim本人を解決 | true | true | PASS |
| Aの非公開Cloud作品 | 1 | 0 | PASS |
| Aの市場分析Report | 1 | 0 | PASS |
| Bの市場分析Report | 0 | 1 | PASS |

2つのuser claimは異なり、transactionはread onlyだった。内部集約判定`existing_contracts_pass`は`true`となった。

## 生成成果物とStorage

Productionに一般ユーザー所有の生成成果物がないため、既存の非公開Cloud作品に紐づくadmin所有成果物を所有側、一般ユーザーBを第三者側として確認した。

| 対象 | 既存所有側 | 一般ユーザーB | 判定 |
|---|---:|---:|---|
| 非公開Cloud作品 | 1 | 0 | PASS |
| 生成Job | 1 | 0 | PASS |
| 生成Asset | 1 | 0 | PASS |
| `cloud-assets` Storage object | 1 | 0 | PASS |

この結果は第三者の非公開成果物参照をRLSが遮断することを示す。所有側はadmin権限でも参照可能なため、一般ユーザー所有側の実受入れを代替しない。

## 未実施と残件

- Productionに非公開`works` rowがないため、marketplace `works` tableの実データ分離は未実施。
- 一般ユーザー所有の生成Job、生成Asset、Storage objectがないため、その所有側参照は未実施。
- Cloud書き出しJobと`cloud-exports` objectが0件のため、署名付きPDF／PNG URLの所有者・第三者比較は未実施。
- URLへの直接アクセス、Job cancel、共同編集者の許可経路は今回操作していない。
- 対象モニター本人の市場分析ブラウザE2Eは、PR-R4-1mの責任者判断どおり非blocking保留であり、passedには変更しない。

既存行がない項目を補うためにProductionデータを作成せず、AIネーム由来8ページE2Eまたは別の明示承認済み受入れで成果物が揃った時点に、一般ユーザー所有の生成成果物と書き出しURLを再確認する。

## データ不変

- transactionはread onlyで、最後に`ROLLBACK`した。
- table、function、policy、role、claim、Storage objectを永続変更していない。
- Provider呼出し、Job enqueue／cancel、Asset作成、署名URL発行、credit消費、費用発生はない。
- 市場分析、作品、書き出し、注文を作成・更新・削除していない。

## 自動検証

- `npm run cloud:manga:owner-isolation`: 7/7 PASS
- `npm run rc:acceptance`: 2 passed、11 pending、2 blocked。未完了状態を維持してschema PASS
- full `npm run rc:validate`: PASS
  - Desktop typecheck／lint、182/182 tests、renderer production build
  - dependency boundary、Hub typecheck／lint、research eval、Hub 632/632 tests
  - Canvas 26/26、AI 48/48、Hub production build
  - Supabase migration 52/52
- `git diff --check`: PASS
- Draft PRのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments: PASS

クリーンworktreeの初回検査はroot依存関係がなく`build:packages`開始前に停止し、root導入後の`rc:validate`初回はDesktop専用依存関係がなく型検査開始時に停止した。rootとDesktopへそれぞれlockfileどおり`npm ci`を実行し、共有package生成後に同じfull `rc:validate`を再実行して終了コード0を確認した。製品コードの修正は行っていない。

## ロールバック

Production操作はread only transaction内で完了しており、実データrollbackは不要。本PRは証跡と台帳だけを変更するため、commitをrevertすれば記録だけが戻る。
