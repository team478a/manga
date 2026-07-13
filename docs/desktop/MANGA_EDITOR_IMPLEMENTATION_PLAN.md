# 漫画編集Canvas MVP 実装計画

作成日: 2026-07-13
作業ブランチ: `feature/manga-canvas-mvp`
開始コミット: `9a17416`
保全タグ: `manga-canvas-mvp-baseline-2026-07-13`

## 開始時検証

| 対象                  | 結果     |
| --------------------- | -------- |
| Desktop TypeScript    | 成功     |
| Desktop ESLint        | 成功     |
| Desktop統合テスト     | 16件成功 |
| Desktop本番ビルド     | 成功     |
| Hub TypeScript        | 成功     |
| Hub ESLint            | 成功     |
| Hub Next.js本番ビルド | 成功     |

未追跡の`deliverables/`は既存のダウンロード用成果物であり、Canvas実装では変更・コミットしません。

## 現行実装との差分

- `panels`は旧形式12項目で、名称、回転、z-index、表示、ロック、スタイル、画像変形を持たない
- `balloons`と`text_objects`は存在しない
- DBスキーマバージョンとマイグレーション前バックアップがない
- UndoスナップショットはProject、Episode、Page、Panelを含むが、履歴スキーマバージョンがない
- 書き出しはPage画像素材を直接利用し、Canvas合成状態をレンダリングしない
- 旧書き出し経路ではWebPがPDFへ埋め込まれない
- renderer中央は画像プレビューで、編集Canvasではない
- 製品版でもOllama未設定時にMock AIへフォールバックする

## 実装原則

1. SQLiteとMANGAIドメイン型を正本にする
2. Konva内部JSONを永続化しない
3. 座標はPage原寸ピクセルで保存し、表示倍率を混在させない
4. rendererは操作中の一時状態だけを持ち、確定時にIPC保存する
5. 既存Pageは全面画像として表示・書き出しできる互換性を維持する
6. DB変更前にSQLiteバックアップを作り、マイグレーションをトランザクション化する
7. Canvas操作は既存Project単位Undo/Redoへ統合する
8. 選択枠、ガイド、グリッドは書き出し対象外のUI Layerへ置く

## データ移行方針

### スキーマバージョン

`schema_migrations(version, name, applied_at)`を追加し、Canvas初回マイグレーションを一度だけ適用します。

### バックアップ

マイグレーション開始前にSQLiteのオンラインバックアップAPIで次へコピーします。

```text
{Documents}/MANGAI/backups/mangai_local-before-canvas-v1-{timestamp}.sqlite
```

バックアップ成功後だけトランザクションを開始し、失敗時は旧DBを変更しません。

### 旧Panel

既存カラムは削除せず、追加カラムへ既定値を設定します。`order_index`は初回移行時の`z_index`へ使用し、既存の`prompt`等も保持します。

### 旧Page

CanvasオブジェクトがないPageは`image_asset_id`をページ全面に表示する互換レイヤーとして扱います。自動的にPanelへ変換せず、旧書き出し互換も維持します。

## 実装ステップとコミット境界

### Step 1: 保全・設計

- 基準検証、タグ、ブランチ
- 座標、DB移行、互換、履歴方針
- コミット: `docs(canvas): record baseline and canvas architecture`

### Step 2: canvas-core

- Canvasドメイン型
- Page/Viewport座標変換
- 矩形制約、回転正規化
- z-index正規化
- 6種類の比率テンプレート
- Unicode安全な縦書き分割・配置
- Zod入力検証とPageメモリ上限
- 単体テスト
- コミット: `feat(canvas-core): add manga canvas domain primitives`

### Step 3: DB・IPC

- DBバックアップとschema migrations
- panels後方互換拡張
- balloons / text_objects
- CRUD、一括保存、レイヤー並び替え
- Undoスナップショットv2
- 製品版Mock AI無効化
- コミットをDB移行、CRUD、Mock安全修正に分割

進捗:

