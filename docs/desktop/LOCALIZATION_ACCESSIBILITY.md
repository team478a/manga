# Desktop多言語化・アクセシビリティ

更新日: 2026-07-17

## 表示言語

ホーム画面または設定画面の「表示言語」から、日本語と英語を切り替えられます。選択値はrendererの`mangai.locale`設定へ保存され、次回起動時にも復元します。切替時はHTMLの`lang`属性と日時表示のlocaleも更新します。

英語化済み:

- ホームの主要操作とProject一覧
- 新規Projectダイアログ
- グローバルナビゲーション
- ワークスペース上部の主要操作
- 下部ステータスのPage・素材表示
- Project構成・Episode・Page・素材パネル
- InspectorのProject・Page・選択画像操作
- Episodeテンプレート名・説明
- Canvasの追加・レイアウト・表示・選択操作
- コマ・吹き出し・テキスト・ルビの全プロパティ
- レイヤー一覧、表示・lock・前後移動
- Creator Chatの専用画面・Canvas右パネル・履歴・テンプレート・送信操作
- ComfyUI画像生成、ワークフロー管理、生成履歴、生成ジョブDrawer
- 設定画面の一般設定・表示言語
- 設定画面のAI接続診断、ComfyUI低スペック実行環境、Ollamaモデル判定
- 設定画面の診断データ・プライバシー、同意、削除・手動送信操作
- 設定画面のAI Provider入力、モデル・生成設定、接続操作、設定変更履歴
- 設定画面のプロンプトテンプレート操作
- Stable/Beta更新チャンネル、更新確認・取得・進捗・再起動確認
- 書き出しダイアログの開始前・実行中・完了・失敗表示
- 設定画面の一般情報、データ保存先、AIログ方針、Runtime Profile、RAM・GPU・VRAM、低スペック警告
- Hubの公開・販売状態、device code認証、承認待ち、下書き差分・限定更新、安全なscope

未翻訳の主な範囲:

- 接続先が独自に返す未知の文面や、将来追加される未登録エラー

Hub URL・認証、AI Provider未設定、ComfyUI無効・timeout、低VRAM排他、診断送信、書き出し、OS資格情報暗号化、更新エラー、バックアップ破損、SQLite整合性、素材復元、workflow検証など、利用者へ表示するmain process・外部サービスメッセージはrendererの選択localeへ変換します。IPCが付加する内部的な呼び出しprefixは画面表示前に除外します。

操作履歴のProject・Episode・Page・Canvas・素材操作ラベルも表示時に翻訳します。履歴へ保存した原文は監査互換性のため変更せず、利用者が入力したProject名・ファイル名・Promptは翻訳しません。

保存データとの互換性を維持するため、対象年齢などの内部値は従来の日本語値を保持し、表示ラベルだけを翻訳します。Creator Chatの組み込みプロンプトテンプレート名・本文と保存済み会話は利用者コンテンツとして自動翻訳しません。

## キーボードとスクリーンリーダー

- 画面先頭のスキップリンクからメインコンテンツへ移動
- Projectカード全体を曖昧なクリック領域にせず、Projectを開く明示的なbuttonとして操作
- 新規Projectダイアログへ`role="dialog"`、`aria-modal`、見出し参照を設定
- ダイアログ表示時はタイトルへfocusし、Tab / Shift+Tabを内部で循環
- Escapeまたはキャンセル後は「新規Project」buttonへfocusを復帰
- エラー通知を`role="alert"`で通知し、専用の閉じるbuttonを提供
- 既存の左右パネル、タブ、書き出しダイアログ、生成DrawerのARIA・focus制御を継続
- AI接続診断を見出しと関連付け、実行中は`aria-busy`、結果一覧は`aria-live="polite"`で通知
- 診断データ・プライバシーを見出しと関連付け、保存・削除・送信結果を`role="status"`で通知
- AI Providerの保存・接続確認・モデル更新結果を`role="status"`で通知
- 更新buttonの変化を`aria-live="polite"`で通知
- Hubの認証・通信エラーを`role="alert"`、コピー・下書き更新成功を`role="status"`で通知

