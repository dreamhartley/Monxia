import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { presetApi, type Preset } from '@/lib/api'
import { hasDraftContent, usePresetDraft } from '@/lib/presetDraft'
import { usePresetEditor } from '@/contexts/PresetEditorContext'
import { useToast } from '@/contexts/ToastContext'
import { PresetCard } from '@/components/presets/PresetCard'
import { PresetDetailDialog } from '@/components/presets/PresetDetailDialog'

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [detailPreset, setDetailPreset] = useState<Preset | null>(null)
  const draft = usePresetDraft()
  const { openCreate, openEdit, revision } = usePresetEditor()
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await presetApi.getAll()
        if (cancelled) return
        if (res.success && res.data) {
          setPresets(res.data)
        } else {
          showToast(res.error || '加载画师串失败', 'error')
        }
      } catch {
        if (!cancelled) showToast('加载画师串失败', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [revision, showToast])

  const hasDraft = hasDraftContent(draft)

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-card/30 px-4 backdrop-blur-sm md:h-16 md:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground md:text-xl">画师串</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            管理常用的画师组合预设
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{hasDraft ? '继续编辑草稿' : '创建画师串'}</span>
          <span className="sm:hidden">{hasDraft ? '草稿' : '创建'}</span>
          {hasDraft && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[10px] font-semibold">
              {draft?.tags.length ?? 0}
            </span>
          )}
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4 md:p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : presets.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
            <AlertCircle className="mb-4 h-12 w-12" />
            <p className="text-lg font-medium">暂无画师串</p>
            <p className="text-sm">创建画师串来快速复用常用的画师组合</p>
          </div>
        ) : (
          <div className="grid max-w-6xl grid-cols-1 gap-4 pb-24 md:grid-cols-2 lg:grid-cols-3">
            {presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onOpen={setDetailPreset} />
            ))}
          </div>
        )}
      </ScrollArea>

      <PresetDetailDialog
        preset={detailPreset}
        onClose={() => setDetailPreset(null)}
        onEdit={(preset) => {
          setDetailPreset(null)
          openEdit(preset)
        }}
      />
    </div>
  )
}
