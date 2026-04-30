// 章节状态
export type ChapterStatus =
  | 'unwritten'    // 未写
  | 'ai_draft'     // AI 草稿
  | 'edited'       // 已编辑
  | 'finalized'    // 已定稿

// 角色类型
export type CharacterRole =
  | 'protagonist'    // 主角
  | 'deuteragonist'  // 男/女主
  | 'supporting'     // 配角
  | 'antagonist'     // 反派

// 记忆条目类型
export type MemoryItemType =
  | 'character'
  | 'event'
  | 'location'
  | 'item'
  | 'rule'
  | 'relationship'

// 记忆重要性
export type MemoryImportance =
  | 'critical'
  | 'high'
  | 'normal'
  | 'low'

// 伏笔状态
export type ForeshadowingStatus =
  | 'planted'    // 已埋伏
  | 'developed'  // 已发展
  | 'resolved'   // 已回收

// AI 任务类型
export type GenerationTaskType =
  | 'setting'
  | 'characters'
  | 'outline'
  | 'chapter_plan'
  | 'write'
  | 'rewrite'
  | 'extract_memory'
  | 'check_consistency'

// 版本类型
export type ChapterVersionType =
  | 'ai_draft'
  | 'user_edit'
  | 'final'

// 项目状态
export type BookStatus =
  | 'active'
  | 'archived'
  | 'completed'
