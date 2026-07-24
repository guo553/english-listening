const { app, BrowserWindow, ipcMain, net, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')

process.on('uncaughtException', (err) => {
  console.error('[未捕获异常]', err.message)
})
process.on('unhandledRejection', (err) => {
  console.error('[未捕获Promise错误]', err.message || err)
})

app.commandLine.appendSwitch('ozone-platform-hint', 'wayland')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '听力小工具',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const prefix = ['', 'info', 'warn', 'error'][level] || 'log'
    if (prefix === 'error' || prefix === 'warn') {
      console.log(`[渲染进程 ${prefix}] ${message}`)
    }
  })

  mainWindow.webContents.on('unhandled-rejection', (event) => {
    console.log('[渲染进程 未捕获Promise错误]', event.reason ? event.reason.message : '')
  })
}

function getDataDir() {
  const userDataPath = app.getPath('userData')
  const dir = path.join(userDataPath, '听力小工具数据')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

ipcMain.handle('fetch-page', async (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('无效的 URL')
  }

  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })

  let loadError = null
  win.webContents.on('render-process-gone', (_e, details) => {
    loadError = new Error('页面渲染进程: ' + (details.reason || '崩溃'))
  })
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    loadError = new Error(desc || '加载失败(' + code + ')')
  })

  const userAgent = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'

  try {
    await win.loadURL(url, { userAgent })
  } catch (e) {
    win.close()
    throw new Error('页面加载失败: ' + e.message)
  }

  await new Promise(r => setTimeout(r, 2000))

  if (loadError) {
    win.close()
    throw loadError
  }

  const startTime = Date.now()
  let lastBodyLen = 0

  while (Date.now() - startTime < 30000) {
    await new Promise(r => setTimeout(r, 1000))
    try {
      const data = await win.webContents.executeJavaScript(`
        (function() {
          var body = document.body;
          if (!body) return null;
          var text = body.innerText || '';
          var audio = document.querySelector('audio');
          var imgs = [];
          document.querySelectorAll('img').forEach(function(img) {
            var src = img.src || '';
            if (src && src.indexOf('avatar') === -1 && src.indexOf('logo') === -1 && img.width > 100) {
              imgs.push(src);
            }
          });

          // 从 body 文本重构 markdown：给题号加 **
          var lines = text.split('\\n');
          var mdLines = [];
          var inQuestion = false;
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) { if (inQuestion) mdLines.push(''); continue; }
            // 匹配题号: "1. text" 或 "1、text"
            var qm = line.match(/^(\\d{1,3})[.、]\\s+(.+)/);
            if (qm) {
              if (inQuestion) mdLines.push('');
              mdLines.push('**' + qm[1] + '. ' + qm[2] + '**');
              inQuestion = true;
              continue;
            }
            // 匹配选项: "A. text" 或 "A、text"
            var om = line.match(/^([A-C])[.、]\\s+(.+)/);
            if (om && inQuestion) {
              mdLines.push(om[1] + '. ' + om[2]);
              continue;
            }
            // 匹配节的标题
            var sm = line.match(/^第[一二三四五六七八九十]节$/);
            if (sm) {
              if (inQuestion) mdLines.push('');
              mdLines.push('**' + sm[0] + '**');
              inQuestion = false;
              continue;
            }
            // 匹配听第X段录音...
            var gm = line.match(/^听第\\d+段录音.*/);
            if (gm) {
              if (inQuestion) mdLines.push('');
              mdLines.push('**' + gm[0] + '**');
              inQuestion = false;
              continue;
            }
          }

          return {
            htmlLen: (document.documentElement.outerHTML || '').length,
            bodyLen: text.length,
            bodyText: text,
            markdown: mdLines.join('\\n'),
            title: document.title || '',
            audioUrl: audio ? audio.src : '',
            images: imgs
          };
        })()
      `)

      if (!data) { win.close(); throw new Error('页面无内容') }

      if (data.bodyLen > 200 && data.bodyLen === lastBodyLen && data.markdown.length > 50) {
        win.close()
        return {
          html: '', markdown: data.markdown,
          title: data.title, audioUrl: data.audioUrl,
          images: data.images
        }
      }
      lastBodyLen = data.bodyLen
    } catch (e) {
      if (loadError) { win.close(); throw loadError }
    }
  }

  win.close()
  throw new Error('加载页面超时')
})

ipcMain.handle('download-image', async (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('无效的图片 URL')
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    try {
      const request = net.request(url)
      request.setHeader('User-Agent', 'Mozilla/5.0 (compatible; EnglishListeningTool/0.0.1)')
      request.on('response', (response) => {
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const buffer = Buffer.concat(chunks)
          const base64 = buffer.toString('base64')
          const contentType = response.headers['content-type'] || 'image/png'
          resolve(`data:${contentType};base64,${base64}`)
        })
        response.on('error', (err) => reject(err))
      })
      request.on('error', (err) => reject(err))
      request.end()
    } catch (err) {
      reject(err)
    }
  })
})

