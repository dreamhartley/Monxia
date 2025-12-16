import { useState, useRef } from 'react'
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { importExportApi } from '@/lib/api'

export default function ImportExportPage() {
  const [exportLoading, setExportLoading] = useState<'json' | 'excel' | null>(null)
  const [importLoading, setImportLoading] = useState<'json' | 'excel' | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const jsonFileRef = useRef<HTMLInputElement>(null)
  const excelFileRef = useRef<HTMLInputElement>(null)

  const handleExportJson = async () => {
    setExportLoading('json')
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
      setExportLoading(null)
    }
  }

  const handleExportExcel = async () => {
    setExportLoading('excel')
    setMessage(null)
    try {
      const blob = await importExportApi.exportExcel()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '画师整理.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMessage({ type: 'success', text: 'Excel 导出成功' })
    } catch (error) {
      console.error('Export Excel failed:', error)
      setMessage({ type: 'error', text: '导出失败' })
    } finally {
      setExportLoading(null)
    }
  }

  const handleImportJson = async (file: File) => {
    setImportLoading('json')
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
      setImportLoading(null)
      if (jsonFileRef.current) {
        jsonFileRef.current.value = ''
      }
    }
  }

  const handleImportExcel = async (file: File) => {
    setImportLoading('excel')
    setMessage(null)
    try {
      const res = await importExportApi.importExcel(file)
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Excel 导入成功' })
      } else {
        setMessage({ type: 'error', text: res.error || '导入失败' })
      }
    } catch (error) {
      console.error('Import Excel failed:', error)
      setMessage({ type: 'error', text: '导入失败，请检查文件格式' })
    } finally {
      setImportLoading(null)
      if (excelFileRef.current) {
        excelFileRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">导入/导出</h1>
          <p className="text-sm text-muted-foreground">备份和恢复你的画师数据</p>
        </div>
      </header>

      {/* 内容区域 */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl space-y-6">
          {/* 消息提示 */}
          {message && (
            <div
              className={`flex items-center gap-2 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* 导出区域 */}
          <div>
            <h2 className="text-lg font-semibold mb-4">导出数据</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 导出 JSON */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileJson className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">导出为 JSON</CardTitle>
                      <CardDescription>
                        导出完整数据，包含所有分类和画师信息
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleExportJson}
                    disabled={exportLoading !== null}
                    className="w-full gap-2"
                  >
                    {exportLoading === 'json' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    导出 JSON
                  </Button>
                </CardContent>
              </Card>

              {/* 导出 Excel */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <FileSpreadsheet className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-base">导出为 Excel</CardTitle>
                      <CardDescription>
                        导出为 Excel 格式，兼容原脚本格式
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleExportExcel}
                    disabled={exportLoading !== null}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {exportLoading === 'excel' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    导出 Excel
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 导入区域 */}
          <div>
            <h2 className="text-lg font-semibold mb-4">导入数据</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 导入 JSON */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileJson className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">导入 JSON</CardTitle>
                      <CardDescription>
                        从 JSON 文件导入数据
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    ref={jsonFileRef}
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImportJson(file)
                    }}
                    disabled={importLoading !== null}
                    className="cursor-pointer"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3 w-3" />
                    <span>选择 JSON 文件上传</span>
                  </div>
                  {importLoading === 'json' && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>正在导入...</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 导入 Excel */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <FileSpreadsheet className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-base">导入 Excel</CardTitle>
                      <CardDescription>
                        从 Excel 文件导入，兼容原脚本格式
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    ref={excelFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImportExcel(file)
                    }}
                    disabled={importLoading !== null}
                    className="cursor-pointer"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3 w-3" />
                    <span>选择 Excel 文件上传</span>
                  </div>
                  {importLoading === 'excel' && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>正在导入...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 说明 */}
          <Card className="bg-secondary/30 border-border/50">
            <CardHeader>
              <CardTitle className="text-base">使用说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>JSON 格式:</strong> 包含完整的数据结构，推荐用于备份和恢复。
              </p>
              <p>
                <strong>Excel 格式:</strong>{' '}
                与原 Python 脚本兼容，方便与其他工具交换数据。Excel
                文件需要包含 "画师分类" 工作表。
              </p>
              <p className="pt-2">
                <strong>注意:</strong> 导入数据会追加到现有数据中，不会覆盖已有数据。
                如需清空数据，请先手动删除。
              </p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
