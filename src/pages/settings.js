window.page_settings = function () {
  const container = document.getElementById('page-settings')
  const settings = loadSettings()

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-small" id="settings-back">← 返回</button>
      <div class="page-title">设置</div>
      <div style="width: 60px;"></div>
    </div>
    <div class="page-scroll">
      <div class="page-content">
        <div class="card">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">考试设置</h3>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 500; margin-bottom: 6px;">
              点击"开始听力"后延迟 <span id="delay-value">${settings.delaySeconds || 0}</span> 秒播放
            </label>
            <input type="range" id="delay-range" min="0" max="30" value="${settings.delaySeconds || 0}"
              style="width: 100%; accent-color: var(--accent);">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
              <span>0 秒</span><span>30 秒</span>
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-weight: 500; margin-bottom: 6px;">
              跳过听力开头 <span id="skip-value">${settings.skipSeconds || 0}</span> 秒
            </label>
            <input type="range" id="skip-range" min="0" max="60" value="${settings.skipSeconds || 0}"
              style="width: 100%; accent-color: var(--accent);">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
              <span>0 秒</span><span>60 秒</span>
            </div>
          </div>
        </div>

        <div class="card mt-16">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">外观</h3>

          <div style="display: flex; gap: 12px;">
            ${['auto', 'light', 'dark'].map(mode => {
              const labels = { auto: '🌓 跟随系统', light: '☀️ 浅色', dark: '🌙 深色' }
              return `
                <label style="flex: 1; text-align: center; padding: 12px; border-radius: var(--radius-sm);
                  border: 2px solid ${settings.theme === mode ? 'var(--accent)' : 'var(--border)'};
                  cursor: pointer; transition: border-color 0.2s;
                  background: ${settings.theme === mode ? 'var(--accent-light)' : 'transparent'};">
                  <input type="radio" name="theme" value="${mode}" ${settings.theme === mode ? 'checked' : ''}
                    style="display: none;">
                  <div>${labels[mode]}</div>
                </label>`
            }).join('')}
          </div>
        </div>

        <div class="text-center text-secondary mt-24" style="font-size: 13px;">
          听力小工具 v0.0.1dev · MIT License
        </div>
      </div>
    </div>
  `

  document.getElementById('settings-back').addEventListener('click', () => {
    const prev = sessionStorage.getItem('prevPage') || 'home'
    App.navigate(prev)
  })

  const delayRange = document.getElementById('delay-range')
  const delayValue = document.getElementById('delay-value')
  const skipRange = document.getElementById('skip-range')
  const skipValue = document.getElementById('skip-value')

  delayRange.addEventListener('input', () => {
    delayValue.textContent = delayRange.value
    saveOneSetting('delaySeconds', parseInt(delayRange.value))
  })

  skipRange.addEventListener('input', () => {
    skipValue.textContent = skipRange.value
    saveOneSetting('skipSeconds', parseInt(skipRange.value))
  })

  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        document.documentElement.setAttribute('data-theme', radio.value)
        localStorage.setItem('theme', radio.value)
        saveOneSetting('theme', radio.value)
        radio.closest('label').style.borderColor = 'var(--accent)'
        radio.closest('label').style.background = 'var(--accent-light)'
        document.querySelectorAll('input[name="theme"]').forEach(r => {
          if (r !== radio) {
            r.closest('label').style.borderColor = 'var(--border)'
            r.closest('label').style.background = 'transparent'
          }
        })
      }
    })
  })
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('settings')) || { delaySeconds: 0, skipSeconds: 0, theme: 'auto' }
  } catch {
    return { delaySeconds: 0, skipSeconds: 0, theme: 'auto' }
  }
}

function saveOneSetting(key, value) {
  const s = loadSettings()
  s[key] = value
  localStorage.setItem('settings', JSON.stringify(s))
}
