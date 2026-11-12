import { useMemo, useState } from 'react'
import { ArrowLeftRight, Copy, RotateCcw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  formatArtistString,
  parseArtistString,
  type ArtistFormat,
  type DetectedFormat,
} from '@/lib/artistString'
import { useToast } from '@/contexts/ToastContext'

const EXAMPLE = '1.2::artist:foo, artist:bar::, (artist:baz:1.1)'

function detectionLabel(detected: DetectedFormat): string {
  if (detected === 'noob') return 'NOOB'
  if (detected === 'nai') return 'NAI'
  if (detected === 'mixed') return '混合格式'
  return '未识别'
}

export function ArtistFormatConverter() {
  const { showToast } = useToast()
  const [source, setSource] = useState('')
  const [targetOverride, setTargetOverride] = useState<ArtistFormat | null>(null)

  const parsed = useMemo(() => parseArtistString(source), [source])
  const suggestedTarget: ArtistFormat =
    parsed.detected === 'noob' ? 'nai' : parsed.detected === 'nai' ? 'noob' : 'noob'
  const target = targetOverride ?? suggestedTarget
  const output = useMemo(
    () => formatArtistString(parsed.tags, target),
    [parsed.tags, target]
  )

  const copyOutput = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      showToast('已复制转换结果', 'success')
    } catch {
      showToast('复制失败，请手动选择复制', 'error')
    }
  }

  const swap = () => {
    if (!output) return
    setSource(output)
    setTargetOverride(target === 'noob' ? 'nai' : 'noob')
  }

  const clearAll = () => {
    setSource('')
    setTargetOverride(null)
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">画师串格式转换</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              在 NOOB 与 NAI 格式之间转换画师串，自动识别并保留权重
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="format-source">源文本</Label>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>识别</span>
                <Badge variant={parsed.detected === 'mixed' ? 'destructive' : 'secondary'}>
                  {detectionLabel(parsed.detected)}
                </Badge>
              </div>
            </div>
            <Textarea
              id="format-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="粘贴 NOOB 或 NAI 画师串…"
              className="min-h-[180px] font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{parsed.tags.length} 位画师</span>
              <span>·</span>
              <span>{parsed.tags.filter((tag) => tag.weight !== 1).length} 个带权重</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>目标格式</Label>
              <div className="inline-flex rounded-md border p-0.5">
                {(['noob', 'nai'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTargetOverride(item)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                      target === item
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {item === 'noob' ? 'NOOB' : 'NAI'}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Textarea
                value={output}
                readOnly
                placeholder="转换结果会显示在这里"
                className="min-h-[180px] bg-muted/30 pr-10 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7"
                onClick={() => void copyOutput()}
                disabled={!output}
                aria-label="复制转换结果"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={swap} disabled={!output}>
                <ArrowLeftRight className="mr-1.5 h-4 w-4" />
                交换
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSource(EXAMPLE)}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                载入示例
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={!source}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                清空
              </Button>
            </div>
          </div>
        </div>

        {parsed.warnings.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-500">{parsed.warnings[0]}</p>
        )}

        {parsed.detected === 'plain' && source.trim() !== '' && (
          <p className="text-xs text-muted-foreground">
            未检测到明显的格式特征，已按纯名称处理；输出会按目标格式补全。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
