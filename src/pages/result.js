window.page_result = function (data) {
  const container = document.getElementById('page-result')
  const set = App.currentSet
  const isFromHistory = data && data.record

  let record = null

  if (isFromHistory) {
    record = data.record
  } else if (set && set.answers) {
    record = {
      setId: set.setId,
      title: set.title,
      grade: set.grade || '',
      sourceUrl: set.sourceUrl || '',
      answerPageUrl: set.answerPageUrl || '',
      timestamp: new Date().toISOString(),
      totalQuestions: set.questionData.questions.length,
      correctCount: null,
      wrongCount: null,
      accuracy: null,
      timeSpent: set.timeSpent || 0,
      answers: set.answers.map(a => ({
        no: a.no, text: a.text, options: a.options,
        userAnswer: a.userAnswer, correctAnswer: null, isCorrect: null
      })),
      standardAnswers: null,
      allGradeAnswers: null,
      scriptText: null,
      scriptImages: [],
      settingDelay: set.settingDelay || 0,
      settingSkip: set.settingSkip || 0
    }
  }

  if (!record) {
    container.innerHTML = '<div class="page-scroll"><div class="page-content text-center" style="padding:60px 0;">暂无数据</div></div>'
    return
  }

  renderResult(record)

  if (!isFromHistory) {
    window.api.storageSave(record.setId, record).catch(() => {})
  }

  // 事件委托：监听整个容器的点击事件
  container.addEventListener('click', handleResultClick)

  function handleResultClick(e) {
    const id = e.target.id
    if (id === 'result-home') {
      container.removeEventListener('click', handleResultClick)
      App.navigate('home')
      return
    }
    if (id === 'result-retry') { handleRetry(record); return }
    if (id === 'btn-grade') { handleAutoGrade(record, container); return }
    if (id === 'btn-manual-grade') {
      document.getElementById('manual-grade-dialog').classList.remove('hidden')
      return
    }
    if (id === 'manual-grade-cancel') {
      document.getElementById('manual-grade-dialog').classList.add('hidden')
      return
    }
    if (id === 'manual-grade-confirm') { handleManualGradeConfirm(record, container); return }
    if (id === 'btn-toggle-script') {
      const el = document.getElementById('script-content')
      if (!el) return
      el.classList.toggle('hidden')
      e.target.textContent = el.classList.contains('hidden') ? '📖 显示录音原文' : '📖 隐藏录音原文'
      return
    }
    if (id === 'btn-download-script') {
      (record.scriptImages || []).forEach((src, idx) => {
        const a = document.createElement('a')
        a.href = src; a.download = '听力原文_' + (idx + 1) + '.png'; a.click()
      })
      return
    }
  }

  // 手动输入自动大写
  container.addEventListener('input', (e) => {
    if (e.target.classList.contains('manual-ans-input')) {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-C]/g, '')
    }
  })
}

function handleRetry(record) {
  if (record.sourceUrl) {
    parsePageFromUrl(record.sourceUrl).then(result => {
      if (!result.markdown) { App.toast('无法重新解析题目', 2000); return }
      const parsed = parseQuestions(result.markdown)
      if (parsed.questions.length === 0) { App.toast('解析题目失败', 2000); return }
      App.currentSet = {
        setId: record.setId, sourceUrl: record.sourceUrl,
        title: result.title || record.title, grade: result.grade || record.grade || '',
        audioUrl: result.audioUrl || '', questionData: parsed,
        answerPageUrl: record.answerPageUrl || '', standardAnswers: null, answers: null
      }
      App.navigate('ready')
    }).catch(() => App.toast('重新解析失败', 2000))
  } else {
    App.navigate('ready')
  }
}

function handleAutoGrade(record, container) {
  window._showPasswordDialog().then(password => {
    if (!password) return
    const btn = document.getElementById('btn-grade')
    if (btn) { btn.disabled = true; btn.textContent = '批改中...' }
    doGrade(record, password).then(() => {
      renderResult(record)
      App.toast('批改完成！', 2000)
    }).catch(err => {
      App.toast('批改失败: ' + (err.message || '未知错误'), 3000)
      if (btn) { btn.disabled = false; btn.textContent = '🔍 自动批改' }
    })
  })
}