## 視覚・動き

- `prefers-reduced-motion: reduce`ではanimationとtransitionを実質無効化
- Windows forced colorsでは入力、button、dialog、panelの境界と選択状態をOS色で明示
- keyboard focusは既存の高視認focus ringを使用
- Homeの主操作色は通常時・hover時とも通常文字のWCAG AAコントラストを満たす配色を使用

## 自動評価

製品rendererを隔離した一時Documents・userDataフォルダーでElectron起動し、`axe-core`で次の主要画面を日本語・英語の両方で連続評価できます。

- Home
- 新規Projectダイアログ
- 漫画編集workspace
- Pageあり漫画編集workspace
- 生成Job Drawer
- 上部「その他」menu
- Canvasの追加・レイアウト・表示menu
- 書き出しダイアログ
- Creator Chat
- 画像生成
- Hub連携
- Hub URL入力エラー
- 設定

```powershell
npm run desktop:test:a11y
```

検査対象はWCAG 2.0 / 2.1のA・AAタグです。監査専用ProjectをUIから作成して各画面へ遷移し、画面別の結果JSONをMainプロセスから書き出します。`serious`または`critical`の違反がある場合は終了コード1にします。Desktop ReleaseのWindows CIでも同じコマンドを実行します。

2026-07-17時点では日本語・英語の29画面・状態で合計726項目が合格し、自動判定の違反は0件です。書き出しダイアログ表示中は背景要素へ`inert`と`aria-hidden`を設定し、読み上げとkeyboard移動をダイアログ内へ限定します。

編集画面では、表示件数の`0`と装飾記号`✎`・`−`について色コントラストを自動確定できない判定保留が各localeで3件あります。タブの件数は操作名と合わせた`aria-label`、記号buttonは翻訳済み操作名の`aria-label`を持ち、装飾文字は`aria-hidden`にしています。実質3要素をNarratorと目視による手動確認対象とします。

## 確認項目

1. ホームと設定で日本語・Englishを切り替え、再起動後に保持されること
2. TabだけでProjectを開き、各Projectのバックアップ・複製・削除へ移動できること
3. 新規Projectダイアログのfocus循環、Escape終了、focus復帰
4. スキップリンクで現在のmain要素へ移動できること
5. Windowsの「アニメーション効果OFF」とハイコントラストで操作状態を識別できること
6. 英語表示中も対象年齢・読み方向を保存してProjectを作成できること
7. Episode追加・並び替え、Page選択・並び替え、素材検索をkeyboardだけで操作できること
8. Canvas tool menuを矢印キーとEscapeで操作し、英語表示でオブジェクトを追加・編集できること
9. Creator Chatの履歴選択・名称変更・削除、テンプレート選択、送信・停止をkeyboardだけで操作できること
10. 画像生成のワークフロー選択、生成開始、履歴のキャンセル・再実行をkeyboardだけで操作できること
11. AI接続診断を英語表示で実行し、進行状態と結果がスクリーンリーダーへ通知されること
12. 診断データのローカル保存同意と外部送信同意が別々に操作でき、英語の確認文が表示されること
13. Providerの有効化、URL、許可origin、モデル選択、保存・接続確認を英語表示でkeyboard操作できること
14. テンプレートの複製・編集・削除確認と、更新チャンネル・更新確認を英語表示でkeyboard操作できること
15. Hubの公開照会、端末認証、URLコピー、差分確認、下書き更新を英語表示でkeyboard操作できること

隔離DBへ監査専用の画像生成Jobを作成し、実行中45%、完了100%、失敗70%の表示を画像生成画面とJob Drawerで評価します。英語localeでは失敗通知に日本語システム文面が残らないことも確認します。実ComfyUI通信は行わず、通常起動時のDBやIPCには監査用Jobを追加しません。

ネイティブ`confirm`・`prompt`を含む手動確認手順は[`NARRATOR_ACCEPTANCE.md`](NARRATOR_ACCEPTANCE.md)へ整理済みです。完全な全状態WCAG評価は、同チェックリストをWindows実機で日本語・英語、高コントラスト、150%表示について完走するまで未完了です。
