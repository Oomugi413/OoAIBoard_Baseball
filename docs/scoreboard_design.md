# Baseball Scoreboard Design Blueprint

このファイルは、野球スコアボードアプリを作る前段階の設計図です。
まだコードは作成せず、画面構成、データ構造、必要ファイル、今後決めることを整理します。

詳細ファイル:

- データ構造の詳細: `data_model.md`
- 操作ルールの詳細: `operation_rules.md`
- ボタン一覧の詳細: `button_list.md`
- 起動、終了、基本的な使い方の説明: `user_guide.txt`

## 1. Project Summary

ローカルPCで起動し、ブラウザからアクセスできる野球用スコアボードを作る。
同一ネットワーク上の別端末からもアクセスできる前提とし、PC側のポート開放やネットワーク設定はこのアプリでは扱わない。

Codex GUI上でのやり取りや画面文言は日本語にする。
ただし、フォルダ名とファイル名は英語アルファベットで統一する。

主な利用シーンは、配信画面にスコアボードを重ねること、別画面からスコアを操作すること、チーム情報や選手名を保存して再利用すること。

対応環境の前提:

- アプリを起動するコンピューターは、将来的にWindowsとLinuxの両対応を前提とする。
- ブラウザからアクセスする端末は、Windows、Linux、macOS、スマホを対象にする。
- 起動したコンピューター自身では、`http://localhost:52582` でアクセスできることを基本とする。
- 同一ネットワーク上の別端末からは、起動したコンピューターのIPアドレスとポート番号でアクセスする。

ポート番号の方針:

- デフォルトのポート番号は `52582` とする。
- 追加で別のポート番号が必要な場合は、`52583`, `52584` のように続きの番号を使う。
- PC側のポート開放やファイアウォール設定は、このアプリでは自動変更しない。

## 2. Recommended Tech Stack

実装時の候補は以下。

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Realtime: Socket.IO
- Storage: SQLite
- Scoreboard rendering: インラインSVG（ベクター描画）でスコアボード本体を描く
- Styling: CSS（カスタムプロパティ、グラデーション、フィルター）＋ CSS Modules
- Fonts: 自己ホストのWebフォント（名前用のコンデンスド・ゴシック＋得点/カウント用の等幅数字）
- Logo storage: ローカルのアップロード用フォルダに保存

理由:

- ブラウザ表示と操作画面を分けやすい。
- Socket.IOにより、操作画面の変更を閲覧画面へ即時反映しやすい。
- SQLiteにより、プリセットや設定をアプリ終了後も保存しやすい。
- TypeScriptにより、スコア状態や操作履歴の扱いを安全にしやすい。
- Node.js系の構成により、将来的なWindows/Linux両対応を進めやすい。
- スコアボードをSVGで描くと解像度に依存せず、配信解像度や端末ごとの拡大縮小でも文字と図形を鮮明に保てる。
- SVGのグラデーションやフィルター（グロー、ベベル、影）により、基本CSSだけでは出しにくい放送品質の見た目を、無透過背景のまま実現できる。

## 3. Page Structure

### 3.1 Home Page

トップページ。

配置するボタン:

- スコアボードを見る
- スコアボードを動かす

設定ページへの導線は、トップページではなく「スコアボードを動かす」側のメニュー、またはスコア入力画面の編集メニューから用意する。

想定URL:

- `/`

### 3.2 Viewer Page

稼働中のスコアボードをすべて並べて表示するページ。
配信ソフトのブラウザソースで使うことを想定する。

主な機能:

- 稼働中スコアボードの一覧表示
- 各スコアボードの表示位置変更
- ページ全体の拡大、縮小
- 端末ごとのスコアボードサイズ変更
- 背景色の変更
- 表示設定の保存
- 操作画面からの変更をリアルタイム反映

サイズ方針:

