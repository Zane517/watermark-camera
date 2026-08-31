// 打包脚本：把拆分的项目合并回单文件 HTML，方便分享或直接用 file:// 打开
// 用法：node build.mjs
// 产物：dist/今日水印相机.html
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, "index.html");
const outDir = join(root, "dist");
const outFile = join(outDir, "今日水印相机.html");

let html = readFileSync(entry, "utf8");
let inlined = 0;

html = html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g, (m, href) => {
  const f = join(root, href);
  if (!existsSync(f)) throw new Error("缺少样式文件：" + href);
  inlined++;
  return "<style>\n" + readFileSync(f, "utf8") + "\n</style>";
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const f = join(root, src);
  if (!existsSync(f)) throw new Error("缺少脚本文件：" + src);
  inlined++;
  return "<script>\n" + readFileSync(f, "utf8") + "\n</script>";
});

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html, "utf8");

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(`已内联 ${inlined} 个文件：${outFile}（${kb} KB）`);
