marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false
})

const App = {
  currentPage: null,
  currentSet: null,
  allSets: [],

  init() {
    const savedTheme = localStorage.getItem('theme') || 'auto'
    document.documentElement.setAttribute('data-theme', savedTheme)
    this.initPasswordDialog()
    this.navigate('home')
  },

  navigate(page, data) {
    if (this.currentPage === page) return
    if (this.currentPage && this.currentPage !== 'settings') {
      sessionStorage.setItem('prevPage', this.currentPage)
    }
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'))
    const el = document.getElementById('page-' + page)
    if (el) el.classList.add('active')
    this.currentPage = page
    if (typeof window['page_' + page] === 'function') {
      window['page_' + page](data)
    }
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
