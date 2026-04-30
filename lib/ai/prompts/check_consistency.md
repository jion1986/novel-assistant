# 一致性检查

## 任务

检查章节内容是否与已有设定、角色、剧情保持一致。

## 输入

### 待检查内容
{{contentToCheck}}

### 小说圣经
{{storyBible}}

### 角色列表（含锁定设定）
{{characters}}

### 已有记忆库
{{memoryItems}}

### 伏笔状态
{{foreshadowings}}

### 时间线
{{timeline}}

## 输出格式（JSON）

```json
{
  "issues": [
    {
      "severity": "critical | high | medium | low",
      "type": "character_drift | setting_conflict | timeline_error | plot_hole | foreshadowing_error | repetition | ai_tone",
      "description": "问题描述",
      "location": "问题出现的位置（章节/段落）",
      "suggestion": "修改建议"
    }
  ],
  "score": {
    "overall": 85,
    "characterConsistency": 90,
    "settingConsistency": 85,
    "timelineConsistency": 80,
    "plotCoherence": 88,
    "foreshadowingConsistency": 82,
    "readability": 90
  },
  "summary": "整体评估摘要，200字以内"
}
```

## 检查维度

1. **人设漂移**
   - 角色性格是否与初始设定一致
   - 角色行为是否符合其动机
   - 角色说话风格是否保持一致

2. **设定冲突**
   - 世界观规则是否被打破
   - 力量体系是否前后矛盾
   - 禁止改动项是否被修改

3. **时间线错误**
   - 事件发生顺序是否合理
   - 时间跨度是否一致
   - 角色年龄/经历是否匹配

4. **剧情漏洞**
   - 因果关系是否成立
   - 角色行为动机是否充分
   - 关键信息是否有来源

5. **伏笔问题**
   - 已埋伏笔是否被遗忘
   - 伏笔回收是否合理
   - 新伏笔是否与已有伏笔冲突

6. **重复问题**
   - 情节是否重复
   - 描写是否重复
   - 对话是否重复

7. **AI 味检测**
   - 是否有套话、空话
   - 描写是否模式化
   - 情感表达是否真实

## 要求

1. 所有问题必须有具体的位置引用
2. severity 判断标准：
   - critical：破坏核心设定或导致剧情崩坏
   - high：明显的不一致，读者会注意到
   - medium：小问题，可以后续修改
   - low：建议性改进
3. 给出具体的修改建议，不只是指出问题
