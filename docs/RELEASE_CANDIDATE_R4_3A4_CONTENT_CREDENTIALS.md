# RELEASE CANDIDATE: PR-R4-3A-4 Content Credentials保全

作成日: 2026-08-17

状態: `IMPLEMENTED_LOCAL / PRIVATE_FIXTURE_REPAIRED / HUMAN_RIGHTS_AND_DUAL_REVIEW_REQUIRED`

## 1. 目的

Benchmark v2.1の収集、Human Review Package、正式assemblyで、Providerが原画像へ付与したC2PA Content Credentialsを失わないようにする。Prompt等の禁止PNG text metadataと、生成元証跡である`caBX`を分離して扱う。

## 2. 発見事項と復旧

- 新規生成した正式候補Batch 01のProvider原画像28/28に`caBX`が存在した。
- 最初の画像正規化で再エンコードされ、Content Credentialsが除去されていた。
- 原画像がprivate rootに残っていたため、追加Provider実行・追加課金なしで28枚を復旧した。
- Content Credentialsのない正規化画像、旧validation report、旧Reviewer ZIPはprivate quarantineへ隔離した。
- 復旧後のReviewer A/B ZIPは各28件で、`caBX`保持、checksum、blind package、private sidecar検証に成功した。

画像、Prompt、Provider Job ID、秘密値、権利資料、Reviewer回答はGitへ追加していない。

## 3. 実装契約

- private source caseとassembly itemに`required_provenance_chunks`を追加する。
- 現バージョンで許可する必須chunkはC2PAの`caBX`だけとする。
- review package generatorは入力画像の必須chunkを検査し、再エンコードせずコピーする。
- package validatorはprivate sidecarとZIP内candidateを照合し、必須chunk欠落を拒否する。
- benchmark assemblyも正式出力前に必須chunk欠落を拒否する。
- 未指定の既存fixtureは既定値`[]`で後方互換を維持する。

## 4. Private evidence

- Formal candidate: 28件、704×1024 PNG、機械検査合格
- Provider実費: 840,000 micros（承認済み上限0.84米ドル内）
- Reviewer A package: 28件、validator成功、`caBX` 28/28
- Reviewer B package: 28件、validator成功、`caBX` 28/28
- Rights review package: 28件
- 正式Benchmark採用: 0/140
- 人間の権利確認: 0/28
- 独立Human Review: 0/56

機械検査やProvider利用条件の一次監査だけで正式採用しない。人間の権利確認、Reviewer A/Bの独立回答、不一致裁定、正式assembly strict／leak gateを必須とする。

## 5. 回帰テスト

- `caBX`付きPNGからblind packageを生成し、validator成功とchunk保持を確認する。
- sourceが`caBX`を要求しているのに入力画像から欠落した場合、generatorが失敗することを確認する。
- assembly schemaが`caBX`だけを許可し、禁止text metadataを必須証跡として誤指定できないことを確認する。
- 既存のintrinsic／referential、blindness、checksum、source family split契約を維持する。

## 6. 不変境界

Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider設定、model、pricing、credit、retry、timeout、Scheduler、runtime Visual Judge、自動修復、Canvas、checkpoint、PNG／PDF出力、成人向け境界、Desktopは変更しない。

## 7. rollback

このPRをrevertすると`required_provenance_chunks`と3つのCLI検査が削除される。private原画像とquarantineはGit外にあり変更されない。古いContent Credentialsなしの派生物を正式候補へ戻してはならない。

## 8. 停止条件

Draft PR、全CI、Vercel Preview成功を確認後、責任者review待ちで停止する。権利担当とHuman Reviewerの完了前に28件を正式140件へ加算せず、PR-R4-3Bへ進まない。
