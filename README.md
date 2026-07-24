# 听力小工具 🎧

英语听力高效训练工具 — 基于 Electron 的桌面应用。

## 功能

| 功能 | 说明 |
|------|------|
| **二维码/URL 解析** | 扫描或拖入二维码图片，自动解析 clewm.net 听力页面 |
| **滚动式答题** | 同一组题目同时显示，无需翻页 |
| **音频播放器** | 快退 5s / 暂停 / 快进 5s / 进度条拖拽 / 0.5x~5x 倍速 |
| **自动批改** | 输入密码后自动从答案页抓取标准答案并批改 |
| **手动录入** | 没有自动答案时，可手动输入 A/B/C 答案进行批改 |
| **三年级匹配** | 自动识别新高一/新高二/新高三，匹配对应答案 |
| **录音原文** | 显示对应年级的听力原文图片，支持下载 |
| **历史记录** | 自动保存答题记录，支持查看、再练、删除 |
| **多主题** | 浅色 / 深色 / 跟随系统 |
| **跨平台** | Windows / Linux / macOS |

## 下载

从 [Releases](https://github.com/guo553/english-listening/releases) 下载最新版本。

## 使用

1. 打开 **听力小工具**
2. 选择二维码图片（或粘贴听力页面 URL）
3. 点击 **开始听力** → 答题
4. 提交答案 → **自动批改**（输入密码）或 **手动录入答案**

## 开发

```bash
git clone https://github.com/guo553/english-listening.git
cd english-listening
npm install
npm start
```

### 跨平台打包

```bash
# Linux → AppImage
npm run build:linux

# Windows → exe（需要 wine 或 Windows 环境）
npm run build:win

# macOS → dmg
npm run build:mac
```

## 技术栈

- **Electron** 33 — 桌面框架
- **HTML5 + CSS3 + Vanilla JS** — 无框架依赖
- **jsQR** — 本地二维码解码
- **marked + DOMPurify** — Markdown 渲染与安全过滤

## 协议

[MIT](LICENSE)