function handleManualGradeConfirm(record, container) {
  const errorEl = document.getElementById('manual-grade-error')
  const inputs = document.querySelectorAll('.manual-ans-input')
  const standardAnswers = []
  let valid = true
  inputs.forEach(inp => {
    const val = inp.value.trim().toUpperCase()
    if (!val) { valid = false; return }
    if (!/^[A-C]$/.test(val)) { valid = false; return }
    standardAnswers.push({ no: parseInt(inp.dataset.no), answer: val })
    saveManualAnswer(record.setId, inp.dataset.no, val)
  })
  if (!valid || standardAnswers.length !== record.totalQuestions) {
    errorEl.textContent = '请为所有题目输入 A、B 或 C'
    errorEl.style.display = 'block'
    return
  }
  document.getElementById('manual-grade-dialog').classList.add('hidden')
  doManualGrade(record, standardAnswers)
  renderResult(record)
  App.toast('批改完成！', 2000)
}

function renderResult(record) {
  const container = document.getElementById('page-result')
  const hasGrade = record.accuracy != null
  const hasAnswerUrl = record.answerPageUrl || (App.currentSet && App.currentSet.answerPageUrl)

  const gradeBadge = record.grade
    ? `<span style="display:inline-block;padding:2px 10px;border-radius:4px;background:var(--accent-light);color:var(--accent);font-size:13px;font-weight:500;margin-left:8px;">${escHtml(record.grade)}</span>`
    : ''

  const gradeBtnHtml = hasGrade ? '' : `
    <div class="text-center mt-24" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      ${hasAnswerUrl ? `<button class="btn btn-primary btn-large" id="btn-grade">🔍 自动批改</button>` : ''}
      <button class="btn btn-secondary btn-large" id="btn-manual-grade">✏️ 手动录入答案</button>
    </div>`

  const scoreSummary = hasGrade ? `
    <div class="card text-center mt-16" style="padding:28px;">
      <div style="font-size:48px;font-weight:700;color:${record.accuracy >= 60 ? 'var(--success)' : 'var(--error)'};">
        ${record.accuracy}%
      </div>
      <div style="font-size:16px;color:var(--text-secondary);margin-top:4px;">
        ${record.correctCount} / ${record.totalQuestions} 正确
      </div>
      ${record.timeSpent ? `<div class="text-secondary mt-8" style="font-size:14px;">
        用时 ${formatDuration(record.timeSpent)}
        ${record.settingDelay ? '· 延迟 ' + record.settingDelay + 's' : ''}
        ${record.settingSkip ? '· 跳过 ' + record.settingSkip + 's' : ''}
      </div>` : ''}
    </div>` : ''

  const answersHtml = record.answers.map(a => {
    const showCorrect = hasGrade && a.isCorrect !== null
    const statusIcon = showCorrect ? (a.isCorrect ? '✅' : '❌') : '📝'
    const correctText = showCorrect && !a.isCorrect
      ? `<span style="color:var(--success);">正确答案: ${escHtml(a.correctAnswer)}</span>` : ''
    const userText = a.userAnswer ? `你的选择: ${escHtml(a.userAnswer)}` : '未作答'
    return `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border-light);
        ${showCorrect && !a.isCorrect ? 'background:var(--error-bg);border-radius:6px;margin-bottom:4px;' : ''}">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <span style="flex-shrink:0;">${statusIcon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:500;font-size:14px;line-height:1.5;">${a.no}. ${escHtml(a.text)}</div>
            <div class="text-secondary" style="font-size:13px;margin-top:4px;">${userText}</div>
            ${correctText}
          </div>
        </div>
      </div>`
  }).join('')

  const scriptSection = (record.scriptText || (record.scriptImages && record.scriptImages.length > 0)) ? `
    <div class="card mt-16">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <h3 style="font-size:15px;font-weight:600;">📖 录音原文</h3>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-small" id="btn-toggle-script">📖 隐藏录音原文</button>
          ${(record.scriptImages || []).length > 0 ? `<button class="btn btn-secondary btn-small" id="btn-download-script">⬇ 下载图片</button>` : ''}
        </div>
      </div>
      <div id="script-content" style="margin-top:12px;font-size:14px;line-height:1.8;">
        ${record.scriptText ? `<div style="white-space:pre-wrap;font-family:serif;">${escHtml(record.scriptText)}</div>` : ''}
        ${(record.scriptImages || []).map((src, idx) => `
          <div style="margin:8px 0;text-align:center;">
            <img src="${src}" style="max-width:100%;height:auto;display:block;margin:0 auto;" loading="lazy">
            <a href="${src}" download="听力原文_${idx+1}.png" style="display:inline-block;margin-top:4px;font-size:12px;color:var(--accent);">⬇ 下载</a>
          </div>
        `).join('')}
      </div>
    </div>` : ''

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-small" id="result-home">🏠 主页</button>
      <div class="page-title">答题结果</div>
      <button class="btn btn-secondary btn-small" id="result-retry">🔄 再练一次</button>
    </div>
    <div class="page-scroll">
      <div class="page-content">
        <div class="card">
          <h2 style="font-size:18px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escHtml(record.title)}${gradeBadge}
          </h2>
          <div class="text-secondary mt-8" style="font-size:13px;">
            ${new Date(record.timestamp).toLocaleString('zh-CN')}
          </div>
        </div>
        ${scoreSummary}
        ${gradeBtnHtml}
        <div class="card mt-16">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">答题详情</h3>
          ${answersHtml}
        </div>
        ${scriptSection}

        <div id="manual-grade-dialog" class="dialog-overlay hidden">
          <div class="dialog-box" style="width:500px;max-height:80vh;overflow-y:auto;">
            <div class="dialog-title">✏️ 手动录入标准答案</div>
            <div class="dialog-desc">为每道题输入正确答案（A/B/C）</div>
            <div id="manual-grade-form" style="margin-top:12px;">
              ${record.answers.map(a => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:4px 0;border-bottom:1px solid var(--border-light);">
                  <span style="min-width:30px;font-weight:500;">${a.no}.</span>
                  <span style="flex:1;font-size:13px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(a.text)}</span>
                  <input type="text" class="manual-ans-input" data-no="${a.no}"
                    style="width:50px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:14px;text-transform:uppercase;"
                    maxlength="1" placeholder="A/B/C"
                    value="${loadManualAnswer(record.setId, a.no)}">
                </div>
              `).join('')}
            </div>
            <div class="dialog-actions">
              <button class="btn btn-secondary" id="manual-grade-cancel">取消</button>
              <button class="btn btn-primary" id="manual-grade-confirm">确认批改</button>
            </div>
            <div id="manual-grade-error" class="text-secondary mt-8" style="color:var(--error);display:none;"></div>
          </div>
        </div>
      </div>
    </div>
  `
}

async function doGrade(record, password) {
  const answerPageUrl = record.answerPageUrl || (App.currentSet && App.currentSet.answerPageUrl)
  if (!answerPageUrl) throw new Error('未找到答案页面链接，无法自动批改')

  const grade = record.grade || (App.currentSet && App.currentSet.grade) || ''
  if (!grade) throw new Error('未检测到年级信息（新高一/新高二/新高三），无法自动匹配答案')

  if (!password) throw new Error('请输入密码')

  const res = await window.api.fetchAnswer(answerPageUrl, password, grade)
  if (!res || !res.ok) throw new Error(res && res.msg ? res.msg : '获取答案失败，请检查密码')

  const content = res.content || ''
  if (!content) throw new Error('未获取到答案内容')

  const parsed = parseAnswerContent(content, grade, record.totalQuestions)
  if (!parsed.answers || parsed.answers.length === 0) {
    throw new Error('未能从答案页面中解析出标准答案')
  }

  let correctCount = 0
  for (const a of record.answers) {
    const sa = parsed.answers.find(s => s.no === a.no)
    if (sa) {
      a.correctAnswer = sa.answer
      a.isCorrect = a.userAnswer === sa.answer
      if (a.isCorrect) correctCount++
    }
  }

  record.correctCount = correctCount
  record.wrongCount = record.totalQuestions - correctCount
  record.accuracy = Math.round((correctCount / record.totalQuestions) * 100)
  record.standardAnswers = parsed.answers
  record.allGradeAnswers = parsed.allGradeAnswers
  record.scriptText = parsed.scriptText || ''
  record.scriptImages = (res.gradeImages && res.gradeImages.length > 0) ? res.gradeImages : (res.images || [])
  record.grade = grade

  try {
    await window.api.storageSave(record.setId, record)
  } catch {}
}

function parseAnswerContent(content, targetGrade, totalQuestions) {
  const result = { answers: [], allGradeAnswers: {}, scriptText: '' }

  // 提取录音原文
  const scriptMatch = content.match(/录\s*音\s*原\s*文[\s\S]*/)
  if (scriptMatch) {
    let script = scriptMatch[0]
    // 去除"录 音 原 文"标题行
    script = script.replace(/^录\s*音\s*原\s*文.*(?:\n|$)/, '')
    // 去除年级标题行和空白
    const gradeLines = script.split('\n').filter(l => /^\s*新?高[一二三]\s*$/.test(l.trim()))
    for (const gl of gradeLines) {
      script = script.replace(gl, '')
    }
    result.scriptText = script.replace(/\n{3,}/g, '\n\n').trim()
  }

  // 提取所有年级的答案
  const gradePattern = /(新?高[一二三])[\s\S]*?(?=新?高[一二三]|录\s*音\s*原\s*文|$)/
  let match
  const gradeRegex = new RegExp(gradePattern, 'g')
  while ((match = gradeRegex.exec(content)) !== null) {
    const gradeName = match[1].trim()
    const block = match[0]
    const answers = parseAnswersBlock(block)
    if (answers.length > 0) {
      result.allGradeAnswers[gradeName] = answers
    }
  }

  // 如果正则没匹配到，尝试直接扫描全文
  if (Object.keys(result.allGradeAnswers).length === 0) {
    const lines = content.split('\n')
    let currentGrade = ''
    for (const line of lines) {
      const gradeMatch = line.match(/^\s*(新?高[一二三])\s*$/)
      if (gradeMatch) {
        currentGrade = gradeMatch[1]
        continue
      }
      const ansRegex = /(\d{1,3})\s*[-~]\s*(\d{1,3})\s*[:：]?\s*([A-E\s]+)/g
      let am
      while ((am = ansRegex.exec(line)) !== null) {
        if (!currentGrade) continue
        const start = parseInt(am[1]), end = parseInt(am[2])
        const ansStr = am[3].replace(/\s+/g, '')
        const answers = []
        for (let i = 0; i < ansStr.length && (start + i) <= end; i++) {
          const no = start + i
          if (no >= 1 && no <= totalQuestions && /^[A-E]$/.test(ansStr[i])) {
            answers.push({ no, answer: ansStr[i] })
          }
        }
        if (answers.length > 0) {
          if (!result.allGradeAnswers[currentGrade]) result.allGradeAnswers[currentGrade] = []
          result.allGradeAnswers[currentGrade].push(...answers)
        }
      }
    }
  }

  // 选择目标年级的答案
  const targetKey = Object.keys(result.allGradeAnswers).find(k => k.includes(targetGrade))
    || Object.keys(result.allGradeAnswers).find(k => k.includes('高三'))
    || Object.keys(result.allGradeAnswers)[0]

  result.answers = result.allGradeAnswers[targetKey] || []
  result.selectedGrade = targetKey || targetGrade

  return result
}

function parseAnswersBlock(block) {
  const result = []
  const lines = block.split('\n')
  for (const line of lines) {
    const regex = /(\d{1,3})\s*[-~]\s*(\d{1,3})\s*[:：]?\s*([A-E\s]+)/g
    let m
    while ((m = regex.exec(line)) !== null) {
      const start = parseInt(m[1])
      const end = parseInt(m[2])
      const ansStr = m[3].replace(/\s+/g, '')
      for (let i = 0; i < ansStr.length && (start + i) <= end; i++) {
        const no = start + i
        if (/^[A-E]$/.test(ansStr[i]) && !result.some(r => r.no === no)) {
          result.push({ no, answer: ansStr[i] })
        }
      }
    }
  }
  return result
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m + ':' + String(s).padStart(2, '0')
}

function doManualGrade(record, standardAnswers) {
  let correctCount = 0
  for (const a of record.answers) {
    const sa = standardAnswers.find(s => s.no === a.no)
    if (sa) {
      a.correctAnswer = sa.answer
      a.isCorrect = a.userAnswer === sa.answer
      if (a.isCorrect) correctCount++
    }
  }
  record.correctCount = correctCount
  record.wrongCount = record.totalQuestions - correctCount
  record.accuracy = Math.round((correctCount / record.totalQuestions) * 100)
  record.standardAnswers = standardAnswers

  window.api.storageSave(record.setId, record).catch(() => {})
}

function loadManualAnswer(setId, no) {
  try {
    const data = JSON.parse(localStorage.getItem('manual_ans_' + setId) || '{}')
    return data[no] || ''
  } catch { return '' }
}

function saveManualAnswer(setId, no, val) {
  try {
    const key = 'manual_ans_' + setId
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    data[no] = val
    localStorage.setItem(key, JSON.stringify(data))
  } catch {}
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
