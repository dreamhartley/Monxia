import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, TouchEvent as ReactTouchEvent } from 'react'
import type { ArtistTag } from '@/lib/artistString'

interface TagChipEditorProps {
  tags: ArtistTag[]
  onChange: (tags: ArtistTag[]) => void
  selectedIndex: number | null
  onSelect: (index: number | null) => void
}

interface DragGhost {
  x: number
  y: number
  name: string
  weight: number
}

const EMPTY_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export function TagChipEditor({ tags, onChange, selectedIndex, onSelect }: TagChipEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStateRef = useRef<{
    index: number
    startX: number
    startY: number
    isDragging: boolean
  } | null>(null)

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null)

  const moveTag = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= tags.length || to >= tags.length) return
      const next = [...tags]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      onChange(next)

      if (selectedIndex === from) {
        onSelect(to)
      } else if (selectedIndex !== null) {
        if (from < selectedIndex && to >= selectedIndex) onSelect(selectedIndex - 1)
        else if (from > selectedIndex && to <= selectedIndex) onSelect(selectedIndex + 1)
      }
    },
    [tags, selectedIndex, onChange, onSelect]
  )

  const removeTag = useCallback(
    (index: number) => {
      const next = tags.filter((_, i) => i !== index)
      onChange(next)
      if (selectedIndex === index) onSelect(null)
      else if (selectedIndex !== null && selectedIndex > index) onSelect(selectedIndex - 1)
    },
    [tags, selectedIndex, onChange, onSelect]
  )

  const handleClick = (index: number) => {
    onSelect(selectedIndex === index ? null : index)
  }

  const handleDragStart = (event: ReactDragEvent, index: number) => {
    setDraggedIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    const empty = new Image()
    empty.src = EMPTY_IMAGE
    event.dataTransfer.setDragImage(empty, 0, 0)
    const tag = tags[index]
    if (tag) setDragGhost({ x: event.clientX, y: event.clientY, name: tag.name, weight: tag.weight })
  }

  const handleDrag = (event: ReactDragEvent) => {
    if (event.clientX === 0 && event.clientY === 0) return
    setDragGhost((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : null))
  }

  const handleDragOver = (event: ReactDragEvent, index: number) => {
    event.preventDefault()
    if (draggedIndex !== null) setDragOverIndex(index)
  }

  const handleDrop = (event: ReactDragEvent, index: number) => {
    event.preventDefault()
    if (draggedIndex !== null) moveTag(draggedIndex, index)
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDragGhost(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDragGhost(null)
  }

  const handleTouchStart = (event: ReactTouchEvent, index: number) => {
    const touch = event.touches[0]
    touchStateRef.current = {
      index,
      startX: touch.clientX,
      startY: touch.clientY,
      isDragging: false,
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchMove = (event: TouchEvent) => {
      const state = touchStateRef.current
      if (!state) return
      const touch = event.touches[0]
      const deltaX = Math.abs(touch.clientX - state.startX)
      const deltaY = Math.abs(touch.clientY - state.startY)

      if (!state.isDragging && (deltaX > 10 || deltaY > 10)) {
        state.isDragging = true
        setDraggedIndex(state.index)
        const tag = tags[state.index]
        if (tag) {
          setDragGhost({
            x: touch.clientX,
            y: touch.clientY,
            name: tag.name,
            weight: tag.weight,
          })
        }
      }

      if (!state.isDragging) return
      if (event.cancelable) event.preventDefault()
      setDragGhost((prev) => (prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null))

      const elements = container.querySelectorAll<HTMLElement>('[data-tag-index]')
      for (const element of elements) {
        const rect = element.getBoundingClientRect()
        if (
          touch.clientX >= rect.left &&
          touch.clientX <= rect.right &&
          touch.clientY >= rect.top &&
          touch.clientY <= rect.bottom
        ) {
          const target = Number.parseInt(element.dataset.tagIndex ?? '-1', 10)
          if (target >= 0) setDragOverIndex(target)
          break
        }
      }
    }

    const handleTouchEnd = () => {
      const state = touchStateRef.current
      if (!state) return
      if (state.isDragging && dragOverIndex !== null) {
        moveTag(state.index, dragOverIndex)
      }
      touchStateRef.current = null
      setDraggedIndex(null)
      setDragOverIndex(null)
      setDragGhost(null)
    }

    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)
    container.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [tags, dragOverIndex, moveTag])

  return (
    <>
      <div
        ref={containerRef}
        className="flex min-h-[56px] flex-wrap content-start gap-1.5 rounded-md border bg-background p-2 touch-none"
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelect(null)
        }}
      >
        {tags.map((tag, index) => (
          <div
            key={`${tag.name}-${index}`}
            data-tag-index={index}
            draggable
            onDragStart={(event) => handleDragStart(event, index)}
            onDrag={handleDrag}
            onDragOver={(event) => handleDragOver(event, index)}
            onDragEnd={handleDragEnd}
            onDrop={(event) => handleDrop(event, index)}
            onClick={() => handleClick(index)}
            onDoubleClick={() => removeTag(index)}
            onTouchStart={(event) => handleTouchStart(event, index)}
            className={`inline-flex h-6 cursor-pointer select-none items-center rounded px-2 text-sm transition-all ${
              selectedIndex === index
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            } ${draggedIndex === index ? 'opacity-50' : ''} ${
              dragOverIndex === index ? 'ring-2 ring-primary ring-offset-1' : ''
            }`}
            title="单击选中，双击删除，拖拽排序"
          >
            <span className="max-w-[220px] truncate">{tag.name}</span>
            {tag.weight !== 1 && (
              <span className="ml-0.5 text-xs opacity-70">:{tag.weight.toFixed(1)}</span>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <span className="px-1 text-sm text-muted-foreground">
            在上方输入画师串，或从画师页添加画师
          </span>
        )}
      </div>

      {dragGhost && (
        <div
          className="pointer-events-none fixed z-[9999] inline-flex h-6 items-center rounded bg-primary px-2 text-sm text-primary-foreground opacity-90 shadow-lg"
          style={{
            left: dragGhost.x,
            top: dragGhost.y,
            transform: 'translate(-50%, -50%) scale(1.05)',
          }}
        >
          <span>{dragGhost.name}</span>
          {dragGhost.weight !== 1 && (
            <span className="ml-0.5 text-xs opacity-70">:{dragGhost.weight.toFixed(1)}</span>
          )}
        </div>
      )}
    </>
  )
}
