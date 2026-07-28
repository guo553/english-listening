// ==Cloudflare Worker==
// 听力小工具发布页 + GitHub 下载反代（通过 Cloudflare 网络加速 GitHub Release 文件下载）
// 部署方式：wrangler deploy 或复制到 Cloudflare Dashboard
// 环境变量 LATEST_TAG：最新 Release 版本号（默认 v0.2.0）

// GitHub 仓库信息
const GH_OWNER = 'guo553'
const GH_REPO = 'english-listening'

// GitHub Release 下载基础路径
const RELEASE_BASE = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download`

// 各平台安装包文件名模板（{version} 会被替换为实际版本号，如 0.2.0）
const ASSETS = {
  linux:  { file: 'English.Listening.Tool-{version}.AppImage',      label: 'Linux (.AppImage)' },
  win:    { file: 'English.Listening.Tool.Setup.{version}.exe',     label: 'Windows (.exe 安装包)' },
  mac:    { file: 'English.Listening.Tool-{version}-universal.dmg', label: 'macOS Universal (.dmg)' },
}

// GitHub URL 校验正则：只允许代理 GitHub 相关域名，防止被滥用作开放代理
const GITHUB_RE = /^(?:https?:\/\/)?(?:raw\.(?:githubusercontent|github)\.com|gist\.(?:githubusercontent|github)\.com|api\.github\.com|github\.com)\/.*$/i

// ===== GitHub 文件反代 =====
// 通过 Cloudflare Workers 的 fetch API 直连 GitHub 回源下载，不走第三方中转
async function proxyGitHub(req, path) {
  // 处理 CORS 预检请求（浏览器跨域时需要）
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-max-age': '86400' }
    })
  }

  // 补全协议头
  let urlStr = path
  if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr

  // 校验 URL 是否属于 GitHub 域名范围
  if (!GITHUB_RE.test(urlStr)) {
    return new Response('只允许 GitHub 域名', { status: 403 })
  }

  // 回源到 GitHub 拉取文件
  // redirect: 'manual' 表示不自动跟随重定向，由我们自己处理
  const res = await fetch(urlStr, {
    method: req.method,
    headers: req.headers,
    redirect: 'manual'
  })

  // 透传 GitHub 的响应头，添加 CORS 和缓存控制
  const headers = new Headers(res.headers)
  headers.set('access-control-allow-origin', '*')
  headers.set('Cache-Control', 'public, max-age=86400')

  // 处理 GitHub 的重定向：如果重定向目标也是 GitHub URL，则继续代理
  if (res.status >= 300 && res.status < 400 && headers.has('location')) {
    const loc = headers.get('location')
    if (GITHUB_RE.test(loc)) {
      return proxyGitHub(req, loc)  // 递归跟随重定向
    }
  }

  // 返回文件内容给客户端
  return new Response(res.body, { status: res.status, headers })
}

// ===== 下载页面 HTML =====
// 渲染功能列表、下载按钮、安装说明等
function renderPage(tag, version) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>听力小工具 - English Listening Tool</title>
<link rel="icon" href="/icon.png" type="image/png">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f7;color:#1d1d1f;line-height:1.6}
.header{background:linear-gradient(135deg,#0071e3,#00a8ff);color:#fff;text-align:center;padding:60px 20px 50px}
.header h1{font-size:36px;font-weight:700;margin-bottom:8px;letter-spacing:-0.5px}
.header p{font-size:18px;opacity:.9;margin-bottom:6px}
.container{max-width:900px;margin:0 auto;padding:24px 20px 60px}
.card{background:#fff;border-radius:14px;padding:28px 32px;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.card h2{font-size:20px;font-weight:600;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #0071e3}
.features{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.features div{background:#f5f5f7;border-radius:10px;padding:14px 16px;font-size:14px}
.features strong{color:#0071e3}
.download-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:8px}
.btn-download{display:block;text-align:center;padding:18px 20px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;transition:transform .15s,box-shadow .15s}
.btn-download:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,113,227,.25)}
.btn-download .icon{font-size:28px;display:block;margin-bottom:6px}
.btn-download .size{font-size:12px;opacity:.7;font-weight:400;margin-top:4px}
.btn-linux{background:#e8f0fe;color:#1a73e8}
.btn-win{background:#e8f5e9;color:#2e7d32}
.btn-mac{background:#fce4ec;color:#c62828}
.btn-source{background:#f3e5f5;color:#7b1fa2}
.install-step{background:#f5f5f7;border-radius:8px;padding:14px 18px;margin:8px 0;font-size:14px}
.install-step code{background:#e8e8ed;padding:2px 6px;border-radius:4px;font-size:13px}
.apple-rant{background:#fff3e0;border-left:4px solid #ff6f00;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0;font-size:14px;color:#4e342e}
.build-info{font-size:13px;color:#6e6e73;text-align:center;margin-top:32px;line-height:1.8}
.build-info a{color:#0071e3;text-decoration:none}
</style>
</head>
<body>
<div class="header">
  <h1>🎧 听力小工具</h1>
  <p>English Listening Tool</p>
  <p style="font-size:14px;opacity:.7">英语听力高效训练 · 跨平台桌面应用</p>
</div>
<div class="container">
  <!-- 功能列表 -->
  <div class="card">
    <h2>📌 功能</h2>
    <div class="features">
      <div><strong>二维码/URL 解析</strong><br>扫描或拖入二维码，自动解析听力页面</div>
      <div><strong>滚动式答题</strong><br>同组题目同时显示，无需翻页</div>
      <div><strong>音频播放器</strong><br>快退/暂停/快进/进度拖拽/0.5x~5x倍速</div>
      <div><strong>自动批改</strong><br>输入密码自动抓取答案并批改</div>
      <div><strong>手动录入</strong><br>手动输入 A/B/C 答案批改</div>
      <div><strong>三年级匹配</strong><br>自动识别新高一/新高二/新高三</div>
      <div><strong>录音原文</strong><br>显示原文图片，支持下载保存</div>
      <div><strong>历史记录</strong><br>保存答题记录，查看/再练/删除</div>
      <div><strong>多主题</strong><br>浅色 / 深色 / 跟随系统</div>
      <div><strong>跨平台</strong><br>Windows / Linux / macOS</div>
    </div>
  </div>
  <!-- 下载按钮区 -->
  <div class="card">
    <h2>⬇ 下载 v${version}</h2>
    <p style="font-size:14px;color:#6e6e73;margin-bottom:16px">通过 Cloudflare 网络加速下载</p>
    <div class="download-grid">
      <a class="btn-download btn-linux" href="/gh/${RELEASE_BASE}/${tag}/${ASSETS.linux.file.replace('{version}', version)}">
        <span class="icon">🐧</span>Linux<span class="size">AppImage</span>
      </a>
      <a class="btn-download btn-win" href="/gh/${RELEASE_BASE}/${tag}/${ASSETS.win.file.replace('{version}', version)}">
        <span class="icon">🪟</span>Windows<span class="size">.exe 安装包</span>
      </a>
      <a class="btn-download btn-mac" href="/gh/${RELEASE_BASE}/${tag}/${ASSETS.mac.file.replace('{version}', version)}">
        <span class="icon">🍎</span>macOS<span class="size">Universal .dmg</span>
      </a>
      <a class="btn-download btn-source" href="/download/source">
        <span class="icon">📦</span>源码<span class="size">.zip</span>
      </a>
    </div>
  </div>
  <!-- 安装方法 -->
  <div class="card">
    <h2>📖 安装方法</h2>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🐧 Linux</h3>
    <div class="install-step">
      1. 下载 <code>.AppImage</code> 文件<br>
      2. 赋予执行权限：<code>chmod +x English.Listening.Tool-*.AppImage</code><br>
      3. 双击运行，或终端执行 <code>./English.Listening.Tool-*.AppImage</code>
    </div>
    <div class="install-step">
      💡 Wayland 用户：<code>ELECTRON_OZONE_PLATFORM_HINT=wayland ./English.Listening.Tool-*.AppImage</code>
    </div>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🪟 Windows</h3>
    <div class="install-step">下载 <code>.exe</code> → 双击安装 → 从开始菜单启动</div>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🍎 macOS</h3>
    <div class="install-step">
      1. 下载 <code>.dmg</code> → 双击挂载 → 拖入「应用程序」<br>
      2. <strong>右键点击</strong>应用图标 → 选择「打开」（首次运行必须这样操作）
    </div>
    <div class="apple-rant">
      <strong>⚠️ macOS 未签名说明</strong><br><br>
      CI 构建的 <code>.dmg</code> 未经过 Apple 签名。首次打开时会提示「无法验证开发者」。
      请右键点击 → 选择「打开」。这不是安全问题，仅因无 Apple 开发者证书。
      这个傻x证书居然要我99块钱，还tm要年年交，sb苹果想钱想疯了。
    </div>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🛠 从源码运行</h3>
    <div class="install-step">
      <code>git clone https://github.com/${GH_OWNER}/${GH_REPO}.git &amp;&amp; cd ${GH_REPO} &amp;&amp; npm install &amp;&amp; npm start</code>
    </div>
  </div>
  <!-- 版权信息 -->
  <div class="build-info">
    <div>English Listening Tool v${version}</div>
    <div>作者: 郭皓玮 · MIT 许可</div>
    <div>GitHub: <a href="https://github.com/${GH_OWNER}/${GH_REPO}" target="_blank">${GH_OWNER}/${GH_REPO}</a></div>
  </div>
</div>
</body>
</html>`
}

