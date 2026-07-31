# Cloud成人向けCanvas v1 実装計画

## 目的

許可済み利用者が採用した成人向けネームを、成人向け区分を保持したまま編集可能なCloud Canvas下書きへ変換する。変換はDB内の構造化処理だけで行い、AI画像生成・外部Provider送信・課金は行わない。

## 実装範囲

1. `CLOUD_ADULT_CANVAS_ENABLED`を明示的に有効化した環境だけで導線を表示する。
2. 成人向けAIネームの既存許可、本人同意、DB Kill Switchを再利用する。
3. 一般／成人の`content_class`をネーム、変換記録、Project、版履歴で一致させる。
4. 成人向けProjectは18歳以上、非公開、所有者本人だけが閲覧・編集可能とする。
5. コマ枠、吹き出し、文字レイヤーだけを作成する。
6. 一般向け画像生成APIは変換記録と元ネームの両方が`general`の場合だけ受理する。
7. forward、rollback、canonical schema、preflight、自動テストを用意する。

## 対象外

- 成人向け画像生成
- 外部Providerへの成人向け内容送信
- 公開、共同編集、Marketplace、販売
- staging migration適用、本番Feature Flag有効化

## 完了条件

- 採用成人向けネームから全ページのCanvas下書きを冪等作成できる。
- 成人向け区分が一般向けへ変化しない。
- 別利用者、許可失効利用者、一般向け画像生成APIから拒否される。
- 全品質ゲートとGitHub CIが成功し、Draft PRとPreviewで確認できる。
