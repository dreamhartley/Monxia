import { usePresetEditor } from '@/contexts/PresetEditorContext'
import { PresetEditorDialog } from './PresetEditorDialog'

/** 全局唯一的画师串编辑弹窗宿主 */
export function PresetEditorHost() {
  const { request, close } = usePresetEditor()

  if (!request.open) return null

  return (
    <PresetEditorDialog
      key={request.key}
      mode={request.mode}
      preset={request.preset}
      onClose={close}
    />
  )
}