// ===== GitHub raw 文件代理 =====
// 用于获取仓库内的静态资源（图标等），利用 Cloudflare 缓存减少回源
async function proxyGitHubRaw(filepath) {
  const url = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/main/${filepath}`
  const resp = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } })
  if (!resp.ok) return new Response('Not Found', { status: 404 })
  const headers = new Headers(resp.headers)
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(resp.body, { status: 200, headers })
}

// ===== Worker 入口 =====
// 路由分发逻辑
export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const tag = env.LATEST_TAG || "v0.2.0"      // 当前 Release 标签
    const version = tag.replace(/^v/, "")        // 去掉 v 前缀用于文件名匹配
    const path = url.pathname

    // 路由 1：静态资源（图标、favicon）
    // 从 GitHub raw 代理 src/ 目录下的文件
    if (path === '/icon.png' || path === '/favicon.ico') {
      return proxyGitHubRaw('src' + path)
    }

    // 路由 2：GitHub 反代下载
    // /gh/ 后面跟完整的 GitHub 文件 URL，例如：
    // /gh/https://github.com/guo553/english-listening/releases/download/v0.2.0/...
    if (path.startsWith('/gh/')) {
      const ghPath = path.slice(4)  // 去掉 /gh/ 前缀
      return proxyGitHub(req, ghPath)
    }

    // 路由 3：向下兼容的下载链接
    // /download/linux → /gh/https://github.com/...（走反代加速）
    // /download/win   → 同上
    // /download/mac   → 同上
    // /download/source → GitHub 源码 zip 包
    if (path.startsWith('/download/')) {
      const platform = path.replace('/download/', '')

      // 源码下载：跳转到 GitHub 仓库的 main.zip
      if (platform === 'source') {
        return new Response(null, {
          status: 302,
          headers: { 'Location': `/gh/https://github.com/${GH_OWNER}/${GH_REPO}/archive/refs/heads/main.zip`, 'Cache-Control': 'public, max-age=86400' }
        })
      }

      // 其他平台：查表获取文件名，拼出 GitHub Release URL 后走反代
      const info = ASSETS[platform]
      if (!info) return new Response('不支持的平台', { status: 404 })
      const ghUrl = `${RELEASE_BASE}/${tag}/${info.file.replace('{version}', version)}`
      return new Response(null, {
        status: 302,
        headers: { 'Location': `/gh/${ghUrl}`, 'Cache-Control': 'public, max-age=86400' }
      })
    }

    // 路由 4：主页 — 返回软件下载页 HTML
    return new Response(renderPage(tag, version), {
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    })
  }
}
