window.page_home = async function () {
  const container = document.getElementById('page-home')

  container.innerHTML = `
    <div class="page-scroll">
      <div class="page-content">
        <div class="text-center" style="padding: 32px 0 24px; position: relative;">
          <h1 style="font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">听力小工具</h1>
          <p class="text-secondary mt-8">英语听力高效训练</p>
          <button id="home-settings" class="btn btn-secondary btn-small"
            style="position: absolute; top: 0; right: 0;">⚙ 设置</button>
        </div>

        <div class="card text-center" style="cursor: pointer; padding: 40px 24px; border: 2px dashed var(--border);"
             id="qr-upload-area">
          <div style="font-size: 48px; margin-bottom: 12px;">📷</div>
          <div style="font-size: 18px; font-weight: 600;">选择二维码图片</div>
          <div class="text-secondary mt-8" style="font-size: 14px;">从文件中选择或粘贴二维码</div>
          <button id="qr-paste-btn" class="btn btn-secondary btn-small" style="margin-top: 12px;">📋 粘贴</button>
        </div>
        <input type="file" id="qr-file-input" accept="image/*" style="display:none">

        <div style="margin-top: 24px; display: flex; align-items: center; gap: 16px;">
          <hr style="flex: 1; border: none; border-top: 1px solid var(--border);">
          <span class="text-secondary" style="font-size: 13px; white-space: nowrap;">或者输入链接</span>
          <hr style="flex: 1; border: none; border-top: 1px solid var(--border);">
        </div>

        <div class="mt-16" style="display: flex; gap: 8px;">
          <input type="text" id="url-input" class="input" placeholder="粘贴听力页面链接..."
                 style="flex: 1;">
          <button class="btn btn-primary" id="parse-btn">解析</button>
        </div>

        <div id="home-status" class="text-center text-secondary mt-16" style="display:none; padding: 16px;"></div>

        <div id="home-history" class="mt-24">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 600;">历史成绩</h3>
            <a href="#" id="view-all-history" style="font-size: 14px; color: var(--accent); text-decoration: none;">查看全部 →</a>
          </div>
          <div id="history-list" class="card" style="padding: 8px;">
            <div class="text-center text-secondary" style="padding: 24px; font-size: 14px;">暂无记录</div>
          </div>
        </div>
      </div>
    </div>
  `

  const qrArea = document.getElementById('qr-upload-area')
  const qrInput = document.getElementById('qr-file-input')
  const urlInput = document.getElementById('url-input')
  const parseBtn = document.getElementById('parse-btn')
  const statusEl = document.getElementById('home-status')
  
  let isParsing = false

  function setStatus(msg, isError) {
    statusEl.style.display = 'block'
    statusEl.textContent = msg
    statusEl.style.color = isError ? 'var(--error)' : 'var(--text-secondary)'
  }

  function clearStatus() {
    statusEl.style.display = 'none'
  }

  async function startParse(url) {
    if (isParsing) return
    isParsing = true
    clearStatus()
    setStatus('正在解析页面...', false)
    try {
      const result = await parsePageFromUrl(url)
      if (!result.markdown) {
        setStatus('未能提取到题目内容，请检查链接', true)
        return
      }
      setStatus('解析成功，正在处理题目...', false)
      const parsed = parseQuestions(result.markdown)
      if (parsed.questions.length === 0) {
        setStatus('未能识别出题目，请检查链接', true)
        return
      }

      const setId = url.split('/').pop() || Date.now().toString(36)
      let qrAnswerUrl = ''
      if (result.qrImageUrl) {
        try {
          const base64 = await window.api.downloadImage(result.qrImageUrl)
          qrAnswerUrl = await decodeQRFromBase64(base64)
        } catch {
          qrAnswerUrl = ''
        }
      }

      App.currentSet = {
        setId: setId,
        sourceUrl: url,
        title: result.title || '未命名套题',
        grade: result.grade || '',
        audioUrl: result.audioUrl,
        questionData: parsed,
        answerPageUrl: qrAnswerUrl,
        standardAnswers: null,
        answers: null
      }
      App.navigate('ready')
    } catch (err) {
      setStatus('解析失败: ' + (err.message || '未知错误'), true)
    } finally {
      isParsing = false
    }
  }

  qrArea.addEventListener('click', (e) => {
  // 如果点击的是粘贴按钮，则不触发文件选择
  if (e.target.id === 'qr-paste-btn') {
    return
  }
  qrInput.click()
})

  qrArea.addEventListener('dragover', (e) => {
    e.preventDefault()
    qrArea.style.borderColor = 'var(--accent)'
    qrArea.style.background = 'var(--accent-light)'
  })

  qrArea.addEventListener('dragleave', () => {
    qrArea.style.borderColor = 'var(--border)'
    qrArea.style.background = 'transparent'
  })

  qrArea.addEventListener('drop', (e) => {
    e.preventDefault()
    qrArea.style.borderColor = 'var(--border)'
    qrArea.style.background = 'transparent'
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) {
      setStatus('请拖入图片文件', true)
      return
    }
    clearStatus()
    setStatus('正在解码二维码...', false)
    decodeQRFromFile(file).then(url => {
      urlInput.value = url
      startParse(url)
    }).catch(err => {
      setStatus('二维码识别失败: ' + (err.message || '未知错误'), true)
    })
  })

  qrInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    clearStatus()
    setStatus('正在解码二维码...', false)
