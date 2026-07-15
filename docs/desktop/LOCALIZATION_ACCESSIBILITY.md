# Desktop多言語化・アクセシビリティ

更新日: 2026-07-15

## 表示言語

ホーム画面または設定画面の「表示言語」から、日本語と英語を切り替えられます。選択値はrendererの`mangai.locale`設定へ保存され、次回起動時にも復元します。切替時はHTMLの`lang`属性と日時表示のlocaleも更新します。

英語化済み:

- ホームの主要操作とProject一覧
- 新規Projectダイアログ
- グローバルナビゲーション
- ワークスペース上部の主要操作
- 下部ステータスのPage・素材表示
- 設定画面の一般設定・表示言語

未翻訳の主な範囲:

- Project構成・素材パネルとInspector
- Canvas編集ツール
- Creator Chat、画像生成、Hub連携
- AI・診断・更新の詳細設定
- main processや外部サービスから返るメッセージ

保存データとの互換性を維持するため、対象年齢などの内部値は従来の日本語値を保持し、表示ラベルだけを翻訳します。

## キーボードとスクリーンリーダー

- 画面先頭のスキップリンクからメインコンテンツへ移動
- Projectカード全体を曖昧なクリック領域にせず、Projectを開く明示的なbuttonとして操作
- 新規Projectダイアログへ`role="dialog"`、`aria-modal`、見出し参照を設定
- ダイアログ表示時はタイトルへfocusし、Tab / Shift+Tabを内部で循環
- Escapeまたはキャンセル後は「新規Project」buttonへfocusを復帰
- エラー通知を`role="alert"`で通知し、専用の閉じるbuttonを提供
- 既存の左右パネル、タブ、書き出しダイアログ、生成DrawerのARIA・focus制御を継続

## 視覚・動き

- `prefers-reduced-motion: reduce`ではanimationとtransitionを実質無効化
- Windows forced colorsでは入力、button、dialog、panelの境界と選択状態をOS色で明示
- keyboard focusは既存の高視認focus ringを使用

## 確認項目

1. ホームと設定で日本語・Englishを切り替え、再起動後に保持されること
2. TabだけでProjectを開き、各Projectのバックアップ・複製・削除へ移動できること
3. 新規Projectダイアログのfocus循環、Escape終了、focus復帰
4. スキップリンクで現在のmain要素へ移動できること
5. Windowsの「アニメーション効果OFF」とハイコントラストで操作状態を識別できること
6. 英語表示中も対象年齢・読み方向を保存してProjectを作成できること

完全な英語版とWCAG評価は未完了です。未翻訳画面を同じ辞書へ段階移行し、axeなどの自動検査とNarratorによる手動確認を追加する必要があります。
