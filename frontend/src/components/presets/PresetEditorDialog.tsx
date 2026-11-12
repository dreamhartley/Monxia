import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Copy,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  detectArtistFormat,
  formatArtistString,
  parseArtistString,
  type ArtistFormat,
  type ArtistTag,
  type DetectedFormat,
} from '@/lib/artistString'
import {
  clearPresetDraft,
  getPresetDraft,
  updatePresetDraft,
  type DraftImageRef,
} from '@/lib/presetDraft'
import { deleteDraftImage, getDraftImage, putDraftImage } from '@/lib/draftImageStore'
import { blobToFile, compressImageFile, revokePreviewUrl } from '@/lib/image'
import { presetApi, presetImageUrl, type Preset } from '@/lib/api'
import { usePresetEditor } from '@/contexts/PresetEditorContext'
import { useToast } from '@/contexts/ToastContext'
import { TagChipEditor } from './TagChipEditor'
import { PresetImageGallery, type GalleryImage } from './PresetImageGallery'
import { ImageLightbox } from './ImageLightbox'

interface PresetEditorDialogProps {
  mode: 'create' | 'edit'
  preset: Preset | null
  onClose: () => void
}

interface EditorImage extends GalleryImage {
  blob?: Blob
  file?: File
  existingId?: number
  draftKey?: string
}

interface InitialState {
  name: string
  description: string
  format: ArtistFormat
  text: string
  tags: ArtistTag[]
  images: EditorImage[]
  draftRefs: DraftImageRef[]
}

const MAX_IMAGES = 5
const MAX_FILE_SIZE = 15 * 1024 * 1024

function makeKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function tagsEqual(a: ArtistTag[], b: ArtistTag[]): boolean {
  if (a.length !== b.length) return false
  return a.every((tag, index) => tag.name === b[index].name && tag.weight === b[index].weight)
}

function buildInitial(mode: 'create' | 'edit', preset: Preset | null): InitialState {
  if (mode === 'edit' && preset) {
    const parsed = parseArtistString(preset.text)
    return {
      name: preset.name,
      description: preset.description,
      format: preset.format,
      text: preset.text,
      tags: parsed.tags,
      images: preset.images.map((image) => ({
        key: `existing-${image.id}`,
        url: presetImageUrl(image.filename),
        name: `参考图 ${image.id}`,
        existingId: image.id,
      })),
      draftRefs: [],
    }
  }

  const draft = getPresetDraft()
  return {
    name: draft?.name ?? '',
    description: draft?.description ?? '',
    format: draft?.format ?? 'noob',
    text: draft?.text ?? '',
    tags: draft?.tags ?? [],
    images: [],
    draftRefs: draft?.images ?? [],
  }
}

function detectionLabel(detected: DetectedFormat): string {
  if (detected === 'noob') return 'NOOB'
  if (detected === 'nai') return 'NAI'
  if (detected === 'mixed') return '混合'
  return '未识别'
}