- デフォルトでは、スコアボードの横幅、高さ、比率を画面幅に応じて自動設定する。
- 自動設定後のサイズは表示中の端末ごとに固定値として扱う。
- 複数端末で表示する場合、スコアボード表示ページのプロパティから端末ごとにサイズを編集できる。
- 端末ごとのサイズ変更は、他の端末の表示サイズには影響させない。
- 端末ごとの表示プロパティはブラウザ内に保存する。
- ブラウザ側で表示プロパティを入出力できるようにする。
- 配信画面用に操作UIを完全に非表示にする専用モードは将来追加できる設計にするが、優先度は最下位とする。

想定URL:

- `/viewer`

保存対象:

- viewer background color
- viewer scale
- per-device board size
- scoreboard positions
- scoreboard display order
- viewer property export data

### 3.3 Control List Page

「スコアボードを動かす」ページ。
稼働中のスコアボードを一覧表示し、選択してスコア入力画面に入る。
この一覧ではスコアボードの視覚プレビューは表示しない。
代わりに、現在の対戦スコアを `Team A 1-0 Team B 1回裏` のようなテキストで表示する。

主な機能:

- 稼働中スコアボードの一覧表示
- 現在の対戦スコアのテキスト表示
- 新規スコアボード作成
- スコアボード選択
- スコアボード名変更
- 不要なスコアボード削除

削除時の扱い:

- そのスコアボードの試合状態、選手名、操作履歴は削除する。
- チームプリセット、共通設定、表示設定は削除しない。
- 手動でスコアボードを削除する場合は、必ず確認を取る。
- 24時間アクセスなしの自動削除では、確認を取らずに削除する。

想定URL:

- `/control`

### 3.4 Score Input Page

個別スコアボードの操作画面。

主な機能:

- ボール、ストライク、アウト、得点、ランナー、イニングの操作
- 一塁、二塁、三塁のランナーON/OFF
- 先攻、後攻それぞれの得点 +1 / -1
- 打席結果の入力
- ABS回数の操作
- 戻る、進む
- 編集メニューの表示
- 選手名メニューの表示
- 操作結果を閲覧画面へリアルタイム反映

想定URL:

- `/control/:boardId`

### 3.5 Settings Page

アプリ全体の設定画面。

主な機能:

- チームプリセットの作成、編集、削除
- プリセット名の編集
- チームロゴ、略称、チームカラー、文字色の保存
- 汎用設定の追加
- アクセスがない場合の自動削除設定
- 一時演出の表示秒数設定

想定URL:

- `/settings`

## 4. Scoreboard Visual Design

レイアウトの参考画像は `design_plan.jpg`。
採用するビジュアルデザインは `design_claude_fable.jpg`（詳細は 4.2）。
`design_plan.jpg` は配置の指針として使い、細かなズレは再現せず、実装時はバランスを整えて配置する。

### 4.1 基本レイアウト

基本レイアウト:

- 全体は黒背景の横長スコアボード
- 左側にイニング表示
- 中央にチーム情報と得点
- 右側にランナー、カウント、アウト数
- 上側に対戦選手表示オプション
- 文字はNoto Sansなどの明瞭なゴシック体を優先し、参考画像に近い太く読みやすい表示にする。
- 打順番号と `P` の背景四角は、文字が視認しやすい大きさにする。
- バッター行とピッチャー行の間には、通常文字色と同じ白の仕切り線を左から右まで一直線に入れる。
- イニング表記、チーム名、得点、ランナー表記、カウント、アウト数は、上部の選手表記より大きく表示する。

表示要素:

- イニング数
- 表、裏の表示
- 先攻チームロゴ
- 先攻チーム略称
- 先攻得点
- 後攻チームロゴ
- 後攻チーム略称
- 後攻得点
- ランナー表示
- ボール、ストライク
- アウト数
- ABSチャレンジ残数
- バッター名
- ピッチャー名
- バッター成績
- ピッチャー球数
- 一時演出表示

一時演出:

- ホームラン時: `HOME RUN`
- 空振り三振時: `K`
- 見逃し三振時: 逆向きの `K`
- 表示秒数はスコアボードごとではなく、全体の設定で変更する。

得点はスコアボード内で最も大きく表示する。
チームカラー上の文字色はチームごとに設定可能とし、初期値は白にする。

### 4.2 採用デザイン: Broadcast LED スタイル

