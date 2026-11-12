import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageLightboxProps {
  url: string
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ url, alt, onClose }: ImageLightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // 大图是独立 Portal：阻止 pointerdown 冒泡到 document，
  // 否则上层 Dialog 会把它当成“点击弹窗外部”而一起关闭。
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const stopPointerDown = (event: PointerEvent) => event.stopPropagation()
    overlay.addEventListener('pointerdown', stopPointerDown)
    return () => overlay.removeEventListener('pointerdown', stopPointerDown)
  }, [])

  return createPortal(
    <div
      ref={overlayRef}
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="presentation"
    >
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-4 top-4 h-9 w-9 rounded-full"
        onClick={onClose}
        aria-label="关闭大图"
      >
        <X className="h-4 w-4" />
      </Button>
      <img
        src={url}
        alt={alt || '参考图'}
        className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body
  )
}
