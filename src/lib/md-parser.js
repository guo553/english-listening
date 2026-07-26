// 清理文本：移除控制字符，去除首尾空格
function sanitizeText(str) {
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

// 反转义 markdown 转义字符：将 \* \_ \[ 等还原为原字符
function unescapeMarkdown(str) {
  return str.replace(/\\([.\\*_~`#\[\]()])/g, '$1')
}

// 核心解析函数：将提取的 markdown 文本解析为结构化的题目、节、组数据
// markdown 格式示例：
//   **第一节**
//   **听第1段录音，回答第1至第5题**
//   **1. 题目内容**
//   A. 选项A
//   B. 选项B
//   C. 选项C
//   ...
//   **第二节**
//   **听第6段录音，回答第6、7题。**
//   **6. 题目内容** ...
function parseQuestions(markdown) {
  const lines = markdown.split('\n')
  const questions = []
  const sections = []
  const groups = []
  let currentQuestion = null
  let lastGroupIndex = -1

  // 中文数字映射，用于节的索引（第一节=1, 第二节=2, ...）
  const sectionNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

  // 逐行解析 markdown
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    // 匹配节标题：**第X节**
    const sectionMatch = trimmed.match(/^\*\*(第([一二三四五六七八九十]+)节)\*\*$/)
    if (sectionMatch) {
      if (currentQuestion) questions.push(currentQuestion)
      currentQuestion = null
      sections.push({
        name: sectionMatch[1],   // 如 "第一节"
        index: sectionNames.indexOf(sectionMatch[2]) + 1,  // 数字索引 1,2,3...
        questionStart: questions.length + 1  // 该节起始题号
      })
      continue
    }

    // 匹配题目组：**听第X段录音，回答第X（至第X）题**
    // 支持格式：回答第6、7题 / 回答第6至第7题 / 回答第6题
    const groupMatch = trimmed.match(/^\*\*(听第(\d+)段录音.*?(?:回答第\s*(\d+)\s*(?:[、,至]\s*第\s*(\d+))?\s*题)?.*?)\*\*$/)
    if (groupMatch) {
      if (currentQuestion) questions.push(currentQuestion)
      currentQuestion = null

      const groupLabel = groupMatch[1]   // 完整标签文本
      const audioNum = groupMatch[2]     // 录音段落编号
      const startQ = groupMatch[3]       // 起始题号
      const endQ = groupMatch[4]         // 结束题号（可选，单题时为 undefined）

      const groupInfo = {
        label: groupLabel,
        questions: [],
        questionStart: questions.length + 1,  // 该组起始题号
        audioNumber: parseInt(audioNum),
        questionRange: startQ ? { start: parseInt(startQ), end: endQ ? parseInt(endQ) : parseInt(startQ) } : null
      }

      // 生成前端显示的组标签
      if (startQ && endQ && startQ !== endQ) {
        groupInfo.displayLabel = `听下面${audioNum}段录音，回答第 ${startQ} 至第 ${endQ} 题`
      } else if (startQ) {
        groupInfo.displayLabel = `听下面录音，回答第 ${startQ} 题`
      } else {
        groupInfo.displayLabel = groupLabel
      }

      groups.push(groupInfo)
      lastGroupIndex = groups.length - 1
      continue
    }

    // 匹配题目行：**1. 题目内容** 或 **1、题目内容**
    const qMatch = trimmed.match(/^\*\*(\d{1,3})\\?\.\s+(.+?)\*\*$/)
    if (qMatch) {
      if (currentQuestion) questions.push(currentQuestion)
      currentQuestion = {
        no: parseInt(qMatch[1], 10),       // 题号
        text: unescapeMarkdown(sanitizeText(qMatch[2])),  // 题目内容
        options: [],
        userAnswer: null,
        groupId: lastGroupIndex >= 0 ? lastGroupIndex : -1  // 所属组索引
      }
      continue
    }

    // 匹配选项行：A. 选项内容
    const optMatch = trimmed.match(/^([A-C])\.\s+(.+)$/)
    if (optMatch && currentQuestion) {
      currentQuestion.options.push(sanitizeText(unescapeMarkdown(optMatch[2])))
    }
  }

  // 处理最后一个题目
  if (currentQuestion) questions.push(currentQuestion)

  // 计算每节的结束题号
  for (const section of sections) {
    const nextSection = sections.find(s => s.index > section.index)
    section.questionEnd = nextSection ? nextSection.questionStart - 1 : questions.length
  }

  // 将题目分配到对应的组（通过题号范围匹配）
  // 只分配题号 >= 该组 questionStart 的题目，避免前一段无组标签时误分配到后续组
  let groupIdx = 0
  for (const q of questions) {
    while (groupIdx < groups.length - 1 && q.no >= groups[groupIdx + 1].questionStart) {
      groupIdx++
    }
    if (groupIdx < groups.length && q.no >= groups[groupIdx].questionStart) {
      groups[groupIdx].questions.push(q.no)
    }
  }

  return {
    questions: questions,
    sections: sections,
    groups: groups.filter(g => g.questions.length > 0)  // 过滤掉没有题目的空组
  }
}

// 根据题号查找所属组的显示信息
function getGroupDisplayInfo(groups, questionNo) {
  for (const group of groups) {
    if (group.questions.includes(questionNo)) {
      return group
    }
  }
  return null
}
