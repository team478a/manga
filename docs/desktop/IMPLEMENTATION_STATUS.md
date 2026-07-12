# Desktop基盤 完了条件チェック

確認日: 2026-07-12

| # | 完了条件 | 状態 | 確認方法・補足 |
| --- | --- | --- | --- |
| 1 | 既存Webがビルドできる | 完了 | `npm run build` 相当のNext.js本番ビルド成功 |
| 2 | DesktopがWindowsで起動 | 完了 | Electronを起動し、6秒後もプロセス継続・stderrなしを確認 |
| 3 | Supabase未設定で利用 | 完了 | DesktopはSupabase依存・環境変数なし |
| 4 | プロジェクト新規作成 | 完了 | UI、IPC、SQLite統合テスト |
| 5 | プロジェクト再オープン | 完了 | SQLite再接続統合テスト |
| 6 | EpisodeとPage作成 | 完了 | UI、IPC、SQLite実装 |
| 7 | 複数画像を素材として読込 | 完了 | ファイル選択、D&D、SHA-256重複防止 |
| 8 | 画像から連続ページ作成 | 完了 | 「全素材を連続ページ化」 |
| 9 | ページ並び替え | 完了 | 上下操作、統合テスト |
| 10 | 終了後もSQLite保存 | 完了 | WAL、再接続統合テスト、終了時close |
| 11 | 固定ユーザー名・ドライブなし | 完了 | Desktopは `app.getPath("documents")`、旧Web記載も汎用化 |
| 12 | エラーを利用者へ表示 | 完了 | IPC例外をメッセージ化しrendererで通知 |
| 13 | TypeScript型チェック | 完了 | Hub・Desktop・各packageで成功 |
| 14 | ESLint | 完了 | Hub・Desktop双方で成功 |
| 15 | Desktop/Web本番ビルド | 完了 | Electron main、Vite renderer、Next.js成功 |
| 16 | ユニット・統合テスト | 完了 | SQLite永続化、ページ順序、書き出しの3件成功 |
| 17 | ドキュメント反映 | 完了 | architecture、desktop、hub、実装状況を追加 |

## 指示範囲内で残る改善

- Undo/Redoは配置のみで未接続です。
- DesktopのPDF・画像ZIP・作品情報・販売文書き出しを実装しました。WebPは画像ZIPには含まれますが、PDFはJPG・PNGページを対象とします。
- プロジェクト一覧の代表画像表示はDB・IPCの準備までで、UI表示は未接続です。
- 複数Episodeの作成はできますが、ワークスペースでのEpisode切替は未実装です。
- インストーラー、コード署名、自動更新は未実装です。

旧Web版のローカル販売パッケージ処理は削除せず保全していますが、公開Webからローカルファイル操作を露出しないよう既定で無効化しました。開発互換確認が必要な場合のみ `MANGAI_ENABLE_LEGACY_LOCAL_TOOLS=true` を使用します。
