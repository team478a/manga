# モニター進行阻害フィードバック修正

## 対象

- 選択コマ生成ボタンが禁止表示のままで、利用者が回復方法を判断できない。
- セリフ文字が吹き出し／コマ内に収まらない既存原稿がある。
- 4ページ作品を作りたいが指定箇所が分からず、AIおまかせで32ページになる。

## 修正

- 生成ボタンの停止理由を、コマ未選択、利用枠取得失敗、生成停止、credit不足、受付中へ分類して表示する。
- コマ未選択時に「最初のコマを選択する」回復操作を追加する。生成条件、credit、Provider呼出し境界は変更しない。
- 吹き出し外へずれたunlocked既存文字だけを、吹き出し内へ再配置して可読レイアウトを再計算する。locked／手動保護対象は変更せず、画像生成とcredit消費を行わない。
- 市場分析のページ数へ4ページ／8ページを追加し、AIおまかせでは読切が32ページになる場合があると明示する。
- シナリオ／ネームの最小ページ数を4へ揃え、明示した4ページを32ページへ拡張せず保存・生成する。長編の8ページ分割は維持する。

## 安全境界

- migration、DB／Storage、Production／staging、Feature Flag、Provider、Job、creditを変更・実行しない。
- 既存32ページ作品や保存済みscenario／storyboardの内容を自動変更しない。
- モニター報告の状態・管理メモ・返信は、修正PRのマージと実画面確認前に変更しない。

## 受入れ

- 関連62/62、Hub／Canvas／AI／Desktop全件、a11y violation 0、migration 74件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- CI／Vercel PreviewはDraft PRで確認する。

## 対応完了通知

- 2026-08-28、PR #371反映後に対象2件をProduction管理画面で`resolved`へ更新した。
- 非公開管理メモへ修正範囲と検証結果を記録し、利用者の送信履歴では「修正済み」と表示する。
- 詳細は`RELEASE_CANDIDATE_MONITOR_FEEDBACK_RESPONSE_CLOSEOUT_20260828.md`を正本とする。
