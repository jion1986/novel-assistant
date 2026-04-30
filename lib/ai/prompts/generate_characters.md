# 生成人设

## 任务

根据小说设定，生成主要角色列表。

## 输入

小说设定：{{storyBible}}
核心创意：{{coreIdea}}

## 输出格式（JSON）

```json
{
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist | deuteragonist | supporting | antagonist",
      "age": "年龄描述",
      "identity": "身份/职业",
      "personality": "性格特点，100字以内",
      "goal": "角色目标，50字以内",
      "speakingStyle": "说话习惯/风格，50字以内",
      "lockedFacts": ["不可改动的设定项1", "不可改动的设定项2"]
    }
  ]
}
```

## 要求

1. 主角必须有明确的动机和成长空间
2. 角色之间要有冲突和张力
3. 每个角色要有独特的说话风格
4. 反派要有自己的逻辑和动机，不只是纯粹的恶
5. 配角数量控制在 3-6 个，避免过多
