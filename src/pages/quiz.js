window.page_quiz = function () {
  const set = App.currentSet
  if (!set || !set.audioUrl) {
    App.navigate('home')
    return
  }

  const container = document.getElementById('page-quiz')
  const questions = set.questionData.questions
  const groups = set.questionData.groups || []
  const settings = loadQuizSettings()
  let answers = {}
  let audio = null
  let isPlaying = false
  let timerInterval = null
  let startTime = Date.now()
  let userConfirmedSubmit = false

  const totalQuestions = questions.length

  const answeredCount = Object.keys(answers).length

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-small" id="quiz-home" style="font-size:12px;padding:4px 10px;">✕ 退出</button>
      <div class="page-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin:0 8px;">
        ${escHtml(set.title)}
      </div>
      <div style="font-size: 14px; color: var(--text-secondary); white-space: nowrap;">
        已答 ${answeredCount}/${totalQuestions}
      </div>
    </div>

    <div id="quiz-body" style="flex:1; display: flex; overflow: hidden; position: relative;">
      <div id="quiz-index" style="width: 56px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid var(--border-light);
          padding: 12px 0; background: var(--bg-card);">
        ${questions.map(q => {
          const isAnswered = answers[q.no] != null
          return `<div class="quiz-index-item ${isAnswered ? 'answered' : ''}" data-no="${q.no}"
            style="padding: 6px 12px; text-align: center; cursor: pointer; font-size: 14px;
                   color: ${isAnswered ? 'var(--accent)' : 'var(--text-muted)'};
                   font-weight: ${isAnswered ? '600' : '400'};
                   transition: background 0.15s;"
            onmouseover="this.style.background='var(--bg-hover)'"
            onmouseout="this.style.background='transparent'">
            ${q.no}
            <div style="font-size: 8px; margin-top: 1px;">${isAnswered ? '●' : '○'}</div>
          </div>`
        }).join('')}
      </div>

      <div id="quiz-questions" style="flex: 1; overflow-y: auto; padding: 16px 24px 120px;">
        ${renderQuestions(questions, set.questionData.sections, groups, answers)}
      </div>
    </div>

    <div id="quiz-player" style="position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-card);
         border-top: 1px solid var(--border); padding: 10px 24px; z-index: 100;
         box-shadow: 0 -2px 8px rgba(0,0,0,0.06);">
      <div style="max-width: 800px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="btn-rewind" class="btn btn-small btn-secondary" title="快退 5s">⏪</button>
          <button id="btn-play" class="btn btn-small btn-primary" title="播放/暂停" style="width: 40px; height: 36px; font-size: 16px;">▶</button>
          <button id="btn-forward" class="btn btn-small btn-secondary" title="快进 5s">⏩</button>

          <select id="speed-select" style="padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px;
            background: var(--bg-card); color: var(--text-primary); font-size: 13px; cursor: pointer;">
            <option value="0.5">0.5x</option>
            <option value="1" selected>1.0x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
            <option value="3">3.0x</option>
            <option value="5">5.0x</option>
          </select>

          <div id="progress-bar" style="flex: 1; height: 6px; background: var(--border-light); border-radius: 3px;
               cursor: pointer; position: relative; min-width: 80px;">
            <div id="progress-fill" style="height: 100%; width: 0%; background: var(--accent); border-radius: 3px;
                 transition: width 0.1s;"></div>
            <div id="progress-thumb" style="position: absolute; top: -5px; width: 16px; height: 16px;
                 background: var(--accent); border-radius: 50%; left: 0%; margin-left: -8px; display: none;
                 box-shadow: 0 1px 4px rgba(0,0,0,0.2);"></div>
          </div>

          <span id="time-display" style="font-size: 13px; color: var(--text-secondary); white-space: nowrap; min-width: 80px;">
            00:00 / 00:00
          </span>

          <button id="btn-submit" class="btn btn-primary" style="white-space: nowrap; margin-left: 4px;">提交答案</button>
        </div>
      </div>
    </div>
  `

  container.dataset.initialized = '1'

  const quizQuestions = document.getElementById('quiz-questions')
  const quizIndex = document.getElementById('quiz-index')
  const playBtn = document.getElementById('btn-play')
  const rewindBtn = document.getElementById('btn-rewind')
  const forwardBtn = document.getElementById('btn-forward')
  const speedSelect = document.getElementById('speed-select')
  const progressFill = document.getElementById('progress-fill')
  const progressThumb = document.getElementById('progress-thumb')
  const progressBar = document.getElementById('progress-bar')
  const timeDisplay = document.getElementById('time-display')
  const submitBtn = document.getElementById('btn-submit')

  initAudio()
  initProgressBar()
  initKeyboard()

  function initAudio() {
    audio = new Audio(set.audioUrl)
    audio.preload = 'auto'
    audio.playbackRate = 1

    if (settings.skipSeconds > 0) {
      audio.currentTime = settings.skipSeconds
    }

    audio.addEventListener('loadedmetadata', () => {
      updateTimeDisplay()
    })

    audio.addEventListener('timeupdate', () => {
      updateTimeDisplay()
    })

    audio.addEventListener('play', () => {
      isPlaying = true
      playBtn.textContent = '⏸'
    })

    audio.addEventListener('pause', () => {
      isPlaying = false
      playBtn.textContent = '▶'
    })

    audio.addEventListener('ended', () => {
      isPlaying = false
      playBtn.textContent = '▶'
    })

    if (settings.delaySeconds > 0) {
      playBtn.textContent = '⏳'
      playBtn.disabled = true
      let countdown = settings.delaySeconds
      const countdownInterval = setInterval(() => {
        countdown--
        playBtn.textContent = countdown > 0 ? countdown + 's' : '▶'
        if (countdown <= 0) {
          clearInterval(countdownInterval)
          playBtn.disabled = false
          audio.play()
        }
      }, 1000)
    }
  }

  function initProgressBar() {
    progressBar.addEventListener('mousedown', (e) => {
      e.preventDefault()
      if (!audio || !audio.duration) return
      progressThumb.style.display = 'block'
      updateProgressFromEvent(e)

      const onMove = (ev) => { updateProgressFromEvent(ev) }
      const onUp = (ev) => {
        updateProgressFromEvent(ev)
        progressThumb.style.display = 'none'
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  function updateProgressFromEvent(e) {
    const rect = progressBar.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const pct = x / rect.width
    audio.currentTime = pct * audio.duration
    progressFill.style.width = (pct * 100) + '%'
    progressThumb.style.left = (pct * 100) + '%'
  }

  function updateTimeDisplay() {
    if (!audio || !audio.duration) return
    const current = audio.currentTime
    const duration = audio.duration
    const pct = duration > 0 ? (current / duration * 100) : 0
    progressFill.style.width = pct + '%'
    progressThumb.style.left = pct + '%'
    timeDisplay.textContent = formatTime(current) + ' / ' + formatTime(duration)
  }

  function formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '00:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
  }

  function initKeyboard() {
    document.addEventListener('keydown', handleKeydown)
  }

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT') return
    if (document.getElementById('password-dialog') && !document.getElementById('password-dialog').classList.contains('hidden')) return

    switch (e.key) {
      case ' ':
        e.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5)
        break
      case '1': selectOption(getCurrentVisibleQuestion(), 0); break
      case '2': selectOption(getCurrentVisibleQuestion(), 1); break
      case '3': selectOption(getCurrentVisibleQuestion(), 2); break
    }
  }

  function getCurrentVisibleQuestion() {
    const qs = quizQuestions.querySelectorAll('.quiz-question')
    let closest = null
    let closestDist = Infinity
    const center = window.innerHeight / 2
    qs.forEach(el => {
      const rect = el.getBoundingClientRect()
      const dist = Math.abs(rect.top + rect.height / 2 - center)
      if (dist < closestDist) {
        closestDist = dist
        closest = parseInt(el.dataset.no)
      }
    })
    return closest
  }

  document.getElementById('quiz-home').addEventListener('click', () => {
    if (confirm('确定退出答题吗？当前答题进度不会被保存。')) {
      if (audio) { audio.pause(); audio.src = ''; audio = null }
      document.removeEventListener('keydown', handleKeydown)
      App.navigate('home')
    }
  })

  playBtn.addEventListener('click', togglePlay)

  function togglePlay() {
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  rewindBtn.addEventListener('click', () => {
    if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5)
  })

  forwardBtn.addEventListener('click', () => {
    if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5)
  })

  speedSelect.addEventListener('change', () => {
    if (audio) audio.playbackRate = parseFloat(speedSelect.value)
  })

  quizIndex.addEventListener('click', (e) => {
    const item = e.target.closest('.quiz-index-item')
    if (!item) return
    const no = item.dataset.no
    const target = quizQuestions.querySelector('.quiz-question[data-no="' + no + '"]')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })

  quizQuestions.addEventListener('change', (e) => {
    if (e.target.type === 'radio') {
      const no = parseInt(e.target.name.replace('q', ''))
      answers[no] = e.target.value
      updateIndexStatus()
      updateAnsweredCount()
    }
  })

  function selectOption(no, optIdx) {
    if (no == null) return
    const radio = quizQuestions.querySelector('input[name="q' + no + '"][value="' + String.fromCharCode(65 + optIdx) + '"]')
    if (radio) radio.checked = true
    answers[no] = String.fromCharCode(65 + optIdx)
    updateIndexStatus()
    updateAnsweredCount()
  }

  function updateIndexStatus() {
    quizIndex.querySelectorAll('.quiz-index-item').forEach(el => {
      const no = parseInt(el.dataset.no)
      const isAnswered = answers[no] != null
      el.style.color = isAnswered ? 'var(--accent)' : 'var(--text-muted)'
      el.style.fontWeight = isAnswered ? '600' : '400'
      const dot = el.querySelector('div:last-child')
      if (dot) dot.textContent = isAnswered ? '●' : '○'
    })
  }

  function updateAnsweredCount() {
    const count = Object.keys(answers).length
    document.querySelector('.page-header div:last-child').textContent = '已答 ' + count + '/' + totalQuestions
  }

  submitBtn.addEventListener('click', () => {
    if (userConfirmedSubmit) {
      doSubmit()
      return
    }
    const answered = Object.keys(answers).length
    const unanswered = totalQuestions - answered

    if (unanswered > 0) {
      if (!confirm('还有 ' + unanswered + ' 道题未作答，确定提交吗？')) return
    } else {
      if (!confirm('确定提交所有答案吗？提交后不可修改。')) return
    }

    userConfirmedSubmit = true
    submitBtn.textContent = '确认提交'
    submitBtn.style.background = 'var(--error)'

    setTimeout(() => {
      userConfirmedSubmit = false
      submitBtn.textContent = '提交答案'
      submitBtn.style.background = ''
    }, 3000)
  })

  function doSubmit() {
    if (audio) audio.pause()
    if (timerInterval) clearInterval(timerInterval)
    document.removeEventListener('keydown', handleKeydown)

    const resultAnswers = questions.map(q => ({
      no: q.no,
      text: q.text,
      options: q.options,
      userAnswer: answers[q.no] || null
    }))

    set.answers = resultAnswers
    const timeSpent = Math.round((Date.now() - startTime) / 1000)

    App.currentSet.answers = resultAnswers
    App.currentSet.timeSpent = timeSpent
    App.currentSet.settingDelay = settings.delaySeconds
    App.currentSet.settingSkip = settings.skipSeconds

    if (audio) {
      audio.pause()
      audio.src = ''
      audio = null
    }

    App.navigate('result', { fromQuiz: true })
  }
}

function renderQuestions(questions, sections, groups, answers) {
  let html = ''
  let currentSectionIdx = 0
  let lastGroupLabel = null

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]

    const nextSection = sections[currentSectionIdx + 1]
    if (nextSection && q.no >= nextSection.questionStart) {
      currentSectionIdx++
    }

    const section = sections[currentSectionIdx]

    if (i === 0 || (section && questions[i-1] && isNewSection(sections, q.no))) {
      html += `<div class="section-title" style="font-weight: 600; font-size: 16px;
        padding: 20px 0 12px; color: var(--text-primary); border-bottom: 2px solid var(--accent); margin-bottom: 16px;">
        ${section ? escHtml(section.name) : ''}
      </div>`
    }

    const group = groups.find(g => g.questions.includes(q.no))
    if (group) {
      const currentGroupLabel = group.displayLabel || group.label
      if (currentGroupLabel !== lastGroupLabel) {
        html += `<div class="group-title" style="font-weight: 500; font-size: 14px; padding: 12px 0 8px;
          color: var(--accent); background: var(--bg-hover); border-radius: 6px; padding: 10px 14px; margin-bottom: 12px;">
          📢 ${escHtml(currentGroupLabel)}
        </div>`
        lastGroupLabel = currentGroupLabel
      }

      if (i > 0 && questions[i - 1]) {
        const prevGroup = groups.find(g => g.questions.includes(questions[i - 1].no))
        if (!prevGroup || prevGroup.label !== group.label) {
          html += `<div style="height: 8px;"></div>`
        } else if (group.questionRange && q.no > questions[i - 1].no + 1) {
          const gapHtml = generateGapHint(group, questions[i - 1].no, q.no)
          if (gapHtml) {
            html += gapHtml
          }
        }
      }
    }

    const userAns = answers[q.no] || ''
    const opts = ['A', 'B', 'C']

    html += `<div class="quiz-question card" data-no="${q.no}" style="margin-bottom: 12px; padding: 16px 20px;">
      <div style="font-weight: 500; font-size: 15px; margin-bottom: 12px; line-height: 1.6;">
        ${q.no}. ${escHtml(q.text)}
      </div>
      <div class="q-options" style="display: flex; flex-direction: column; gap: 6px;">
        ${opts.map((letter, idx) => {
          const optText = q.options[idx] || ''
          const checked = userAns === letter
          return `
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px 12px;
              border-radius: 6px; cursor: pointer; transition: background 0.15s;
              ${checked ? 'background: var(--accent-light);' : ''}"
              onmouseover="this.style.background='${checked ? 'var(--accent-light)' : 'var(--bg-hover)'}'"
              onmouseout="this.style.background='${checked ? 'var(--accent-light)' : 'transparent'}'">
              <input type="radio" name="q${q.no}" value="${letter}" ${checked ? 'checked' : ''}
                style="accent-color: var(--accent); width: 16px; height: 16px; flex-shrink: 0;">
              <span style="font-size: 14px; line-height: 1.5;">${letter}. ${escHtml(optText)}</span>
            </label>`
        }).join('')}
      </div>
    </div>`
  }

  return html
}

function generateGapHint(group, prevQNo, currentQNo) {
  if (!group || !group.questionRange) return ''

  const { start, end } = group.questionRange

  if (currentQNo <= prevQNo + 1) return ''

  const missingStart = prevQNo + 1
  const missingEnd = currentQNo - 1

  if (missingEnd - missingStart >= 2) {
    return `
      <div style="padding: 8px 14px; margin: 8px 0; background: var(--bg-card);
        border-left: 3px solid var(--accent); border-radius: 4px; font-size: 13px;
        color: var(--text-secondary);">
        ⏭️ 跳至第 ${currentQNo} 题（第 ${missingStart}-${missingEnd} 题为其他小题组）
      </div>`
  }

  return ''
}

function isNewSection(sections, qNo) {
  return sections.some(s => s.questionStart === qNo)
}

function loadQuizSettings() {
  if (window._cachedSettings) return window._cachedSettings
  return { delaySeconds: 0, skipSeconds: 0 }
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
