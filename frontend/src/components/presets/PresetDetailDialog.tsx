import { useState } from 'react'
import { Copy, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { presetImageUrl, type Preset } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { PresetImageGallery, type GalleryImage } from './PresetImageGallery'
import { ImageLightbox } from './ImageLightbox'

interface PresetDetailDialogProps {
  preset: Preset | null
  onClose: () => void
  onEdit: (preset: Preset) => void
}

export function PresetDetailDialog({ preset, onClose, onEdit }: PresetDetailDialogProps) {
  const { showToast } = useToast()
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null)

  if (!preset) return null

  const images: GalleryImage[] = preset.images.map((image) => ({
    key: `image-${image.id}`,
    url: presetImageUrl(image.filename),
    name: `参考图 ${image.id}`,
  }))

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(preset.text)
      showToast('已复制到剪贴板', 'success')
    } catch {
      showToast('复制失败，请手动选择复制', 'error')
    }
  }

  const closeDetail = () => {
    setPreviewImage(null)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && closeDetail()}>
      <DialogContent
        className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
        onEscapeKeyDown={(event) => {
          if (previewImage) {
            event.preventDefault()
            setPreviewImage(null)
          }
        }}
        onInteractOutside={(event) => {
          // 大图预览是独立 Portal，不能让点击预览遮罩被当成“点击弹窗外部”
          if (previewImage) event.preventDefault()
        }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{preset.name}</span>
            <Badge variant={preset.format === 'noob' ? 'secondary' : 'default'} className="shrink-0">
              {preset.format === 'noob' ? 'NOOB' : 'NAI'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {preset.description && (
            <p className="text-sm text-muted-foreground">{preset.description}</p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">画师串内容</span>
              <span className="text-xs text-muted-foreground">点击内容即可复制</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => void copyContent()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void copyContent()
                }
              }}
              className="group relative max-h-48 cursor-pointer overflow-y-auto rounded-md border bg-muted/40 p-3 pr-10 font-mono text-sm transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              title="点击复制"
            >
              <span className="whitespace-pre-wrap break-all">{preset.text || '（空画师串）'}</span>
              <Copy className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-70 group-hover:opacity-100" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">参考样图</span>
              <span className="text-xs text-muted-foreground">{images.length}/5</span>
            </div>
            <PresetImageGallery
              images={images}
              max={5}
              readOnly
              onPreview={(image) => setPreviewImage(image)}
            />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-6 py-3 sm:justify-between">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            参考图仅保存在本机，不参与导出
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="outline" onClick={closeDetail}>
              关闭
            </Button>
            <Button type="button" onClick={() => onEdit(preset)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              编辑
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {previewImage && (
        <ImageLightbox
          url={previewImage.url}
          alt={previewImage.name}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </Dialog>
  )
}
