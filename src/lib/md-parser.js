function sanitizeText(str) {
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

function unescapeMarkdown(str) {
  return str.replace(/\\([.\\*_~`#\[\]()])/g, '$1')
}

function parseQuestions(markdown) {
  const lines = markdown.split('\n')
  const questions = []
  const sections = []
  const groups = []
  let currentQuestion = null
  let lastGroupIndex = -1

  const sectionNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue

    const sectionMatch = trimmed.match(/^\*\*(第([一二三四五六七八九十]+)节)\*\*$/)
    if (sectionMatch) {
      if (currentQuestion) questions.push(currentQuestion)
      currentQuestion = null
      sections.push({
        name: sectionMatch[1],
        index: sectionNames.indexOf(sectionMatch[2]) + 1,
        questionStart: questions.length + 1
      })
      continue
    }

    const groupMatch = trimmed.match(/^\*\*(听第(\d+)段录音.*?(?:回答第\s*(\d+)\s*至?\s*第\s*(\d+)\s*题|回答第\s*(\d+)\s*题)?.*?)\*\*$/)
    if (groupMatch) {
      if (currentQuestion) questions.push(currentQuestion)
      currentQuestion = null

      const groupLabel = groupMatch[1]
      const audioNum = groupMatch[2]
      const startQ = groupMatch[3] || groupMatch[5]
      const endQ = groupMatch[4]

      const groupInfo = {
        label: groupLabel,
        questions: [],
        questionStart: questions.length + 1,
        audioNumber: parseInt(audioNum),
        questionRange: startQ ? { start: parseInt(startQ), end: endQ ? parseInt(endQ) : parseInt(startQ) } : null
      }

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

    const qMatch = trimmed.match(/^\*\*(\d{1,3})\\?\.\s+(.+?)\*\*$/)
    if (qMatch) {
      if (currentQuestion) questions.push(currentQuestion)
      currentQuestion = {
        no: parseInt(qMatch[1], 10),
        text: unescapeMarkdown(sanitizeText(qMatch[2])),
        options: [],
        userAnswer: null,
        groupId: lastGroupIndex >= 0 ? lastGroupIndex : -1
      }
      continue
    }

    const optMatch = trimmed.match(/^([A-C])\.\s+(.+)$/)
    if (optMatch && currentQuestion) {
      currentQuestion.options.push(sanitizeText(unescapeMarkdown(optMatch[2])))
    }
  }

  if (currentQuestion) questions.push(currentQuestion)

  for (const section of sections) {
    const nextSection = sections.find(s => s.index > section.index)
    section.questionEnd = nextSection ? nextSection.questionStart - 1 : questions.length
  }

  let groupIdx = 0
  for (const q of questions) {
    while (groupIdx < groups.length - 1 && q.no >= groups[groupIdx + 1].questionStart) {
      groupIdx++
    }
    if (groupIdx < groups.length) {
      groups[groupIdx].questions.push(q.no)
    }
  }

  return {
    questions: questions,
    sections: sections,
    groups: groups.filter(g => g.questions.length > 0)
  }
}

function getGroupDisplayInfo(groups, questionNo) {
  for (const group of groups) {
    if (group.questions.includes(questionNo)) {
      return group
    }
  }
  return null
}


