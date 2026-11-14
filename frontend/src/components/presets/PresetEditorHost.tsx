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
import { usePresetEditor } from '@/contexts/PresetEditorContext'
import { PresetEditorDialog } from './PresetEditorDialog'

/** 全局唯一的画师串编辑弹窗宿主 */
export function PresetEditorHost() {
  const {
    request,
    close,
    pendingEditPreset,
    confirmPendingEdit,
    cancelPendingEdit,
  } = usePresetEditor()

  return (
    <>
      {request.open && (
        <PresetEditorDialog
          key={request.key}
          mode={request.mode}
          preset={request.preset}
          onClose={close}
        />
      )}

      <AlertDialog
        open={pendingEditPreset !== null}
        onOpenChange={(open) => !open && cancelPendingEdit()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>当前已有画师串草稿</AlertDialogTitle>
            <AlertDialogDescription>
              编辑「{pendingEditPreset?.name}」需要先清空当前草稿，清空后不可恢复。
              确定清空草稿并进入编辑模式吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirmPendingEdit()
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              清空并编辑
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
