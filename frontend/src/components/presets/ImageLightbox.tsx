import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageLightboxProps {
  url: string
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ url, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
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
