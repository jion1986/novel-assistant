# 提取记忆

## 任务

根据用户定稿的章节内容，提取和更新记忆库。

## 输入

### 本章定稿内容
{{finalContent}}

### 现有记忆库
{{existingMemory}}

### 现有角色状态
{{existingCharacters}}

### 现有伏笔状态
{{existingForeshadowings}}

## 输出格式（JSON）

```json
{
  "events": [
    {
      "type": "event",
      "content": "事件描述",
      "importance": "critical | high | normal | low",
      "relatedCharacters": ["相关角色名"]
    }
  ],
  "characterUpdates": [
    {
      "name": "角色名",
      "changes": "状态变化描述"
    }
  ],
  "newCharacters": [
    {
      "name": "新角色名",
      "role": "supporting",
      "description": "角色简介"
    }
  ],
  "newLocations": [
    {
      "type": "location",
      "content": "地点描述",
      "importance": "normal"
    }
  ],
  "newItems": [
    {
      "type": "item",
      "content": "物品描述",
      "importance": "normal"
    }
  ],
  "ruleChanges": [
    {
      "type": "rule",
      "content": "规则变化描述",
      "importance": "high"
    }
  ],
  "foreshadowingUpdates": [
    {
      "name": "伏笔名",
      "status": "planted | developed | resolved",
      "note": "变化说明"
    }
  ],
  "newForeshadowings": [
    {
      "name": "新伏笔名",
      "description": "伏笔描述",
      "resolvePlan": "预计回收方式"
    }
  ],
  "nextChapterNotes": "下一章需要注意的事项，200字以内"
}
```

## 要求

1. 只提取本章**新发生**的事件和变化
2. 不要重复已有的记忆
3. 重要性判断要准确：影响全书走向的为 critical
4. 角色状态变化要具体到可验证的事实
5. 伏笔状态要准确更新
6. 下一章注意事项要实用，帮助下一章保持连续性
