'use client'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveIndicatorProps {
  status: SaveStatus
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') {
    return (
      <span className="text-xs text-muted-foreground">
        未保存
      </span>
    )
  }

  if (status === 'saving') {
    return (
      <span className="text-xs text-muted-foreground">
        保存中...
      </span>
    )
  }

  if (status === 'saved') {
    return (
      <span className="text-xs text-green-600">
        已保存
      </span>
    )
  }

  return (
    <span className="text-xs text-red-500">
      保存失败
    </span>
  )
}
