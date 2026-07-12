# Creator Chat・ローカルAI基盤 完了条件

確認日: 2026-07-12

| # | 完了条件 | 状態 | 確認方法・補足 |
| --- | --- | --- | --- |
| 1 | Hubが正常ビルド | 完了 | TypeScript、ESLint、Next.js本番ビルド成功 |
| 2 | 既存Desktop機能 | 完了 | 既存統合テストとDesktopビルド成功 |
| 3 | AI設定画面 | 完了 | 上部「設定」から表示 |
| 4 | Ollama接続確認 | 完了 | main process経由。成功・失敗モックテスト済み |
| 5 | Ollamaモデル一覧 | 完了 | `/api/tags`取得、SQLiteキャッシュ、接続失敗時の復元 |
| 6 | Creator Chat送信 | 完了 | Ollama有効時はOllama、未設定時はMock |
| 7 | ストリーミング表示 | 完了 | NDJSONストリームとIPCイベント |
| 8 | 応答途中停止 | 完了 | AbortControllerと送信停止ボタン |
| 9 | チャット履歴SQLite保存 | 完了 | 再起動復元テスト成功 |
| 10 | ComfyUI接続確認 | 完了 | `/system_stats` |
| 11 | ワークフロー登録 | 完了 | JSONコピー、Zodマッピング検証 |
| 12 | Prompt差し込み・開始 | 完了 | マッピングによりノード入力へ反映 |
| 13 | 画像生成状態確認 | 完了 | `/history/{id}`をポーリング |
| 14 | 完了画像取得 | 完了 | `/view`モックテスト成功 |
| 15 | Project素材登録 | 完了 | 生成フォルダ保存・assets登録テスト成功 |
| 16 | ジョブ履歴 | 完了 | SQLite保存と画面表示 |
| 17 | 失敗ジョブ再実行 | 完了 | 画像ジョブ履歴から再実行 |
| 18 | 実行中キャンセル | 完了 | AbortとComfyUI `/interrupt` |
| 19 | AI未設定で起動 | 完了 | Mock fallback、外部接続なし |
| 20 | モック自動テスト | 完了 | Desktop統合テスト全15件成功 |
| 21 | Desktop TypeScript | 完了 | 成功 |
| 22 | Desktop ESLint | 完了 | 成功 |
| 23 | Desktopビルド | 完了 | Electron main・Vite成功 |
| 24 | Hub回帰検証 | 完了 | TypeScript・ESLint・ビルド成功 |
| 25 | ドキュメント | 完了 | AI設定・利用手順・状況表を追加 |
| 26 | Creator Chat対象切替 | 完了 | Chat内でProject・Episode・Pageを選択可能 |
| 27 | テンプレート複製・編集 | 完了 | 初期テンプレート保護、カスタム版の追加・編集・削除 |
| 28 | 画像生成進捗表示 | 完了 | 処理段階の進捗をSQLiteへ保存し履歴へ表示 |

## 外部環境で未確認

実際のOllamaモデル、実際のComfyUIインストール、ユーザー固有ワークフローによるE2E生成は、このPC上の外部サービス稼働状態に依存するため未確認です。HTTP互換モックでは接続、モデル取得、ストリーム、キュー、成功、失敗、タイムアウト、キャンセル、画像取得を検証しています。

## 残る改善

- クラウドプロバイダー追加時のElectron `safeStorage` 対応
- URL許可リストのより細かなネットワーク制限
