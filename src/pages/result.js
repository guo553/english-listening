window.page_result = async function (data) {
  const container = document.getElementById('page-result')
  const set = App.currentSet
  const isFromHistory = data && data.record

  let record = null

  if (isFromHistory) {
    record = data.record
  } else if (set && set.answers) {
    const practiceId = 'practice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
    record = {
      practiceId: practiceId,
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
      settingSkip: set.settingSkip || 0,
      practiceNumber: 1
    }

    try {
      const existingRecords = await getPracticeRecords(set.setId)
      record.practiceNumber = existingRecords.length + 1
    } catch {}
  }

  if (!record) {
    container.innerHTML = '<div class="page-scroll"><div class="page-content text-center" style="padding:60px 0;">暂无数据</div></div>'
    return
  }

  renderResult(record).then(() => {
    if (!isFromHistory) {
      savePracticeRecord(record)
    }
  })

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
      const imgs = record.scriptImages || []
      if (imgs.length === 0) return
      window.api.saveAllImages(imgs, record.title || '听力').then(res => {
        if (res && res.ok) {
          App.toast(`已保存 ${res.saved.length} 张图片到 ${res.targetDir}`, 3000)
        }
      })
      return
    }
    if (id === 'btn-view-history') {
      showPracticeHistory(record.setId, record.title)
      return
    }
    if (id === 'btn-export-csv') {
      exportToCsv(record.setId, record.title)
      return
    }
  }

  container.addEventListener('input', (e) => {
    if (e.target.classList.contains('manual-ans-input')) {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-C]/g, '')
    }
  })
}

// 保存练习记录：完整记录存到 practiceId.json，摘要存到 summary_{setId}.json，更新全局索引
function savePracticeRecord(record) {
  // 完整记录（含答案、原文等全部数据）以 practiceId 为 key 存储
  window.api.storageSave(record.practiceId, record).catch(() => {})

  // 摘要记录（供成绩趋势/CSV导出使用）以 summary_{setId} 为 key，存为数组
  getPracticeRecordsFromFile(record.setId).then(records => {
    const idx = records.findIndex(r => r.practiceId === record.practiceId)
    const summary = {
      practiceId: record.practiceId,
      title: record.title,
      timestamp: record.timestamp,
      accuracy: record.accuracy,
      correctCount: record.correctCount,
      totalQuestions: record.totalQuestions,
      timeSpent: record.timeSpent,
      practiceNumber: record.practiceNumber
    }
    // 同一 practiceId 已存在则更新（如批改后 accuracy 从 null 变有值），否则追加
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...summary }
    } else {
      records.push(summary)
    }
    window.api.storageSave('summary_' + record.setId, records).catch(() => {})
  }).catch(() => {})

  // 更新全局套题索引 __sets__.json，供主页和历史页快速读取
  updateSetsIndex(record)
}

// 更新 __sets__.json 全局索引：key = setId, value = {title, accuracy, practiceCount, timestamp}
// 主页 loadHistorySummary 和历史页 loadFullHistory 都依赖此索引
async function updateSetsIndex(record) {
  try {
    const index = await window.api.storageLoad('__sets__') || {}
    // 从摘要数组长度获取实际练习次数，避免重复调用导致计数错误
    const summary = await getPracticeRecordsFromFile(record.setId)
    index[record.setId] = {
      title: record.title || (index[record.setId] && index[record.setId].title) || record.setId,
      grade: record.grade || (index[record.setId] && index[record.setId].grade) || '',
      sourceUrl: record.sourceUrl || (index[record.setId] && index[record.setId].sourceUrl) || '',
      answerPageUrl: record.answerPageUrl || (index[record.setId] && index[record.setId].answerPageUrl) || '',
      timestamp: record.timestamp || (index[record.setId] && index[record.setId].timestamp),
      accuracy: record.accuracy != null ? record.accuracy : (index[record.setId] && index[record.setId].accuracy),
      practiceCount: Array.isArray(summary) ? summary.length : (index[record.setId] && index[record.setId].practiceCount) || 1
    }
    await window.api.storageSave('__sets__', index)
  } catch {}
}

