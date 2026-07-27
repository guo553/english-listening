// ==Cloudflare Worker==
// 听力小工具 - 发布页 + 下载反代（自动测速选最快节点）
// 部署：wrangler deploy

const GH_OWNER = 'guo553'
const GH_REPO = 'english-listening'
const RELEASE_BASE = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download`
const NODES_URL = 'https://hubp.tbedu.top/nodes.json'
// 测速用的小文件（各加速节点代理此 URL 测试延迟）
const SPEED_TEST_URL = 'https://raw.githubusercontent.com/guo553/english-listening/main/worker.js'

const ASSETS = {
  linux:  { file: 'English.Listening.Tool-{version}.AppImage',          label: 'Linux (.AppImage)' },
  win:    { file: 'English.Listening.Tool.Setup.{version}.exe',         label: 'Windows (.exe 安装包)' },
  mac:    { file: 'English.Listening.Tool-{version}-universal.dmg',     label: 'macOS Universal (.dmg)' },
}

// 缓存的最快节点（全局变量，同 isolate 内跨请求复用）
let _fastestNode = null
let _fastestNodeTime = 0
const CACHE_TTL = 3600000 // 1 小时重新测速

// 从 https://hubp.tbedu.top/nodes.json 获取节点列表
async function fetchNodeList() {
  const resp = await fetch(NODES_URL)
  if (!resp.ok) return []
  const json = await resp.json()
  return json.data || []
}

// 测试单个节点的延迟（毫秒），超时 10 秒
async function testNodeLatency(node) {
  const url = `https://${node}/${SPEED_TEST_URL}`
  const start = Date.now()
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return Infinity
    return Date.now() - start
  } catch {
    return Infinity
  }
}

// 测速并选出最快节点，结果缓存 1 小时
async function findFastestNode() {
  if (_fastestNode && Date.now() - _fastestNodeTime < CACHE_TTL) {
    return _fastestNode
  }

  const nodes = await fetchNodeList()
  if (nodes.length === 0) return null

  // 并发测速所有节点
  const results = await Promise.all(
    nodes.map(async (node) => ({
      node,
      latency: await testNodeLatency(node)
    }))
  )

  // 过滤掉超时的，按延迟排序
  const valid = results.filter(r => r.latency < Infinity).sort((a, b) => a.latency - b.latency)
  if (valid.length === 0) return null

  _fastestNode = valid[0].node
  _fastestNodeTime = Date.now()
  return _fastestNode
}

