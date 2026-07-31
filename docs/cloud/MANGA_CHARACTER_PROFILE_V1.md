# MANGAI Cloud キャラクター設定 v1

作成日: 2026-07-31

## 目的

一般向けCloud漫画で、ページをまたいだ人物の別人化、髪型や衣装の意図しない変更を減らす。利用者はProvider、Seed、技術Promptを操作せず、日本語の設定だけを登録する。

## 利用方法

1. `Cloud Creator`から対象作品を開く
2. `外見・衣装の設定を編集`を選ぶ
3. ネームに登録された人物名と同じ名前で設定を作る
4. 年齢、体格、髪、基本衣装、配色、変えてはいけない特徴を入力する
5. 保存後にコマ画像を生成する

名前が一致した人物の最新設定は生成条件へ自動追加される。更新時は旧設定を上書きせず新しい版を作り、生成Jobには利用したProfile IDとversionを保存する。

## データと権限

- `cloud_character_profiles`: 現在版と基本情報
- `cloud_character_profile_versions`: 変更ごとの不変snapshot
- RLSにより本人の作品・設定だけを参照可能
- 書き込みは所有者確認を行うSecurity Definer RPCだけに限定
- 一般向け`cloud_projects`だけを対象とし、成人向け境界は変更しない
- APIキー、Provider内部情報、技術Promptを画面へ表示しない

## 適用前後

Migration:

`supabase/migrations/202607310005_cloud_character_profiles.sql`

Rollback:

`supabase/rollbacks/202607310005_cloud_character_profiles.sql`

未適用環境では設定画面に準備案内を表示し、既存の作品閲覧・編集・画像生成を壊さない。適用後は設定を保存し、同名人物を含むコマ生成Jobの入力に`characterProfileVersions`が記録されることを確認する。

## 今回含まない範囲

- 正面・側面・全身・表情の参照画像
- Style Bible
- Location／Prop Profile
- コマへのcast・場所・小物の明示割当
- 自動の継続性評価・警告
- 成人向けCloud／Desktop

これらはPhase M2の後続として段階実装する。
