import { useState, useRef, useEffect } from 'react'
import {
  Download,
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Lock,
  Eye,
  EyeOff,
  Image,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { importExportApi, accountApi, backgroundApi } from '@/lib/api'

export default function SettingsPage() {
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // 账户管理状态
  const [accountLoading, setAccountLoading] = useState(false)
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // 背景图管理状态
  const [bgLoading, setBgLoading] = useState(false)
  const [hasCustomBg, setHasCustomBg] = useState(false)
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null)

  const jsonFileRef = useRef<HTMLInputElement>(null)
  const bgFileRef = useRef<HTMLInputElement>(null)

  // 获取当前用户名
  useEffect(() => {
    const fetchAccountInfo = async () => {
      const res = await accountApi.getInfo()
      if (res.success && res.data) {
        setCurrentUsername(res.data.username)
      }
    }
    fetchAccountInfo()
  }, [])

  // 获取背景图信息
  useEffect(() => {
    const fetchBackgroundInfo = async () => {
      const res = await backgroundApi.getInfo()
      if (res.success && res.data) {
        setHasCustomBg(res.data.has_custom)
        setBgPreviewUrl(res.data.url)
      }
    }
    fetchBackgroundInfo()
  }, [])

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
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        a.download = `monxia_backup_${timestamp}.json`
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

  // 处理账户更新
  const handleUpdateAccount = async () => {
    setMessage(null)

    if (!currentPassword) {
      setMessage({ type: 'error', text: '请输入当前密码' })
      return
    }

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的新密码不一致' })
      return
    }

    if (!newUsername && !newPassword) {
      setMessage({ type: 'error', text: '请输入新用户名或新密码' })
      return
    }

    setAccountLoading(true)
    try {
      const res = await accountApi.update({
        current_password: currentPassword,
        new_username: newUsername || undefined,
        new_password: newPassword || undefined,
      })

      if (res.success) {
        setMessage({ type: 'success', text: res.message || '账户信息已更新' })
        // 清空表单
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        if (newUsername) {
          setCurrentUsername(newUsername)
          setNewUsername('')
        }
      } else {
        setMessage({ type: 'error', text: res.error || '更新失败' })
      }
    } catch (error) {
      console.error('Update account failed:', error)
      setMessage({ type: 'error', text: '更新失败' })
    } finally {
      setAccountLoading(false)
    }
  }

  // 处理背景图上传
  const handleUploadBackground = async (file: File) => {
    setBgLoading(true)
    setMessage(null)
    try {
      const res = await backgroundApi.upload(file)
      if (res.success) {
        setHasCustomBg(true)
        // 添加时间戳防止缓存
        setBgPreviewUrl(res.data.url + '?t=' + Date.now())
        setMessage({ type: 'success', text: res.message || '背景图上传成功' })
      } else {
        setMessage({ type: 'error', text: res.error || '上传失败' })
      }
    } catch (error) {
      console.error('Upload background failed:', error)
      setMessage({ type: 'error', text: '上传失败' })
    } finally {
      setBgLoading(false)
      if (bgFileRef.current) {
        bgFileRef.current.value = ''
      }
    }
  }

  // 处理删除背景图
  const handleDeleteBackground = async () => {
    setBgLoading(true)
    setMessage(null)
    try {
      const res = await backgroundApi.delete()
      if (res.success) {
        setHasCustomBg(false)
        setBgPreviewUrl(null)
        setMessage({ type: 'success', text: res.message || '已恢复默认背景' })
      } else {
        setMessage({ type: 'error', text: res.error || '删除失败' })
      }
    } catch (error) {
      console.error('Delete background failed:', error)
      setMessage({ type: 'error', text: '删除失败' })
    } finally {
      setBgLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">设置</h1>
            <p className="text-sm text-muted-foreground">管理应用配置和数据</p>
          </div>
        </div>
      </header>

      {/* 内容区域 */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6 pb-8">
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

          {/* 账户管理部分 */}
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-foreground">账户设置</h2>
            <span className="text-sm text-muted-foreground">· 修改登录信息</span>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10">
                  <User className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base">修改账户</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    当前用户名：{currentUsername}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 当前密码 */}
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" />
                  当前密码 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="请输入当前密码"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 新用户名 */}
              <div className="space-y-2">
                <Label htmlFor="new-username" className="text-sm flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  新用户名 <span className="text-muted-foreground text-xs">(可选)</span>
                </Label>
                <Input
                  id="new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="留空则不修改"
                />
              </div>

              {/* 新密码 */}
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" />
                  新密码 <span className="text-muted-foreground text-xs">(可选)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="留空则不修改"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 确认新密码 */}
              {newPassword && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    确认新密码 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                  />
                </div>
              )}

              <Button
                onClick={handleUpdateAccount}
                disabled={accountLoading}
                className="w-full gap-2"
              >
                {accountLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                保存修改
              </Button>
            </CardContent>
          </Card>

          {/* 登录背景图设置 */}
          <div className="flex items-center gap-2 pt-4">
            <h2 className="text-lg font-medium text-foreground">登录背景</h2>
            <span className="text-sm text-muted-foreground">· 自定义登录页面背景图</span>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10">
                  <Image className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">背景图片</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {hasCustomBg ? '已设置自定义背景' : '当前使用默认背景'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 预览区域 */}
              {bgPreviewUrl && (
                <div className="relative rounded-lg overflow-hidden border border-border/50">
                  <img
                    src={bgPreviewUrl}
                    alt="背景预览"
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className="absolute bottom-2 left-2 text-xs text-white/80">当前背景预览</span>
                </div>
              )}

              {/* 上传区域 */}
              <input
                ref={bgFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUploadBackground(file)
                }}
                className="hidden"
                disabled={bgLoading}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => bgFileRef.current?.click()}
                  disabled={bgLoading}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  {bgLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  上传背景图
                </Button>
                {hasCustomBg && (
                  <Button
                    onClick={handleDeleteBackground}
                    disabled={bgLoading}
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    恢复默认
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                支持 JPG、PNG、GIF、WebP 格式，建议使用 1920x1080 或更高分辨率的图片
              </p>
            </CardContent>
          </Card>

          {/* 数据备份部分 */}
          <div className="flex items-center gap-2 pt-4">
            <h2 className="text-lg font-medium text-foreground">数据备份</h2>
            <span className="text-sm text-muted-foreground">· 导入/导出</span>
          </div>

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
        </div>
      </ScrollArea>
    </div>
  )
}
