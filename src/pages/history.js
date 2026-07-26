window.page_history = function () {
  const container = document.getElementById('page-history')

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-small" id="history-back">🏠 主页</button>
      <div class="page-title">历史成绩</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-secondary btn-small" id="history-export-all" title="导出所有记录">📥 导出</button>
        <button class="btn btn-secondary btn-small" id="history-clear" style="color: var(--error);">清空</button>
      </div>
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
        const key = item.filename.replace('.json', '')
        if (key.startsWith('__') || key.startsWith('summary_') || key.startsWith('manual_')) continue
        await window.api.storageDelete(key).catch(() => {})
      }
      const items2 = await window.api.storageList()
      for (const item of items2) {
        if (item.filename.startsWith('summary_') || item.filename.startsWith('manual_')) {
          await window.api.storageDelete(item.filename.replace('.json', '')).catch(() => {})
        }
      }
      loadFullHistory()
      App.toast('已清空所有记录', 2000)
    } catch {
      App.toast('清空失败', 2000)
    }
  })

  document.getElementById('history-export-all').addEventListener('click', () => {
    exportAllToCsv()
  })

  loadFullHistory()
}

async function loadFullHistory() {
  const list = document.getElementById('history-list-full')
  try {
    const items = await window.api.storageList()

    const practiceGroups = {}
    for (const item of items) {
      try {
        const data = await window.api.storageLoad(item.filename.replace('.json', ''))
        if (data && data.setId) {
          if (!practiceGroups[data.setId]) {
            practiceGroups[data.setId] = {
              setId: data.setId,
              title: data.title || '未命名',
              grade: data.grade || '',
              sourceUrl: data.sourceUrl || '',
              answerPageUrl: data.answerPageUrl || '',
              practices: [],
              latestTimestamp: ''
            }
          }
          practiceGroups[data.setId].practices.push(data)
          if (!practiceGroups[data.setId].latestTimestamp ||
              new Date(data.timestamp) > new Date(practiceGroups[data.setId].latestTimestamp)) {
            practiceGroups[data.setId].latestTimestamp = data.timestamp
          }
        }
      } catch {}
    }

    const groupKeys = Object.keys(practiceGroups)
    if (groupKeys.length === 0) {
      list.innerHTML = '<div class="text-center text-secondary" style="padding: 32px; font-size: 14px;">暂无记录</div>'
      return
    }

    groupKeys.sort((a, b) =>
      new Date(practiceGroups[b].latestTimestamp) - new Date(practiceGroups[a].latestTimestamp)
    )

    list.innerHTML = groupKeys.map(setId => {
      const group = practiceGroups[setId]
      const practices = group.practices.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      )
      const latest = practices[0]
      const gradedPractices = practices.filter(p => p.accuracy != null)
      const bestAcc = gradedPractices.length > 0
        ? Math.max(...gradedPractices.map(p => p.accuracy))
        : null
      const avgAcc = gradedPractices.length > 0
        ? Math.round(gradedPractices.reduce((sum, p) => sum + p.accuracy, 0) / gradedPractices.length)
        : null

      return `
        <div class="history-group" style="border-bottom:1px solid var(--border-light);padding:12px 0;" data-set-id="${escHtml(setId)}">
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:500;display:flex;align-items:center;gap:8px;">
                ${escHtml(group.title)}
                ${practices.length > 1 ? `<span style="background:var(--accent-light);color:var(--accent);font-size:11px;padding:2px 8px;border-radius:10px;">${practices.length}次</span>` : ''}
                ${group.grade ? `<span style="background:var(--bg-hover);color:var(--text-secondary);font-size:11px;padding:2px 8px;border-radius:4px;">${escHtml(group.grade)}</span>` : ''}
              </div>
              <div class="text-secondary" style="font-size:13px;margin-top:4px;">
                ${new Date(latest.timestamp).toLocaleDateString('zh-CN')}
                ${bestAcc != null ? `· 最高 ${bestAcc}% · 平均 ${avgAcc}%` : ''}
                ${practices.length > 1 ? ` · 共${practices.length}次练习` : ''}
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <div style="width:100px;">
                <div class="accuracy-bar">
                  <div class="accuracy-fill ${(latest.accuracy ?? 0) >= 80 ? 'high' : (latest.accuracy ?? 0) >= 60 ? 'mid' : 'low'}"
                    style="width:${latest.accuracy ?? 0}%;"></div>
                </div>
              </div>
              <div style="font-weight:600;font-size:15px;min-width:48px;text-align:right;">
                ${latest.accuracy != null ? latest.accuracy + '%' : '-'}
              </div>
              <button class="btn btn-secondary btn-small" data-set-id="${escHtml(setId)}" data-action="expand">详情</button>
              <button class="btn btn-secondary btn-small" data-filename="${latest.practiceId || ''}" data-action="view">查看</button>
              <button class="btn btn-secondary btn-small" data-set-id="${escHtml(setId)}" data-source-url="${escHtml(group.sourceUrl)}" data-action="retry">再练</button>
              <button class="btn btn-secondary btn-small" data-set-id="${escHtml(setId)}" data-action="delete" style="color: var(--error);">删除</button>
            </div>
          </div>
          <div class="practice-detail-list" style="display:none;padding-top:12px;margin-top:12px;border-top:1px solid var(--border-light);">
            ${practices.map(p => `
              <div style="display:flex;align-items:center;gap:12px;padding:8px;border-radius:6px;margin-bottom:4px;background:var(--bg-hover);">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;color:var(--text-secondary);">
                    第${p.practiceNumber || '?'}次 · ${new Date(p.timestamp).toLocaleString('zh-CN')}
                  </div>
                  ${p.timeSpent ? `<div style="font-size:12px;color:var(--text-muted);">用时 ${formatDuration(p.timeSpent)}</div>` : ''}
                </div>
                <div style="font-weight:600;font-size:14px;color:${(p.accuracy ?? 0) >= 60 ? 'var(--success)' : 'var(--error)'};">
                  ${p.accuracy != null ? p.accuracy + '%' : '未批改'}
                </div>
                <button class="btn btn-secondary btn-small" data-practice-id="${p.practiceId}" data-action="view-practice">查看</button>
              </div>
            `).join('')}
          </div>
        </div>`
    }).join('')

    list.querySelectorAll('[data-action="expand"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const groupEl = btn.closest('.history-group')
        const detailEl = groupEl.querySelector('.practice-detail-list')
        detailEl.style.display = detailEl.style.display === 'none' ? 'block' : 'none'
        btn.textContent = detailEl.style.display === 'none' ? '详情' : '收起'
      })
    })

    list.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const practiceId = btn.dataset.filename
        if (!practiceId) return
        const data = await window.api.storageLoad(practiceId)
        if (data) {
          App.navigate('result', { record: data })
        }
      })
    })

    list.querySelectorAll('[data-action="view-practice"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const practiceId = btn.dataset.practiceId
        if (!practiceId) return
        const data = await window.api.storageLoad(practiceId)
        if (data) {
          App.navigate('result', { record: data })
        }
      })
    })

    list.querySelectorAll('[data-action="retry"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const sourceUrl = btn.dataset.sourceUrl
        const setId = btn.dataset.setId
        if (!sourceUrl) {
          App.toast('该记录无来源链接，无法重练', 2000)
          return
        }
        App.currentSet = null
        App.navigate('home')
        setTimeout(() => {
          document.getElementById('url-input').value = sourceUrl
          document.getElementById('parse-btn').click()
        }, 100)
      })
    })

    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const setId = btn.dataset.setId
        if (!confirm(`确定删除「${setId}」的所有练习记录吗？`)) return

        for (const p of practiceGroups[setId].practices) {
          if (p.practiceId) {
            await window.api.storageDelete(p.practiceId).catch(() => {})
          }
        }
        localStorage.removeItem('practice_records_' + setId)

        loadFullHistory()
        App.toast('已删除该题目的所有记录', 2000)
      })
    })
  } catch {
    list.innerHTML = '<div class="text-center text-secondary" style="padding: 32px; font-size: 14px;">加载失败</div>'
  }
}

