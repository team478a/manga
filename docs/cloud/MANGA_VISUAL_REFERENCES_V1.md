# MANGA Visual References v1

## 目的

一般向けCloud漫画で、キャラクター・画風・場所・小物の見た目をページ間で揃えるため、参照画像とコマ単位の明示割当を画像生成へ渡す。

## 実装範囲

- 既存の非公開 `cloud_assets` へ参照画像を保存
- Character Profile、Style Bible、Location／Prop Profileと画像を関連付け
- ページ内のコマへ人物・場所・小物を明示割当
- 自動名前照合と明示割当を統合して生成Promptを構築
- 参照したasset IDを生成Job入力へ固定
- Worker実行時だけ有効期間10分の署名URLを発行
- BFL FLUX.2の `input_image`〜`input_image_8` へ送信
- KleinモデルではProvider上限に合わせ4枚、それ以外は最大8枚

## 利用画面

作品詳細の「参照画像とコマ割当」から設定する。

1. 対象の人物・画風・場所・小物を選ぶ
2. 参照画像と任意ラベルを保存する
3. ページとコマを選び、人物・場所・小物を割り当てる
4. 通常どおりコマ画像を生成する

## セキュリティ

- 一般向け作品だけを対象とする
- DB参照は所有者RLS、更新は所有者検証済みRPCに限定する
- 画像は公開URLにせず、Workerが実行直前に短時間署名URLを生成する
- Jobの所有者・作品と一致しないassetはProvider送信前に拒否する
- migration未適用時は既存のテキスト生成経路を壊さず、設定画面だけ安全に停止する
- Provider内部エラーや署名URLを利用者画面へ表示しない

## DB

- migration: `202608010001_cloud_visual_references.sql`
- rollback: `202608010001_cloud_visual_references.sql`
- `cloud_visual_reference_assets`
- `cloud_panel_subject_assignments`

## 今回含めないもの

- 生成画像を自動で新しい参照画像に昇格する処理
- 画像認識による顔・衣装・場所の継続性スコア
- 成人向けCloud／Desktopへの同期
- Providerの有料実行とstaging migration適用

## 次のM2タスク

採用済み画像とProfile設定を比較し、キャラクター・衣装・場所の変化を警告する継続性評価を追加する。
