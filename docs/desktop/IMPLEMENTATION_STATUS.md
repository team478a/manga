# Desktop基盤 完了条件チェック

確認日: 2026-07-15

漫画編集Canvas MVPの個別33条件は [`MANGA_EDITOR_IMPLEMENTATION_STATUS.md`](MANGA_EDITOR_IMPLEMENTATION_STATUS.md) を参照してください。

| #   | 完了条件                     | 状態 | 確認方法・補足                                                                     |
| --- | ---------------------------- | ---- | ---------------------------------------------------------------------------------- |
| 1   | 既存Webがビルドできる        | 完了 | `npm run build` 相当のNext.js本番ビルド成功                                        |
| 2   | DesktopがWindowsで起動       | 完了 | Electronを起動し、6秒後もプロセス継続・stderrなしを確認                            |
| 3   | Supabase未設定で利用         | 完了 | DesktopはSupabase依存・環境変数なし                                                |
| 4   | プロジェクト新規作成         | 完了 | UI、IPC、SQLite統合テスト                                                          |
| 5   | プロジェクト再オープン       | 完了 | SQLite再接続統合テスト                                                             |
| 6   | EpisodeとPage作成            | 完了 | UI、IPC、SQLite実装                                                                |
| 7   | 複数画像を素材として読込     | 完了 | ファイル選択、D&D、SHA-256重複防止                                                 |
| 8   | 画像から連続ページ作成       | 完了 | 「全素材を連続ページ化」                                                           |
| 9   | ページ並び替え               | 完了 | 上下操作、統合テスト                                                               |
| 10  | 終了後もSQLite保存           | 完了 | WAL、再接続統合テスト、終了時close                                                 |
| 11  | 固定ユーザー名・ドライブなし | 完了 | Desktopは `app.getPath("documents")`、旧Web記載も汎用化                            |
| 12  | エラーを利用者へ表示         | 完了 | IPC例外をメッセージ化しrendererで通知                                              |
| 13  | TypeScript型チェック         | 完了 | Hub・Desktop・各packageで成功                                                      |
| 14  | ESLint                       | 完了 | Hub・Desktop双方で成功                                                             |
| 15  | Desktop/Web本番ビルド        | 完了 | Electron main、Vite renderer、Next.js成功                                          |
| 16  | ユニット・統合テスト         | 完了 | SQLite、完全複製、別ドライブ削除、AI、書き出し、端末認証、診断、更新を含む46件成功 |
| 17  | ドキュメント反映             | 完了 | architecture、desktop、hub、実装状況を追加                                         |

## 現状と残る改善

- Project単位の永続Undo/Redoと直近50件の操作履歴に対応しています。
- 素材削除は実ファイル、Page・コマ、表紙、AI生成出力参照を含めて再起動後もUndo/Redoできます。
- ComfyUI生成ジョブの監査記録を残したまま、新規生成素材の追加だけを1操作でUndo/Redoできます。
- 書き出し履歴は書き出し画面、秘密値を除外したAI設定変更履歴は設定画面で確認できます。
- PDF、画像ZIP、作品情報、販売文書き出しを実装しています。JPG・PNG・WebPを共通PageレンダラーでPDFと画像ZIPへ合成します。
- 複数Episode、代表画像、任意保存先、Creator Chat、ComfyUI画像生成に対応しています。
- 別ドライブのProject削除は同一ドライブの`.mangai-trash`へ退避し、退避失敗時はDB情報を保持します。
- Hub連携画面から、Projectに対応する公開作品と販売中商品数を秘密鍵なしで確認できます。
- Hubで端末コードと限定scopeを承認すると、自分の非公開下書きを確認し、作品名・説明だけを更新できます。
- ローカル構造化ログと同意制の詳細クラッシュレポートに対応しています。外部送信clientは別同意・手動操作で実装済みですが、現行配布版の受付先は未設定です。
- 日本語・英語locale基盤、主要shell・Project panel・Inspectorの英語表示、dialog focus管理、reduced motion、Windows forced colorsに対応しています。全画面翻訳とWCAG評価は未完了です。
- NSISインストーラー、ブランドアイコン、署名専用ビルド、自動更新、GitHub Actions配布基盤を実装しています。
- NSISのinstall、製品版renderer起動、隔離SQLite生成、uninstall E2Eと、SPDX SBOM・SHA-256検証に対応しています。
- 信頼された署名証明書、Git remote、実公開先が未設定のため、実署名と初回公開リリースは未完了です。
- 最新の全体状況と計画は [`../PROJECT_STATUS_AND_ROADMAP.md`](../PROJECT_STATUS_AND_ROADMAP.md) を参照してください。

旧Web版のローカル販売パッケージ処理は削除せず保全していますが、公開Webからローカルファイル操作を露出しないよう既定で無効化しました。開発互換確認が必要な場合のみ `MANGAI_ENABLE_LEGACY_LOCAL_TOOLS=true` を使用します。
