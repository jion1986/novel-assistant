'use client'

interface MarkdownToolbarProps {
  onAction: (action: string, placeholder?: string) => void
}

const tools = [
  { label: 'H1', action: 'h1', placeholder: '标题' },
  { label: 'H2', action: 'h2', placeholder: '小标题' },
  { label: 'H3', action: 'h3', placeholder: '小节标题' },
  { label: 'B', action: 'bold', placeholder: '粗体文字' },
  { label: 'I', action: 'italic', placeholder: '斜体文字' },
  { label: '"', action: 'quote', placeholder: '引用内容' },
  { label: '-', action: 'list', placeholder: '列表项' },
  { label: '1.', action: 'orderedList', placeholder: '列表项' },
  { label: '[ ]', action: 'task', placeholder: '待办项' },
  { label: '```', action: 'code', placeholder: '代码' },
  { label: 'link', action: 'link', placeholder: '链接文字' },
  { label: '---', action: 'hr', placeholder: '' },
  { label: 'table', action: 'table', placeholder: '' },
]

export function MarkdownToolbar({ onAction }: MarkdownToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 mb-2 p-1.5 rounded-md bg-muted/50 border">
      {tools.map((tool) => (
        <button
          key={tool.action}
          onClick={() => onAction(tool.action, tool.placeholder)}
          className="px-2 py-1 text-xs font-medium rounded hover:bg-muted transition-colors"
          title={tool.action}
        >
          {tool.label}
        </button>
      ))}
    </div>
  )
}