function redirectDownload(url) {
  return new Response(null, {
    status: 302,
    headers: { 'Location': url, 'Cache-Control': 'public, max-age=86400' }
  })
}

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
.btn-download{display:block;text-align:center;padding:18px 20px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden}
.btn-download:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,113,227,.25)}
.btn-download .icon{font-size:28px;display:block;margin-bottom:6px}
.btn-download .size{font-size:12px;opacity:.7;font-weight:400;margin-top:4px}
.btn-linux{background:#e8f0fe;color:#1a73e8}
.btn-win{background:#e8f5e9;color:#2e7d32}
.btn-mac{background:#fce4ec;color:#c62828}
.install-step{background:#f5f5f7;border-radius:8px;padding:14px 18px;margin:8px 0;font-size:14px}
.install-step code{background:#e8e8ed;padding:2px 6px;border-radius:4px;font-size:13px}
.apple-rant{background:#fff3e0;border-left:4px solid #ff6f00;padding:14px 18px;border-radius:0 8px 8px 0;margin:12px 0;font-size:14px;color:#4e342e}
.build-info{font-size:13px;color:#6e6e73;text-align:center;margin-top:32px;line-height:1.8}
.build-info a{color:#0071e3;text-decoration:none}
.node-info{font-size:12px;color:#6e6e73;text-align:center;margin-top:8px}
</style>
</head>
<body>
<div class="header">
  <h1>🎧 听力小工具</h1>
  <p>English Listening Tool</p>
  <p style="font-size:14px;opacity:.7">英语听力高效训练 · 跨平台桌面应用</p>
</div>
<div class="container">
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
  <div class="card">
    <h2>⬇ 下载 v${version}</h2>
    <p style="font-size:14px;color:#6e6e73;margin-bottom:16px">已自动选择最快的加速节点</p>
    <div class="download-grid">
      <a class="btn-download btn-linux" href="/download/linux">
        <span class="icon">🐧</span>Linux<span class="size">AppImage</span>
      </a>
      <a class="btn-download btn-win" href="/download/win">
        <span class="icon">🪟</span>Windows<span class="size">.exe 安装包</span>
      </a>
      <a class="btn-download btn-mac" href="/download/mac">
        <span class="icon">🍎</span>macOS<span class="size">Universal .dmg</span>
      </a>
    </div>
  </div>
  <div class="card">
    <h2>📖 安装方法</h2>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🐧 Linux</h3>
    <div class="install-step">
      1. 下载 <code>.AppImage</code> 文件<br>
      2. 赋予执行权限：<code>chmod +x English.Listening.Tool-*.AppImage</code><br>
      3. 双击运行，或终端执行 <code>./English.Listening.Tool-*.AppImage</code>
    </div>
    <div class="install-step">
      💡 Wayland 用户请用环境变量启动：<br>
      <code>ELECTRON_OZONE_PLATFORM_HINT=wayland ./English.Listening.Tool-*.AppImage</code>
    </div>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🪟 Windows</h3>
    <div class="install-step">
      1. 下载 <code>.exe</code> 安装包<br>
      2. 双击运行，按提示完成安装<br>
      3. 从开始菜单或桌面快捷方式启动
    </div>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🍎 macOS</h3>
    <div class="install-step">
      1. 下载 <code>.dmg</code> 文件<br>
      2. 双击挂载，将 <code>English Listening Tool.app</code> 拖入「应用程序」文件夹<br>
      3. <strong>右键点击</strong>应用图标 → 选择「打开」（首次运行必须这样操作）
    </div>
    <div class="apple-rant">
      <strong>⚠️ macOS 未签名说明</strong><br><br>
      CI 构建的 <code>.dmg</code> 未经过 Apple 签名。首次打开时，双击会提示「无法验证开发者」。
      请右键点击 <code>.dmg</code> → 选择「打开」，再次确认「打开」即可运行。也可在「系统设置 → 隐私与安全性」中点击「仍要打开」。
      这不是安全问题，仅因无 Apple 开发者证书。这个傻x证书居然要我99块钱，还tm要年年交，sb苹果想钱想疯了。
    </div>
    <h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">🛠 从源码运行</h3>
    <div class="install-step">
      <code>git clone https://github.com/${GH_OWNER}/${GH_REPO}.git</code><br>
      <code>cd ${GH_REPO}</code><br>
      <code>npm install</code><br>
      <code>npm start</code>
    </div>
  </div>
  <div class="build-info">
    <div>English Listening Tool v${version}</div>
    <div>作者: 郭皓玮 · MIT 许可</div>
    <div>GitHub: <a href="https://github.com/${GH_OWNER}/${GH_REPO}" target="_blank">${GH_OWNER}/${GH_REPO}</a></div>
  </div>
</div>
</body>
</html>`
}

async function proxyGitHubRaw(filepath) {
  const url = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/main/${filepath}`
  const resp = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } })
  if (!resp.ok) return new Response('Not Found', { status: 404 })
  const headers = new Headers(resp.headers)
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(resp.body, { status: 200, headers })
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const tag = env.LATEST_TAG || "v0.2.0"
    const version = tag.replace(/^v/, "")
    const path = url.pathname

    if (path === '/icon.png' || path === '/favicon.ico') {
      return proxyGitHubRaw('src' + path)
    }

    // 下载：先用测速找出最快的加速节点，然后302跳转到该节点
    if (path.startsWith('/download/')) {
      const platform = path.replace('/download/', '')
      const info = ASSETS[platform]
      if (!info) return new Response('不支持的平台', { status: 404 })

      const ghUrl = `${RELEASE_BASE}/${tag}/${info.file.replace('{version}', version)}`
      const fastest = await findFastestNode()
      if (fastest) {
        // 走加速节点：https://{node}/https://github.com/...
        return redirectDownload(`https://${fastest}/${ghUrl}`)
      }
      // 没有可用节点则直连 GitHub
      return redirectDownload(ghUrl)
    }

    return new Response(renderPage(tag, version), {
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    })
  }
}