// 读取某套题的练习摘要，返回 Promise（兼容旧的同步调用）
function getPracticeRecords(setId) {
  return new Promise((resolve) => {
    getPracticeRecordsFromFile(setId).then(resolve).catch(() => resolve([]))
  })
}

// 从文件读取摘要数组 summary_{setId}.json
async function getPracticeRecordsFromFile(setId) {
  try {
    const data = await window.api.storageLoad('summary_' + setId)
    return data || []
  } catch {
    return []
  }
}

// 「再练一次」：优先从文件缓存 set_{setId}.json 加载套题数据
// 有缓存则直接跳转准备页，无缓存则重新 HTTP 请求解析并缓存
function handleRetry(record) {
  if (!record.sourceUrl) {
    App.toast('该记录无来源链接，无法重练', 2000)
    return
  }

  App.toast('正在加载题目...', 2000)

  // 尝试从文件系统读取缓存的套题数据（第一次解析时由 startParse 缓存）
  const tryLoadCached = window.api.storageLoad('set_' + record.setId)

  tryLoadCached.then(cachedSet => {
    if (cachedSet && cachedSet.questions && cachedSet.questions.length > 0) {
      // 有缓存 → 直接跳转到准备页
      setAndGo(cachedSet, record)
      return
    }
    // 无缓存 → 重新请求 URL 解析，并缓存结果供下次使用
    parsePageFromUrl(record.sourceUrl).then(result => {
      if (!result.markdown) {
        App.toast('无法重新解析题目，请检查网络连接', 3000)
        return
      }
      const parsed = parseQuestions(result.markdown)
      if (parsed.questions.length === 0) {
        App.toast('解析题目失败', 2000)
        return
      }
      const cached = {
        title: result.title || record.title,
        grade: result.grade || record.grade || '',
        audioUrl: result.audioUrl || '',
        questions: parsed.questions,
        groups: parsed.groups,
        sections: parsed.sections
      }
      window.api.storageSave('set_' + record.setId, cached).catch(() => {})
      setAndGo(cached, record)
    })
  }).catch(() => {
    // storageLoad 失败（文件不存在等），也走重新解析流程
    parsePageFromUrl(record.sourceUrl).then(result => {
      if (!result.markdown) {
        App.toast('无法重新解析题目，请检查网络连接', 3000)
        return
      }
      const parsed = parseQuestions(result.markdown)
      if (parsed.questions.length === 0) {
        App.toast('解析题目失败', 2000)
        return
      }
      const cached = {
        title: result.title || record.title,
        grade: result.grade || record.grade || '',
        audioUrl: result.audioUrl || '',
        questions: parsed.questions,
        groups: parsed.groups,
        sections: parsed.sections
      }
      window.api.storageSave('set_' + record.setId, cached).catch(() => {})
      setAndGo(cached, record)
    })
  })

  // 设置 App.currentSet 并跳转到准备页
  function setAndGo(cached, record) {
    App.currentSet = {
      setId: record.setId,
      sourceUrl: record.sourceUrl,
      title: cached.title,
      grade: cached.grade || '',
      audioUrl: cached.audioUrl || '',
      questionData: {
        questions: cached.questions,
        sections: cached.sections || [],
        groups: cached.groups || []
      },
      answerPageUrl: record.answerPageUrl || '',
      standardAnswers: null,
      answers: null
    }
    App.navigate('ready')
  }
}

