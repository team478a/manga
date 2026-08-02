# MANGAI Cloud 画風・世界観設定 v1

作成日: 2026-07-31

## 目的

一般向けCloud漫画で、ページごとの画風変化、同じ場所や小物の形状・配色変化を減らす。利用者は日本語で作品の見た目を指定し、Provider、Seed、技術Promptを操作しない。

## 使い方

1. Cloud Creatorで作品を開く
2. `画風・場所・小物を設定`を選ぶ
3. 作品全体の画風、線、陰影、背景密度、構図ルールを保存する
4. 繰り返し登場する場所・小物の名前と固定特徴を保存する
5. ネームからコマ画像を生成する

画風の最新版は作品の全コマへ適用する。場所・小物は、名前がネームの背景・動作・構図に現れるコマだけへ適用する。たとえば`駅前`を登録すると`朝の駅前`のコマへ反映し、無関係な室内コマには追加しない。

## データと安全性

- `cloud_style_bibles` / `cloud_style_bible_versions`
- `cloud_world_profiles` / `cloud_world_profile_versions`
- 更新は旧版を上書きせず、不変version snapshotを追加
- 所有者RLSと所有者確認RPCを使用
- 一般向けCloud Projectだけを対象とする
- 生成Jobへ利用したBible/Profile IDとversionを記録
- migration未適用環境では既存制作を壊さず準備案内を表示

Migration: `202607310006_cloud_world_bible.sql`

Rollback: `supabase/rollbacks/202607310006_cloud_world_bible.sql`

## 後続M2

- キャラクター・場所・小物の参照画像
- シーン／コマへの明示的なcast・場所・小物割当
- Provider capabilityに応じた画像参照とSeed固定
- 衣装、場所、小物の意図しない変化を検出する継続性警告
