# Data Model

このファイルは、野球スコアボードアプリで扱うデータ構造を整理する。
画面構成や実装順は `scoreboard_design.md`、操作時の状態変化は `operation_rules.md` を参照する。

## 1. Board

稼働中のスコアボード1つを表す。

保持する情報:

- board id
- board name
- created at
- updated at
- last accessed at
- game state
- team settings
- player settings
- display options
- undo history
- redo history

スコアボード名:

- スコアボード名は作成後に変更できる。
- 名称変更は試合状態やチーム設定には影響しない。
- Viewer Page、Control List Page、Score Input Pageで表示するラベルとして使う。

削除時:

- 手動削除では必ず確認を取る。
- 24時間アクセスなしの自動削除では確認を取らない。
- 削除時は、そのスコアボードの試合状態、選手名、操作履歴、専用表示オプションを削除する。
- チームプリセット、共通設定、閲覧画面設定は削除しない。

## 2. Game State

試合中に変化する情報。

保持する情報:

- inning number
- inning half: top or bottom
- balls
- strikes
- outs
- runner on first
- runner on second
- runner on third
- away score
- home score
- away ABS count
- home ABS count
- temporary overlay message

制約:

- ボールは最大4表示。
- ストライクは最大3表示。
- アウトは最大3 outs表示。
- チェンジはアウト3のときのみ使用可能。
- チェンジ時は、ランナー、ボール、ストライク、アウトをリセットする。
- ランナーは一塁、二塁、三塁ごとにON/OFFできる。
- 得点は打席結果による自動加点に加えて、先攻、後攻それぞれ手動で +1 / -1 できる。
- 得点は0未満にしない。

## 3. Team Settings

スコアボードごとのチーム設定。

保持する情報:

- team side: away or home
- team name
- abbreviation
- logo path
- team color
- text color
- linked preset id

表示ルール:

- チームカラー上の文字色はチームごとに設定可能。
- チームカラー上の文字色の初期値は白。
- スコアボード上の得点は最も大きく表示する。

## 4. Team Preset

設定ページで保存する共通プリセット。
アプリ終了後も保存する。

保持する情報:

- preset id
- preset name
- team name
- abbreviation
- logo path
- team color
- text color
- created at
- updated at

チームロゴのルール:

- 推奨サイズは 256x256。
- 対応形式は PNG と JPEG。
- 透過PNGは透過を保持する。
- 256x256 以外の画像は、保存時に 256x256 の正方形へ自動変換する。
- 変換時は上下幅と左右幅が等しくなるようにリサイズし、縦横比の歪みは許容する。
- 画像が大きすぎる場合も、保存時に自動圧縮する。

## 5. Player Settings

対戦選手表示オプション用の情報。

保持する情報:

- away batting order 1-9
- home batting order 1-9
- away pitchers
- home pitchers
- current batting order index
- pinch hitter flag
- position text

バッター情報:

- batting order number
- player name
- position
- is pinch hitter
- home runs
- hits
- strikeouts swinging
- strikeouts looking
- outs
- others

バッター成績の表示:

- hit count = home runs + hits
- at bat count = home runs + hits + strikeouts swinging + strikeouts looking + outs
- `others` は四死球、打撃妨害などを想定し、打数には含めない。

ピッチャー情報:

- pitcher name
- pitch count
- order in pitching list

現在のピッチャー:

- 現在のピッチャーは、各チームのピッチャー一覧の最後の人とする。

表示ルール:

- バッターは常に上。
- ピッチャーは常に下。
- 表裏に応じて色は攻撃側、守備側に入れ替わる。
- 代打時は打順番号を `PH` と表示する。

## 6. Viewer Settings

閲覧画面の表示設定。

保持する情報:

- background color
- page scale
- per-device board size
- viewer client id
- board layout mode
- board positions
- board display order

端末ごとの表示プロパティ:

- スコアボードサイズは端末ごとに保存する。
- 端末ごとの表示プロパティは、ブラウザ内の保存領域だけに保存する。
- 表示プロパティはブラウザ側で入出力できるようにする。
- 入出力により、別ブラウザや別端末へ同じ表示設定を移せるようにする。
- 他端末の表示サイズには影響させない。

入出力対象:

- 端末ごとのスコアボードサイズ
- 表示位置
- 拡大率
- 背景色

## 7. General Settings

アプリ全体の設定。

保持する情報:

- auto cleanup enabled
- auto cleanup idle hours
- last app access at
- overlay display seconds

自動削除の初期設定:

- 稼働中スコアボードはアプリ再起動後も残す。
- ただし、24時間アプリにアクセスがない場合、すべての稼働中スコアボードを削除する。
- この24時間の値と有効/無効は、全体の設定メニューで管理できるようにする。
- チームプリセット、共通設定、閲覧画面設定は自動削除の対象外にする。
- アプリへのアクセスは、Viewer Page、Control List Page、Score Input Page、Settings Pageの表示、またはSSE（リアルタイム）接続で更新する。

一時演出:

- 一時演出の表示秒数は、全体の設定メニューで管理する。
- スコアボードごとの設定にはしない。

## 8. Persistence Summary

アプリ終了後も保存するもの:

- 稼働中スコアボード
- 削除していないスコアボードの試合状態
- チームプリセット
- 共通設定
- 閲覧画面の背景色
- 閲覧画面の拡大率
- 閲覧画面の表示位置
- 端末ごとのスコアボードサイズ。ただし、これはサーバーではなく各ブラウザ内に保存する。
- 端末ごとの表示プロパティの入出力データ

スコアボード削除時に削除するもの:

- 試合状態
- 選手名
- ピッチャー一覧
- 打者成績
- 操作履歴
- そのスコアボード専用の表示オプション
