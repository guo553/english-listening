// ===== 页面内容提取工具 =====
// 从 HTML 或 markdown 中提取听力页面所需的各种信息

// 清理文本：移除控制字符，去除首尾空格
function sanitizeText(str) {
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

// 从 HTML 中提取 markdown 内容节点
function extractMarkdown(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const node = doc.querySelector('.markdown-content-source-node')
  if (!node) return ''
  return sanitizeText(node.textContent)
}

// 提取页面中最后一个非头像/logo 的图片 URL（通常是二维码答案页链接）
function extractQrImageUrl(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const images = doc.querySelectorAll('img')
  let lastImg = null
  for (const img of images) {
    const src = img.getAttribute('src') || ''
    if (src.startsWith('http') && !src.includes('avatar') && !src.includes('logo')) {
      lastImg = src
    }
  }
  return lastImg || ''
}

// 从 markdown 中提取音频链接
// 支持格式：音频： [名称](URL) 或 [xxx.mp3](URL)
function extractAudioUrl(markdown) {
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/音频\s*：\s*\[.+?\]\s*\((.+?)\)/)
    if (match) return match[1]
    const match2 = line.match(/音频\s*[:：]\s*\[.+?\]\s*\((.+?)\)/)
    if (match2) return match2[1]
  }
  // 回退：直接找 .mp3 链接
  const linkMatch = markdown.match(/\[([^\]]*\.mp3)\]\(([^)]+)\)/)
  if (linkMatch) return linkMatch[2]
  return ''
}

// 从 markdown 中提取标题（第一个 # 开头的行）
function extractTitle(markdown) {
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)/)
    if (match) return sanitizeText(match[1])
  }
  return ''
}

// 从标题中提取年级信息（新高一/新高二/新高三）
function extractGrade(title) {
  if (!title) return ''
  if (title.includes('新高一')) return '新高一'
  if (title.includes('新高二')) return '新高二'
  if (title.includes('新高三')) return '新高三'
  if (title.includes('高一')) return '新高一'
  if (title.includes('高二')) return '新高二'
  if (title.includes('高三')) return '新高三'
  return ''
}

// ===== 页面解析入口 =====
// 调用 window.api.fetchPage 获取页面内容，提取所需字段
async function parsePageFromUrl(url) {
  const result = await window.api.fetchPage(url)
  if (!result) throw new Error('无法获取页面内容')

  const markdown = result.markdown || ''
  if (!markdown) throw new Error('无法从页面中提取题目内容，请确认链接是否正确')

  const images = result.images || []
  // 取最后一张图片作为二维码答案页
  const qrImageUrl = images.length > 0 ? images[images.length - 1] : ''

  const audioUrl = result.audioUrl || ''
  const title = result.title || ''
  const grade = extractGrade(title)
  return { html: '', markdown, qrImageUrl, audioUrl, title, grade }
}
