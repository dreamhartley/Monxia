import { useState, useRef } from 'react'
import {
  Download,
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { importExportApi } from '@/lib/api'

export default function SettingsPage() {
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const jsonFileRef = useRef<HTMLInputElement>(null)

  const handleExportJson = async () => {
    setExportLoading(true)
    setMessage(null)
    try {
      const res = await importExportApi.exportJson()
      if (res.success && res.data) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = '画师数据.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setMessage({ type: 'success', text: 'JSON 导出成功' })
      } else {
        setMessage({ type: 'error', text: res.error || '导出失败' })
      }
    } catch (error) {
      console.error('Export JSON failed:', error)
      setMessage({ type: 'error', text: '导出失败' })
    } finally {
      setExportLoading(false)
    }
  }

  const handleImportJson = async (file: File) => {
    setImportLoading(true)
    setMessage(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await importExportApi.importJson(data)
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'JSON 导入成功' })
      } else {
        setMessage({ type: 'error', text: res.error || '导入失败' })
      }
    } catch (error) {
      console.error('Import JSON failed:', error)
      setMessage({ type: 'error', text: '导入失败，请检查文件格式' })
    } finally {
      setImportLoading(false)
      if (jsonFileRef.current) {
        jsonFileRef.current.value = ''
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.json')) {
      handleImportJson(file)
    } else {
      setMessage({ type: 'error', text: '请选择 JSON 文件' })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted/50">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">设置</h1>
            <p className="text-sm text-muted-foreground">管理应用配置和数据</p>
          </div>
        </div>
      </header>

      {/* 内容区域 */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 导入/导出部分标题 */}
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-foreground">数据备份</h2>
            <span className="text-sm text-muted-foreground">· 导入/导出</span>
          </div>

          {/* 消息提示 */}
          {message && (
            <div
              className={`flex items-center gap-3 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* 导入导出卡片并排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 导出区域 */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Download className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">导出数据</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      备份所有分类和画师
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col justify-center">
                <Button
                  onClick={handleExportJson}
                  disabled={exportLoading}
                  className="w-full gap-2"
                >
                  {exportLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileJson className="h-4 w-4" />
                  )}
                  导出 JSON
                </Button>
              </CardContent>
            </Card>

            {/* 导入区域 */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <Upload className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-base">导入数据</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      从备份文件恢复
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImportJson(file)
                  }}
                  className="hidden"
                  disabled={importLoading}
                />
                <div
                  onClick={() => !importLoading && jsonFileRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`
                    relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
                    transition-all duration-200
                    ${isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
                    }
                    ${importLoading ? 'pointer-events-none opacity-60' : ''}
                  `}
                >
                  {importLoading ? (
                    <div className="flex flex-col items-center gap-2 py-1">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">正在导入...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <FileJson className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        点击选择或拖拽 JSON 文件
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 说明 */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>JSON 文件包含完整的数据结构，推荐用于备份和恢复。</p>
              <p>
                <strong className="text-foreground/80">注意：</strong>
                导入数据会追加到现有数据中，不会覆盖已有数据。
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