export function PresetEditorDialog({ mode, preset, onClose }: PresetEditorDialogProps) {
  const [initial] = useState<InitialState>(() => buildInitial(mode, preset))

  const { notifySaved } = usePresetEditor()
  const { showToast } = useToast()

  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [format, setFormat] = useState<ArtistFormat>(initial.format)
  const [text, setText] = useState(initial.text)
  const [tags, setTags] = useState<ArtistTag[]>(initial.tags)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [detected, setDetected] = useState<DetectedFormat>(detectArtistFormat(initial.text))
  const [warnings, setWarnings] = useState<string[]>([])

  const [images, setImages] = useState<EditorImage[]>(initial.images)
  const [draftRefs, setDraftRefs] = useState<DraftImageRef[]>(initial.draftRefs)
  const [imagesLoaded, setImagesLoaded] = useState(mode === 'edit')
  const [imageBusy, setImageBusy] = useState(false)
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([])
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const urlsRef = useRef<Set<string>>(new Set())

  // 草稿图片从 IndexedDB 恢复
  useEffect(() => {
    if (mode !== 'create') return
    let cancelled = false

    const load = async () => {
      const loaded: EditorImage[] = []
      const refs: DraftImageRef[] = []
      for (const ref of initial.draftRefs) {
        const stored = await getDraftImage(ref.key)
        if (!stored) continue
        const url = URL.createObjectURL(stored.blob)
        urlsRef.current.add(url)
        loaded.push({
          key: ref.key,
          url,
          name: ref.name,
          blob: stored.blob,
          draftKey: ref.key,
        })
        refs.push({ key: ref.key, name: ref.name, width: stored.width, height: stored.height })
      }

      if (cancelled) {
        for (const image of loaded) {
          revokePreviewUrl(image.url)
          urlsRef.current.delete(image.url)
        }
        return
      }

      setImages(loaded)
      setDraftRefs(refs)
      setImagesLoaded(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [mode, initial])

  // 卸载时释放所有预览 URL
  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  // 输入框内容变化后重新解析（带防抖，避免每次按键重置光标）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parsed = parseArtistString(text)
      setDetected(parsed.detected)
      setWarnings(parsed.warnings)
      setTags((prev) => (tagsEqual(prev, parsed.tags) ? prev : parsed.tags))
      setSelectedIndex((prev) => (prev !== null && prev < parsed.tags.length ? prev : null))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [text])

  const hasContent =
    name.trim() !== '' ||
    description.trim() !== '' ||
    tags.length > 0 ||
    images.length > 0

  // 创建模式下自动保存草稿
  useEffect(() => {
    if (mode !== 'create' || !imagesLoaded) return

    const timer = window.setTimeout(() => {
      if (!hasContent) {
        if (getPresetDraft()) void clearPresetDraft()
        return
      }
      updatePresetDraft({ name, description, format, text, tags, images: draftRefs })
    }, 400)

    return () => window.clearTimeout(timer)
  }, [mode, imagesLoaded, hasContent, name, description, format, text, tags, draftRefs])

  const applyTags = (next: ArtistTag[]) => {
    setTags(next)
    setText(formatArtistString(next, format))
  }

  const adjustWeight = (delta: number) => {
    if (selectedIndex === null) return
    const next = tags.map((tag, index) => {
      if (index !== selectedIndex) return tag
      const weight = Math.max(0.1, Math.min(2, Math.round((tag.weight + delta) * 10) / 10))
      return { ...tag, weight }
    })
    applyTags(next)
  }

  const resetWeight = () => {
    if (selectedIndex === null) return
    applyTags(tags.map((tag, index) => (index === selectedIndex ? { ...tag, weight: 1 } : tag)))
  }

  const changeFormat = (next: ArtistFormat) => {
    if (next === format) return
    const parsed = parseArtistString(text)
    const nextTags = parsed.tags.length > 0 ? parsed.tags : tags
    setFormat(next)
    setTags(nextTags)
    setSelectedIndex(null)
    setText(formatArtistString(nextTags, next))
    setWarnings(parsed.warnings)
    setDetected(next)
  }

  const reparse = () => {
    const parsed = parseArtistString(text)
    setDetected(parsed.detected)
    setWarnings(parsed.warnings)
    setTags(parsed.tags)
    setSelectedIndex(null)

    if (parsed.tags.length === 0) return
    let nextFormat = format
    if (parsed.detected === 'noob' || parsed.detected === 'nai') nextFormat = parsed.detected
    else if (parsed.detected === 'mixed') nextFormat = text.includes('::') ? 'nai' : 'noob'

    setFormat(nextFormat)
    setText(formatArtistString(parsed.tags, nextFormat))
  }

  const handlePaste = () => {
    window.setTimeout(() => {
      const value = textareaRef.current?.value ?? ''
      const parsed = parseArtistString(value)
      setDetected(parsed.detected)
      setWarnings(parsed.warnings)
      setTags(parsed.tags)
      setSelectedIndex(null)

      if (parsed.tags.length === 0) return
      if (parsed.detected === 'plain') return

      const nextFormat: ArtistFormat =
        parsed.detected === 'nai'
          ? 'nai'
          : parsed.detected === 'noob'
            ? 'noob'
            : value.includes('::')
              ? 'nai'
              : 'noob'

      setFormat(nextFormat)
      setText(formatArtistString(parsed.tags, nextFormat))
    }, 0)
  }

  const handleCopy = async () => {
    const value = text || formatArtistString(tags, format)
    try {
      await navigator.clipboard.writeText(value)
      showToast('已复制画师串', 'success')
    } catch {
      showToast('复制失败，请手动选择复制', 'error')
    }
  }

  const handleAddImages = async (files: File[]) => {
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      showToast('参考图最多 5 张', 'error')
      return
    }

    const accepted = files.slice(0, remaining)
    if (files.length > remaining) {
      showToast(`最多再添加 ${remaining} 张参考图`, 'error')
    }

    setImageBusy(true)
    let storageFailed = false

    for (const file of accepted) {
      if (file.size > MAX_FILE_SIZE) {
        showToast(`${file.name} 超过 15MB，已跳过`, 'error')
        continue
      }

      try {
        const compressed = await compressImageFile(file)
        const url = URL.createObjectURL(compressed.blob)
        urlsRef.current.add(url)

        if (mode === 'create') {
          const key = makeKey()
          const saved = await putDraftImage(key, {
            blob: compressed.blob,
            name: file.name,
            width: compressed.width,
            height: compressed.height,
          })
          if (!saved) storageFailed = true
          setImages((prev) => [
            ...prev,
            { key, url, name: file.name, blob: compressed.blob, draftKey: key },
          ])
          setDraftRefs((prev) => [
            ...prev,
            { key, name: file.name, width: compressed.width, height: compressed.height },
          ])
        } else {
          setImages((prev) => [
            ...prev,
            {
              key: makeKey(),
              url,
              name: file.name,
              file: blobToFile(compressed.blob, file.name),
            },
          ])
        }
      } catch {
        showToast(`${file.name} 处理失败`, 'error')
      }
    }

    if (storageFailed) {
      showToast('草稿图片存储不可用，刷新页面后可能丢失', 'error')
    }
    setImageBusy(false)
  }

  const handleRemoveImage = (key: string) => {
    const target = images.find((image) => image.key === key)
    if (!target) return

    if (target.existingId !== undefined) {
      setRemovedImageIds((prev) => [...prev, target.existingId as number])
    }
    if (target.draftKey) {
      void deleteDraftImage(target.draftKey)
      setDraftRefs((prev) => prev.filter((ref) => ref.key !== target.draftKey))
    }

    revokePreviewUrl(target.url)
    urlsRef.current.delete(target.url)
    setImages((prev) => prev.filter((image) => image.key !== key))
  }

  const handleSave = async () => {
    if (saving || imageBusy) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('请输入画师串名称')
      return
    }

    const parsed = parseArtistString(text)
    const finalTags = parsed.tags.length > 0 ? parsed.tags : tags
    if (finalTags.length === 0) {
      setError('请至少输入一个画师')
      return
    }

    const finalText = formatArtistString(finalTags, format)
    setSaving(true)
    setError(null)

    try {
      if (mode === 'create') {
        const res = await presetApi.create({
          name: trimmedName,
          description: description.trim(),
          format,
          text: finalText,
        })
        if (!res.success || !res.data) {
          setError(res.error || '保存失败')
          return
        }

        const uploadable = images.filter((image) => image.blob)
        let imageFailed = 0
        if (uploadable.length > 0) {
          const uploadRes = await presetApi.uploadImages(
            res.data.id,
            uploadable.map((image) => blobToFile(image.blob as Blob, image.name || 'reference.jpg'))
          )
          if (!uploadRes.success) {
            imageFailed = uploadable.length
          } else {
            imageFailed = uploadRes.data?.failed?.length ?? 0
          }
        }

        await clearPresetDraft()
        notifySaved()
        onClose()
        if (imageFailed > 0) {
          showToast(`画师串已创建，${imageFailed} 张参考图上传失败`, 'error')
        } else {
          showToast('画师串已创建', 'success')
        }
        return
      }

      if (!preset) {
        setError('画师串不存在')
        return
      }

      const res = await presetApi.update(preset.id, {
        name: trimmedName,
        description: description.trim(),
        format,
        text: finalText,
      })
      if (!res.success) {
        setError(res.error || '保存失败')
        return
      }

      const newImages = images.filter((image) => image.file)
      let failures = 0
      if (newImages.length > 0) {
        const uploadRes = await presetApi.uploadImages(
          preset.id,
          newImages.map((image) => image.file as File)
        )
        if (!uploadRes.success) failures += newImages.length
        else failures += uploadRes.data?.failed?.length ?? 0
      }

      for (const imageId of removedImageIds) {
        const deleteRes = await presetApi.deleteImage(preset.id, imageId)
        if (!deleteRes.success) failures += 1
      }

      notifySaved()
      onClose()
      if (failures > 0) {
        showToast(`画师串已保存，${failures} 个参考图操作失败`, 'error')
      } else {
        showToast('画师串已保存', 'success')
      }
    } catch {
      setError('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!preset) return
    setSaving(true)
    try {
      const res = await presetApi.delete(preset.id)
      if (res.success) {
        notifySaved()
        onClose()
        showToast('画师串已删除', 'success')
      } else {
        setError(res.error || '删除失败')
      }
    } catch {
      setError('删除失败，请稍后重试')
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleClearDraft = async () => {
    setShowClearConfirm(false)
    await clearPresetDraft()

    for (const image of images) {
      revokePreviewUrl(image.url)
    }
    urlsRef.current.clear()
    setImages([])
    setDraftRefs([])
    setRemovedImageIds([])
    setName('')
    setDescription('')
    setFormat('noob')
    setText('')
    setTags([])
    setSelectedIndex(null)
    setWarnings([])
    setDetected('plain')
    setError(null)
    showToast('草稿已清空', 'success')
  }

  const handleClose = () => {
    if (mode === 'create') {
      if (hasContent) {
        updatePresetDraft({ name, description, format, text, tags, images: draftRefs })
      } else if (getPresetDraft()) {
        void clearPresetDraft()
      }
    }
    onClose()
  }

  const selectedTag = selectedIndex !== null ? tags[selectedIndex] : null

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0 md:max-h-[90vh]"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            void handleSave()
          }
        }}
        onEscapeKeyDown={(event) => {
          if (previewImage) {
            event.preventDefault()
            setPreviewImage(null)
          }
        }}
        onInteractOutside={(event) => {
          // 大图预览是独立 Portal，避免点击预览遮罩时误关整个编辑器
          if (previewImage) event.preventDefault()
        }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{mode === 'edit' ? '编辑画师串' : '创建画师串'}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="preset-name">名称</Label>
              <Input
                id="preset-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="输入画师串名称"
              />
            </div>
            <div className="space-y-1">
              <Label>保存格式</Label>
              <div className="inline-flex w-full rounded-md border p-0.5 sm:w-auto">
                {(['noob', 'nai'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => changeFormat(item)}
                    className={`flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                      format === item
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {item === 'noob' ? 'NOOB' : 'NAI'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="preset-description">描述</Label>
            <Input
              id="preset-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="添加描述（可选）"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="preset-text">画师串</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1" onClick={() => void handleCopy()}>
                <Copy className="h-3.5 w-3.5" />
                复制
              </Button>
            </div>
            <Textarea
              id="preset-text"
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onPaste={handlePaste}
              placeholder="粘贴 NOOB 或 NAI 画师串，自动识别格式与权重"
              className="min-h-[96px] font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={detected === 'mixed' ? 'destructive' : 'secondary'}>
                识别：{detectionLabel(detected)}
              </Badge>
              <span>{tags.length} 位画师</span>
              <span>·</span>
              <span>{tags.filter((tag) => tag.weight !== 1).length} 个带权重</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-6 gap-1 px-2 text-xs"
                onClick={reparse}
              >
                <RefreshCw className="h-3 w-3" />
                重新识别
              </Button>
            </div>
            {warnings.length > 0 && (
              <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-500">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {warnings[0]}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>标签</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => adjustWeight(-0.1)}
                  disabled={selectedIndex === null}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-12 text-center text-xs text-muted-foreground">
                  {selectedTag ? selectedTag.weight.toFixed(1) : '—'}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => adjustWeight(0.1)}
                  disabled={selectedIndex === null}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={resetWeight}
                  disabled={selectedIndex === null}
                >
                  重置
                </Button>
              </div>
            </div>
            <TagChipEditor
              tags={tags}
              onChange={applyTags}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
            <p className="text-xs text-muted-foreground">单击选中，双击删除，拖拽排序</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>参考样图</Label>
              <span className="text-xs text-muted-foreground">
                {images.length}/{MAX_IMAGES}
              </span>
            </div>
            <PresetImageGallery
              images={images}
              max={MAX_IMAGES}
              busy={imageBusy}
              onAdd={(files) => void handleAddImages(files)}
              onRemove={handleRemoveImage}
              onPreview={(image) => setPreviewImage(image)}
            />
          </div>

          {error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-6 py-3 sm:justify-between">
          {mode === 'edit' ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              删除
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowClearConfirm(true)}
              disabled={!hasContent || saving}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              清空草稿
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              取消
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || imageBusy}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {mode === 'edit' ? '保存' : '创建'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空草稿</AlertDialogTitle>
            <AlertDialogDescription>
              将清除名称、描述、画师串、格式与全部参考图，且不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleClearDraft()}
              className="bg-destructive hover:bg-destructive/90"
            >
              清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除画师串</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复，关联的全部参考图也会一并删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
