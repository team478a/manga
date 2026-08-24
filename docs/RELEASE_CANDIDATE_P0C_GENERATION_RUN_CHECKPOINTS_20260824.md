# P0-C 生成run checkpoint Release Candidate

## 目的

長編batchの中断・再開時に、完了済みコマのAssetを再生成せず、未完了コマだけを継続できる永続契約を追加する。

## 変更

- `cloud_generation_run_checkpoints`にbatch target、page、panel、元page revision、Job、完成Asset、SHA-256を固定する。
- service-role専用RPCはcompleted Job、同一projectの利用可能Asset、batch targetをDB内で再検証し、同一内容だけ冪等に記録する。
- Workerは`CLOUD_GENERATION_RESUMABLE_V2_ENABLED=true`の場合だけ、Job完了後にbest-effortでcheckpointを記録する。記録障害は完了Jobを失敗へ戻さず、Provider処理を繰り返さない。
- 純粋resume plannerはtarget identity、page revision、64桁digestが一致するcheckpointだけを完了扱いにする。
- 20ページfixtureは13ページ完了後の再起動を再現し、残り7ページだけが対象となり、既存Asset IDとdigestが不変であることを検証する。

## 安全境界

- Feature Flagはstrict・既定OFFのまま。
- Production migration、Provider／Worker実行、Job作成、Storage変更、credit予約・消費は行わない。
- rollbackはcheckpointが存在する場合に情報損失を避けて停止する。

## 検証

- 集中fixture 2/2、migration 65件、dependency境界、lint、全型検査、Hub 844 tests、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、Hub／Desktop build、RC structure、diff check成功。
