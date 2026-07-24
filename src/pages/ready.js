window.page_ready = function () {
  const set = App.currentSet
  if (!set) {
    App.navigate('home')
    return
  }

  const container = document.getElementById('page-ready')
  const qCount = set.questionData.questions.length
  const settings = loadSettings()

  container.innerHTML = `
    <div class="page-scroll">
      <div class="page-content">
        <div style="padding: 24px 0;">
          <button class="btn btn-secondary btn-small" id="ready-back">← 返回</button>
        </div>

        <div class="card">
          <h2 style="font-size: 22px; font-weight: 700; line-height: 1.4;">${escHtml(set.title)}</h2>

          <div class="mt-24" style="display: flex; gap: 24px; flex-wrap: wrap;">
            <div>
              <div class="text-secondary" style="font-size: 13px;">题目数量</div>
              <div style="font-size: 20px; font-weight: 600;">${qCount} 题</div>
            </div>
            <div>
              <div class="text-secondary" style="font-size: 13px;">播放延迟</div>
              <div style="font-size: 20px; font-weight: 600;">${settings.delaySeconds || 0} 秒</div>
            </div>
            <div>
              <div class="text-secondary" style="font-size: 13px;">跳过开头</div>
              <div style="font-size: 20px; font-weight: 600;">${settings.skipSeconds || 0} 秒</div>
            </div>
          </div>

          <div class="mt-24">
            <button class="btn btn-primary btn-large w-full" id="start-quiz">▶ 开始听力</button>
          </div>

          <div class="mt-16">
            <button class="btn btn-secondary w-full" id="go-settings">⚙ 设置</button>
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('ready-back').addEventListener('click', () => App.navigate('home'))

  document.getElementById('start-quiz').addEventListener('click', () => {
    if (!set.audioUrl) {
      App.toast('未找到音频链接', 2000)
      return
    }
    App.navigate('quiz')
  })

  document.getElementById('go-settings').addEventListener('click', () => {
    App.navigate('settings')
  })
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('settings')) || {}
  } catch {
    return {}
  }
}

function escHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
