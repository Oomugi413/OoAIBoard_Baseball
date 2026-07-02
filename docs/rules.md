# Baseball Scoreboard Project Rules

このファイルは、プロジェクト全体の決めごとを集約する。
具体的には、技術スタック、実装順、コーディングルール、未決事項を置く。
画面の見た目やデータ構造などの個別仕様は、各設計ファイルに置く。

ドキュメント構成:

- `rules.md`（本ファイル）: 技術スタック、実装順、コーディングルール、未決事項。
- `operation.md`: 実装したいスコアボード／HTMLページの構造（ファイル構成を含む）と、操作による状態変化。
- `scoreboard_design.md`: 画面構成、スコアボードの見た目、メニュー。
- `data_model.md`: データ構造、保存対象、削除対象、設定値。
- `button_list.md`: 画面ごとのボタン一覧。
- `user_guide.txt`: 起動、終了、基本操作の説明。

## 1. Tech Stack

技術選定は次を重視して決める。

1. 配信で見劣りしない、必要十分にリッチなスコアボード表示を実現すること。
2. 非プログラマが簡単なコマンド（`npm install` と `npm start`）で起動できること。前提要件は Node.js と npm。
3. Windows / Linux の両対応を崩さないこと。
4. LAN内・数ボード・数端末という規模に対して、無用に複雑な構成は避けること。

見た目・演出の質を最優先しつつ、それに不要な複雑さは持ち込まない、というバランスで構成を選ぶ。

採用構成:

- 実行環境: Node.js（LTS）。npm 同梱。
- サーバー: Node標準の `node:http`。追加のWebフレームワークは使わない。
- 静的配信: `node:http` から `src/client/` を直接配信する。
- リアルタイム反映: SSE（Server-Sent Events / ブラウザ標準の `EventSource`）。
- フロントエンド: 素のJavaScript（ESモジュール）を基本にする。表示・演出の質を高めるために必要なら、軽量なビルド工程やライブラリの追加を許容する。
- 型の安全性: TypeScriptの代わりに JSDoc 型注釈 ＋ `// @ts-check`（`jsconfig.json`）で、まずはビルドなしでエディタ上の型チェックを得る。
- 保存: 単一のJSONファイル（`storage/data/app.json`）。書き込みは一時ファイル→リネームのアトミック書き込みで壊れないようにする。
- スコアボード描画: インラインSVG（ベクター描画）。詳細は `scoreboard_design.md` の 3.3。
- スタイル: CSS（カスタムプロパティ、グラデーション、フィルター）。
- フォント: 自己ホストのWebフォント（名前用のコンデンスド・ゴシック＋得点/カウント用の等幅数字）。CDNは使わず同梱する。
- 一時演出のアニメーション: 単純な演出はCSS/SVGアニメーションで作る。演出を増やして表現を豊かにする場合は Lottie（JSON定義のアニメーション）を使う。
- ロゴ画像変換: jimp（純JavaScript製の画像ライブラリ）。256x256変換・透過保持・圧縮に使う。
- ロゴ保存: ローカルのアップロード用フォルダ（`storage/uploads/team-logos/`）に保存。

理由:

- `node:http` と SSE だけで、operation.md の「操作をサーバーへ送る → サーバーが状態更新 → 閲覧画面へ通知」という一方向のリアルタイム反映を満たせる。双方向通信は不要。
- SSE はブラウザ標準で切断時の自動再接続を備え、追加ライブラリなしにスマホを含む対象ブラウザで動く。
- データ量はボード数個＋プリセット＋設定でキロバイト級のため、JSONファイルで十分。アトミック書き込みでアプリ終了後も安全に保存できる。
- スコアボードをSVGで描くと解像度に依存せず、配信解像度や端末ごとの拡大縮小でも文字と図形を鮮明に保てる（`scoreboard_design.md` 3.3 参照）。
- リッチな演出のためのビルドやライブラリ（Lottie など）は禁止しない。ただし起動の簡単さ（`npm install` と `npm start`）とWindows/Linux両対応は守る。
- jimp は純JavaScript製でネイティブビルドが不要なため、Windows/Linuxのどちらでもインストールに失敗しにくい。

見送った候補と理由（`3. Coding Rules` の方針に基づき記録する）:

- React + TypeScript + Vite: 5ページ規模には過剰で、状態更新のたびに再描画する現行方式で足りる。将来UIが複雑化したら再検討する。型はまず JSDoc＋`@ts-check` で代替する。
- Express: ルーティングと静的配信は `node:http` で足り、依存を1つ減らせる。
- Socket.IO: 双方向通信もルーム管理も不要。SSEで要件を満たせ、依存を減らせる。
- SQLite（better-sqlite3 等）: ネイティブモジュールで環境によりインストールに失敗する恐れがあり、非プログラマ運用の最大リスク。データ規模的にもJSONで足りる。将来データが増えた場合は、追加インストール不要でNodeに内蔵された `node:sqlite` へ移行できる余地を残す。
- sharp（画像変換）: 高速だがネイティブバイナリ依存。256x256のロゴ変換では速度差は体感できないため、純JS製の jimp を優先する。

## 2. Implementation Detail

### 2.1 File Structure

実装が進むにつれて作る想定のファイル構成。
初期実装ではファイルをまとめてよく、機能追加に合わせて分割する。

```text
baseball-scoreboard/
  docs/
    rules.md                  # 技術スタック・実装順・コーディング規約・未決事項
    scoreboard_design.md      # 画面構成・スコアボードの見た目・メニュー
    operation.md              # 実装したい機能と操作ルール
    data_model.md             # データ構造・保存対象・削除対象
    button_list.md            # 画面ごとのボタン一覧
    user_guide.txt            # 起動・終了・基本操作
    design_plan.jpg           # レイアウト参考画像
    design_claude_fable.jpg   # 採用デザイン案の画像
  package.json                # "type": "module"、scripts(start/test)、依存はjimpのみ
  jsconfig.json               # @ts-check によるエディタ型チェック
  .gitignore
  src/
    client/                   # ブラウザ用。ESモジュールとして配信
      index.html
      app.js                  # エントリ。ルーティング、状態同期(SSE)、再描画の起点
      lib/
        api.js                # fetchラッパと EventSource(SSE) クライアント
        router.js             # ハッシュルーティング
        viewerSettings.js     # 端末ごとの表示プロパティ(localStorage)と入出力
        scoreboard/
          scoreboardView.js   # インラインSVGのスコアボード描画（表示専用）
          overlay.js          # HOME RUN / K などの一時演出オーバーレイ
        pages/
          homePage.js
          viewerPage.js
          controlListPage.js
          scoreInputPage.js
          settingsPage.js
        menus/
          editMenu.js
          playerMenu.js
      styles/
        app.css               # 全体スタイル（規模に応じ scoreboard.css 等へ分割可）
      fonts/                  # 自己ホストのWebフォント（同梱）
    server/                   # ローカルサーバー（node:http）
      index.mjs               # サーバ起動、静的配信、APIルーティング、SSE
      lib/
        store.js              # app.json の読み書き（アトミック書き込み）
        api.js                # REST処理（boards / presets / settings / logo upload）
        sse.js                # SSEクライアント管理と broadcast
        cleanup.js            # 24時間アクセスなしの自動削除
        imageService.js       # jimpによる256x256変換・形式チェック・透過保持・圧縮
    shared/                   # クライアント/サーバー双方で使う定義とルール
      scoringRules.mjs        # 試合状態と applyAction（サーバーが利用、単体テスト対象）
      types.js                # JSDoc typedef（@ts-check で共有する型の形）
  storage/                    # 実行時に生成。Git管理対象外
    data/
      app.json                # boards + presets + settings
    uploads/
      team-logos/             # 変換後の256x256ロゴ
  tests/
    scoringRules.test.mjs     # node:test
    imageService.test.mjs
    store.test.mjs
    design_fable/             # スコアボードのデザインモックアップと生成スクリプト
```

ファイルの役割:

- `docs/` は設計ファイル群。`rules.md`（本ファイル）にプロジェクト全体のルールとファイル構成、`scoreboard_design.md` に見た目、`operation.md` に実装したい機能と操作ルール、`data_model.md` にデータ構造を置く。
- `src/client/` はブラウザで動く画面一式。`app.js` をエントリに、`lib/pages/` へ各ページ、`lib/menus/` へメニュー、`lib/scoreboard/` へ表示専用のスコアボード描画（インラインSVG）を置く。スコアボード描画は操作ボタンを含めず、Viewer PageとScore Input Pageで同じ見た目を再利用する。
- `src/server/` はローカルサーバー、保存処理、リアルタイム通信。`index.mjs` は `node:http` でサーバーを起動し、静的配信・APIルーティング・SSEをまとめる。`lib/store.js` は `app.json` をアトミック書き込みで安全に読み書きし、`lib/cleanup.js` は自動削除、`lib/imageService.js` は jimp によるロゴ変換（256x256・PNG/JPEG判定・透過保持・圧縮）を扱う。
- `src/shared/` はクライアント/サーバー双方で使う定義とルール。`scoringRules.mjs` は試合状態と操作（applyAction）を持ち、単体テストの対象にする。
- `storage/` は実行時に生成されるJSONデータとロゴ画像。Git管理対象から外す。