try {
  const url = await decodeQRFromFile(file)
  urlInput.value = url
  startParse(url)
  return
} catch (err) {
  setStatus('二维码识别失败: ' + (err.message || '未知错误'), true)
}
  })

  parseBtn.addEventListener('click', () => {
    const url = urlInput.value.trim()
    if (!url) {
      setStatus('请输入听力页面链接', true)
      return
    }
    startParse(url)
  })

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') parseBtn.click()
  })

  document.getElementById('home-settings').addEventListener('click', () => {
    App.navigate('settings')
  })

  document.getElementById('view-all-history').addEventListener('click', (e) => {
    e.preventDefault()
    App.navigate('history')
  })

  document.getElementById('qr-paste-btn').addEventListener('click', async () => {
    try {
      // 尝试读取剪贴板中的图片
      const clipboardItems = await navigator.clipboard.read()
      let hasImage = false
      
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            hasImage = true
            const blob = await item.getType(type)
            const file = new File([blob], 'clipboard-image.png', { type: blob.type })
            
            setStatus('正在解码二维码...', false)
            try {
              const url = await decodeQRFromFile(file)
              urlInput.value = url
              startParse(url)
              return
            } catch (err) {
              setStatus('二维码识别失败: ' + (err.message || '未知错误'), true)
            }
          }
        }
      }
      
      // 如果没有图片，尝试读取文本
      if (!hasImage) {
        const text = await navigator.clipboard.readText()
        if (!text) {
          setStatus('剪贴板为空', true)
          return
        }
        
        const urlPattern = /(https?:\/\/[^\s]+)/
        const urlMatch = text.match(urlPattern)
        
        if (urlMatch) {
          const url = urlMatch[0]
          urlInput.value = url
          startParse(url)
        } else {
          setStatus('剪贴板中没有有效的 URL', true)
        }
      }
    } catch (err) {
      setStatus('无法读取剪贴板: ' + err.message, true)
    }
  })

  // 监听粘贴事件
  urlInput.addEventListener('paste', async (e) => {
    e.preventDefault()
    try {
      // 尝试读取剪贴板中的图片
      const clipboardItems = await navigator.clipboard.read()
      let hasImage = false
      
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            hasImage = true
            const blob = await item.getType(type)
            const file = new File([blob], 'clipboard-image.png', { type: blob.type })
            
            setStatus('正在解码二维码...', false)
            try {
              const url = await decodeQRFromFile(file)
              urlInput.value = url
              startParse(url)
              return
            } catch (err) {
              setStatus('二维码识别失败: ' + (err.message || '未知错误'), true)
            }
          }
        }
      }
      
      // 如果没有图片，尝试读取文本
      if (!hasImage) {
        const text = await navigator.clipboard.readText()
        if (!text) {
          setStatus('剪贴板为空', true)
          return
        }
        
        const urlPattern = /(https?:\/\/[^\s]+)/
        const urlMatch = text.match(urlPattern)
        
        if (urlMatch) {
          const url = urlMatch[0]
          urlInput.value = url
          startParse(url)
        } else {
          setStatus('剪贴板中没有有效的 URL', true)
        }
      }
    } catch (err) {
      setStatus('无法读取剪贴板: ' + err.message, true)
    }
  })

  loadHistorySummary()
}

