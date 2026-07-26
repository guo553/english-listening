// 主页：二维码/链接输入、解析套题、历史摘要
window.page_home = async function () {
  const container = document.getElementById('page-home')

  // 页面模板：二维码上传区、链接输入框、历史记录摘要
  container.innerHTML = `
    <div class="page-scroll">
      <div class="page-content">
        <div class="text-center" style="padding: 32px 0 24px; position: relative;">
          <h1 style="font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">听力小工具</h1>
          <p class="text-secondary mt-8">英语听力高效训练</p>
          <button id="home-settings" class="btn btn-secondary btn-small"
            style="position: absolute; top: 0; right: 0;">⚙ 设置</button>
        </div>

        <!-- 二维码上传区：点击选择文件、拖拽图片、粘贴按钮 -->
        <div class="card text-center" style="cursor: pointer; padding: 40px 24px; border: 2px dashed var(--border);"
             id="qr-upload-area">
          <div style="font-size: 48px; margin-bottom: 12px;">📷</div>
          <div style="font-size: 18px; font-weight: 600;">选择二维码图片</div>
          <div class="text-secondary mt-8" style="font-size: 14px;">从文件中选择或粘贴二维码</div>
          <button id="qr-paste-btn" class="btn btn-secondary btn-small" style="margin-top: 12px;">📋 粘贴</button>
        </div>
        <!-- 隐藏的文件选择 input，通过点击二维码区触发 -->
        <input type="file" id="qr-file-input" accept="image/*" style="display:none">

        <!-- 分割线：或者手动输入链接 -->
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

        <!-- 状态提示区：显示解析进度/错误 -->
        <div id="home-status" class="text-center text-secondary mt-16" style="display:none; padding: 16px;"></div>

        <!-- 历史记录摘要：显示最近5条练习 -->
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

  // DOM 引用
  const qrArea = document.getElementById('qr-upload-area')
  const qrInput = document.getElementById('qr-file-input')
  const urlInput = document.getElementById('url-input')
  const parseBtn = document.getElementById('parse-btn')
  const statusEl = document.getElementById('home-status')

  // 解析锁：防止重复点击导致并发请求
  let isParsing = false

  // 设置状态提示文字
  function setStatus(msg, isError) {
    statusEl.style.display = 'block'
    statusEl.textContent = msg
    statusEl.style.color = isError ? 'var(--error)' : 'var(--text-secondary)'
  }

  function clearStatus() {
    statusEl.style.display = 'none'
  }

  // 核心函数：解析听力 URL → 提取题目 → 保存到 App.currentSet → 跳转准备页
  // 同时将解析结果缓存到文件系统（set_{setId}.json），供「再练一次」直接加载
  async function startParse(url) {
    if (isParsing) return
    isParsing = true
    clearStatus()
    setStatus('正在解析页面...', false)
    try {
      // 通过 Electron IPC 在独立 BrowserWindow 中加载页面提取内容
      const result = await parsePageFromUrl(url)
      if (!result.markdown) {
        setStatus('未能提取到题目内容，请检查链接', true)
        return
      }
      setStatus('解析成功，正在处理题目...', false)
      // 将 markdown 解析为结构化题目数据
      const parsed = parseQuestions(result.markdown)
      if (parsed.questions.length === 0) {
        setStatus('未能识别出题目，请检查链接', true)
        return
      }

      // 从 URL 末尾提取 setId 作为唯一标识（同一套题共用同一 setId）
      const setId = url.split('/').pop() || Date.now().toString(36)

      // 如果有答案二维码图片，下载并解码出答案页 URL
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

      // 缓存套题到文件系统：下次「再练一次」时直接读文件，无需重新 HTTP 请求
      window.api.storageSave('set_' + setId, {
        title: result.title || '未命名套题',
        grade: result.grade || '',
        audioUrl: result.audioUrl,
        questions: parsed.questions,
        groups: parsed.groups,
        sections: parsed.sections
      }).catch(() => {})

      App.navigate('ready')
    } catch (err) {
      setStatus('解析失败: ' + (err.message || '未知错误'), true)
    } finally {
      isParsing = false
    }
  }

  // 点击二维码区 → 弹出文件选择框（除非点的是粘贴按钮）
  qrArea.addEventListener('click', (e) => {
    if (e.target.id === 'qr-paste-btn') return
    qrInput.click()
  })

  // 拖拽图片到二维码区 → 高亮提示
  qrArea.addEventListener('dragover', (e) => {
    e.preventDefault()
    qrArea.style.borderColor = 'var(--accent)'
    qrArea.style.background = 'var(--accent-light)'
  })

  qrArea.addEventListener('dragleave', () => {
    qrArea.style.borderColor = 'var(--border)'
    qrArea.style.background = 'transparent'
  })

  // 放下图片 → 解码二维码 → 自动解析
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

  // 通过文件选择器选中图片 → 解码二维码 → 自动解析
  qrInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    clearStatus()
    setStatus('正在解码二维码...', false)
    try {
      const url = await decodeQRFromFile(file)
      urlInput.value = url
      startParse(url)
    } catch (err) {
      setStatus('二维码识别失败: ' + (err.message || '未知错误'), true)
    }
  })

  // 点击解析按钮 → 从输入框获取 URL → 解析
  parseBtn.addEventListener('click', () => {
    const url = urlInput.value.trim()
    if (!url) {
      setStatus('请输入听力页面链接', true)
      return
    }
    startParse(url)
  })

  // 输入框按回车 → 触发解析
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') parseBtn.click()
  })

  // 设置按钮 → 跳转设置页
  document.getElementById('home-settings').addEventListener('click', () => {
    App.navigate('settings')
  })

  // 查看全部历史 → 跳转历史页
  document.getElementById('view-all-history').addEventListener('click', (e) => {
    e.preventDefault()
    App.navigate('history')
  })

  // 粘贴按钮（二维码区内的按钮）：从剪贴板读取图片或文本
  document.getElementById('qr-paste-btn').addEventListener('click', async () => {
    try {
      // 优先读取剪贴板中的图片（二维码截图）
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
      // 没有图片则尝试读取文本中的 URL
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

  // 在 URL 输入框内粘贴 → 同样检查剪贴板是否有图片
  urlInput.addEventListener('paste', async (e) => {
    e.preventDefault()
    try {
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

  // 加载主页历史摘要
  loadHistorySummary()
}

// 从 __sets__.json 全局索引读取最近的练习记录摘要
// __sets__.json 由 savePracticeRecord 每次保存时同步更新
async function loadHistorySummary() {
  const list = document.getElementById('history-list')
  try {
    // 读取全局套题索引，key = setId, value = {title, accuracy, practiceCount, timestamp}
    const index = await window.api.storageLoad('__sets__') || {}
    const setIds = Object.keys(index)

    if (setIds.length === 0) {
      list.innerHTML = '<div class="text-center text-secondary" style="padding: 24px; font-size: 14px;">暂无记录</div>'
      return
    }

    // 按时间排序，取最近 5 个
    const sorted = setIds
      .map(id => ({ setId: id, ...index[id] }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    const recent = sorted.slice(0, 5)

    // 渲染历史列表，同一套题多次练习合并显示并标注次数
    list.innerHTML = recent.map(r => {
      const acc = r.accuracy
      const accClass = acc >= 80 ? 'high' : acc >= 60 ? 'mid' : 'low'
      const time = r.timestamp ? new Date(r.timestamp).toLocaleDateString('zh-CN') : ''
      return `
        <div class="history-item" data-set-id="${escHtml(r.setId)}" data-practice-count="${r.practiceCount || 1}">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escHtml(r.title || r.setId)}
              ${(r.practiceCount || 1) > 1 ? `<span style="font-size: 11px; color: var(--accent); margin-left: 4px;">(${r.practiceCount}次)</span>` : ''}
            </div>
            <div class="text-secondary" style="font-size: 13px;">${time}</div>
          </div>
          <div style="width: 120px;">
            <div class="accuracy-bar"><div class="accuracy-fill ${accClass}" style="width: ${acc ?? 0}%"></div></div>
          </div>
          <div style="font-weight: 600; font-size: 15px; min-width: 48px; text-align: right;">${acc != null ? acc + '%' : '-'}</div>
          <button class="btn btn-secondary btn-small" data-set-id="${escHtml(r.setId)}" data-action="view">查看</button>
        </div>`
    }).join('')

    // 点击「查看」→ 读取该套题的最新一次练习记录并跳转结果页
    list.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const setId = btn.dataset.setId
        const summary = await window.api.storageLoad('summary_' + setId)
        const latest = Array.isArray(summary) && summary.length > 0 ? summary[summary.length - 1] : null
        if (latest && latest.practiceId) {
          const fullRecord = await window.api.storageLoad(latest.practiceId)
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

// XSS 防护：将文本中的 HTML 特殊字符转义
function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
