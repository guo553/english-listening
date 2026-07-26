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

### 支持平台

| 平台 | 安装包 | 说明 |
|------|--------|------|
| **Linux** | `.AppImage` | 通用格式，下载后 `chmod +x` 即可运行 |
| **Windows** | `.exe` 安装包 | 一键安装 |
| **macOS** | `.dmg` (Universal) | 同时支持 Intel 和 Apple Silicon，CI 自动构建，未签名 |

> 📌 **macOS 安装说明**：CI 构建的 `.dmg` 未经过 Apple 签名。首次打开时，双击会提示“无法验证开发者”。请**右键点击** `.dmg` → 选择「打开」，再次确认「打开」即可运行。也可在「系统设置 → 隐私与安全性」中点击「仍要打开」。这不是安全问题，仅因无 Apple 开发者证书。这个傻x证书居然要我99块钱，还tm要年年交，sb苹果想钱想疯了。

## 使用

1. 打开 **听力小工具**
2. 选择二维码图片（或粘贴听力页面 URL）
3. 点击 **开始听力** → 答题
4. 提交答案 → **自动批改**（输入密码）或 **手动录入答案**

## 开发

### 环境要求

| 环境 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18 | 推荐 v20 LTS 或更高 |
| npm | >= 9 | 随 Node.js 一同安装 |
| Git | >= 2 | 版本控制 |

### 快速开始

```bash
git clone https://github.com/guo553/english-listening.git
cd english-listening
npm install
npm start
```

### 系统配置

#### Linux

```bash
# 安装 Electron 依赖（Arch Linux）
sudo pacman -S libxss nss atk-bridge2

# Ubuntu / Debian
sudo apt install libxss1 libnss3 libatk-bridge2.0-0

# Wayland 支持
export ELECTRON_OZONE_PLATFORM_HINT=wayland
npm start
```

> 本项目在 **Arch Linux + KDE Plasma 6 (Wayland)** 环境下开发测试。如使用 Wayland 合成器，启动时设置 `ELECTRON_OZONE_PLATFORM_HINT=wayland` 环境变量即可获得原生 Wayland 支持，避免 XWayland 转译。

#### Windows

```powershell
# 安装 Node.js（推荐使用 nvm-windows 或 官方安装包）
# https://nodejs.org

# 克隆并启动
git clone https://github.com/guo553/english-listening.git
cd english-listening
npm install
npm start
```

#### macOS

```bash
# 安装 Node.js（推荐使用 nvm 或 Homebrew）
# brew install node

# 克隆并启动
git clone https://github.com/guo553/english-listening.git
cd english-listening
npm install
npm start
```

### 无耻的 macOS 未签名应用安装方法

CI 构建的 `.dmg` 未经过 Apple 签名（傻x苹果，开发你平台的应用还tm要收钱，无耻至极），首次打开时会提示「无法验证开发者」。按以下步骤操作：

**方法一：右键打开（推荐）**
1. 下载 `.dmg` 文件后双击挂载
2. 将 `English Listening Tool.app` 拖入「应用程序」文件夹
3. **右键点击**应用图标 → 选择「打开」
4. 弹出提示框后，再次点击「打开」即可

**方法二：系统设置允许**
1. 按方法一操作被阻止后，打开「系统设置 → 隐私与安全性」
2. 在页面底部找到「已阻止使用 "English Listening Tool"」提示
3. 点击「仍要打开」

**方法三：命令行移除隔离属性**
```bash
# 移除 macOS 的隔离标记
sudo xattr -rd com.apple.quarantine "/Applications/English Listening Tool.app"
```

> 这不是安全问题，仅因应用未购买 无耻的Apple 开发者证书签名。

### 数据存储位置

设置、练习记录、答案密码等数据存储在系统用户数据目录下：

| 平台 | 路径 |
|------|------|
| **Linux** | `~/.config/english-listening-tool/听力小工具数据/` |
| **Windows** | `%APPDATA%/english-listening-tool/听力小工具数据/` |
| **macOS** | `~/Library/Application Support/english-listening-tool/听力小工具数据/` |

| 文件 | 内容 |
|------|------|
| `__settings__.json` | 界面设置（缩放、字体、延迟、主题） |
| `__passwords__.json` | 答案页面 URL → 密码 |
| `summary_{题目ID}.json` | 某题目的所有练习记录摘要 |
| `manual_{题目ID}.json` | 手动录入的答案 |
| `{练习ID}.json` | 完整练习记录（答案、原文等） |

> 可在程序内「设置 → 数据管理 → 清除所有数据」一键删除上述全部文件。

### 版本隔离

Electron 安装在项目目录 `node_modules` 下（`npm install` 时本地安装），不依赖全局 Electron，实现版本隔离：

```bash
# 检查本地安装的 Electron 版本
npx electron --version
```

### 跨平台打包

```bash
# Linux → AppImage
npm run build:linux

# Windows → exe（需要 wine 或 Windows 环境）
npm run build:win

# macOS → dmg（需要 macOS 环境）
npm run build:mac
```

> 注意：macOS 打包需要在 macOS 系统上执行，需要 Xcode 和 Apple 开发者账号进行签名。Linux 和 Windows 的交叉编译需要对应工具（如 wine）。

## 技术栈

- **Electron** 33 — 桌面框架
- **HTML5 + CSS3 + Vanilla JS** — 无框架依赖
- **jsQR** — 本地二维码解码
- **marked + DOMPurify** — Markdown 渲染与安全过滤

## 协议

[MIT](LICENSE)
