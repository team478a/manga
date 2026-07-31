# MANGAI Cloud Release 5 実装計画

## 目的

Release 4で採用した一般向けAIネームを、既存Cloud Creatorで編集できる非公開Projectへ変換する。
画像生成の前に、全ページ、コマ枠、吹き出し、セリフを編集可能なCanvas下書きとして固定する。

## 今回の対象

1. 最新の採用ネームからだけProjectを作成
2. ネーム1版につきProjectを1つだけ作る冪等変換
3. 全ページとページ順の作成
4. 1〜6コマの右綴じ向けグリッド配置
5. セリフ、心の声、ナレーションの吹き出し・文字配置
6. 元ネームとProjectの追跡
7. 所有者RLS、Feature Flag、migration、rollback、preflight
8. 作成済みProjectの再表示導線

## 対象外

- 画像生成Provider呼出
- Cloud AI QueueへのJob登録
- Asset作成
- Canvas Editor本体の変更
- 成人向けデータのCloud Project化
- Stripe、Marketplace、Desktop

## 完了条件

- 採用ネーム以外からProjectを作成できない
- 同じネームを再実行してもProjectが増えない
- 8〜48ページのCanvas snapshotが同一transactionで作成される
- Canvas schema v1として安全に読み込める
- 別利用者のProject・変換記録を参照できない
- 画像・生成Job・外部Provider呼出を発生させない
- 品質ゲート、Draft PR、Vercel Previewが成功する
