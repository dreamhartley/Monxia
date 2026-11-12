import { AnimatePresence, motion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { usePresetDraft, hasDraftContent } from '@/lib/presetDraft'
import { usePresetEditor } from '@/contexts/PresetEditorContext'

/** 全局草稿入口：任意页面有草稿时显示在右下角 */
export function PresetDraftFab() {
  const draft = usePresetDraft()
  const { request, openCreate } = usePresetEditor()
  const visible = hasDraftContent(draft) && !request.open
  const count = draft?.tags.length ?? 0
  const label = count > 0 ? `继续编辑画师串（${count} 位画师）` : '继续编辑画师串草稿'

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          onClick={openCreate}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 md:right-6 md:bottom-6"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          aria-label={label}
          title={label}
        >
          <Layers className="h-5 w-5" />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {count > 99 ? '99+' : count}
            </span>
          ) : (
            <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
