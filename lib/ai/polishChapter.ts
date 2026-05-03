import { callKimi } from './kimiClient'

interface PolishIssue {
  pattern: string
  original: string
  position: number
}

const PATTERNS = [
  { name: '深吸一口气', regex: /深吸一口气|深吸了一口气/g },
  { name: '他知道', regex: /他知道|他明白|他意识到/g },
  { name: '眼神坚定', regex: /眼神坚定|目光坚毅|眼中闪过一丝|眼神变得坚定|眼神中透露出/g },
  { name: '战斗总结', regex: /战斗激烈|经过一番激战|成功击败|战斗异常激烈|战斗即将来临|战斗爆发了|最终被击退|一触即发|愈发激烈/g },
  { name: '决心独白', regex: /他知道他必须|他将|他的心中充满了|心中暗自发誓/g },
  { name: '情绪标签', regex: /心中充满了希望|眼中闪烁着泪光|心中充满了对未来的憧憬|充满希望|团结一心/g },
]

function findIssues(content: string): PolishIssue[] {
  const issues: PolishIssue[] = []
  for (const p of PATTERNS) {
    const matches = content.matchAll(p.regex)
    for (const match of matches) {
      if (match.index !== undefined) {
        // 提取包含该匹配的整句
        const start = content.lastIndexOf('。', match.index) + 1
        const end = content.indexOf('。', match.index)
        const sentence = content.slice(start, end + 1).trim()
        issues.push({
          pattern: p.name,
          original: sentence || match[0],
          position: match.index,
        })
      }
    }
  }
  return issues
}

function buildPolishPrompt(content: string, issues: PolishIssue[]): string {
  const uniqueSentences = [...new Set(issues.map((i) => i.original))].slice(0, 12)

  return `你是小说编辑。以下文本中有 ${issues.length} 处套路句式，需要改写为具体动作和细节。

改写原则：
- "他知道..." → 改成主角看到的具体细节，让读者自己推断
- "深吸一口气" → 改成具体身体反应（手心出汗、喉结滚动、手指发抖等）
- "眼神坚定" → 改成具体动作（握拳、拍桌、转身就走等）
- "战斗激烈" → 改成具体动作链
- "心中充满希望" → 改成具体行为（拿出东西、走向某人、做出决定等）

需要改写的句子：
${uniqueSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

请输出完整润色后的文本。不要改变剧情事实、人物关系和字数规模。只替换套路句式，保留其他内容。\n\n原文：\n${content}`
}

export interface PolishResult {
  content: string
  issuesFound: number
  issuesFixed: number
  model: string
  inputTokens: number
  outputTokens: number
}

/**
 * 反AI味润色器：检测套路句式并改写
 */
export async function polishChapter(content: string): Promise<PolishResult> {
  const issues = findIssues(content)

  if (issues.length === 0) {
    return {
      content,
      issuesFound: 0,
      issuesFixed: 0,
      model: 'none',
      inputTokens: 0,
      outputTokens: 0,
    }
  }

  // 如果套路句式较少（≤2处），直接返回原文（避免过度改写）
  if (issues.length <= 2) {
    return {
      content,
      issuesFound: issues.length,
      issuesFixed: 0,
      model: 'skipped',
      inputTokens: 0,
      outputTokens: 0,
    }
  }

  const prompt = buildPolishPrompt(content, issues)

  const result = await callKimi({
    messages: [
      {
        role: 'system',
        content: '你是小说编辑，专门负责把AI味重的套路句式改写成具体动作和细节。你保持剧情不变，只改写表达方式。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.55,
    maxTokens: 5200,
  })

  const polishedContent = result.content.trim()

  // 验证润色后的内容字数不能比原文少太多
  const originalWords = content.replace(/\s/g, '').length
  const polishedWords = polishedContent.replace(/\s/g, '').length

  if (polishedWords < originalWords * 0.85) {
    console.log(`  润色后字数不足(${polishedWords} < ${originalWords * 0.85})，保留原文`)
    return {
      content,
      issuesFound: issues.length,
      issuesFixed: 0,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    }
  }

  const fixedIssues = findIssues(polishedContent).length

  return {
    content: polishedContent,
    issuesFound: issues.length,
    issuesFixed: issues.length - fixedIssues,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  }
}
