<div align="center">

# 今日水印相机 · Today Watermark Camera

**零依赖纯前端照片水印工具——时间、经纬度、地址、拍摄人自动叠加，图片全程本地处理。**

[![Build APK](https://github.com/Zane517/watermark-camera/actions/workflows/build-apk.yml/badge.svg)](https://github.com/Zane517/watermark-camera/actions/workflows/build-apk.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-online-277AF7?logo=githubpages)](https://zane517.github.io/watermark-camera/)
[![License: MIT](https://img.shields.io/badge/license-MIT-36D167.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.4.1-3482ff.svg)](#十更新日志)
[![Dependencies](https://img.shields.io/badge/dependencies-none-36D167.svg)](#三模块架构)

[在线演示](https://zane517.github.io/watermark-camera/) · [快速开始](#二快速开始) · [模块架构](#三模块架构) · [配置](#四配置高德-web-服务key可选) · [更新日志](#十更新日志)

</div>

---

## 一、项目简介

今日水印相机是一个运行在浏览器里的照片水印工具，适用于考勤打卡、巡检留痕、现场实拍等场景。选择图片或调用摄像头拍摄后，工具会在画面上叠加时间、经纬度、地址、拍摄人与备注等信息，并按原图分辨率导出。

**核心特性：**

- **数据不出端**：图像解码、水印绘制与编码全部在浏览器本地完成，图片不上传、无遥测、无用户数据采集。
- **零依赖**：原生 HTML / CSS / JavaScript，无框架、无 npm 依赖、无必需构建步骤。
- **完整取证要素**：时间、经纬度（**统一 WGS84**）、地理位置、拍摄人、备注，均可自动获取或手动修正。
- **多形态分发**：在线 PWA、单文件 HTML、本地静态服务、Android APK 四种部署方式。
- **离线可用**：PWA 侧由 Service Worker 缓存应用外壳；APK 侧 Web 资源内置，完全离线可运行。
- **双主题 UI**：基于 [Miuix](https://github.com/compose-miuix-ui/miuix)（HyperOS 风格）官方色板，跟随系统明暗模式自动切换。

---

## 二、快速开始

### 2.1 在线使用（推荐）

访问 **[zane517.github.io/watermark-camera](https://zane517.github.io/watermark-camera/)**，由 GitHub Pages 以 HTTPS 托管，摄像头、定位等能力开箱即用。手机浏览器可通过「添加到主屏幕」安装为独立窗口应用。

### 2.2 本地运行

在仓库根目录执行，任选其一：

    npx serve .
    python -m http.server 8000

也可直接双击 <code>index.html</code> 打开（<code>file://</code> 下摄像头/定位不可用，用「选择图片」导入）。

### 2.3 单文件分发

    node build.mjs

生成 <code>dist/今日水印相机.html</code>（约 31 KB），可单独分发给他人。

### 2.4 Android APK（相机首页 + 本地内置 + 自动更新）

仓库内置 WebView 壳工程（<code>android/</code>），**启动首页为全屏相机水印页 <code>app.html</code>（与网页版分离）**：实时取景并逐帧叠加时间/水印，点按画面弹出面板编辑，快门拍照经原生桥写入系统相册（Pictures/AI），底栏「工具」可进入完整网页版。CI 构建时将全部 Web 资源同步进 APK（<code>assets/www/</code>）：

1. **Actions → Build APK → Run workflow**（推送 <code>android/</code> 或网页文件变更均会自动触发）；
2. 在运行详情页 **Artifacts** 下载 <code>watermark-camera-apk</code>，获得 <code>app-debug.apk</code>；
3. 安装后首次启动会申请摄像头、定位与（Android 9 及以下）存储权限。

壳加载 APK 内置资源，**断网完全可用**；启动时读取 <code>version.json</code>，发现更高版本即静默同步，网页迭代无需重装 APK。

---

## 三、模块架构

数据流：<code>app.js</code>（状态与事件） → <code>watermark.js</code>（Canvas 绘制） → 预览 / 导出；地理数据经 <code>geo.js</code> 获取后写回状态。各模块通过 <code>window.WM</code> 命名空间协作，未使用 ES Module，因此 <code>file://</code> 直开可用。

| 文件 | 职责 |
|------|------|
| <code>index.html</code> | 网页版入口（完整编辑工具） |
| <code>app.html</code> · <code>js/appcam.js</code> · <code>js/appedit.js</code> | App 首页相机水印页：实时取景叠加、点按编辑、拍照保存，与网页版完全分离 |
| <code>css/style.css</code> | Miuix 设计语言主题（双主题 CSS 变量） |
| <code>js/config.js</code> | 默认参数、导出画质、AMap Key 读写 |
| <code>js/utils.js</code> | 时间格式化、中英混排文字测量、圆角矩形 |
| <code>js/geo.js</code> | 浏览器定位、地址逆地理、地址转经纬度、**GCJ-02 ⇄ WGS84 本地转换** |
| <code>js/camera.js</code> | 摄像头启停与抓帧 |
| <code>js/watermark.js</code> | 水印绘制，仅依赖状态与画布，无 DOM 耦合 |
| <code>js/app.js</code> | 网页版 UI 绑定与主流程 |
| <code>sw.js</code> · <code>manifest.webmanifest</code> | PWA 离线缓存与安装清单（在线模式） |
| <code>build.mjs</code> | 将样式与脚本内联为单文件 HTML |
| <code>android/…/MainActivity.java</code> | 壳：首页加载、权限、选图、<code>AppNative</code> 保存桥 |
| <code>android/…/LocalAssets.java</code> · <code>Updater.java</code> | 资源拦截（更新优先/内置兜底）与后台版本同步 |
| <code>version.json</code> | 发布版本号与待同步文件清单 |

---

## 四、配置高德 Web 服务 Key（可选）

不配置 Key 时，「地址逆地理」与「地址转经纬度」不可用，其余功能不受影响。

1. [高德开放平台](https://lbs.amap.com/) → 控制台 → 创建应用 → 添加 Key；
2. **服务平台必须选择「Web 服务」**，误选「Web 端 (JS API)」会返回 <code>INVALID_USER_SCODE</code>；
3. 页面右上角「配置定位 Key」→ 粘贴保存。

Key 仅写入浏览器 <code>localStorage</code>（键名 <code>wm.amap.key</code>），不会进入任何源码文件或远端服务器；清空输入框即可删除。APK 与在线版的存储域不同，首次在新环境使用需重新配置一次。

---

## 五、功能说明

### 5.1 水印字段

| 字段 | 来源 | 说明 |
|------|------|------|
| 时间 | 自动 / 手动 | 导入图片或点击「现在」时刷新，可手改 |
| 纬度 / 经度 | 自动 / 手动 | 浏览器定位或高德地址编码，统一 WGS84（见 5.3），可手改 |
| 地址 | 自动 / 手动 | 逆地理反查或手填 |
| 拍摄人 / ID、备注 | 手动 | 填写后方渲染至水印 |

### 5.2 水印风格

| 风格 | 布局 |
|------|------|
| 经典 | 左下信息块 + 画面中央半透明「现场拍照」+ 右下弧形文字 |
| 简洁 | 左上信息块，可选半透明底衬 |
| 角落 | 同简洁，固定于左下角 |

可调项：中央水印 / 弧形水印（文字可自定义）/ 时间 / 经纬度 / 地址开关、底衬开关、字号缩放（1.2–5.0）。导出始终为**原图分辨率 + JPEG 95%**，不受预览尺寸影响。

### 5.3 坐标系说明（固定 WGS84）

- 浏览器定位原生返回 WGS84，直接使用；
- 高德地理编码返回 GCJ-02，<code>geo.js</code> 本地转换为 WGS84 后再进入水印（境外原样返回）；
- 逆地理反查入参先由 WGS84 转成 GCJ-02 发给高德，保证地址准确；
- 坐标系选择已移除，水印恒显示「坐标系：WGS84坐标系」。

---

## 六、设计规范

UI 采用 [Miuix](https://github.com/compose-miuix-ui/miuix)（<code>compose-miuix-ui/miuix</code>）项目 <code>Colors.kt</code> 中的官方 <code>lightColorScheme</code> / <code>darkColorScheme</code> 色板：主色 <code>#3482FF</code>（浅色）/ <code>#277AF7</code>（深色），深色背景 <code>#242424</code>，字体栈 MiSans → HarmonyOS Sans SC → PingFang SC。通过 <code>prefers-color-scheme</code> 自动切换，顶栏使用毛玻璃（backdrop-filter），卡片圆角 24px；App 编辑面板为 HyperOS 设置式分组布局。

---

## 七、环境与兼容性

| 能力 | HTTPS / localhost | <code>file://</code> 直开 | Android APK |
|------|:-:|:-:|:-:|
| 图片导入与水印导出 | ✅ | ✅ | ✅ |
| 摄像头拍摄 | ✅ | ❌（用「选择图片」） | ✅ |
| 浏览器定位 | ✅ | 视浏览器而定 | ✅ |
| PWA 安装 / 离线 | ✅ | ❌ | —（本地资源内置） |
| 断网运行 | 依赖 SW 缓存 | ✅ | ✅（资源内置，无需网络） |

支持 Chrome / Edge / Firefox / Safari 等现代浏览器；建议使用近两个大版本。局域网 <code>http://IP:8000</code> 不属于安全上下文，摄像头同样不可用。

---

## 八、隐私与安全

- 图片、水印数据、定位信息与 Key 均不离开本机，无统计 SDK、无 Cookie、无第三方存储。
- 除用户主动触发的高德地理编码请求外，在线模式无其他外部网络请求。
- APK 启动时仅静默读取一次 <code>version.json</code>（版本号与文件清单）检查更新，离线自动跳过。
- Android 壳工程仅提供 WebView 容器与权限桥接，不采集、不回传任何数据；资源读取带路径穿越防护。

---

## 九、免责声明

时间与经纬度均支持手动编辑，因此水印内容**不具备防篡改证明力**。本工具面向工作留痕、日常记录与材料整理，不建议作为唯一法律证据使用；由此产生的争议开发者不承担责任。

---

## 十、更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.4.1 | 2026-10-22 | 坐标全链路固定 WGS84：<code>geo.js</code> 增加 GCJ-02 ⇄ WGS84 本地转换（编码出参转 WGS、反查入参转 GCJ），移除坐标系选择 UI，状态文案与水印恒为 WGS84；App 侧同步 |
| v1.4.0 | 2026-10-22 | App 首页改为全屏相机水印页（app.html）：实时取景叠加、点按编辑面板、快门拍照经原生桥存相册；与网页版 index.html 分离，底栏可互跳 |
| v1.3.0 | 2026-10-22 | APK 本地内置 Web 资源（完全离线可用）；<code>version.json</code> 启动静默增量更新、失败整体回退；CI 构建同步网页资源；壳环境跳过 SW 注册 |
| v1.2.0 | 2026-10-22 | Miuix 设计语言改版：官方双主题色板、毛玻璃顶栏、PWA 图标与主题色同步，SW 缓存升 v2 |
| v1.1.0 | 2026-10-22 | Android WebView 壳 + GitHub Actions 自动构建 APK |
| v1.0.2 | 2026-10-22 | PWA：安装清单、离线缓存、应用图标 |
| v1.0.1 | 2026-10-22 | GitHub Pages 在线版；MIT License；文档对齐 |
| v1.0 | 2026-09-01 | 首版：模块化拆分、单文件打包、坐标系切换、密钥移出源码 |

---

## 十一、许可证

[MIT](LICENSE) © Zane517