// 自动批改入口：优先使用本地缓存答案，其次尝试已保存密码，最后弹窗让用户输入密码
function handleAutoGrade(record, container) {
  const answerPageUrl = record.answerPageUrl || (App.currentSet && App.currentSet.answerPageUrl)

  // 第一优先级：检查本地是否有第一次批改时缓存的答案（answers_{setId}.json）
  window.api.storageLoad('answers_' + record.setId).then(cached => {
    if (cached && cached.answers && cached.answers.length > 0) {
      // 用缓存的答案直接批改，无需联网请求答案页面
      applyCachedAnswers(record, cached)
      doGradeWithBtnNoFetch(record)
      return
    }
    // 第二优先级：尝试已保存的密码（前一次输入时存在 __passwords__.json 中）
    window.api.storageLoad('__passwords__').then(saved => {
      const savedPwd = saved && answerPageUrl ? saved[answerPageUrl] : null
      if (savedPwd) {
        doGradeWithBtn(record, savedPwd)
        return
      }
      // 第三优先级：弹密码输入窗口
      window._showPasswordDialog().then(password => {
        if (!password) return
        doGradeWithBtn(record, password)
      })
    }).catch(() => {
      window._showPasswordDialog().then(password => {
        if (!password) return
        doGradeWithBtn(record, password)
      })
    })
  }).catch(() => {
    window.api.storageLoad('__passwords__').then(saved => {
      const savedPwd = saved && answerPageUrl ? saved[answerPageUrl] : null
      if (savedPwd) {
        doGradeWithBtn(record, savedPwd)
        return
      }
      window._showPasswordDialog().then(password => {
        if (!password) return
        doGradeWithBtn(record, password)
      })
    }).catch(() => {
      window._showPasswordDialog().then(password => {
        if (!password) return
        doGradeWithBtn(record, password)
      })
    })
  })

  // 用本地缓存的答案直接批改（不触发网络请求）
  function applyCachedAnswers(record, cached) {
    let correctCount = 0
    for (const a of record.answers) {
      const sa = cached.answers.find(s => s.no === a.no)
      if (sa) {
        a.correctAnswer = sa.answer
        a.isCorrect = a.userAnswer === sa.answer
        if (a.isCorrect) correctCount++
      }
    }
    record.correctCount = correctCount
    record.wrongCount = record.totalQuestions - correctCount
    record.accuracy = Math.round((correctCount / record.totalQuestions) * 100)
    record.standardAnswers = cached.answers
    record.allGradeAnswers = cached.allGradeAnswers
    record.scriptText = cached.scriptText || ''
    record.scriptImages = cached.scriptImages || []
    if (cached.grade) record.grade = cached.grade

    window.api.storageSave(record.practiceId, record).catch(() => {})
  }

  function doGradeWithBtnNoFetch(record) {
    const btn = document.getElementById('btn-grade')
    if (btn) { btn.disabled = true; btn.textContent = '批改中...' }
    savePracticeRecord(record)
    renderResult(record).then(() => {
      App.toast('批改完成！', 2000)
    }).catch(err => {
      App.toast('批改失败: ' + (err.message || '未知错误'), 3000)
      if (btn) { btn.disabled = false; btn.textContent = '🔍 自动批改' }
    })
  }

  function doGradeWithBtn(record, password) {
    const btn = document.getElementById('btn-grade')
    if (btn) { btn.disabled = true; btn.textContent = '批改中...' }
    doGrade(record, password).then(() => {
      return renderResult(record)
    }).then(() => {
      App.toast('批改完成！', 2000)
    }).catch(err => {
      App.toast('批改失败: ' + (err.message || '未知错误'), 3000)
      if (btn) { btn.disabled = false; btn.textContent = '🔍 自动批改' }
    })
  }
}

// 手动录入确认：从输入框收集 A/B/C 答案，调用 doManualGrade 批改
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
  renderResult(record).then(() => {
    App.toast('批改完成！', 2000)
  })
}