- Canvasマイグレーション前バックアップ、`schema_migrations`、Panel拡張、Balloon/Textテーブルを実装
- 製品版Mock自動フォールバック停止、テストモード表示、AI設定導線を実装
- Panel・Balloon・Text Objectの保存／削除CRUDとIPCを実装済み
- IPC入力はcanvas-coreのZod schemaで検証し、親BalloonとTextのページ整合性もDB層で検証
- ProjectBundleをCanvas属性、Balloon、Text Object対応へ拡張
- Undoスナップショットv2へ移行し、旧スナップショットとの後方互換を維持
- 再起動後の永続化、親子cascade削除、Undo/Redo復元を含むDesktop 19テストが成功
- `canvas-relative-text-v1` migrationで旧Page座標を親基準の相対比率へ変換し、移行前バックアップを作成
- 子テキストの相対比率をSQLiteの正本とし、bundle生成時にPage座標へ解決する後方互換経路を実装
- Canvas一括保存とレイヤー並び替えはKonva UI実装時に追加する

### Step 4: コマ・画像Canvas

- `konva` / `react-konva`
- Page原寸座標とズームViewport
- Panel作成、選択、変形、削除、複製
- Asset割り当て、クリッピング、画像編集モード
- スナップとガイド

進捗:

- Konva / react-konvaを導入し、既存ページ画像を保持したCanvas Stageへ置換
- Panel・Balloon・Textの追加、単一選択、ドラッグ、リサイズ、回転、削除を永続化APIへ接続
- 6種類のページテンプレート適用UI、統合レイヤー一覧、20〜200%ズームを実装
- ページ外移動・変形制約、Canvas一括保存、テンプレートの単一Undo、統合z-index描画を実装
- レイヤーの前面／背面移動、表示、ロックと、選択コマへの素材配置を実装
- 素材一覧からドロップ位置のコマへAsset IDを直接割り当てるD&Dを実装
- コマ内画像クリッピングとcover / contain / manualの倍率・オフセット・回転・透明度編集を実装
- ダブルクリック／プロパティから開始する画像編集専用モードを実装。Canvas内の移動・四隅拡縮・回転、中央リセット、Escape／完了ボタンでの終了に対応
- ページ端・中央・他オブジェクトへのドラッグ中スナップと青色ガイド線を実装
- ページ上のドラッグによる任意サイズのコマ作成、作成プレビュー、Escapeキャンセルを実装
- 100pxグリッド表示、グリッド吸着、全スナップON/OFFを実装
- Canvasとレイヤー一覧のShift操作による複数選択を実装
- 複数オブジェクトの一括移動・複製・削除を単一Undo履歴へ集約
- 一括移動はページ内制約とスナップを維持し、ロックを含む選択の変更を抑止
- 複数選択時は移動のみを許可し、曖昧な一括リサイズ・回転は無効化
- レイヤー一覧のドラッグハンドル、挿入位置ガイド、任意位置D&D並び替えを実装
- 30オブジェクトPageの製品版実操作と、保存・移動・再読込の性能スモークテストを完了
- D&Dと前面／背面ボタンを複合キー対応の共通z-index正規化へ統合し、単一Undoで保存

### Step 5: 吹き出し・テキスト

- 3種類の吹き出し
- 親子テキスト
- 横書き、縦書き、自由テキスト
- デバウンス保存、あふれ警告

進捗:

- 楕円・角丸・ナレーションの種類変更と8方向の尻尾描画・編集を実装
- テキスト本文、縦横組、文字サイズ、文字色、揃え、名称の詳細編集を実装
- grapheme単位の縦書き表示と文字あふれ警告を実装
- 同一ページBalloonへの親子割り当てUIと、選択Balloon内へのText追加を実装
- Balloon作成時の子Text自動生成と、移動・リサイズ時の追従・領域再計算を実装
- 親の移動・リサイズ時は子Textを再保存せず、SQLiteの相対比率からPage座標を再計算
- 親Balloonの複製・複数移動では子Textを自動的に含め、単一Undoへ集約
- 本文入力を600msのデバウンス保存へ集約
- 句読点・括弧・長音・三点リーダーを縦書き用字形へ変換
- 禁則処理は次の作業単位

### Step 6: レイヤー・テンプレート

- 統合レイヤー一覧
- 並び替え、表示、ロック、名称
- 6テンプレートと置換/追加

