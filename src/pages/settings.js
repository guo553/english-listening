// ===== 设置页 =====
// 考试设置（延迟播放、跳过开头）、显示设置（缩放、字体）、外观（主题切换）、数据管理（清除所有数据）
window.page_settings = async function () {
  const container = document.getElementById('page-settings')
  const settings = await loadSettingsFromFile()

  const zoomLevels = [
    { value: 0.75, label: '75%' },
    { value: 0.875, label: '87.5%' },
    { value: 1, label: '100% (默认)' },
    { value: 1.125, label: '112.5%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' },
    { value: 1.75, label: '175%' },
    { value: 2, label: '200%' }
  ]

  const fontSizes = [12, 13, 14, 15, 16, 17, 18, 19, 20]

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
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">显示设置</h3>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 500; margin-bottom: 10px;">
              界面缩放: <span id="zoom-value">${(settings.zoom || 1) * 100}%</span>
            </label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
              ${zoomLevels.map(z => `
                <button class="zoom-btn ${Math.abs((settings.zoom || 1) - z.value) < 0.01 ? 'active' : ''}"
                  data-zoom="${z.value}" style="padding: 8px; border-radius: 6px; border: 2px solid ${Math.abs((settings.zoom || 1) - z.value) < 0.01 ? 'var(--accent)' : 'var(--border)'}; background: ${Math.abs((settings.zoom || 1) - z.value) < 0.01 ? 'var(--accent-light)' : 'transparent'}; color: var(--text-primary); cursor: pointer; font-size: 13px; transition: all 0.2s;">
                  ${z.label}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom: 8px;">
            <label style="display: block; font-weight: 500; margin-bottom: 10px;">
              字体大小: <span id="font-value">${settings.fontSize || 15}px</span>
            </label>
            <div style="display: flex; gap: 6px; align-items: center;">
              <input type="range" id="font-range" min="12" max="20" value="${settings.fontSize || 15}"
                style="flex: 1; accent-color: var(--accent);">
              <span id="font-display" style="min-width: 40px; text-align: center; font-size: 14px; color: var(--text-secondary);">${settings.fontSize || 15}px</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              <span>小 (12px)</span><span>大 (20px)</span>
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

        <div class="card mt-16">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">数据管理</h3>
          <div style="display: flex; gap: 12px; align-items: center;">
            <button class="btn btn-secondary" id="btn-clear-data" style="color: var(--error);">🗑 清除所有数据</button>
            <span style="font-size: 13px; color: var(--text-secondary);">清除后将重置所有设置和记录</span>
          </div>
        </div>

        <div class="text-center mt-24" style="font-size: 13px; color: var(--text-muted); line-height: 1.8;">
          <div>English Listening Tool v${getAppVersion()}</div>
          <div>作者: 郭皓玮 · MIT 许可</div>
          <div>GitHub: <a href="#" id="about-github" style="color:var(--accent);text-decoration:none;">guo553/english-listening</a></div>
          <div>鸣谢: <a href="#" id="about-electron" style="color:var(--accent);text-decoration:none;">Electron 框架</a></div>
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

  document.querySelectorAll('.zoom-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const zoom = parseFloat(btn.dataset.zoom)
      saveOneSetting('zoom', zoom)
      applyZoom(zoom)
      document.querySelectorAll('.zoom-btn').forEach(b => {
        const isActive = Math.abs(parseFloat(b.dataset.zoom) - zoom) < 0.01
        b.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)'
        b.style.background = isActive ? 'var(--accent-light)' : 'transparent'
      })
      document.getElementById('zoom-value').textContent = Math.round(zoom * 100) + '%'
    })
  })

  const fontRange = document.getElementById('font-range')
  const fontDisplay = document.getElementById('font-display')
  const fontValue = document.getElementById('font-value')

  fontRange.addEventListener('input', () => {
    const size = parseInt(fontRange.value)
    fontDisplay.textContent = size + 'px'
    fontValue.textContent = size + 'px'
    saveOneSetting('fontSize', size)
    applyFontSize(size)
  })

  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        document.documentElement.setAttribute('data-theme', radio.value)
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

  document.getElementById('btn-clear-data').addEventListener('click', async () => {
    if (!confirm('确定清除所有数据吗？这将删除所有设置、练习记录和答案数据，此操作不可撤销。')) return
    try {
      await window.api.clearAllData()
      App.toast('已清除所有数据，即将重新加载...', 2000)
      setTimeout(() => location.reload(), 1000)
    } catch (err) {
      App.toast('清除失败: ' + err.message, 3000)
    }
  })

  document.getElementById('about-github').addEventListener('click', (e) => {
    e.preventDefault()
    window.open('https://github.com/guo553/english-listening', '_blank')
  })

  document.getElementById('about-electron').addEventListener('click', (e) => {
    e.preventDefault()
    window.open('https://www.electronjs.org', '_blank')
  })

}

function getAppVersion() {
  return typeof require !== 'undefined' ? require('../../package.json').version : '0.1.0'
}

async function loadSettingsFromFile() {
  try {
    const data = await window.api.storageLoad('__settings__')
    return data || { delaySeconds: 0, skipSeconds: 0, theme: 'auto', zoom: 1, fontSize: 15 }
  } catch {
    return { delaySeconds: 0, skipSeconds: 0, theme: 'auto', zoom: 1, fontSize: 15 }
  }
}

async function saveOneSetting(key, value) {
  try {
    const s = await loadSettingsFromFile()
    s[key] = value
    await window.api.storageSave('__settings__', s)
  } catch {}
}