参考画像: `design_claude_fable.jpg`
（初稿は `design_claude_opus.jpg`。フィードバックを反映した改訂版 `design_claude_fable.jpg` が現行案）

![新スコアボードデザイン案 (Broadcast LED)](design_claude_fable.jpg)

方針:

- 従来の基本CSS版は、平坦な塗りと標準的な枠線で情報は読めるが、放送映像に重ねると素朴で古い印象になっていた。
- 新デザインは、テレビ中継のスコアバグに近い「Broadcast LED」スタイルにする。
- 配置は `design_plan.jpg` を維持したまま、質感と視認性を引き上げる。
- 画像はグリーンバック上に配置し、無透過背景でクロマキー運用に耐えることを示している。

ビジュアルの要点:

- 本体は角丸のダークパネルに、金属質のベゼル（外枠）と柔らかいドロップシャドウを重ねて奥行きを出す。
- 背景は暗い紺〜黒の縦グラデーションで、無透過のまま。グリーンバックに重ねてクロマキー抜きできる前提を崩さない。
- スコアボード全体は横長（およそ2:1）にし、チーム略称が全角6文字（例: ソフトバンク）まで、仕切り線や得点の数字に重ならずに入る幅を確保する。
- チームカラーの帯は上→下の縦グラデーションと上部のハイライトで、平坦ではなく立体的なバー表現にする。
- チームカラーの帯（チーム枠）は、2桁得点まで余裕を持って収まる大きさを確保する。
- 得点は最大サイズの白文字にし、淡いグローを添えて最も目立たせる。
- 得点の数字は、チーム帯の右端いっぱいに確保した固定幅の得点スロットの中で左右中央揃えにする。これにより、2桁得点（例: 20点）でも桁が重ならず、チーム帯の大きさも変わらない。
- 得点スロットの左端には薄い仕切り線を入れ、得点部分とチーム略称の領域を分ける。チーム略称が長い場合は、仕切り線を越えないように略称側の文字を自動縮小する。
- イニングの数字はイニング枠の上下中央に置き、表裏の三角はその上に添える。
- 上部の打者・投手行の間には、参考画像どおり左右いっぱいの仕切り線を入れて行を分ける。
- 打者・投手行の選手名と成績は、配信画面でも読みやすい大きめの文字にする（4.1のとおり、イニング・チーム名・得点・カウント類よりは小さくする）。
- 打者・投手行と得点エリアの間には、細い水色（アクセントカラー）のセパレーターを入れて情報の階層を示す。
- ランナーはひし形のベース図で表し、進塁中のベースは赤の塗り＋グローで点灯表現にする。
- カウントは `3-2` のように大きく表示する。`B - S` などの補助ラベルは付けない。
- アウトは大きめのLED風ドット（点灯=赤グロー、消灯=グレー枠）だけで表し、`OUT` の文字ラベルは付けない。
- ABSの残チャレンジ数は、各チーム帯の左端に見やすい大きさの縦ピップで示す。

配色（初期値、チーム設定で上書き可能）:

- 背景パネル: 紺〜黒 (`#141b28` → `#070a11`)
- アクセント: 水色 (`#38bdf8`)
- 先攻(例): 赤系グラデーション、後攻(例): 青系グラデーション
- 文字色: 白 (`#ffffff`)。チームカラー上の文字色はチームごとに設定可能で、初期値は白。
- 点灯表示(ベース/アウト): 赤 (`#ef2233`)

一時演出（`HOME RUN` / `K` / 逆向き `K`）は、この本体の上に重ねる全面オーバーレイとして表示し、CSSアニメーションまたはLottieで動きを付ける。表示秒数は全体設定に従う。

モックアップ生成ファイル（Claude以外のAIエージェントも参照可能）:

- [tests/design_fable/mockup.html](../tests/design_fable/mockup.html) — スコアボード本体のモックアップ原本（HTML + インラインSVG）
- [tests/design_fable/render.mjs](../tests/design_fable/render.mjs) — モックアップを `design_claude_fable.jpg` へ書き出すスクリプト
- [tests/design_fable/measure.mjs](../tests/design_fable/measure.mjs) — 文字の描画範囲を計測し、仕切り線や数字との重なりを検証するスクリプト
- [tests/design_fable/README.md](../tests/design_fable/README.md) — 前提条件と使い方

