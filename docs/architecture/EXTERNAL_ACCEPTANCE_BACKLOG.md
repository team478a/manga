# External Acceptance Backlog

更新日: 2026-08-04

## 目的

repository-only検査では完了できない、credential、staging/Production、実ブラウザ、複数利用者、実Provider、責任者判断が必要な受入れを一元管理する。

この一覧の存在は本番変更の許可を意味しない。

## P0 一般向け限定公開

| ID | 受入れ | 必要な外部条件 | 合格条件 | 状態 |
| --- | --- | --- | --- | --- |
| EXT-001 | 認証済み縦型E2E | Production相当Supabase、一般monitor user | 市場分析→企画→シナリオ→ネーム→原稿保存が同一userで完走 | 未実施 |
| EXT-002 | 2ユーザーRLS | staging service role、異なる2 user | Project、素材、生成、export、checkpoint、feedbackを相互参照・更新不可 | 自動検査あり、staging実施待ち |
| EXT-003 | 一般画像Provider | BFL credential、少額有料実行 | 1コマ生成、2〜4候補、採用、再生成、復元、秘密値非露出 | 未実施 |
| EXT-004 | Worker/Scheduler | Vercel/worker secret、管理者 | enqueue→claim→complete、失敗再試行、heartbeat/停止検知が成立 | 未実施 |
| EXT-005 | 8ページ実ブラウザ | Desktop browser、test project | 編集、保存、再読込、候補採用、PDF/PNG一致 | 未実施 |
| EXT-006 | responsive | 390px、768px、1280px | 主要workflowとAdminで横overflowなく主要操作可能 | 未実施 |
| EXT-007 | monitor招待 | Resend、Production origin | 招待、メール確認、初回login、開始、feedback送信が完走 | 部分実施、再確認待ち |
| EXT-008 | owner go/no-go | 責任者 | readiness、停止手順、除外範囲を承認 | 未承認 |

## P1 長編漫画制作

| ID | 受入れ | 必要な外部条件 | 合格条件 | 状態 |
| --- | --- | --- | --- | --- |
| EXT-101 | 32ページbatch | 実Project、Provider、Worker | batch作成、部分失敗、再実行、lock、状態同期が成立 | fixtureのみ |
| EXT-102 | 連続性・章計画 | 実シナリオ・編集者 | fact/thread/章計画が再表示され、矛盾修正workflowが成立 | 実データ待ち |
| EXT-103 | checkpoint復元drill | staging DB/Storage | checkpoint、差分確認、復元、再読込が一致 | repository検査のみ |
| EXT-104 | 100ページ負荷 | 実ブラウザ、DB、Storage、Worker | navigation、保存、thumbnail、PDF、再開が許容時間・容量内 | 決定的fixtureのみ |
| EXT-105 | budget/storage fail closed | staging quota設定 | 超過前警告、生成拒否、cleanup、監査が設計どおり | 未実施 |
| EXT-106 | PDF/PNG目視 | 日本語font、実画像 | コマ、画像、吹き出し、縦横文字、改ページが崩れない | 未実施 |

## P2 運用・障害対応

| ID | 受入れ | 必要な外部条件 | 合格条件 | 状態 |
| --- | --- | --- | --- | --- |
| EXT-201 | Provider障害 | test credential、意図的失敗 | 利用者へ内部情報を出さず再試行可能 | 未実施 |
| EXT-202 | DB/Storage障害 | staging | safe error、操作非消失、復旧後再開 | 未実施 |
| EXT-203 | monitor issue運用 | monitor/admin | 添付、受付通知、状態通知、task claim/completeが完走 | 部分実施 |
| EXT-204 | rollback rehearsal | staging | migration/flag/deploy rollback手順を再現 | 未実施 |
| EXT-205 | Production route smoke | Production URL | 公開・認証route 9/9が安全な応答 | 2026-08-04 PASS |

## 成人向け・Desktop

成人向けは一般向け限定公開の受入れと混ぜない。将来再開時は、年齢確認、規約同意、個別許可、DB kill switch、Provider利用規約、監査、画像Provider境界を別acceptanceとして作る。

DesktopはWindows実機、installer、GPU/低spec、local LLM、update/signingの外部受入れが必要であり、Cloud PR-R0の完了条件には含めない。

## 実施順

1. EXT-001、EXT-002でdata isolationと縦型保存を確認
2. EXT-003、EXT-004で最小の有料生成を確認
3. EXT-005、EXT-006、EXT-007でmonitor UXを確認
4. EXT-008で限定公開判断
5. P1長編受入れを小規模から100ページへ拡大

## 証跡

各受入れは実施日時、environment、対象commit、tester、結果、秘密値を含まないscreenshot/log、rollback要否を記録する。credential本体や利用者の機密データを文書へ保存しない。
