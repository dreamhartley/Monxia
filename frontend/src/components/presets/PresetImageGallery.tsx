import { useRef, useState } from 'react'
import { ImagePlus, Info, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface GalleryImage {
  key: string
  url: string
  name?: string
}

interface PresetImageGalleryProps {
  images: GalleryImage[]
  max?: number
  readOnly?: boolean
  busy?: boolean
  onAdd?: (files: File[]) => void
  onRemove?: (key: string) => void
  onPreview?: (image: GalleryImage, index: number) => void
}

export function PresetImageGallery({
  images,
  max = 5,
  readOnly = false,
  busy = false,
  onAdd,
  onRemove,
  onPreview,
}: PresetImageGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const remaining = Math.max(0, max - images.length)

  const handleFiles = (files: FileList | File[]) => {
    if (!onAdd) return
    const selected = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (selected.length === 0) return
    onAdd(selected.slice(0, remaining))
  }

  if (readOnly) {
    if (images.length === 0) {
      return (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          暂无参考图
        </div>
      )
    }

    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {images.map((image, index) => (
          <button
            key={image.key}
            type="button"
            className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted text-left"
            onClick={() => onPreview?.(image, index)}
            title="点击查看大图"
          >
            <img
              src={image.url}
              alt={image.name || `参考图 ${index + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {images.map((image, index) => (
          <div
            key={image.key}
            className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted"
          >
            <button
              type="button"
              className="h-full w-full"
              onClick={() => onPreview?.(image, index)}
              title="点击查看大图"
            >
              <img
                src={image.url}
                alt={image.name || `参考图 ${index + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-1 top-1 h-6 w-6 rounded-full opacity-90"
              onClick={() => onRemove?.(image.key)}
              aria-label="删除参考图"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {images.length < max && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragOver(false)
              handleFiles(event.dataTransfer.files)
            }}
            className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs transition-colors ${
              isDragOver ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:border-primary/50'
            }`}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span>{busy ? '处理中…' : '添加图片'}</span>
            <span className="text-[10px] opacity-70">
              {images.length}/{max}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          if (files && files.length > 0) handleFiles(files)
          event.target.value = ''
        }}
      />

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Info className="h-3 w-3" />
        最多 {max} 张参考图，仅保存在本机，不参与导出
      </p>
    </div>
  )
}