// 渲染结果页面：显示得分、答案详情、练习趋势、录音原文等
async function renderResult(record) {
  const container = document.getElementById('page-result')
  await initManualAnswers(record.setId)
  const hasGrade = record.accuracy != null
  const hasAnswerUrl = record.answerPageUrl || (App.currentSet && App.currentSet.answerPageUrl)
  const practiceRecords = await getPracticeRecords(record.setId)
  const practiceCount = practiceRecords.length

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
      ${practiceCount > 1 ? `
        <div class="mt-8" style="font-size:13px;color:var(--accent);">
          第 ${record.practiceNumber || 1} 次练习 · 共 ${practiceCount} 次
          ${getProgressText(practiceRecords, record.accuracy)}
        </div>
      ` : ''}
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
            ${showCorrect ? `
              <div style="display:flex;gap:12px;margin-top:4px;font-size:13px;">
                <span class="text-secondary">${userText}</span>
                ${correctText}
              </div>
              <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">
                ${a.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx)
                  const isUserChoice = a.userAnswer === letter
                  const isCorrect = a.correctAnswer === letter
                  let bg = ''
                  if (isCorrect) bg = 'var(--success-bg)'
                  else if (isUserChoice && !isCorrect) bg = 'var(--error-bg)'
                  return `<span style="padding:2px 8px;border-radius:4px;font-size:12px;background:${bg};border:1px solid ${isCorrect ? 'var(--success)' : isUserChoice ? 'var(--error)' : 'var(--border-light)'};">${letter}. ${escHtml(opt)}</span>`
                }).join('')}
              </div>
            ` : `
              <div class="text-secondary" style="font-size:13px;margin-top:4px;">${userText}</div>
            `}
          </div>
        </div>
      </div>`
  }).join('')

  const historySection = practiceCount > 1 ? renderPracticeHistorySection(practiceRecords, record.practiceId) : ''

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
      <div style="display:flex;gap:6px;">
        ${practiceCount > 0 ? '<button class="btn btn-secondary btn-small" id="btn-view-history">📊 成绩趋势</button>' : ''}
        ${practiceCount > 0 ? '<button class="btn btn-secondary btn-small" id="btn-export-csv">📥 导出CSV</button>' : ''}
        <button class="btn btn-secondary btn-small" id="result-retry">🔄 再练一次</button>
      </div>
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
        ${historySection}
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

        <div id="practice-history-dialog" class="dialog-overlay hidden">
          <div class="dialog-box" style="width:600px;max-height:80vh;overflow-y:auto;">
            <div class="dialog-title">📊 练习成绩趋势</div>
            <div id="practice-history-content" style="margin-top:12px;"></div>
            <div class="dialog-actions">
              <button class="btn btn-secondary" id="history-dialog-close">关闭</button>
              <button class="btn btn-primary" id="btn-export-csv-dialog">📥 导出 CSV</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  const historyDialogClose = document.getElementById('history-dialog-close')
  if (historyDialogClose) {
    historyDialogClose.addEventListener('click', () => {
      document.getElementById('practice-history-dialog').classList.add('hidden')
    })
  }

  const exportCsvDialog = document.getElementById('btn-export-csv-dialog')
  if (exportCsvDialog) {
    exportCsvDialog.addEventListener('click', () => {
      exportToCsv(record.setId, record.title)
    })
  }
}

function getProgressText(records, currentAccuracy) {
  if (records.length < 2) return ''
  const gradedRecords = records.filter(r => r.accuracy != null)
  if (gradedRecords.length < 2) return ''
  const sorted = [...gradedRecords].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const firstAcc = sorted[0].accuracy
  const lastAcc = sorted[sorted.length - 1].accuracy
  const diff = lastAcc - firstAcc
  if (diff > 0) return `↑ 提升 ${diff}%`
  if (diff < 0) return `↓ 下降 ${Math.abs(diff)}%`
  return '持平'
}

function renderPracticeHistorySection(records, currentPracticeId) {
  const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const gradedRecords = sorted.filter(r => r.accuracy != null)

  if (gradedRecords.length < 2) return ''

  const maxAccuracy = Math.max(...gradedRecords.map(r => r.accuracy))

  return `
    <div class="card mt-16">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">📈 练习记录 (${gradedRecords.length} 次)</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${gradedRecords.map((r, idx) => {
          const isCurrent = r.practiceId === currentPracticeId
          const barWidth = maxAccuracy > 0 ? (r.accuracy / maxAccuracy * 100) : 0
          const prevAcc = idx > 0 ? gradedRecords[idx - 1].accuracy : null
          const diff = prevAcc != null ? r.accuracy - prevAcc : null
          return `
            <div style="flex:1;min-width:120px;padding:10px;border-radius:8px;border:2px solid ${isCurrent ? 'var(--accent)' : 'var(--border-light)'};background:${isCurrent ? 'var(--accent-light)' : 'transparent'};">
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">第${r.practiceNumber}次</div>
              <div style="font-size:20px;font-weight:700;color:${r.accuracy >= 60 ? 'var(--success)' : 'var(--error)'};">${r.accuracy}%</div>
              <div style="height:4px;background:var(--border-light);border-radius:2px;margin:6px 0;overflow:hidden;">
                <div style="height:100%;width:${barWidth}%;background:${r.accuracy >= 60 ? 'var(--success)' : 'var(--error)'};border-radius:2px;"></div>
              </div>
              <div style="font-size:11px;color:var(--text-muted);">
                ${new Date(r.timestamp).toLocaleDateString('zh-CN')}
                ${diff != null ? (diff > 0 ? `<span style="color:var(--success);">+${diff}%</span>` : diff < 0 ? `<span style="color:var(--error);">${diff}%</span>` : '') : ''}
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>`
}

