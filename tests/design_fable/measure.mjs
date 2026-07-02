// mockup.html 内の全 <text> 要素の描画範囲(BBox)を出力するスクリプト。
// チーム略称が仕切り線(得点スロット左端)を越えていないか、
// 得点の数字がスロット内で左右中央になっているかの検証に使う。
// 使い方: node measure.mjs
// Chrome の場所が既定と異なる場合は環境変数 CHROME_PATH で指定する。
import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "mockup.html");
const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
const result = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("text").forEach((t) => {
    const b = t.getBBox();
    out.push({ text: t.textContent, cls: t.getAttribute("class"), x1: Math.round(b.x), x2: Math.round(b.x + b.width) });
  });
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
