import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Preset } from '@/lib/api'
import { parseArtistString } from '@/lib/artistString'
import {
  clearPresetDraft,
  emptyDraft,
  getPresetDraft,
  hasDraftContent,
  isDraftModified,
  updatePresetDraft,
  type PresetDraftV3,
} from '@/lib/presetDraft'

export type PresetEditorMode = 'create' | 'edit'

export interface PresetEditorRequest {
  open: boolean
  mode: PresetEditorMode
  preset: Preset | null
  /** 每次打开递增，用于强制重置编辑器内部状态 */
  key: number
}

interface PresetEditorContextValue {
  request: PresetEditorRequest
  /** 待确认的编辑请求：当前草稿非空，需要用户确认清空 */
  pendingEditPreset: Preset | null
  /** 保存 / 删除成功后递增，列表页据此刷新 */
  revision: number
  /** 打开草稿（有草稿则续写，没有则新建） */
  openDraft: () => void
  /** 编辑画师串：草稿非空时先要求确认 */
  openEdit: (preset: Preset) => void
  /** 确认清空草稿并进入编辑 */
  confirmPendingEdit: () => void
  /** 取消进入编辑，保留当前草稿 */
  cancelPendingEdit: () => void
  close: () => void
  notifySaved: () => void
}

const PresetEditorContext = createContext<PresetEditorContextValue | null>(null)

const CLOSED: PresetEditorRequest = {
  open: false,
  mode: 'create',
  preset: null,
  key: 0,
}

/** 用草稿里的原始快照还原出编辑目标，供续写草稿时使用 */
function presetFromDraft(draft: PresetDraftV3): Preset | null {
  if (draft.mode !== 'edit' || draft.presetId === null || !draft.origin) return null
  return {
    id: draft.presetId,
    name: draft.origin.name,
    description: draft.origin.description,
    format: draft.origin.format,
    text: draft.origin.text,
    images: draft.origin.images.map((image, index) => ({
      id: image.id,
      filename: image.filename,
      display_order: index,
    })),
    created_at: '',
    updated_at: draft.updatedAt,
  }
}

/** 建立编辑草稿：把服务端快照写成 origin，并把当前内容作为草稿内容 */
async function startEditDraft(preset: Preset): Promise<void> {
  await clearPresetDraft()
  updatePresetDraft({
    ...emptyDraft(),
    mode: 'edit',
    presetId: preset.id,
    origin: {
      name: preset.name,
      description: preset.description,
      format: preset.format,
      text: preset.text,
      images: preset.images.map((image) => ({
        id: image.id,
        filename: image.filename,
        name: `参考图 ${image.id}`,
      })),
    },
    name: preset.name,
    description: preset.description,
    format: preset.format,
    text: preset.text,
    tags: parseArtistString(preset.text).tags,
    images: [],
    removedImageIds: [],
  })
}

export function PresetEditorProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<PresetEditorRequest>(CLOSED)
  const [pendingEditPreset, setPendingEditPreset] = useState<Preset | null>(null)
  const [revision, setRevision] = useState(0)

  const openDraft = useCallback(() => {
    const draft = getPresetDraft()
    const editTarget = draft && hasDraftContent(draft) ? presetFromDraft(draft) : null
    setRequest((prev) => ({
      open: true,
      mode: editTarget ? 'edit' : 'create',
      preset: editTarget,
      key: prev.key + 1,
    }))
  }, [])

  const beginEdit = useCallback(async (preset: Preset) => {
    await startEditDraft(preset)
    setRequest((prev) => ({ open: true, mode: 'edit', preset, key: prev.key + 1 }))
  }, [])

  const openEdit = useCallback(
    (preset: Preset) => {
      const draft = getPresetDraft()
      // 已经在这个画师串的草稿里，直接续写（保留未保存的改动）
      if (draft && draft.mode === 'edit' && draft.presetId === preset.id) {
        setRequest((prev) => ({ open: true, mode: 'edit', preset, key: prev.key + 1 }))
        return
      }
      // 草稿里有未保存的内容（新建内容或编辑改动）才需要确认清空
      if (draft && isDraftModified(draft)) {
        setPendingEditPreset(preset)
        return
      }
      void beginEdit(preset)
    },
    [beginEdit]
  )

  const confirmPendingEdit = useCallback(() => {
    const preset = pendingEditPreset
    setPendingEditPreset(null)
    if (preset) void beginEdit(preset)
  }, [pendingEditPreset, beginEdit])

  const cancelPendingEdit = useCallback(() => {
    setPendingEditPreset(null)
  }, [])

  const close = useCallback(() => {
    setRequest((prev) => ({ ...prev, open: false, preset: null }))
  }, [])

  const notifySaved = useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  const value = useMemo(
    () => ({
      request,
      pendingEditPreset,
      revision,
      openDraft,
      openEdit,
      confirmPendingEdit,
      cancelPendingEdit,
      close,
      notifySaved,
    }),
    [
      request,
      pendingEditPreset,
      revision,
      openDraft,
      openEdit,
      confirmPendingEdit,
      cancelPendingEdit,
      close,
      notifySaved,
    ]
  )

  return <PresetEditorContext.Provider value={value}>{children}</PresetEditorContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePresetEditor(): PresetEditorContextValue {
  const context = useContext(PresetEditorContext)
  if (!context) {
    throw new Error('usePresetEditor 必须在 PresetEditorProvider 内使用')
  }
  return context
}
