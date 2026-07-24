window.page_history = function () {
  const container = document.getElementById('page-history')

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-small" id="history-back">🏠 主页</button>
      <div class="page-title">历史成绩</div>
      <button class="btn btn-secondary btn-small" id="history-clear" style="color: var(--error);">清空</button>
    </div>
    <div class="page-scroll">
      <div class="page-content">
        <div id="history-list-full" class="card" style="padding: 8px;">
          <div class="text-center text-secondary" style="padding: 32px; font-size: 14px;">加载中...</div>
        </div>
      </div>
    </div>
  `

  document.getElementById('history-back').addEventListener('click', () => App.navigate('home'))

  document.getElementById('history-clear').addEventListener('click', async () => {
    if (!confirm('确定清空所有历史成绩吗？此操作不可撤销。')) return
    try {
      const items = await window.api.storageList()
      for (const item of items) {
        await window.api.storageDelete(item.filename.replace('.json', ''))
      }
      loadFullHistory()
      App.toast('已清空所有记录', 2000)
    } catch {
      App.toast('清空失败', 2000)
    }
  })

  loadFullHistory()
}

async function loadFullHistory() {
  const list = document.getElementById('history-list-full')
  try {
    const items = await window.api.storageList()
    if (items.length === 0) {
      list.innerHTML = '<div class="text-center text-secondary" style="padding: 32px; font-size: 14px;">暂无记录</div>'
      return
    }

    list.innerHTML = items.map(item => {
      const acc = item.accuracy
      const accClass = acc >= 80 ? 'high' : acc >= 60 ? 'mid' : 'low'
      const time = item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN') : ''
      return `
        <div class="history-item" data-filename="${item.filename}">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(item.title)}</div>
            <div class="text-secondary" style="font-size: 13px;">${time}</div>
          </div>
          <div style="width: 120px;">
            <div class="accuracy-bar">
              <div class="accuracy-fill ${accClass}" style="width: ${acc}%"></div>
            </div>
          </div>
          <div style="font-weight: 600; font-size: 16px; min-width: 48px; text-align: right;">
            ${acc != null ? acc + '%' : '-'}
          </div>
          <button class="btn btn-secondary btn-small" data-filename="${item.filename}" data-action="view">查看</button>
          <button class="btn btn-secondary btn-small" data-filename="${item.filename}" data-action="retry">再练</button>
          <button class="btn btn-secondary btn-small" data-filename="${item.filename}" data-action="delete" style="color: var(--error);">删除</button>
        </div>`
    }).join('')

    list.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename
        const key = filename.replace('.json', '')
        const data = await window.api.storageLoad(key)
        if (data) {
          App.navigate('result', { record: data })
        }
      })
    })

    list.querySelectorAll('[data-action="retry"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename
        const key = filename.replace('.json', '')
        const data = await window.api.storageLoad(key)
        if (data && data.sourceUrl) {
          App.currentSet = null
          App.navigate('home')
          setTimeout(() => {
            document.getElementById('url-input').value = data.sourceUrl
            document.getElementById('parse-btn').click()
          }, 100)
        } else {
          App.toast('该记录无来源链接，无法重练', 2000)
        }
      })
    })

    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!confirm('确定删除这条记录？')) return
        const filename = btn.dataset.filename
        const key = filename.replace('.json', '')
        await window.api.storageDelete(key)
        loadFullHistory()
      })
    })
  } catch {
    list.innerHTML = '<div class="text-center text-secondary" style="padding: 32px; font-size: 14px;">加载失败</div>'
  }
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