async function loadHistorySummary() {
  const list = document.getElementById('history-list')
  try {
    const items = await window.api.storageList()

    const grouped = {}
    for (const item of items) {
      const key = item.filename.replace('.json', '')
      if (!key.startsWith('summary_')) continue
      try {
        const records = await window.api.storageLoad(key)
        const setTitle = item.title || key
        if (!grouped[setTitle] || new Date(item.timestamp) > new Date(grouped[setTitle].timestamp)) {
          const latest = Array.isArray(records) ? records[records.length - 1] : null
          grouped[setTitle] = {
            title: setTitle,
            filename: item.filename,
            key: key,
            accuracy: latest ? latest.accuracy : item.accuracy,
            timestamp: item.timestamp,
            practiceCount: Array.isArray(records) ? records.length : 0
          }
        }
      } catch {}
    }

    const sorted = Object.values(grouped).sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    )
    const recent = sorted.slice(0, 5)

    if (recent.length === 0) {
      const fallback = items.filter(i => !i.filename.startsWith('summary_') && !i.filename.startsWith('__') && !i.filename.startsWith('manual_'))
      if (fallback.length === 0) {
        list.innerHTML = '<div class="text-center text-secondary" style="padding: 24px; font-size: 14px;">暂无记录</div>'
        return
      }
      const entry = fallback[0]
      const acc = entry.accuracy
      const accClass = acc >= 80 ? 'high' : acc >= 60 ? 'mid' : 'low'
      list.innerHTML = `
        <div class="history-item" data-filename="${entry.filename}">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escHtml(entry.title)}</div>
            <div class="text-secondary" style="font-size: 13px;">${entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('zh-CN') : ''}</div>
          </div>
          <div style="width: 120px;">
            <div class="accuracy-bar"><div class="accuracy-fill ${accClass}" style="width: ${acc ?? 0}%"></div></div>
          </div>
          <div style="font-weight: 600; font-size: 15px; min-width: 48px; text-align: right;">${acc != null ? acc + '%' : '-'}</div>
          <button class="btn btn-secondary btn-small" data-filename="${entry.filename}" data-action="view">查看</button>
        </div>`
      addSummaryViewListeners(list, fallback)
      return
    }

    list.innerHTML = recent.map(r => {
      const acc = r.accuracy
      const accClass = acc >= 80 ? 'high' : acc >= 60 ? 'mid' : 'low'
      const time = r.timestamp ? new Date(r.timestamp).toLocaleDateString('zh-CN') : ''
      return `
        <div class="history-item" data-filename="${r.filename}">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escHtml(r.title)}
              ${r.practiceCount > 1 ? `<span style="font-size: 11px; color: var(--accent); margin-left: 4px;">(${r.practiceCount}次)</span>` : ''}
            </div>
            <div class="text-secondary" style="font-size: 13px;">${time}</div>
          </div>
          <div style="width: 120px;">
            <div class="accuracy-bar"><div class="accuracy-fill ${accClass}" style="width: ${acc ?? 0}%"></div></div>
          </div>
          <div style="font-weight: 600; font-size: 15px; min-width: 48px; text-align: right;">${acc != null ? acc + '%' : '-'}</div>
          <button class="btn btn-secondary btn-small" data-filename="${r.filename}" data-action="view">查看</button>
        </div>`
    }).join('')

    list.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const key = btn.dataset.filename.replace('.json', '')
        const records = await window.api.storageLoad(key)
        const latestRecord = Array.isArray(records) ? records[records.length - 1] : records
        if (latestRecord && latestRecord.practiceId) {
          const fullRecord = await window.api.storageLoad(latestRecord.practiceId)
          if (fullRecord) {
            App.navigate('result', { record: fullRecord })
          }
        }
      })
    })
  } catch {
    list.innerHTML = '<div class="text-center text-secondary" style="padding: 24px; font-size: 14px;">加载失败</div>'
  }
}

function addSummaryViewListeners(list, items) {
  list.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const filename = btn.dataset.filename
      const key = filename.replace('.json', '')
      const data = await window.api.storageLoad(key)
      if (data) {
        App.navigate('result', { record: data })
      }
    })
  })
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
