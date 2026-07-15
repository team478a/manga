# 漫画編集Canvas MVP 完了条件チェック

確認日: 2026-07-15

総合判定: **一部完了**

以下の33項目は機能・自動検証・ビルド・手動受け入れの条件として完了しています。現行NSISのinstall・製品版起動・uninstall E2Eは完了しました。署名済み自動更新とクリーンWindows最終受入れが残るため、総合判定は「一部完了」を維持します。

| #   | 完了条件                              | 状態         | 確認方法                                            |
| --- | ------------------------------------- | ------------ | --------------------------------------------------- |
| 1   | 既存MANGAI Hubが正常にビルド          | 完了         | ルートTypeScript、ESLint、Next.js 16本番ビルド成功  |
| 2   | 既存MANGAI Desktop機能が利用可能      | 完了         | Desktop統合テスト36件、修正版パッケージUI起動       |
| 3   | 旧Projectを開ける                     | 完了         | 旧DB移行テストと旧形式相当Projectの手動表示・出力   |
| 4   | Page編集Canvasを開ける                | 完了         | パッケージUIで新規Page Canvasを確認                 |
| 5   | 矩形コマを作成                        | 完了         | 既定追加、テンプレート、ドラッグ作成                |
| 6   | コマを移動・リサイズ・回転            | 完了         | Konva Transformerと永続保存                         |
| 7   | 素材画像をコマへ配置                  | 完了         | 4素材の配置・調整とAsset ID限定の直接D&D実装        |
| 8   | コマ内画像を移動・拡縮・回転          | 完了         | 専用モード、Transformer、変換計算試験               |
| 9   | 画像をコマ領域でクリップ              | 完了         | Konva clipと書き出しSVG clipPath                    |
| 10  | 3種類の吹き出しを作成                 | 完了         | ellipse、rounded、narration型とUI選択               |
| 11  | 吹き出しへテキスト入力                | 完了         | 子Text一括作成、親指定、相対座標保存、本文入力      |
| 12  | 横書きを表示・保存                    | 完了         | UI・SQLite・書き出し経路                            |
| 13  | 縦書きを表示・保存                    | 完了         | 基本禁則・縦中横を含むcanvas-core試験、書き出し試験 |
| 14  | 自由テキストを配置                    | 完了         | parent nullのText Object                            |
| 15  | レイヤー順を変更                      | 完了         | D&D、ボタン、複合キー対応z-index正規化              |
| 16  | レイヤーを非表示・ロック              | 完了         | UI、永続化、書き出し除外試験                        |
| 17  | 6種類のPageテンプレート               | 完了         | canvas-core 6種類試験、4コマを手動確認              |
| 18  | Canvas操作をUndo/Redo                 | 完了         | 手動Undo/Redoと統合試験                             |
| 19  | 再起動後もCanvasと履歴を復元          | 完了         | SQLite試験とパッケージ再起動手動確認                |
| 20  | JPG/PNG/WebP混在PageをPDF出力         | 完了         | Sharp統合試験とパッケージ版出力の色確認             |
| 21  | 合成済みPageを画像ZIP出力             | 完了         | 連番PNG ZIP統合試験とパッケージ版出力確認           |
| 22  | 非表示レイヤーを書き出さない          | 完了（自動） | ページレンダラー試験                                |
| 23  | Episode・Page順で書き出す             | 完了（自動） | export統合試験                                      |
| 24  | 旧形式Pageを書き出せる                | 完了（自動） | 全面背景フォールバック試験                          |
| 25  | 製品版でMock AIを自動使用しない       | 完了         | app.isPackaged制約とMock拒否試験                    |
| 26  | Desktop TypeScript                    | 完了         | `npm run typecheck`成功                             |
| 27  | Desktop ESLint                        | 完了         | `npm run lint`成功                                  |
| 28  | Desktop本番ビルド                     | 完了         | Electron mainとVite renderer成功                    |
| 29  | 既存統合テスト                        | 完了         | AI・DB・複製・更新を含む36/36成功                   |
| 30  | 今回追加したテスト                    | 完了         | canvas-core 24/24、Canvas DB・書き出し試験成功      |
| 31  | NSIS x64生成                          | 完了         | `MANGAI-Desktop-Setup-0.1.0-x64.exe`生成成功        |
| 32  | Hub TypeScript、ESLint、Next.jsビルド | 完了         | 3項目成功                                           |
| 33  | 実装・未実装を文書化                  | 完了         | 本書、MANGA_EDITOR、計画、履歴、全体資料を更新      |

## 検証数値

- Desktop統合テスト: 36/36
- canvas-core単体テスト: 24/24
- Hub TypeScript / ESLint / Next.js build: 成功
- Desktop TypeScript / ESLint / production build: 成功
- Windows x64 NSIS: 成功
- NSIS install・製品版renderer起動・隔離SQLite・uninstall E2E: 成功
- Windows成果物・SPDX SBOM・SHA-256検証: 成功
- パッケージ版起動・素材表示: 成功
- 手動受け入れシナリオA〜D: 成功
- シナリオAの素材は、ファイル選択ダイアログの自動操作が安定しなかったため、製品と同じデータ層から登録して配置・編集・出力を確認
- シナリオCは旧形式相当Projectの手動表示・出力と、実旧DBのバックアップ付き移行自動テストを組み合わせて確認
- JPG/PNG/WebP混在出力: PDF 1ページ、ZIP `001.png`、赤・緑・青・黄の全素材を画素検査で確認
- 旧形式Page出力: PDF 1ページ、ZIP `001.png`、1600×2400、中央画素RGBA `(220, 55, 55, 255)`
- 30オブジェクト性能: コマ28・吹き出し1・テキスト1で、選択約0.4秒、移動保存約0.6秒、リサイズ保存約0.63秒、再読込約1.1秒。フリーズ・保存失敗なし
- 30オブジェクトDBスモークテスト: 一括保存10.5ms、移動保存1.7ms、再読込13.0ms

## 配布前に残る確認

1. 信頼された証明書によるWindows実署名
2. 署名済み旧版から新版への自動更新E2E
3. クリーンWindowsでの最終受入れ
