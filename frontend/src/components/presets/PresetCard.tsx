import { List } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Preset } from '@/lib/api'

interface PresetCardProps {
  preset: Preset
  onOpen: (preset: Preset) => void
}

/** 轻量画师串卡片：只展示名称 / 格式 / 描述，点击进入详情 */
export function PresetCard({ preset, onOpen }: PresetCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(preset)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(preset)
        }
      }}
      className="group cursor-pointer bg-card/80 backdrop-blur-sm border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <List className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="truncate text-lg">{preset.name}</CardTitle>
          </div>
          <Badge variant={preset.format === 'noob' ? 'secondary' : 'default'} className="shrink-0">
            {preset.format === 'noob' ? 'NOOB' : 'NAI'}
          </Badge>
        </div>
      </CardHeader>
      {preset.description && (
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">{preset.description}</p>
        </CardContent>
      )}
    </Card>
  )
}
