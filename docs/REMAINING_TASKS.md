# MANGAI 残タスク一覧

確認日: 2026-07-18

対象ブランチ: `feature/manga-canvas-mvp`

基準コミット: Dezgo dispatcher `1909117`以降

## 1. 現在の判定

一般漫画をCloud、成人向け漫画をDesktopで扱う製品分離後の不足機能と実装順は[`PRODUCT_DEVELOPMENT_PLAN_CLOUD_DESKTOP.md`](PRODUCT_DEVELOPMENT_PLAN_CLOUD_DESKTOP.md)へ整理しました。Phase 0の製品境界、Phase 1のCloud保存基盤、Phase 2のCloud Creator Editor MVPまで完了しました。次の開発対象はPhase 3の一般向けCloud AIです。

各Phaseの実装範囲・検証証跡は[`PHASE0_PRODUCT_BOUNDARY_COMPLETION.md`](PHASE0_PRODUCT_BOUNDARY_COMPLETION.md)、[`PHASE1_CLOUD_CREATOR_FOUNDATION_COMPLETION.md`](PHASE1_CLOUD_CREATOR_FOUNDATION_COMPLETION.md)、[`PHASE2_CLOUD_CREATOR_EDITOR_COMPLETION.md`](PHASE2_CLOUD_CREATOR_EDITOR_COMPLETION.md)を参照してください。

HubとDesktopの主要機能、ローカル品質ゲート、Windowsインストール・製品版起動・アンインストールE2E、SBOM・checksum生成、実Dドライブを使ったProject削除・ゴミ箱E2Eまでは完了しています。残作業の中心は外部サービスを使うRC受入れ、コード署名、初回公開です。

RC受入れ結果は`desktop/RC_ACCEPTANCE_STATUS.json`へ構造化して記録し、`npm run rc:acceptance`でschemaと証拠必須項目、`npm run rc:acceptance:strict`で未完了・blockedの有無を機械判定できるようにしました。通常preflightにも集計を表示します。

2026-07-15に製品方針を低スペック対応・ハイブリッド生成へ変更しました。既存機能を維持し、Generation Router、外部送信ポリシー、背景Provider、レイヤー分離、低スペックRuntime Profileを段階追加します。調査結果と実装順は[`desktop/HYBRID_GENERATION_PHASE1_AUDIT.md`](desktop/HYBRID_GENERATION_PHASE1_AUDIT.md)を参照してください。

## 2. RC公開を止めるタスク

| 優先 | タスク                 | 完了条件                                                 | 前提                           |
| ---- | ---------------------- | -------------------------------------------------------- | ------------------------------ |
| P0   | Windows実署名          | installerと製品EXEのAuthenticodeが`Valid`                | 信頼されたコード署名証明書     |
| P0   | GitHub公開基盤         | remote設定、署名Secrets登録、Draft Release作成           | GitHubリポジトリ               |
| P0   | 署名付き自動更新E2E    | 旧版から新版へ更新し、作品データを保持                   | 署名済み2version、公開更新URL  |
| P0   | クリーンWindows受入れ  | install、起動、書き出し、更新、uninstallを新規環境で完走 | Windows VMまたは新規PC         |
| P0   | Ollama実環境E2E        | 接続、モデル取得、Chat、停止、履歴復元                   | Ollamaと対象モデル             |
| P0   | ComfyUI実環境E2E       | workflow、生成、キャンセル、素材登録                     | ComfyUI、モデル、workflow JSON |
| P0   | Dezgo Phase 1実API E2E | 非成人向けsafe素材10枚、費用・速度・秘密値非露出を記録   | BYOK key、利用者の課金承認     |
| P0   | Supabase staging試験   | migration適用、読み取り専用preflight、rollback確認       | staging DBと`psql`             |
| P0   | Desktop端末認証E2E     | 承認、複数端末、期限切れ、失効後拒否                     | staging Hub・Supabase          |
| P0   | StripeテストE2E        | 成功、失敗、返金、改ざん拒否、期限付きdownload           | Stripe test・Webhook           |
| P0   | Hub公開前確認          | Vercel/Supabase/Stripe環境で主要導線を完走               | staging合格後の公開設定        |

必要な設定値は`npm run rc:preflight`で値を表示せず確認できます。全項目を必須として判定する場合は`npm run rc:preflight:strict`を使用します。

## 3. 外部準備なしで進められる改善

| 優先 | タスク                       | 現在の制限                                                                      |
| ---- | ---------------------------- | ------------------------------------------------------------------------------- |
| P0   | ハイブリッド生成Phase 1基盤  | Router・ポリシー・ローカル実行・Asset Library・safe Job handoffまで完了         |
| P1   | 外部背景Provider接続         | Dezgoのcredential・見積・承認・直列dispatcher・費用確定まで完了。実API E2E待ち  |
| P1   | Dezgo成人向けPhase 2         | 署名取込・失効時Job停止まで完了。本番鍵・実承認・専用dispatcher・画像分類待ち   |
| P1   | Panelレイヤー分離・合成      | 永続化、直接変形、mask、correction透明パッチ、互換cacheまで完了                 |
| P2   | 低スペックRuntime Profile    | ComfyUI実行環境診断まで完了。実workflowによる8GB画像生成E2Eが残る               |
| P2   | 英語化の全画面展開・WCAG評価 | 日英29状態のaxe違反0件。Narrator受入れ表作成済み。Windows実機での手動完走が残る |

## 4. 外部受付基盤の準備後に進める改善

| 優先 | タスク                    | 現在の状態                                                        |
| ---- | ------------------------- | ----------------------------------------------------------------- |
| P1   | クラッシュレポート受付API | Desktop送信client・別同意・手動再送は完成。受付先と運用方針が未定 |

## 5. Hub成長機能

- 購入者アカウント、購入履歴、期限切れ後の再ダウンロード
- 購入完了・グッズ申請更新などのメール通知
- 公開クリエイタープロフィール
- 管理者による作品・商品・ユーザーの削除・停止
- Stripe Connectによる自動分配・振込
- 部分返金の金額管理と返金開始画面
- 印刷会社API、配送、在庫連携
- 外部AI APIを使った販売文生成

これらは初回RCを止める条件ではなく、公開後のPhase 4候補です。

## 6. 推奨実行順

1. コード署名証明書の取得とGitHubリポジトリ準備を並行開始
2. Supabase stagingへmigrationを適用し、端末認証を確認
3. Stripeテスト決済・失敗・返金・download E2E
4. 実Ollama・ComfyUI E2Eと、利用者承認後のDezgo非成人向け10枚試験
5. 署名済みDraft Release作成
6. クリーンWindowsで旧版から新版への更新を含む最終受入れ
7. Hub公開環境を設定し、RC判定記録を確定

詳細な手順は[`desktop/RELEASE_CANDIDATE_ACCEPTANCE.md`](desktop/RELEASE_CANDIDATE_ACCEPTANCE.md)を参照してください。