デザインを修正する場合は `mockup.html` を編集し、`measure.mjs` で重なりがないことを確認してから `render.mjs` で画像を書き出す。

### 4.3 レンダリング技術

スコアボード本体は、基本CSSではなく **インラインSVG（ベクター描画）** で描く。

採用理由:

- 解像度非依存: 配信解像度（720p/1080p/4K）や、Viewer Pageの端末ごとの拡大縮小でも、文字・図形を鮮明なまま保てる。
- 質感表現: SVGのグラデーション、フィルター（グロー、ベベル、影）で、基本CSSでは出しにくい放送品質の見た目を作れる。
- 図形の精密表現: ベースのひし形、イニングの三角、LED風ドットなどを正確に描ける。
- 無透過背景の担保: 一番下に不透明の矩形を敷くだけで背景を確実に無透過にでき、グリーンバック運用と両立する。
- 依存の少なさ: SVGはブラウザ標準で追加ライブラリが不要。既存の構成（React または現行のプレーンJS）にそのまま組み込める。
- データ駆動: スコアやカウント等の状態を、SVGの属性・テキストへ直接バインドできる。

検討したが採用しなかった案:

- Canvas / WebGL: 文字の鮮明さやアクセシビリティで不利で、再描画が命令的になり保守しづらい。今回の要件には過剰。
- 基本CSSのみの強化: グローや面取り、セグメント表示などが手続き的になりやすく、拡大縮小時の鮮明さでもSVGに劣る。

タイポグラフィ:

- 名前・略称: コンデンスド・ゴシック体（例: Bahnschrift / DIN系。クロスプラットフォーム用途では Saira Condensed や Barlow Condensed などの自己ホストWebフォントを推奨）。
- 得点・カウント: 太めの等幅（tabular）数字にして桁のブレをなくす。
- 日本語表示部分は Noto Sans JP 系を併用する。
- ライセンス上再配布可能なフォントを自己ホストし、OSに依存せず同じ見た目になるようにする。

この方針は `2. Recommended Tech Stack` の Scoreboard rendering / Styling / Fonts と対応する。

## 5. Main Data Model

この章の詳細は `data_model.md` に記載する。
設計変更時は、この親設計書ではなく `data_model.md` を更新する。

`data_model.md` に含める内容:

- Board
- Game State
- Team Settings
- Team Preset
- Player Settings
- Viewer Settings
- General Settings
- Persistence Summary

## 6. Operation Rules

この章の詳細は `operation_rules.md` に記載する。
設計変更時は、この親設計書ではなく `operation_rules.md` を更新する。

`operation_rules.md` に含める内容:

- Pitch Buttons
- Plate Appearance Buttons
- Out Buttons
- Change Button
- Runner Controls
- Manual Score Controls
- ABS Controls
- Board Management Controls
- Viewer Property Controls
- Undo and Redo
- Realtime Sync
- Automatic Cleanup
- Overlay Timing

## 7. Menus

### 7.1 Edit Menu

スコア入力画面から横に出てくるメニュー。

編集できる内容:

- スコアボード名
- 先攻チームロゴ
- 先攻チーム略称
- 先攻チームカラー
- 先攻文字色
- 後攻チームロゴ
- 後攻チーム略称
- 後攻チームカラー
- 後攻文字色
- ABS表示オプション
- 対戦選手表示オプション
- チームプリセット読み込み
- チームプリセット書き出し

### 7.2 Player Menu

対戦選手表示オプションが有効な場合に使うメニュー。

編集できる内容:

- 先攻打者 1-9番
- 後攻打者 1-9番
- 守備位置
- 代打チェック
- 先攻ピッチャー一覧
- 後攻ピッチャー一覧
- ピッチャー追加

表示ルール:

- バッターは常に上。
- ピッチャーは常に下。
- 表裏に応じて色は攻撃側、守備側に入れ替わる。
- 代打時は打順番号を `PH` と表示する。