// 显示成绩趋势弹窗：从 summary_{setId}.json 读取所有练习记录并绘制表格
async function showPracticeHistory(setId, title) {
  const records = await getPracticeRecords(setId)
  const dialog = document.getElementById('practice-history-dialog')
  const content = document.getElementById('practice-history-content')

  if (!dialog || !content) return

  const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const gradedRecords = sorted.filter(r => r.accuracy != null)

  content.innerHTML = `
    <h4 style="font-size:14px;margin-bottom:12px;">${escHtml(title)}</h4>
    ${gradedRecords.length === 0 ? '<p style="color:var(--text-secondary);text-align:center;padding:20px;">暂无已批改的练习记录</p>' : `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:2px solid var(--border);">
            <th style="padding:8px;text-align:left;">次数</th>
            <th style="padding:8px;text-align:left;">日期</th>
            <th style="padding:8px;text-align:center;">正确率</th>
            <th style="padding:8px;text-align:center;">正确/总数</th>
            <th style="padding:8px;text-align:right;">用时</th>
          </tr>
        </thead>
        <tbody id="practice-history-body">
          ${gradedRecords.map((r, idx) => `
            <tr data-practice-id="${r.practiceId}" style="border-bottom:1px solid var(--border-light);cursor:pointer;transition:background 0.15s;"
              onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
              <td style="padding:8px;">第 ${r.practiceNumber} 次</td>
              <td style="padding:8px;color:var(--text-secondary);">${new Date(r.timestamp).toLocaleString('zh-CN')}</td>
              <td style="padding:8px;text-align:center;font-weight:600;color:${r.accuracy >= 60 ? 'var(--success)' : 'var(--error)'};">${r.accuracy}%</td>
              <td style="padding:8px;text-align:center;">${r.correctCount}/${r.totalQuestions}</td>
              <td style="padding:8px;text-align:right;color:var(--text-secondary);">${formatDuration(r.timeSpent)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${gradedRecords.length > 1 ? `
        <div style="margin-top:16px;padding:12px;background:var(--accent-light);border-radius:8px;">
          <div style="font-size:13px;font-weight:500;margin-bottom:8px;">统计摘要</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;">
            <div><span style="color:var(--text-secondary);">最高:</span> <strong>${Math.max(...gradedRecords.map(r=>r.accuracy))}%</strong></div>
            <div><span style="color:var(--text-secondary);">最低:</span> <strong>${Math.min(...gradedRecords.map(r=>r.accuracy))}%</strong></div>
            <div><span style="color:var(--text-secondary);">平均:</span> <strong>${Math.round(gradedRecords.reduce((sum,r)=>sum+r.accuracy,0)/gradedRecords.length)}%</strong></div>
          </div>
        </div>
      ` : ''}
    `}
  `

  // 表格行点击跳转到对应练习的结果页
  const tbody = document.getElementById('practice-history-body')
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const row = e.target.closest('tr[data-practice-id]')
      if (!row) return
      const practiceId = row.dataset.practiceId
      const fullRecord = await window.api.storageLoad(practiceId)
      if (fullRecord) {
        dialog.classList.add('hidden')
        App.navigate('result', { record: fullRecord })
      }
    })
  }

  dialog.classList.remove('hidden')
}

// CSV 导出：从 summary_{setId}.json 读取练习记录，导出为 UTF-8 BOM CSV 文件
async function exportToCsv(setId, title) {
  try {
    const records = await getPracticeRecords(setId)
    if (records.length === 0) {
      App.toast('没有可导出的练习记录', 2000)
      return
    }

    const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    const BOM = '\uFEFF'
    const headers = ['序号', '题目名称', '练习日期', '正确率(%)', '正确数', '总题数', '用时(秒)', '延迟(s)', '跳过(s)']
    const rows = sorted.map((r, idx) => [
      idx + 1,
      `"${title.replace(/"/g, '""')}"`,
      new Date(r.timestamp).toLocaleString('zh-CN'),
      r.accuracy ?? '',
      r.correctCount ?? '',
      r.totalQuestions ?? '',
      r.timeSpent ?? '',
      '', ''
    ])

    const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/[^\w\u4e00-\u9fa5]/g, '_')}_练习记录.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    App.toast(`已导出 ${sorted.length} 条练习记录`, 2000)

    const dialog = document.getElementById('practice-history-dialog')
    if (dialog && !dialog.classList.contains('hidden')) {
      dialog.classList.add('hidden')
    }
  } catch (err) {
    console.error('CSV 导出失败:', err)
    App.toast('导出失败: ' + err.message, 3000)
  }
}

