// mockup.html を Chrome ヘッドレスで JPG に書き出すスクリプト。
// 使い方: node render.mjs [出力先.jpg]
// Chrome の場所が既定と異なる場合は環境変数 CHROME_PATH で指定する。
import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "mockup.html");
const outPath = process.argv[2] || path.join(__dirname, "out.jpg");
const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--no-sandbox", "--force-color-profile=srgb"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1560, height: 940, deviceScaleFactor: 2 });
await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: outPath, type: "jpeg", quality: 92 });
await browser.close();
console.log("wrote", outPath);
