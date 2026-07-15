# MANGAI 残タスク一覧

確認日: 2026-07-15

対象ブランチ: `feature/manga-canvas-mvp`

基準コミット: `994cd20`

## 1. 現在の判定

HubとDesktopの主要機能、ローカル品質ゲート、Windowsインストール・製品版起動・アンインストールE2E、SBOM・checksum生成、実Dドライブを使ったProject削除・ゴミ箱E2Eまでは完了しています。残作業の中心は外部サービスを使うRC受入れ、コード署名、初回公開です。

2026-07-15に製品方針を低スペック対応・ハイブリッド生成へ変更しました。既存機能を維持し、Generation Router、外部送信ポリシー、背景Provider、レイヤー分離、低スペックRuntime Profileを段階追加します。調査結果と実装順は[`desktop/HYBRID_GENERATION_PHASE1_AUDIT.md`](desktop/HYBRID_GENERATION_PHASE1_AUDIT.md)を参照してください。

## 2. RC公開を止めるタスク

| 優先 | タスク                | 完了条件                                                 | 前提                           |
| ---- | --------------------- | -------------------------------------------------------- | ------------------------------ |
| P0   | Windows実署名         | installerと製品EXEのAuthenticodeが`Valid`                | 信頼されたコード署名証明書     |
| P0   | GitHub公開基盤        | remote設定、署名Secrets登録、Draft Release作成           | GitHubリポジトリ               |
| P0   | 署名付き自動更新E2E   | 旧版から新版へ更新し、作品データを保持                   | 署名済み2version、公開更新URL  |
| P0   | クリーンWindows受入れ | install、起動、書き出し、更新、uninstallを新規環境で完走 | Windows VMまたは新規PC         |
| P0   | Ollama実環境E2E       | 接続、モデル取得、Chat、停止、履歴復元                   | Ollamaと対象モデル             |
| P0   | ComfyUI実環境E2E      | workflow、生成、キャンセル、素材登録                     | ComfyUI、モデル、workflow JSON |
| P0   | Supabase staging試験  | migration適用、読み取り専用preflight、rollback確認       | staging DBと`psql`             |
| P0   | Desktop端末認証E2E    | 承認、複数端末、期限切れ、失効後拒否                     | staging Hub・Supabase          |
| P0   | StripeテストE2E       | 成功、失敗、返金、改ざん拒否、期限付きdownload           | Stripe test・Webhook           |
| P0   | Hub公開前確認         | Vercel/Supabase/Stripe環境で主要導線を完走               | staging合格後の公開設定        |

必要な設定値は`npm run rc:preflight`で値を表示せず確認できます。全項目を必須として判定する場合は`npm run rc:preflight:strict`を使用します。

## 3. 外部準備なしで進められる改善

| 優先 | タスク                         | 現在の制限                                      |
| ---- | ------------------------------ | ----------------------------------------------- |
| P0   | ハイブリッド生成Phase 1基盤    | 純粋Router・作品別外部送信ポリシー永続化は完了。route判定履歴とshadow routingが未実装 |
| P1   | 背景Asset Library              | 生成素材は保存済みだが背景分類・検索・再利用導線がない |
| P2   | 英語化の全画面展開・WCAG評価   | 漫画編集workspace・Creator Chat・画像生成英語化完了。Hub・設定詳細とWCAG評価が残る |

## 4. 外部受付基盤の準備後に進める改善

| 優先 | タスク                     | 現在の状態                                                       |
| ---- | -------------------------- | ---------------------------------------------------------------- |
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
4. 実Ollama・ComfyUI E2Eと対応version記録
5. 署名済みDraft Release作成
6. クリーンWindowsで旧版から新版への更新を含む最終受入れ
7. Hub公開環境を設定し、RC判定記録を確定

詳細な手順は[`desktop/RELEASE_CANDIDATE_ACCEPTANCE.md`](desktop/RELEASE_CANDIDATE_ACCEPTANCE.md)を参照してください。
