import { describe, expect, it } from 'vitest'
import { buildRewriteSelectionPrompt } from '../rewriteSelection'

describe('rewriteSelection', () => {
  it('构造只改写选中文本的提示词', () => {
    const prompt = buildRewriteSelectionPrompt({
      selectedText: '艾丽卡站在控制台前，能量场再次波动。',
      instruction: '换成更有冲突感的开头',
      storyBible: '星门不能被强行开启。',
      characters: '艾丽卡: 谨慎但果断',
    })

    expect(prompt).toContain('换成更有冲突感的开头')
    expect(prompt).toContain('艾丽卡站在控制台前')
    expect(prompt).toContain('只输出改写后的选中文本')
    expect(prompt).toContain('不要改动未选中的上下文')
  })
})
