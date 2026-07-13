# 漫画編集Canvas MVP 完了条件チェック

確認日: 2026-07-13

総合判定: **一部完了**

以下の33項目は広義な機能・自動検証・ビルド条件として完了しています。ただし、詳細要件の未実装と4手動シナリオの未確認部分があるため、MVP全体は実装完了と判定しません。

| #   | 完了条件                              | 状態         | 確認方法                                            |
| --- | ------------------------------------- | ------------ | --------------------------------------------------- |
| 1   | 既存MANGAI Hubが正常にビルド          | 完了         | ルートTypeScript、ESLint、Next.js 16本番ビルド成功  |
| 2   | 既存MANGAI Desktop機能が利用可能      | 完了         | Desktop統合テスト19件、修正版パッケージUI起動       |
| 3   | 旧Projectを開ける                     | 完了（自動） | 旧DBマイグレーションと旧形式Page書き出しテスト      |
| 4   | Page編集Canvasを開ける                | 完了         | パッケージUIで新規Page Canvasを確認                 |
| 5   | 矩形コマを作成                        | 完了         | 既定追加、テンプレート、ドラッグ作成                 |
| 6   | コマを移動・リサイズ・回転            | 完了         | Konva Transformerと永続保存                         |
| 7   | 素材画像をコマへ配置                  | 完了（実装） | Asset ID限定の直接D&Dと選択素材割り当て             |
| 8   | コマ内画像を移動・拡縮・回転          | 完了         | オフセット、倍率、回転プロパティとレンダラー試験    |
| 9   | 画像をコマ領域でクリップ              | 完了         | Konva clipと書き出しSVG clipPath                    |
| 10  | 3種類の吹き出しを作成                 | 完了         | ellipse、rounded、narration型とUI選択               |
| 11  | 吹き出しへテキスト入力                | 完了         | 吹き出しと子Textの一括作成、親Balloon指定、本文入力 |
| 12  | 横書きを表示・保存                    | 完了         | UI・SQLite・書き出し経路                            |
| 13  | 縦書きを表示・保存                    | 完了         | 手動表示、canvas-core単体試験、書き出し試験         |
| 14  | 自由テキストを配置                    | 完了         | parent nullのText Object                            |
| 15  | レイヤー順を変更                      | 完了         | 統合z-index保存と正規化                             |
| 16  | レイヤーを非表示・ロック              | 完了         | UI、永続化、書き出し除外試験                        |
| 17  | 6種類のPageテンプレート               | 完了         | canvas-core 6種類試験、4コマを手動確認              |
| 18  | Canvas操作をUndo/Redo                 | 完了         | 手動Undo/Redoと統合試験                             |
| 19  | 再起動後もCanvasと履歴を復元          | 完了         | SQLite試験とパッケージ再起動手動確認                |
| 20  | JPG/PNG/WebP混在PageをPDF出力         | 完了（自動） | Sharp共通レンダラー統合試験                         |
| 21  | 合成済みPageを画像ZIP出力             | 完了（自動） | 連番PNG ZIP統合試験                                 |
| 22  | 非表示レイヤーを書き出さない          | 完了（自動） | ページレンダラー試験                                |
| 23  | Episode・Page順で書き出す             | 完了（自動） | export統合試験                                      |
| 24  | 旧形式Pageを書き出せる                | 完了（自動） | 全面背景フォールバック試験                          |
| 25  | 製品版でMock AIを自動使用しない       | 完了         | app.isPackaged制約とMock拒否試験                    |
| 26  | Desktop TypeScript                    | 完了         | `npm run typecheck`成功                             |
| 27  | Desktop ESLint                        | 完了         | `npm run lint`成功                                  |
| 28  | Desktop本番ビルド                     | 完了         | Electron mainとVite renderer成功                    |
| 29  | 既存統合テスト                        | 完了         | AI・DBを含む19/19成功                               |
| 30  | 今回追加したテスト                    | 完了         | canvas-core 14/14、Canvas DB・書き出し試験成功      |
| 31  | NSIS x64生成                          | 完了         | `MANGAI-Desktop-Setup-0.1.0-x64.exe`生成成功        |
| 32  | Hub TypeScript、ESLint、Next.jsビルド | 完了         | 3項目成功                                           |
| 33  | 実装・未実装を文書化                  | 完了         | 本書、MANGA_EDITOR、計画、履歴、全体資料を更新      |

## 検証数値

- Desktop統合テスト: 19/19
- canvas-core単体テスト: 14/14
- Hub TypeScript / ESLint / Next.js build: 成功
- Desktop TypeScript / ESLint / production build: 成功
- Windows x64 NSIS: 成功
- パッケージ版起動・素材表示: 成功
- 直接D&Dの実マウス操作: 4手動シナリオで最終確認予定

## 完了を妨げる残項目

1. 4手動シナリオを素材ファイルと出力結果まで完走する
2. Canvas内画像編集専用モード
3. 親子テキスト保存座標の完全な相対座標化
4. レイヤーD&D並び替え
5. 30オブジェクトPage性能確認
6. クリーンWindowsへのインストール確認
