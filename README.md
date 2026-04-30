# AI 小说助手

AI 驱动的小说初稿生成工作台。AI 负责生成设定、人设、大纲和章节正文，人负责微调定稿。

## 功能

- **AI 生成工作流**：设定 → 人设 → 大纲 → 章节正文
- **记忆库系统**：定稿后自动提取角色状态、事件、伏笔，确保章节连续性
- **Markdown 编辑器**：编辑/预览/分屏三种模式，支持语法高亮和快捷键
- **多模型路由**：主模型限流时自动切换到备用模型
- **成本追踪**：实时显示每次 AI 调用的 token 消耗和预估费用
- **一致性检查**：AI 自动检查章节内容与设定、人设的一致性
- **导出功能**：支持导出 Markdown 和 TXT 格式

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma 6 + SQLite
- Kimi API (Moonshot) / 多模型兼容

## 启动

```bash
npm install
npx prisma migrate dev
npm run dev
```

访问 http://localhost:3003

## 环境变量

```env
DATABASE_URL="file:./dev.db"
KIMI_API_KEY=your_key_here
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=moonshot-v1-8k

# 可选备用模型
BACKUP_1_API_KEY=
BACKUP_1_BASE_URL=https://api.siliconflow.cn/v1
BACKUP_1_MODEL=deepseek-ai/DeepSeek-V3
```

## 核心流程

1. 创建小说 → 输入核心创意
2. 生成设定 → AI 生成世界观、基调、核心冲突
3. 生成人设 → AI 生成主要角色
4. 生成大纲 → AI 生成章节大纲
5. 写章节 → AI 根据上下文和记忆库生成正文
6. 编辑定稿 → 人在 Markdown 编辑器中修改
7. 提取记忆 → 定稿后 AI 自动提取关键信息到记忆库

## 测试

```bash
# 单元/集成测试
npm run test

# E2E 测试（需先安装 Playwright 浏览器）
npx playwright install chromium
npm run test:e2e

# 类型检查
npm run typecheck
```

## 部署

### Docker Compose（推荐）

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env，填入 KIMI_API_KEY 和 SESSION_SECRET

# 2. 启动
 docker-compose up -d

# 3. 查看日志
 docker-compose logs -f app
```

### 手动部署

```bash
npm install
npm run build
npm start
```

### 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | SQLite 数据库路径，默认 `file:./dev.db` |
| `SESSION_SECRET` | 是 | Session 加密密钥，至少 32 字符 |
| `KIMI_API_KEY` | 是 | Kimi (Moonshot) API Key |
| `KIMI_BASE_URL` | 否 | Kimi API 地址，默认官方地址 |
| `KIMI_MODEL` | 否 | 模型名称，默认 `moonshot-v1-8k` |
| `BACKUP_1/2_API_KEY` | 否 | 备用模型 API Key |
| `MAX_TOKENS_PER_CHAPTER` | 否 | 单章最大生成 token 数 |
| `COST_WARNING_THRESHOLD` | 否 | 成本警告阈值（元） |
