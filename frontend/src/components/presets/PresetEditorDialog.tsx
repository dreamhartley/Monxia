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
  hasDraftContent,
  isDraftModified,
  updatePresetDraft,
  type DraftImageRef,
  type PresetDraftOrigin,
  type PresetDraftV3,
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
  removedImageIds: number[]
  /** 编辑模式的原始快照，用于放弃修改 / 脏检查 */
  origin: PresetDraftOrigin | null
  presetId: number | null
}

const MAX_IMAGES = 5
const MAX_FILE_SIZE = 15 * 1024 * 1024

/** 权重调节步进与取值范围 */
const WEIGHT_STEP = 0.05
const MIN_WEIGHT = 0.05
const MAX_WEIGHT = 2
/** 权重显示保留的小数位（0.05 步进需要两位） */
const WEIGHT_DIGITS = 2

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

function originFromPreset(preset: Preset): PresetDraftOrigin {
  return {
    name: preset.name,
    description: preset.description,
    format: preset.format,
    text: preset.text,
    images: preset.images.map((image) => ({
      id: image.id,
      filename: image.filename,
      name: `参考图 ${image.id}`,
    })),
  }
}

function existingImagesOfPreset(preset: Preset, removedImageIds: number[]): EditorImage[] {
  const removed = new Set(removedImageIds)
  return preset.images
    .filter((image) => !removed.has(image.id))
    .map((image) => ({
      key: `existing-${image.id}`,
      url: presetImageUrl(image.filename),
      name: `参考图 ${image.id}`,
      existingId: image.id,
    }))
}

