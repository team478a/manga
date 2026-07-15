# Desktop基盤 完了条件チェック

確認日: 2026-07-14

漫画編集Canvas MVPの個別33条件は [`MANGA_EDITOR_IMPLEMENTATION_STATUS.md`](MANGA_EDITOR_IMPLEMENTATION_STATUS.md) を参照してください。

| #   | 完了条件                     | 状態 | 確認方法・補足                                                                   |
| --- | ---------------------------- | ---- | -------------------------------------------------------------------------------- |
| 1   | 既存Webがビルドできる        | 完了 | `npm run build` 相当のNext.js本番ビルド成功                                      |
| 2   | DesktopがWindowsで起動       | 完了 | Electronを起動し、6秒後もプロセス継続・stderrなしを確認                          |
| 3   | Supabase未設定で利用         | 完了 | DesktopはSupabase依存・環境変数なし                                              |
| 4   | プロジェクト新規作成         | 完了 | UI、IPC、SQLite統合テスト                                                        |
| 5   | プロジェクト再オープン       | 完了 | SQLite再接続統合テスト                                                           |
| 6   | EpisodeとPage作成            | 完了 | UI、IPC、SQLite実装                                                              |
| 7   | 複数画像を素材として読込     | 完了 | ファイル選択、D&D、SHA-256重複防止                                               |
| 8   | 画像から連続ページ作成       | 完了 | 「全素材を連続ページ化」                                                         |
| 9   | ページ並び替え               | 完了 | 上下操作、統合テスト                                                             |
| 10  | 終了後もSQLite保存           | 完了 | WAL、再接続統合テスト、終了時close                                               |
| 11  | 固定ユーザー名・ドライブなし | 完了 | Desktopは `app.getPath("documents")`、旧Web記載も汎用化                          |
| 12  | エラーを利用者へ表示         | 完了 | IPC例外をメッセージ化しrendererで通知                                            |
| 13  | TypeScript型チェック         | 完了 | Hub・Desktop・各packageで成功                                                    |
| 14  | ESLint                       | 完了 | Hub・Desktop双方で成功                                                           |
| 15  | Desktop/Web本番ビルド        | 完了 | Electron main、Vite renderer、Next.js成功                                        |
| 16  | ユニット・統合テスト         | 完了 | SQLite、完全複製、AI、書き出し、端末認証、診断ログ、更新チャンネルを含む36件成功 |
| 17  | ドキュメント反映             | 完了 | architecture、desktop、hub、実装状況を追加                                       |

## 現状と残る改善

- Project単位の永続Undo/Redoと直近50件の操作履歴に対応しています。
- PDF、画像ZIP、作品情報、販売文書き出しを実装しています。WebPは画像ZIPには含まれますが、PDFは現在JPG・PNGページが対象です。
- 複数Episode、代表画像、任意保存先、Creator Chat、ComfyUI画像生成に対応しています。
- Hub連携画面から、Projectに対応する公開作品と販売中商品数を秘密鍵なしで確認できます。
- Hubで端末コードを承認すると、自分の非公開下書きも読み取り専用で確認できます。
- ローカル構造化ログと同意制の詳細クラッシュレポートに対応しています。外部送信はありません。
- NSISインストーラー、ブランドアイコン、署名専用ビルド、自動更新、GitHub Actions配布基盤を実装しています。
- 信頼された署名証明書、Git remote、実公開先が未設定のため、実署名と初回公開リリースは未完了です。
- 最新の全体状況と計画は [`../PROJECT_STATUS_AND_ROADMAP.md`](../PROJECT_STATUS_AND_ROADMAP.md) を参照してください。

旧Web版のローカル販売パッケージ処理は削除せず保全していますが、公開Webからローカルファイル操作を露出しないよう既定で無効化しました。開発互換確認が必要な場合のみ `MANGAI_ENABLE_LEGACY_LOCAL_TOOLS=true` を使用します。
