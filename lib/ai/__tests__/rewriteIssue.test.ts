import { describe, expect, it } from 'vitest'
import { findIssueSegment } from '../rewriteIssue'

describe('rewriteIssue', () => {
  it('按检查结果位置定位需要改写的正文片段', () => {
    const content = [
      '第一段保持不变。角色进入地下实验室，发现门禁系统仍然锁死。',
      '艾丽卡站在控制台前，指尖划过控制面板，屏幕上的数据流像瀑布一样刷新。',
      '第三段继续推进剧情，约翰提醒她不要触碰红色开关。',
    ].join('\n\n')

    const segment = findIssueSegment(content, {
      type: 'repetition',
      location: '艾丽卡 站在 控制台前，指尖划过 控制面板',
    })

    expect(segment.text).toContain('艾丽卡站在控制台前')
    expect(segment.text).toContain('数据流')
    expect(segment.text).not.toContain('第三段继续推进剧情')
  })

  it('重复问题缺少明确位置时默认回到章节开头片段', () => {
    const content = [
      '艾丽卡站在控制台前，能量场再次波动。约翰沉默地看着她。',
      '中段剧情转入新的线索。',
    ].join('\n\n')

    const segment = findIssueSegment(content, {
      type: 'repetition',
      location: '',
    })

    expect(segment.start).toBe(0)
    expect(segment.text).toContain('艾丽卡站在控制台前')
  })
})
