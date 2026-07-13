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
- WebPは画像ZIPへ入るがPDFへ埋め込まれない
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
- コマ内画像クリッピングとcover / contain / manualの倍率・オフセット・回転・透明度編集を実装
- ページ端・中央・他オブジェクトへのドラッグ中スナップと青色ガイド線を実装
- 複数選択は次の作業単位

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
- Ctrl/Cmd+Dによる選択オブジェクト複製、Delete/Backspace削除を実装
- 入力欄フォーカス中とロック中はショートカット操作を抑止

### Step 8: 共通レンダラー・書き出し

- Page原寸PNG合成
- WebP混在
- DPIからPDF物理サイズ計算
- 合成済み連番画像ZIP
- 進捗、キャンセル、ページ別失敗

### Step 9: 回帰・受け入れ・文書

- 指示書の自動テストと4手動シナリオ
- Desktop / Hub / NSIS回帰
- 完了条件33項目の個別判定

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