### 7.3 Global Settings

全体の設定画面で編集する内容。

- 自動削除の有効/無効
- 自動削除までのアクセスなし時間
- 一時演出の表示秒数
- チームプリセット

一時演出の表示秒数は、個別スコアボードの編集メニューには置かない。

### 7.4 Viewer Property Panel

Viewer Pageで開く表示プロパティ用のパネル。

編集できる内容:

- 背景色
- ページ全体の拡大率
- 端末ごとのスコアボードサイズ
- スコアボードの表示位置
- 表示プロパティの書き出し
- 表示プロパティの読み込み

このパネルの設定は端末ごとの見え方を調整するためのもので、試合状態には影響しない。

### 7.5 Delete Confirmation Dialog

手動削除時に表示する確認ダイアログ。

表示する場面:

- Control List Pageからスコアボードを削除するとき

ルール:

- 削除対象のスコアボード名を表示する。
- 確認後にのみ削除する。
- 24時間アクセスなしの自動削除では表示しない。

## 8. Needed File Structure

実装時に作る想定のファイル構成。
現時点ではまだ作成しない。

```text
baseball-scoreboard/
  docs/
    scoreboard_design.md
    data_model.md
    operation_rules.md
    button_list.md
    user_guide.txt
  package.json
  tsconfig.json
  vite.config.ts
  src/
    client/
      main.tsx
      App.tsx
      routes/
        HomePage.tsx
        ViewerPage.tsx
        ControlListPage.tsx
        ScoreInputPage.tsx
        SettingsPage.tsx
      components/
        scoreboard/
          ScoreboardView.tsx
          InningPanel.tsx
          TeamRow.tsx
          RunnerPanel.tsx
          CountPanel.tsx
          PlayerMatchupPanel.tsx
          AbsIndicator.tsx
          OverlayMessage.tsx
        controls/
          PitchControls.tsx
          PlateAppearanceControls.tsx
          OutControls.tsx
          RunnerControls.tsx
          ScoreControls.tsx
          BoardManagementControls.tsx
          HistoryControls.tsx
          InningControls.tsx
        menus/
          EditMenu.tsx
          PlayerMenu.tsx
        settings/
          TeamPresetEditor.tsx
          GeneralSettingsEditor.tsx
          ViewerPropertyPanel.tsx
          ColorInput.tsx
          LogoUploader.tsx
      api/
        boardApi.ts
        presetApi.ts
        socketClient.ts
      state/
        scoreboardReducer.ts
        operationHistory.ts
      styles/
        global.css
        scoreboard.css
    server/
      index.ts
      routes/
        boardRoutes.ts
        presetRoutes.ts
        settingsRoutes.ts
      realtime/
        socketServer.ts
      services/
        boardService.ts
        presetService.ts
        settingsService.ts
        cleanupService.ts
        imageService.ts
      db/
        database.ts
        schema.sql
        migrations/
    shared/
      types/
        scoreboard.ts
        team.ts
        player.ts
        settings.ts
        viewer.ts
      operations/
        scoreboardActions.ts
        scoringRules.ts
  storage/
    data/
      app.db
    uploads/
      team-logos/
  tests/
    scoringRules.test.ts
    scoreboardReducer.test.ts
    cleanupService.test.ts
    imageService.test.ts
```

### File Responsibilities

`docs/`

- `scoreboard_design.md` は、全体設計、画面構成、ファイル構造、実装順を置く。
- `data_model.md` は、データ構造、保存対象、削除対象、設定値を置く。
- `operation_rules.md` は、ボタン操作、状態変化、リアルタイム反映、自動削除のルールを置く。
- `button_list.md` は、画面ごとに必要なボタンと操作項目の一覧を置く。
- `user_guide.txt` は、コーディングに詳しくない人向けの起動、終了、基本操作の説明を置く。

`src/client/routes/`

- 各ページ単位の画面を置く。
- URLごとの表示内容を分ける。

`src/client/components/scoreboard/`

- 配信や閲覧で見えるスコアボード本体を置く。
- 操作ボタンは置かず、表示専用にする。

`src/client/components/controls/`