ipcMain.handle('fetch-answer', async (_event, { answerPageUrl, password, grade }) => {
  if (typeof answerPageUrl !== 'string' || !answerPageUrl.startsWith('http')) {
    throw new Error('无效的答案页面 URL')
  }
  if (typeof password !== 'string') {
    throw new Error('密码格式无效')
  }

  const safePassword = JSON.stringify(password)
  const safeGrade = grade ? JSON.stringify(grade) : '""'

  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })

  let loadError = null
  win.webContents.on('render-process-gone', (_e, details) => {
    loadError = new Error('页面渲染进程: ' + (details.reason || '崩溃'))
  })
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    loadError = new Error(desc || '加载失败(' + code + ')')
  })

  const userAgent = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
  try {
    await win.loadURL(answerPageUrl, { userAgent })
  } catch (e) {
    win.close(); throw new Error('页面加载失败: ' + e.message)
  }
  await new Promise(r => setTimeout(r, 2000))
  if (loadError) { win.close(); throw loadError }

  // 注入密码
  try {
    await win.webContents.executeJavaScript(`
      (function() {
        var pwd = ${safePassword};
        var input = document.querySelector('input.psw-input') || document.querySelector('input[type="password"]');
        if (!input) return;

        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (setter && setter.set) setter.set.call(input, pwd);
        else input.value = pwd;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        var btn = document.querySelector('.comfirm');
        if (btn) btn.click();
      })()
    `)
  } catch {}

  // 轮询等待答案内容
  const startTime = Date.now()
  while (Date.now() - startTime < 30000) {
    await new Promise(r => setTimeout(r, 1000))
    if (loadError) { win.close(); throw loadError }
    try {
      const result = await win.webContents.executeJavaScript(`
        (function() {
          var targetGrade = ${safeGrade};

          function collectGradeImages() {
            var allImgs = [];
            var nodes = document.body ? document.body.querySelectorAll('*') : [];
            var currentGrade = '';
            var gradeImages = [];
            var allImages = [];

            for (var i = 0; i < nodes.length; i++) {
              var el = nodes[i];
              if (el.children.length > 0) continue;
              var txt = (el.textContent || '').trim();
              var gm = txt.match(/^(新?高[一二三])$/);
              if (gm) { currentGrade = gm[1]; continue; }

              if (el.tagName === 'IMG') {
                var src = el.src || '';
                var alt = el.alt || '';
                var w = el.naturalWidth || el.width || 0;
                if (src && w > 100 && alt !== '头像' && src.indexOf('avatar') === -1) {
                  allImages.push(src);
                  if (currentGrade === targetGrade || (targetGrade && currentGrade.indexOf(targetGrade) >= 0)) {
                    gradeImages.push(src);
                  }
                }
              }
            }

            window.scrollTo(0, document.body.scrollHeight);
            return { all: allImages, grade: gradeImages };
          }

          var md = document.querySelector('.markdown-content-source-node');
          if (md && md.textContent.trim().length > 20) {
            var imgs = collectGradeImages();
            return { ok: true, src: 'md', content: md.textContent, images: imgs.all, gradeImages: imgs.grade };
          }
          var text = document.body ? document.body.innerText : '';
          if (text.indexOf('该内容已被制作者加密') === -1 && text.length > 50) {
            var imgs = collectGradeImages();
            return { ok: true, src: 'body', content: text, images: imgs.all, gradeImages: imgs.grade };
          }
          return null;
        })()
      `)
      if (result) { win.close(); return result }
    } catch {}
  }

  win.close()
  throw new Error('获取答案超时')
})

ipcMain.handle('storage-save', async (_event, { key, data }) => {
  const filePath = path.join(getDataDir(), safeFilename(key) + '.json')
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return true
})

ipcMain.handle('storage-load', async (_event, key) => {
  const filePath = path.join(getDataDir(), safeFilename(key) + '.json')
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
})

ipcMain.handle('storage-list', async () => {
  const dir = getDataDir()
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
  const result = []
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
      result.push({
        filename: file,
        title: data.title || file.replace('.json', ''),
        timestamp: data.timestamp || null,
        accuracy: data.accuracy ?? null
      })
    } catch {
      result.push({ filename: file, title: file.replace('.json', ''), timestamp: null, accuracy: null })
    }
  }
  return result.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
})

ipcMain.handle('storage-delete', async (_event, key) => {
  const filePath = path.join(getDataDir(), safeFilename(key) + '.json')
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  return true
})

function createAppMenu() {
  const template = [
    {
      label: '听力小工具',
      submenu: [
        {
          label: '关于听力小工具',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 听力小工具',
              message: '听力小工具',
              detail: [
                '作者: 郭皓玮',
                '邮箱: guohaowei63@gmail.com',
                '',
                '协议: MIT 开源许可',
                'GitHub: https://github.com/guo553/english-listening',
                '',
                '鸣谢: Electron 框架',
                'https://www.electronjs.org',
                '',
                '本软件基于 MIT 协议开源，',
                '可自由使用、修改和分发。'
              ].join('\n'),
              buttons: ['查看许可', '访问 GitHub', 'Electron 官网', '确定'],
              defaultId: 3,
              cancelId: 3
            }).then(({ response }) => {
              if (response === 0) {
                shell.openPath(path.join(__dirname, 'LICENSE'))
              } else if (response === 1) {
                shell.openExternal('https://github.com/guo553/english-listening')
              } else if (response === 2) {
                shell.openExternal('https://www.electronjs.org')
              }
            })
          }
        },
        { type: 'separator' },
        { label: '退出', role: 'quit', accelerator: 'CmdOrCtrl+Q' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: '重做', role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: '复制', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { label: '全选', role: 'selectAll', accelerator: 'CmdOrCtrl+A' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { label: '关闭', role: 'close' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '开发者工具', role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { label: '重新加载', role: 'reload', accelerator: 'CmdOrCtrl+R' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createAppMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