### Step 7: Undo/Redo統合

- dragend / transformend単位の履歴
- テキスト・スライダー操作集約
- 再起動復元と旧履歴の安全な読み飛ばし

操作補助の進捗:

- 矢印キー1px、Shift+矢印10pxの移動を実装
- Ctrl/Cmd+Dによる選択オブジェクトの単一・一括複製、Delete/Backspaceの単一・一括削除を実装
- 吹き出しと子テキストを一括複製した場合は、新しい親子IDへ付け替えて保存
- 入力欄フォーカス中とロック中はショートカット操作を抑止

### Step 8: 共通レンダラー・書き出し

- Page原寸PNG合成
- WebP混在
- DPIからPDF物理サイズ計算
- 合成済み連番画像ZIP
- 進捗、キャンセル、ページ別失敗

進捗:

- Canvas Coreの画像配置・縦書き・吹き出し尻尾計算を共有するSVGページレンダラーをmain processへ実装
- Page原寸PNGへ背景、Panelクリップ画像、Balloon、Text、回転、透明度、z-indexを合成
- JPG / PNG / WebPをdata URIとして同じ合成経路で処理し、旧Page画像も全面背景として維持
- Sharp/librsvgのSVG内WebP非描画を避けるため、使用中WebPを合成前にPNGへ正規化
- 合成済みPNGを`001.png`形式でZIPへ格納し、Episode・Page正式順を維持
- PDF物理サイズをPageピクセル寸法とProject DPIから72pt/inchで算出
- ページ失敗時は対象ページと理由をまとめてエラーにし、欠落した正常完了を禁止
- PNG寸法、PDFページ数・物理寸法、WebP、縦書き、吹き出し、非表示レイヤーを自動テスト
- ページ番号・総ページ数・進捗率・パッケージ作成状態をIPCイベントでUI表示
- 書き出しボタンを処理中のキャンセル操作へ切り替え、AbortSignalでmain processへ伝播
- 進捗100%完了と事前キャンセルを自動テスト

### Step 9: 回帰・受け入れ・文書

- 指示書の自動テストと4手動シナリオ
- Desktop / Hub / NSIS回帰
- 完了条件33項目の個別判定

進捗:

- Desktop TypeScript、ESLint、本番ビルド、統合テスト20件を確認
- canvas-core単体テスト16件を確認
- Hub TypeScript、ESLint、Next.js本番ビルドを確認
- Windows x64 NSISを生成し、パッケージ版の正常起動を確認
- パッケージ版で新規Project、Page、4コマ、吹き出し、縦書き、Undo/Redo、再起動復元を確認
- preloadのCommonJS梱包漏れによるパッケージ版黒画面を検出・修正
- 33条件の個別判定と詳細要件の残項目を文書化
- 4手動シナリオを完走。新規編集、Undo/Redo・再起動復元、旧形式相当Page、JPG/PNG/WebP混在PDF・ZIPを確認
- 受け入れで検出したWebP欠落を修正し、色画素回帰テストと修正版パッケージで再確認
- 実旧DB移行はバックアップ付き自動テスト、旧形式相当Projectの表示・未編集出力はパッケージ版UIで確認

## リスクと対策

| リスク                       | 対策                                               |
| ---------------------------- | -------------------------------------------------- |
| 旧DB破損                     | 事前バックアップ、バージョン管理、トランザクション |
| 高解像度書き出しのメモリ枯渇 | 1辺・総ピクセル・推定メモリ上限、ページ単位処理    |
| 表示と書き出しの差異         | `canvas-core`の共通描画モデルを利用                |
| ドラッグ中のDB過負荷         | renderer一時状態、endイベントで保存                |
| Undo履歴肥大化               | バイナリ/Base64を除外し操作を集約                  |
| 縦書き互換                   | `Intl.Segmenter`優先、`Array.from`フォールバック   |
| 既存Page欠落                 | CanvasなしPageの全面画像フォールバック             |

## 今回の進捗報告ルール

各Step終了時に、完了、一部完了、未完了を明示します。全33条件を満たすまではCanvas MVP全体を「実装完了」と報告しません。