- スコア入力画面の操作ボタン群を置く。

`src/client/components/menus/`

- 編集メニューと選手名メニューを置く。

`src/client/api/`

- サーバーとの通信処理を置く。

`src/client/state/`

- 操作による状態変更、戻る、進むの処理を置く。

`src/server/`

- ローカルサーバー、保存処理、リアルタイム通信を置く。
- `cleanupService.ts` は、24時間アクセスなしの自動削除を扱う。
- `imageService.ts` は、ロゴ画像の256x256変換、形式チェック、圧縮を扱う。

`src/shared/`

- クライアントとサーバーの両方で使う型やルールを置く。

`storage/`

- 実行時に生成されるデータベースやロゴ画像を置く。
- Git管理対象から外す想定。

## 9. Realtime Sync Design

リアルタイム反映の詳細は `operation_rules.md` の `Realtime Sync` に記載する。
親設計書では、操作画面の変更をサーバー経由で閲覧画面へ反映する方針だけを管理する。

## 10. Persistence Rules

保存対象、削除対象、自動削除の詳細は `data_model.md` の `Persistence Summary` と `General Settings`、および `operation_rules.md` の `Automatic Cleanup` に記載する。
親設計書では、アプリ終了後も必要な設定を保存し、スコアボード削除時の扱いを詳細ファイルへ委譲する方針だけを管理する。

## 11. Implementation Order

実装に進む場合の推奨順。

1. プロジェクト雛形を作る。
2. スコアボード表示だけを先に作る。
3. ダミーデータでデザインを整える。
4. スコア状態の型と操作ルールを作る。
5. スコア入力画面を作る。
6. 閲覧画面と操作画面をリアルタイム連携する。
7. チームプリセットを保存できるようにする。
8. ロゴアップロードと256x256変換を追加する。
9. 選手名メニューと成績計算を追加する。
10. 戻る、進むを追加する。
11. 複数端末操作の競合処理を確認する。
12. 複数スコアボード表示と削除を仕上げる。
13. 自動削除設定を追加する。
14. 削除確認を追加する。
15. 配信用の背景色、拡大率、位置調整を仕上げる。
16. 端末ごとの表示プロパティの入出力を追加する。
17. 閲覧画面の完全非表示UIモードを将来追加できる余地を残す。

## 12. Coding Rules

実装時のルール。

- Windows/Linuxの各環境で前提となる要件は、`user_guide.txt` にまとめる。
- 依存関係や起動方法が変わった場合は、コードだけでなく `user_guide.txt` も更新する。
- 前提要件は、コーディングに詳しくない人が別途ChatGPTなどに質問してインストール手順を確認できる粒度で書く。
- 前提要件は、公式のインストール手順を実行すれば達成できる粒度で書く。
- 公式手順を丸ごと転載する必要はない。
- 例: Windows環境では、Node.jsとnpmがインストールされており、PATHが通っている必要がある。
- `11. Implementation Order` の手順は一つずつ実行し、各手順後のテストに成功したらGitに内容を保存する。
- OS依存のパス区切りやシェル固有の書き方をコードに直接埋め込まない。
- Windows/Linux両対応を崩す依存を追加する場合は、代替案や導入理由を設計書に残す。

## 13. Confirmed Decisions

確定済みの詳細仕様は、重複管理を避けるため以下のファイルに集約する。

- データ、保存、設定に関する決定: `data_model.md`
- 操作、リアルタイム反映、自動削除に関する決定: `operation_rules.md`

親設計書には、画面構成、見た目の方向性、ファイル構造、実装順のみを残す。

## 14. Remaining Open Questions

現時点ではなし。

## 15. Design Notes

デザイン実装時の注意。

- 得点を最も目立たせる。
- 黒背景の中で、チームカラー、白文字、カウント表示が読みやすいようにする。
- 小さい配信画面でも読める文字サイズにする。
- ボタン画面は操作ミスを防ぐため、種類ごとにまとまりを分ける。
- 配信用Viewer Pageには余計な説明文を出さない。
- スコアボード本体と操作画面は部品を分け、同じ見た目を再利用できるようにする。
