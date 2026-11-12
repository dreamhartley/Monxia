import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Preset } from '@/lib/api'

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
  /** 保存 / 删除成功后递增，列表页据此刷新 */
  revision: number
  openCreate: () => void
  openEdit: (preset: Preset) => void
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

export function PresetEditorProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<PresetEditorRequest>(CLOSED)
  const [revision, setRevision] = useState(0)

  const openCreate = useCallback(() => {
    setRequest((prev) => ({ open: true, mode: 'create', preset: null, key: prev.key + 1 }))
  }, [])

  const openEdit = useCallback((preset: Preset) => {
    setRequest((prev) => ({ open: true, mode: 'edit', preset, key: prev.key + 1 }))
  }, [])

  const close = useCallback(() => {
    setRequest((prev) => ({ ...prev, open: false, preset: null }))
  }, [])

  const notifySaved = useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  const value = useMemo(
    () => ({ request, revision, openCreate, openEdit, close, notifySaved }),
    [request, revision, openCreate, openEdit, close, notifySaved]
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