// 自动批改：通过答案页面 URL 获取标准答案，逐题比对，计算正确率
// 批改完成后保存完整记录、更新摘要、缓存答案和密码
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
    await window.api.storageSave(record.practiceId, record)
  } catch {}

  try {
    const records = await getPracticeRecordsFromFile(record.setId)
    const idx = records.findIndex(r => r.practiceId === record.practiceId)
    const summary = {
      practiceId: record.practiceId, title: record.title,
      timestamp: record.timestamp,
      accuracy: record.accuracy, correctCount: record.correctCount,
      totalQuestions: record.totalQuestions, timeSpent: record.timeSpent,
      practiceNumber: record.practiceNumber
    }
    if (idx >= 0) records[idx] = summary
    else records.push(summary)
    await window.api.storageSave('summary_' + record.setId, records)
  } catch {}

  try {
    await window.api.storageSave('answers_' + record.setId, {
      answers: record.standardAnswers,
      allGradeAnswers: record.allGradeAnswers,
      scriptText: record.scriptText,
      scriptImages: record.scriptImages,
      grade: grade,
      gradedAt: new Date().toISOString()
    })
  } catch {}

  try {
    const existing = await window.api.storageLoad('__passwords__') || {}
    existing[record.answerPageUrl] = password
    window.api.storageSave('__passwords__', existing).catch(() => {})
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

// 手动录入答案批改：用户手动为每道题输入 A/B/C，比对后计算正确率
// 保存完整记录、更新摘要、缓存答案
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

  window.api.storageSave(record.practiceId, record).catch(() => {})

  getPracticeRecordsFromFile(record.setId).then(records => {
    const idx = records.findIndex(r => r.practiceId === record.practiceId)
    const summary = {
      practiceId: record.practiceId, title: record.title,
      timestamp: record.timestamp,
      accuracy: record.accuracy, correctCount: record.correctCount,
      totalQuestions: record.totalQuestions, timeSpent: record.timeSpent,
      practiceNumber: record.practiceNumber
    }
    if (idx >= 0) records[idx] = summary
    else records.push(summary)
    window.api.storageSave('summary_' + record.setId, records).catch(() => {})
  }).catch(() => {})

  window.api.storageSave('answers_' + record.setId, {
    answers: standardAnswers,
    grade: '',
    gradedAt: new Date().toISOString()
  }).catch(() => {})
}

function loadManualAnswer(setId, no) {
  try {
    return window._manualAnswers && window._manualAnswers[setId] && window._manualAnswers[setId][no] || ''
  } catch { return '' }
}

function saveManualAnswer(setId, no, val) {
  if (!window._manualAnswers) window._manualAnswers = {}
  if (!window._manualAnswers[setId]) window._manualAnswers[setId] = {}
  window._manualAnswers[setId][no] = val
  window.api.storageSave('manual_' + setId, window._manualAnswers[setId]).catch(() => {})
}

async function initManualAnswers(setId) {
  if (!window._manualAnswers) window._manualAnswers = {}
  if (!window._manualAnswers[setId]) {
    try {
      const data = await window.api.storageLoad('manual_' + setId)
      window._manualAnswers[setId] = data || {}
    } catch {
      window._manualAnswers[setId] = {}
    }
  }
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
