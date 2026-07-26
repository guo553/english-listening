marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false
})

const escHtmlCache = new Map()

function escHtmlCached(str) {
  if (escHtmlCache.has(str)) return escHtmlCache.get(str)
  const div = document.createElement('div')
  div.textContent = str
  const result = div.innerHTML
  if (escHtmlCache.size < 1000) {
    escHtmlCache.set(str, result)
  }
  return result
}

function clearEscHtmlCache() {
  escHtmlCache.clear()
}

function applyZoom(zoom) {
  document.documentElement.style.transform = `scale(${zoom})`
  document.documentElement.style.transformOrigin = 'top left'
  document.documentElement.style.width = `${100 / zoom}%`
  document.documentElement.style.height = `${100 / zoom}%`
  document.documentElement.style.overflow = 'auto'
}

function applyFontSize(size) {
  document.documentElement.style.fontSize = size + 'px'
  document.body.style.fontSize = size + 'px'
}

const App = {
  currentPage: null,
  currentSet: null,
  allSets: [],
  _pageCache: {},

  init() {
    this.migrateFromLocalStorage().then(() => {
      this.applyDisplaySettings()
      this.initPasswordDialog()
      this.navigate('home')
    })
  },

  async migrateFromLocalStorage() {
    try {
      let settings = await window.api.storageLoad('__settings__')
      if (settings) return

      const legacy = localStorage.getItem('settings')
      if (legacy) {
        await window.api.storageSave('__settings__', JSON.parse(legacy))
        localStorage.removeItem('settings')
      }

      const theme = localStorage.getItem('theme')
      if (theme) {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.removeItem('theme')
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('practice_records_')) {
          const setId = key.replace('practice_records_', '')
          const data = localStorage.getItem(key)
          if (data) {
            await window.api.storageSave('summary_' + setId, JSON.parse(data))
          }
        }
        if (key && key.startsWith('manual_ans_')) {
          const setId = key.replace('manual_ans_', '')
          const data = localStorage.getItem(key)
          if (data) {
            await window.api.storageSave('manual_' + setId, JSON.parse(data))
          }
        }
      }
    } catch {}
  },

  applyDisplaySettings() {
    window.api.storageLoad('__settings__').then(settings => {
      if (!settings) return
      window._cachedSettings = settings
      if (settings.zoom) applyZoom(settings.zoom)
      if (settings.fontSize) applyFontSize(settings.fontSize)
      const theme = settings.theme
      if (theme) document.documentElement.setAttribute('data-theme', theme)
    }).catch(() => {})
  },

  navigate(page, data) {
    if (this.currentPage === page) return
    if (this.currentPage && this.currentPage !== 'settings') {
      sessionStorage.setItem('prevPage', this.currentPage)
    }

    const pageEl = document.getElementById('page-' + page)
    if (!pageEl) return

    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'))
    pageEl.classList.add('active')

    this.currentPage = page

    requestAnimationFrame(() => {
      if (typeof window['page_' + page] === 'function') {
        window['page_' + page](data)
      }
    })
  },

  toast(msg, duration) {
    const el = document.getElementById('toast')
    if (!el) return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(el._timer)
    el._timer = setTimeout(() => el.classList.remove('show'), duration || 2500)
  },

  initPasswordDialog() {
    const dialog = document.getElementById('password-dialog')
    const input = document.getElementById('pwd-input')
    const confirmBtn = document.getElementById('pwd-confirm')
    const cancelBtn = document.getElementById('pwd-cancel')
    const errorEl = document.getElementById('pwd-error')

    let resolveCallback = null

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

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmBtn.click()
      if (e.key === 'Escape') cancelBtn.click()
    })

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

document.addEventListener('DOMContentLoaded', () => {
  App.init()
})
