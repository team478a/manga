# P1-A 人物version付き参照画像binding Release Candidate

## 変更

- `cloud_character_reference_bindings`で人物profile version、owner画像Asset、参照role、表情key、優先度、review状態を結合する。
- roleは`front / side / back / face / full_body / expression / costume_detail`に限定する。
- owner、project、人物version、削除状態、画像MIMEをRPC内で再検証する。
- authenticatedはowner RLS readと検証RPCだけ、直接writeはservice roleだけとする。
- 既存`cloud_visual_reference_assets`は削除・変更せず互換経路として残す。roleとversionを推測できないため自動backfillしない。
- binding存在時のrollbackは情報損失を避けて停止する。

## 非対象

- resolver、readiness policy、UI、Prompt、Providerは変更しない。P1-B以降で扱う。
- Production migration、Provider／Worker実行、Job、Storage、credit操作は行わない。

## 検証

- migration／rollback／canonical schema／manifest 66件、ACL assertion、deps、lint、全型検査、Hub 850 tests、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、両build、RC structure、diff check成功。