### 2.2 Implementation Lists

実装に進む場合の推奨順。
実装状況の凡例: [済] = 実装済み / [一部] = 一部実装 / [未] = 未実装。
（実装状況の最終確認日: 2026-07-02）

1. [済] プロジェクト雛形を作る。
2. [済] スコアボード表示だけを先に作る。
3. [済] ダミーデータでデザインを整える。（現状は基本CSS版。`scoreboard_design.md` 3.2 の Broadcast LED デザインへの置き換えはこれから）
4. [済] スコア状態の型と操作ルールを作る。
5. [済] スコア入力画面を作る。
6. [済] 閲覧画面と操作画面をリアルタイム連携する。（SSEで実装）
7. [未] チームプリセットを保存できるようにする。
8. [未] ロゴアップロードと256x256変換を追加する。（現状はロゴURLの文字列入力のみ）
9. [一部] 選手名メニューと成績計算を追加する。（打者の編集と成績計算は済み。ピッチャー追加が未実装で、現在のピッチャー1人しか編集できない）
10. [済] 戻る、進むを追加する。（キーボードショートカットは未実装）
11. [未] 複数端末操作の競合処理を確認する。（後勝ちの方針は決定済みだが、確認作業は未実施）
12. [済] 複数スコアボード表示と削除を仕上げる。
13. [済] 自動削除設定を追加する。
14. [済] 削除確認を追加する。（ブラウザ標準の確認ダイアログで実装）
15. [一部] 配信用の背景色、拡大率、位置調整を仕上げる。（背景色・拡大率は済み。表示位置の変更と画面幅に応じた自動サイズが未実装）
16. [済] 端末ごとの表示プロパティの入出力を追加する。（クリップボード経由の簡易入出力で実装）
17. [未] 閲覧画面の完全非表示UIモードを将来追加できる余地を残す。（将来項目）

## 3. Coding Rules

実装時のルール。

- 起動は簡単なコマンド（`npm install` と `npm start`）で完結する状態を保つ。
- ビルド工程やライブラリの追加は、スコアボードの表示・演出の質を高めるために必要な範囲で許容する。ただしWindows/Linux両対応と起動の簡単さを崩さない。追加時は理由を本ファイルに残す。
- 実行時の追加npm依存は、必要な範囲にとどめる。新たに追加する場合は、純JavaScript製で環境依存が少ないものを優先し、理由を本ファイルに残す（例: 画像変換の jimp）。
- 型はまず TypeScript を導入せず、JSDoc注釈＋`// @ts-check` で確認する。将来的な導入は妨げない。
- `app.json` への書き込みは、一時ファイルに書いてからリネームするアトミック書き込みにし、書き込み途中のクラッシュで壊れないようにする。
- OS依存のパス区切りやシェル固有の書き方をコードに直接埋め込まない。
- Windows/Linuxの各環境で前提となる要件は、`user_guide.txt` にまとめる。
- `user_guide.txt` は、コードで実装し次第書き換える。仕様段階では先行して書き換えない。依存関係や起動方法が変わった場合は、コードだけでなく `user_guide.txt` も更新する。
- 前提要件は、コーディングに詳しくない人が別途ChatGPTなどに質問してインストール手順を確認できる粒度で書く。公式のインストール手順を実行すれば達成できる粒度でよく、公式手順を丸ごと転載する必要はない（例: Windows環境では、Node.jsとnpmがインストールされ、PATHが通っている必要がある）。
- `2.2 Implementation Lists` の手順は一つずつ実行し、各手順後のテストに成功したら実装リストを更新してから、Gitに内容を保存する。

## 4. Open Questions

現時点で保留・未反映の事項。決まり次第、該当ファイルへ反映する。

- ABS表示・対戦選手表示のデフォルトON/OFFを `data_model.md` に明記する（現実装は両方ON）。未反映。
- コード側の整理（例: 盗塁死用の `keepCurrentBatterOnNextInning` フラグの要否）。次にコードを触るときに検討する。
- Viewer Pageの「表示位置の変更」と「画面幅に応じた自動サイズ」は未実装（`2.2 Implementation Lists` の 15 / 16）。
- 一時演出を Lottie で増やす場合の具体的な演出内容と、必要になるビルド構成。実装時に詰める。
