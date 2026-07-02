# design_fable モックアップ生成ファイル

`docs/design_claude_fable.jpg`（採用デザイン案の画像）を生成するためのファイル一式。
Claude 以外の AI エージェントや人間が、デザインの再現・修正・再書き出しをできるように保存している。

## ファイル

- `mockup.html` — スコアボード本体のモックアップ（HTML + インラインSVG）。**デザインの原本**。
- `render.mjs` — `mockup.html` を Chrome ヘッドレスで JPG に書き出すスクリプト。
- `measure.mjs` — SVG内の文字の描画範囲(BBox)を出力するスクリプト。チーム略称が得点スロットの仕切り線を越えていないか、得点の数字がスロット中央にあるかを数値で検証する。
- `package.json` — 依存関係（puppeteer-core）。

## 前提

- Node.js と npm がインストールされ、PATHが通っていること。
- Google Chrome がインストールされていること。
  - 既定パス: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - 異なる場合は環境変数 `CHROME_PATH` で実行ファイルの場所を指定する。

## 使い方

```
cd tests/design_fable
npm install
node measure.mjs                                    # 文字範囲の計測（重なり検証）
node render.mjs ../../docs/design_claude_fable.jpg  # デザイン画像の書き出し
```

## デザイン修正の手順

1. `mockup.html` を編集する（配置・寸法は `docs/scoreboard_design.md` の 4.1〜4.2 に従う）。
2. `node measure.mjs` で、チーム略称の右端(x2)が得点スロットの仕切り線の位置より小さいこと、得点数字の左右余白が等しいことを確認する。
3. `node render.mjs ../../docs/design_claude_fable.jpg` で画像を書き出す。
4. `docs/scoreboard_design.md` の記述と食い違いが出た場合は、設計書側も更新する。

## 主な設計値（mockup.html 内のSVG座標）

- viewBox: `0 0 1160 560`（横長 約2:1）
- チーム帯: x=162〜936、チーム略称は全角6文字（例: ソフトバンク）まで
- 得点スロット: x=746〜936（帯の右端いっぱい）、数字はスロット内で左右中央揃え
- スロット左端 x=746 に薄い仕切り線
- ステータス欄（ベース・カウント・アウト）: x=946〜1147、中心 x=1046
