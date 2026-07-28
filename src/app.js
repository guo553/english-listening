// ===== Markdown 渲染配置 =====
marked.setOptions({
  breaks: true,       // 换行符转换为 <br>
  gfm: true,          // 启用 GitHub Flavored Markdown
  headerIds: false,   // 不自动生成标题 ID
  mangle: false       // 不混淆邮箱
})

// ===== HTML 转义缓存 =====
// 避免频繁创建 DOM 元素，相同字符串重复转义时直接返回缓存结果
// 设置 1000 条上限防止内存泄漏
const escHtmlCache = new Map()

function escHtmlCached(str) {
  if (escHtmlCache.has(str)) return escHtmlCache.get(str)
  const div = document.createElement('div')
  div.textContent = str
  const result = div.innerHTML
  if (escHtmlCache.size < 1000) escHtmlCache.set(str, result)
  return result
}

function clearEscHtmlCache() {
  escHtmlCache.clear()
}

// ===== 显示设置 =====
// 缩放：对整个页面使用 CSS transform:scale，保持布局比例
function applyZoom(zoom) {
  document.documentElement.style.transform = `scale(${zoom})`
  document.documentElement.style.transformOrigin = 'top left'
  document.documentElement.style.width = `${100 / zoom}%`
  document.documentElement.style.height = `${100 / zoom}%`
  document.documentElement.style.overflow = 'auto'
}

// 字体大小：同时设置 html 和 body 确保全局统一
function applyFontSize(size) {
  document.documentElement.style.fontSize = size + 'px'
  document.body.style.fontSize = size + 'px'
}

// ===== 核心应用对象 =====
// 管理页面导航、设置加载、密码对话框、Markdown 渲染等全局功能
const App = {
  currentPage: null,    // 当前活动页名称
  currentSet: null,     // 当前正在练习的套题数据
  allSets: [],          // 全部套题（预留字段）
  _pageCache: {},

  // ===== 初始化入口 =====
  // 先迁移旧版 localStorage 数据，再加载设置，然后跳转到主页
  init() {
    this.migrateFromLocalStorage().then(() => {
      this.applyDisplaySettings()
      this.initPasswordDialog()
      this.navigate('home')
    })
  },

  // ===== 旧版数据迁移 =====
  // 从 Electron 的 localStorage 迁移到文件系统（通过 window.api）
  // 迁移内容包括：设置、主题、练习记录摘要、手动答案
  async migrateFromLocalStorage() {
    try {
      // 如果 __settings__ 已存在说明已迁移过，跳过
      let settings = await window.api.storageLoad('__settings__')
      if (settings) return

      // 迁移设置
      const legacy = localStorage.getItem('settings')
      if (legacy) {
        await window.api.storageSave('__settings__', JSON.parse(legacy))
        localStorage.removeItem('settings')
      }

      // 迁移主题
      const theme = localStorage.getItem('theme')
      if (theme) {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.removeItem('theme')
      }

      // 迁移练习记录和手动答案
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('practice_records_')) {
          const setId = key.replace('practice_records_', '')
          await window.api.storageSave('summary_' + setId, JSON.parse(localStorage.getItem(key)))
        }
        if (key && key.startsWith('manual_ans_')) {
          const setId = key.replace('manual_ans_', '')
          await window.api.storageSave('manual_' + setId, JSON.parse(localStorage.getItem(key)))
        }
      }
    } catch {}
  },

  // ===== 显示设置 =====
  // 从文件系统读取设置并应用到界面（缩放、字体、主题）
  applyDisplaySettings() {
    window.api.storageLoad('__settings__').then(settings => {
      if (!settings) return
      window._cachedSettings = settings
      if (settings.zoom) applyZoom(settings.zoom)
      if (settings.fontSize) applyFontSize(settings.fontSize)
      if (settings.theme) document.documentElement.setAttribute('data-theme', settings.theme)
    }).catch(() => {})
  },

  // ===== 页面导航 =====
  // page: 页面名称（home/ready/quiz/result/settings/history）
  // data: 传递给页面的数据（如结果页的 record）
  navigate(page, data) {
    if (this.currentPage === page) return        // 已在目标页则跳过
    if (this.currentPage && this.currentPage !== 'settings') {
      sessionStorage.setItem('prevPage', this.currentPage)  // 保存上一页用于返回
    }

    const pageEl = document.getElementById('page-' + page)
    if (!pageEl) return

    // 切换页面显示
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'))
    pageEl.classList.add('active')
    this.currentPage = page

    // 异步调用页面渲染函数 window.page_{name}()
    requestAnimationFrame(() => {
      if (typeof window['page_' + page] === 'function') {
        window['page_' + page](data)
      }
    })
  },

  // ===== Toast 提示 =====
  toast(msg, duration) {
    const el = document.getElementById('toast')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(el._timer)
    el._timer = setTimeout(() => el.classList.remove('show'), duration || 2500)
  },

  // ===== 密码对话框 =====
  // 初始化对话框事件绑定，对外暴露 window._showPasswordDialog 供结果页调用
  initPasswordDialog() {
    const dialog = document.getElementById('password-dialog')
    const input = document.getElementById('pwd-input')
    const confirmBtn = document.getElementById('pwd-confirm')
    const cancelBtn = document.getElementById('pwd-cancel')
    const errorEl = document.getElementById('pwd-error')

    let resolveCallback = null

    // 显示密码弹窗并返回 Promise，用户输入 + 确认后 resolve
    window._showPasswordDialog = function () {
      return new Promise((resolve) => {
        resolveCallback = resolve
        input.value = ''
        errorEl.style.display = 'none'
        dialog.classList.remove('hidden')
        setTimeout(() => input.focus(), 100)
      })
    }

    confirmBtn.addEventListener('click', () => {
      const pwd = input.value.trim()
      if (!pwd) {
        errorEl.textContent = '请输入密码'
        errorEl.style.display = 'block'
        return
      }
      dialog.classList.add('hidden')
      if (resolveCallback) resolveCallback(pwd)
    })

    cancelBtn.addEventListener('click', () => {
      dialog.classList.add('hidden')
      if (resolveCallback) resolveCallback(null)
    })

    // 键盘快捷键：回车确认、ESC 取消
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmBtn.click()
      if (e.key === 'Escape') cancelBtn.click()
    })

    // 粘贴按钮：从剪贴板读取文本填入密码框
    document.getElementById('pwd-paste').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText()
        input.value = text
        input.dispatchEvent(new Event('input', { bubbles: true }))
      } catch {
        App.toast('无法读取剪贴板', 2000)
      }
    })
  },

  closePasswordDialog() {
    document.getElementById('password-dialog').classList.add('hidden')
  },

  // ===== Markdown 渲染 =====
  // 将 markdown 文本渲染为安全的 HTML（转义 + DOMPurify 过滤）
  renderMarkdown(md) {
    const html = marked.parse(md)
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'hr', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody',
        'tr', 'th', 'td', 'div', 'span', 'img', 'a'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'class', 'id']
    })
  }
}

// ===== 启动入口 =====
document.addEventListener('DOMContentLoaded', () => {
  App.init()
})