async function exportAllToCsv() {
  try {
    let allRecords = []
    const items = await window.api.storageList()

    for (const item of items) {
      const key = item.filename.replace('.json', '')
      if (!key.startsWith('summary_')) continue
      try {
        const records = await window.api.storageLoad(key)
        if (Array.isArray(records)) {
          const setId = key.replace('summary_', '')
          for (const r of records) {
            r._setId = setId
          }
          allRecords = allRecords.concat(records)
        }
      } catch {}
    }

    if (allRecords.length === 0) {
      App.toast('没有可导出的练习记录', 2000)
      return
    }

    const sorted = allRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    const BOM = '\uFEFF'
    const headers = ['序号', '题目ID', '练习次数', '日期时间', '正确率(%)', '正确数', '总题数', '用时(秒)']
    const rows = sorted.map((r, idx) => [
      idx + 1,
      `"${(r._setId || '').replace(/"/g, '""')}"`,
      r.practiceNumber,
      new Date(r.timestamp).toLocaleString('zh-CN'),
      r.accuracy ?? '',
      r.correctCount ?? '',
      r.totalQuestions ?? '',
      r.timeSpent ?? ''
    ])

    const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `听力练习记录_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    App.toast(`已导出 ${sorted.length} 条练习记录`, 2000)
  } catch (err) {
    console.error('CSV 导出失败:', err)
    App.toast('导出失败: ' + err.message, 3000)
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m + ':' + String(s).padStart(2, '0')
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
