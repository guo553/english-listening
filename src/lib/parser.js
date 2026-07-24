function sanitizeText(str) {
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

function extractMarkdown(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const node = doc.querySelector('.markdown-content-source-node')
  if (!node) return ''
  return sanitizeText(node.textContent)
}

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

function extractAudioUrl(markdown) {
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/音频\s*：\s*\[.+?\]\s*\((.+?)\)/)
    if (match) return match[1]
    const match2 = line.match(/音频\s*[:：]\s*\[.+?\]\s*\((.+?)\)/)
    if (match2) return match2[1]
  }
  const linkMatch = markdown.match(/\[([^\]]*\.mp3)\]\(([^)]+)\)/)
  if (linkMatch) return linkMatch[2]
  return ''
}

function extractTitle(markdown) {
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)/)
    if (match) return sanitizeText(match[1])
  }
  return ''
}

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

async function parsePageFromUrl(url) {
  const result = await window.api.fetchPage(url)
  if (!result) throw new Error('无法获取页面内容')

  const markdown = result.markdown || ''
  if (!markdown) throw new Error('无法从页面中提取题目内容，请确认链接是否正确')

  const images = result.images || []
  const qrImageUrl = images.length > 0
    ? images[images.length - 1]
    : ''

  const audioUrl = result.audioUrl || ''
  const title = result.title || ''
  const grade = extractGrade(title)
  return { html: '', markdown, qrImageUrl, audioUrl, title, grade }
}