function buildInitial(mode: 'create' | 'edit', preset: Preset | null): InitialState {
  const draft = getPresetDraft()

  if (mode === 'edit' && preset) {
    const resumable = draft && draft.mode === 'edit' && draft.presetId === preset.id
    if (resumable && draft) {
      return {
        name: draft.name,
        description: draft.description,
        format: draft.format,
        text: draft.text,
        tags: draft.tags,
        images: existingImagesOfPreset(preset, draft.removedImageIds),
        draftRefs: draft.images,
        removedImageIds: draft.removedImageIds,
        origin: draft.origin ?? originFromPreset(preset),
        presetId: preset.id,
      }
    }

    const parsed = parseArtistString(preset.text)
    return {
      name: preset.name,
      description: preset.description,
      format: preset.format,
      text: preset.text,
      tags: parsed.tags,
      images: existingImagesOfPreset(preset, []),
      draftRefs: [],
      removedImageIds: [],
      origin: originFromPreset(preset),
      presetId: preset.id,
    }
  }

  const source = draft && draft.mode === 'create' ? draft : null
  return {
    name: source?.name ?? '',
    description: source?.description ?? '',
    format: source?.format ?? 'noob',
    text: source?.text ?? '',
    tags: source?.tags ?? [],
    images: [],
    draftRefs: source?.images ?? [],
    removedImageIds: [],
    origin: null,
    presetId: null,
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
  const [removedImageIds, setRemovedImageIds] = useState<number[]>(initial.removedImageIds)
  const [imagesLoaded, setImagesLoaded] = useState(initial.draftRefs.length === 0)
  const [imageBusy, setImageBusy] = useState(false)
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const urlsRef = useRef<Set<string>>(new Set())

  const origin = initial.origin
  const presetId = initial.presetId
  const isEditDraft = mode === 'edit' && origin !== null && presetId !== null

  // 草稿图片从 IndexedDB 恢复（新建与编辑共用）
  useEffect(() => {
    const refs = initial.draftRefs
    if (refs.length === 0) return
    let cancelled = false

    const load = async () => {
      const loaded: EditorImage[] = []
      const validRefs: DraftImageRef[] = []
      for (const ref of refs) {
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
        validRefs.push({ key: ref.key, name: ref.name, width: stored.width, height: stored.height })
      }

      if (cancelled) {
        for (const image of loaded) {
          revokePreviewUrl(image.url)
          urlsRef.current.delete(image.url)
        }
        return
      }

      setImages((prev) => [...prev, ...loaded])
      setDraftRefs(validRefs)
      setImagesLoaded(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [initial])

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

  /** 当前编辑内容对应的草稿快照 */
  const buildDraft = (): PresetDraftV3 => ({
    version: 3,
    mode: isEditDraft ? 'edit' : 'create',
    presetId: isEditDraft ? presetId : null,
    origin: isEditDraft ? origin : null,
    name,
    description,
    format,
    text,
    tags,
    images: draftRefs,
    removedImageIds: isEditDraft ? removedImageIds : [],
    updatedAt: new Date().toISOString(),
  })

  const hasContent = hasDraftContent(buildDraft())
  /** 编辑模式下与原始快照是否有差异（决定“放弃修改”是否可用） */
  const modified = isDraftModified(buildDraft())

  // 新建与编辑都自动保存草稿
  useEffect(() => {
    if (!imagesLoaded) return

    const timer = window.setTimeout(() => {
      if (!hasContent) {
        // 新建时没有内容就不留草稿；编辑时保留快照，退出时再加清理
        if (!isEditDraft && getPresetDraft()) void clearPresetDraft()
        return
      }
      updatePresetDraft(buildDraft())
    }, 400)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesLoaded, hasContent, name, description, format, text, tags, draftRefs, removedImageIds])

  const applyTags = (next: ArtistTag[]) => {
    setTags(next)
    setText(formatArtistString(next, format))
  }

  const adjustWeight = (delta: number) => {
    if (selectedIndex === null) return
    const next = tags.map((tag, index) => {
      if (index !== selectedIndex) return tag
      const raw = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, tag.weight + delta))
      // 按 0.05 步进并保留两位小数，避免浮点误差累积出 0.30000000000000004
      const weight = Math.round(raw * 100) / 100
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

      const uploadable = images.filter((image) => image.blob)
      let failures = 0
      if (uploadable.length > 0) {
        const uploadRes = await presetApi.uploadImages(
          preset.id,
          uploadable.map((image) => blobToFile(image.blob as Blob, image.name || 'reference.jpg'))
        )
        if (!uploadRes.success) failures += uploadable.length
        else failures += uploadRes.data?.failed?.length ?? 0
      }

      for (const imageId of removedImageIds) {
        const deleteRes = await presetApi.deleteImage(preset.id, imageId)
        if (!deleteRes.success) failures += 1
      }

      await clearPresetDraft()
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
        if (presetId !== null && getPresetDraft()?.presetId === presetId) {
          await clearPresetDraft()
        }
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

  /** 清空草稿：新建模式清空所有输入，编辑模式放弃改动并恢复原始内容 */
  const handleClearDraft = async () => {
    setShowClearConfirm(false)
    await clearPresetDraft()

    for (const image of images) {
      revokePreviewUrl(image.url)
    }
    urlsRef.current.clear()
    setDraftRefs([])
    setRemovedImageIds([])
    setSelectedIndex(null)
    setWarnings([])
    setError(null)

    if (isEditDraft && origin && preset) {
      const parsed = parseArtistString(origin.text)
      setName(origin.name)
      setDescription(origin.description)
      setFormat(origin.format)
      setText(origin.text)
      setTags(parsed.tags)
      setDetected(detectArtistFormat(origin.text))
      setImages(
        origin.images.map((image) => ({
          key: `existing-${image.id}`,
          url: presetImageUrl(image.filename),
          name: image.name,
          existingId: image.id,
        }))
      )
      showToast('已放弃修改，草稿已清空', 'success')
      return
    }

    setImages([])
    setName('')
    setDescription('')
    setFormat('noob')
    setText('')
    setTags([])
    setDetected('plain')
    showToast('草稿已清空', 'success')
  }

  const handleClose = () => {
    if (hasContent) {
      updatePresetDraft(buildDraft())
    } else if (getPresetDraft()) {
      void clearPresetDraft()
    }
    onClose()
  }

  /**
   * 编辑模式下没有任何改动时直接退出：不调用保存接口，
   * 同时清掉这份编辑草稿，之后即可正常创建新画师串。
   */
  const handleExitEdit = async () => {
    if (saving) return
    setSaving(true)
    try {
      await clearPresetDraft()
      showToast('已退出编辑，草稿已清除', 'success')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  /** 编辑模式且未改动时，主按钮承担「退出编辑」职责 */
  const idleEdit = isEditDraft && !modified

  const selectedTag = selectedIndex !== null ? tags[selectedIndex] : null

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0 md:max-h-[90vh]"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            // 未改动时主按钮是「退出编辑」，快捷键保持一致
            if (idleEdit) void handleExitEdit()
            else void handleSave()
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
          <DialogTitle className="flex items-center gap-2">
            {mode === 'edit' ? '编辑画师串' : '创建画师串'}
            <Badge variant="outline" className="text-[10px] font-normal">
              草稿自动保存
            </Badge>
          </DialogTitle>
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
                  onClick={() => adjustWeight(-WEIGHT_STEP)}
                  disabled={selectedIndex === null}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-12 text-center text-xs text-muted-foreground">
                  {selectedTag ? selectedTag.weight.toFixed(WEIGHT_DIGITS) : '—'}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => adjustWeight(WEIGHT_STEP)}
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
          <div className="flex items-center gap-2">
            {mode === 'edit' && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                删除
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowClearConfirm(true)}
              disabled={(isEditDraft ? !modified : !hasContent) || saving}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {mode === 'edit' ? '放弃修改' : '清空草稿'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {idleEdit ? (
              <Button type="button" onClick={() => void handleExitEdit()} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                退出编辑
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleSave()} disabled={saving || imageBusy}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {mode === 'edit' ? '保存' : '创建'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === 'edit' ? '确认放弃本次修改' : '确认清空草稿'}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'edit'
                ? '将丢弃本次编辑的全部改动，恢复为已保存的画师串内容，且不可恢复。'
                : '将清除名称、描述、画师串、格式与全部参考图，且不可恢复。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleClearDraft()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {mode === 'edit' ? '放弃修改' : '清空'}
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
