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
  Key,
  Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  importExportApi,
  accountApi,
  backgroundApi,
  danbooruConfigApi,
  gelbooruConfigApi,
  dataSourceApi,
} from '@/lib/api'
import type { ImportProgress, DataSource, DataSourceSettings } from '@/lib/api'

export default function SettingsPage() {
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
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

  // Danbooru API 配置状态
  const [danbooruLoading, setDanbooruLoading] = useState(false)
  const [danbooruUsername, setDanbooruUsername] = useState('')
  const [danbooruApiKey, setDanbooruApiKey] = useState('')
  const [danbooruMaskedKey, setDanbooruMaskedKey] = useState('')
  const [hasDanbooruConfig, setHasDanbooruConfig] = useState(false)
  const [showDanbooruApiKey, setShowDanbooruApiKey] = useState(false)

  // 数据来源与 Gelbooru API 配置状态
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceInfo, setSourceInfo] = useState<DataSourceSettings | null>(null)
  const [gelbooruLoading, setGelbooruLoading] = useState(false)
  const [gelbooruTesting, setGelbooruTesting] = useState(false)
  const [gelbooruUserId, setGelbooruUserId] = useState('')
  const [gelbooruApiKey, setGelbooruApiKey] = useState('')
  const [gelbooruMaskedKey, setGelbooruMaskedKey] = useState('')
  const [hasGelbooruConfig, setHasGelbooruConfig] = useState(false)
  const [showGelbooruApiKey, setShowGelbooruApiKey] = useState(false)

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

  // 获取 Danbooru API 配置
  useEffect(() => {
    const fetchDanbooruConfig = async () => {
      const res = await danbooruConfigApi.get()
      if (res.success && res.data) {
        setDanbooruUsername(res.data.username)
        setDanbooruMaskedKey(res.data.api_key_masked)
        setHasDanbooruConfig(res.data.has_config)
      }
    }
    fetchDanbooruConfig()
  }, [])

  // 获取数据来源与 Gelbooru API 配置
  useEffect(() => {
    const fetchSourceInfo = async () => {
      const res = await dataSourceApi.get()
      if (res.success && res.data) {
        setSourceInfo(res.data)
      }
    }
    const fetchGelbooruConfig = async () => {
      const res = await gelbooruConfigApi.get()
      if (res.success && res.data) {
        setGelbooruUserId(res.data.user_id)
        setGelbooruMaskedKey(res.data.api_key_masked)
        setHasGelbooruConfig(res.data.has_config)
      }
    }
    fetchSourceInfo()
    fetchGelbooruConfig()
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
    setImportProgress(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // 使用流式导入（并发优化版本）
      await importExportApi.importJsonStream(data, (progress) => {
        setImportProgress(progress)

        if (progress.type === 'complete') {
          setMessage({ type: 'success', text: progress.message || 'JSON 导入成功' })
        } else if (progress.type === 'error') {
          setMessage({ type: 'error', text: progress.error || '导入失败' })
        }
      })
    } catch (error) {
      console.error('Import JSON failed:', error)
      setMessage({ type: 'error', text: '导入失败，请检查文件格式' })
    } finally {
      setImportLoading(false)
      setImportProgress(null)
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

  // 处理 Danbooru 配置更新
  const handleUpdateDanbooruConfig = async () => {
    if (!danbooruUsername.trim() && !danbooruApiKey.trim()) {
      setMessage({ type: 'error', text: '请输入用户名和 API Key' })
      return
    }

    setDanbooruLoading(true)
    setMessage(null)
    try {
      const res = await danbooruConfigApi.update({
        username: danbooruUsername,
        api_key: danbooruApiKey,
      })
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Danbooru API 配置已保存' })
        setHasDanbooruConfig(true)
        // 清空 API Key 输入框，重新获取 masked key
        setDanbooruApiKey('')
        const configRes = await danbooruConfigApi.get()
        if (configRes.success && configRes.data) {
          setDanbooruMaskedKey(configRes.data.api_key_masked)
        }
      } else {
        setMessage({ type: 'error', text: res.error || '保存失败' })
      }
    } catch (error) {
      console.error('Update Danbooru config failed:', error)
      setMessage({ type: 'error', text: '保存失败' })
    } finally {
      setDanbooruLoading(false)
    }
  }

  // 处理清除 Danbooru 配置
  const handleClearDanbooruConfig = async () => {
    setDanbooruLoading(true)
    setMessage(null)
    try {
      const res = await danbooruConfigApi.clear()
      if (res.success) {
        setDanbooruUsername('')
        setDanbooruApiKey('')
        setDanbooruMaskedKey('')
        setHasDanbooruConfig(false)
        setMessage({ type: 'success', text: res.message || 'Danbooru API 配置已清除' })
      } else {
        setMessage({ type: 'error', text: res.error || '清除失败' })
      }
    } catch (error) {
      console.error('Clear Danbooru config failed:', error)
      setMessage({ type: 'error', text: '清除失败' })
    } finally {
      setDanbooruLoading(false)
    }
  }

  // 切换数据来源（不会触发重新抓取）
  const handleSelectSource = async (source: DataSource) => {
    if (sourceLoading || sourceInfo?.source === source) return

    setSourceLoading(true)
    setMessage(null)
    try {
      const res = await dataSourceApi.update(source)
      if (res.success && res.data) {
        setSourceInfo(res.data)
        if (res.data.warning) {
          setMessage({ type: 'error', text: res.data.warning })
        } else {
          setMessage({
            type: 'success',
            text: `已切换到 ${source === 'gelbooru' ? 'Gelbooru' : 'Danbooru'} 数据源，之后抓取将使用该站点`,
          })
        }
      } else {
        setMessage({ type: 'error', text: res.error || '切换失败' })
      }
    } catch (error) {
      console.error('Update data source failed:', error)
      setMessage({ type: 'error', text: '切换失败' })
    } finally {
      setSourceLoading(false)
    }
  }

  // 处理 Gelbooru 配置更新
  const handleUpdateGelbooruConfig = async () => {
    if (!gelbooruUserId.trim() || !gelbooruApiKey.trim()) {
      setMessage({ type: 'error', text: '请填写 Gelbooru 的 User ID 与 API Key' })
      return
    }

    setGelbooruLoading(true)
    setMessage(null)
    try {
      const res = await gelbooruConfigApi.update({
        user_id: gelbooruUserId.trim(),
        api_key: gelbooruApiKey.trim(),
      })
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'Gelbooru API 配置已保存' })
        setHasGelbooruConfig(true)
        setGelbooruApiKey('')
        const [configRes, sourceRes] = await Promise.all([
          gelbooruConfigApi.get(),
          dataSourceApi.get(),
        ])
        if (configRes.success && configRes.data) {
          setGelbooruMaskedKey(configRes.data.api_key_masked)
        }
        if (sourceRes.success && sourceRes.data) {
          setSourceInfo(sourceRes.data)
        }
      } else {
        setMessage({ type: 'error', text: res.error || '保存失败' })
      }
    } catch (error) {
      console.error('Update Gelbooru config failed:', error)
      setMessage({ type: 'error', text: '保存失败' })
    } finally {
      setGelbooruLoading(false)
    }
  }

  // 处理清除 Gelbooru 配置
  const handleClearGelbooruConfig = async () => {
    setGelbooruLoading(true)
    setMessage(null)
    try {
      const res = await gelbooruConfigApi.clear()
      if (res.success) {
        setGelbooruUserId('')
        setGelbooruApiKey('')
        setGelbooruMaskedKey('')
        setHasGelbooruConfig(false)
        setMessage({ type: 'success', text: res.message || 'Gelbooru API 配置已清除' })
        const sourceRes = await dataSourceApi.get()
        if (sourceRes.success && sourceRes.data) {
          setSourceInfo(sourceRes.data)
        }
      } else {
        setMessage({ type: 'error', text: res.error || '清除失败' })
      }
    } catch (error) {
      console.error('Clear Gelbooru config failed:', error)
      setMessage({ type: 'error', text: '清除失败' })
    } finally {
      setGelbooruLoading(false)
    }
  }

  // 测试 Gelbooru 凭据是否可用
  const handleTestGelbooru = async () => {
    setGelbooruTesting(true)
    setMessage(null)
    try {
      const res = await gelbooruConfigApi.test()
      if (res.success && res.data) {
        const count = res.data.sample_count
        setMessage({
          type: res.data.ok ? 'success' : 'error',
          text: res.data.ok
            ? `连接成功：测试标签 ${res.data.sample_tag || ''} 共 ${count ?? '?'} 个作品`
            : res.data.message || '连接失败',
        })
      } else {
        setMessage({ type: 'error', text: res.error || '连接失败' })
      }
    } catch (error) {
      console.error('Test Gelbooru config failed:', error)
      setMessage({ type: 'error', text: '连接失败' })
    } finally {
      setGelbooruTesting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-14 md:h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-4 md:px-6 flex items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-foreground">设置</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">管理应用配置和数据</p>
          </div>
        </div>
      </header>

      {/* 内容区域 */}
      <ScrollArea className="flex-1 p-4 md:p-6">
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

          {/* 数据来源 */}
          <div className="flex items-center gap-2 pt-4">
            <h2 className="text-lg font-medium text-foreground">数据来源</h2>
            <span className="text-sm text-muted-foreground">· 抓取作品数据时使用的站点</span>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10">
                  <Database className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-base">抓取来源</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    切换后立即生效，不会自动重新抓取已有数据
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  {
                    key: 'danbooru' as DataSource,
                    title: 'Danbooru',
                    desc: hasDanbooruConfig ? '已配置 API Key' : '匿名访问（可选配置 API Key）',
                  },
                  {
                    key: 'gelbooru' as DataSource,
                    title: 'Gelbooru',
                    desc: hasGelbooruConfig ? '已配置 API 凭据' : '需要 User ID + API Key',
                  },
                ]).map((option) => {
                  const active = (sourceInfo?.source || 'danbooru') === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleSelectSource(option.key)}
                      disabled={sourceLoading}
                      className={`text-left rounded-lg border p-3 transition-colors disabled:opacity-60 ${
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-border/60 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.title}</span>
                        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                    </button>
                  )
                })}
              </div>
              {sourceInfo && !sourceInfo.ready && (
                <p className="text-xs text-destructive">
                  当前来源还缺少 API 凭据，抓取会失败，请在下方填写对应站点的凭据。
                </p>
              )}
            </CardContent>
          </Card>

          {/* Danbooru API 配置 */}
          <div className="flex items-center gap-2 pt-4">
            <h2 className="text-lg font-medium text-foreground">Danbooru API</h2>
            <span className="text-sm text-muted-foreground">· 配置 API 认证（可选）</span>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10">
                  <Key className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-base">API 认证</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {hasDanbooruConfig ? '已配置 API Key' : '未配置（使用匿名访问）'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 用户名 */}
              <div className="space-y-2">
                <Label htmlFor="danbooru-username" className="text-sm flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  Danbooru 用户名
                </Label>
                <Input
                  id="danbooru-username"
                  type="text"
                  value={danbooruUsername}
                  onChange={(e) => setDanbooruUsername(e.target.value)}
                  placeholder="输入 Danbooru 用户名"
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="danbooru-apikey" className="text-sm flex items-center gap-2">
                  <Key className="h-3.5 w-3.5" />
                  API Key
                  {danbooruMaskedKey && (
                    <span className="text-muted-foreground font-mono text-xs">
                      (当前: {danbooruMaskedKey})
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="danbooru-apikey"
                    type={showDanbooruApiKey ? 'text' : 'password'}
                    value={danbooruApiKey}
                    onChange={(e) => setDanbooruApiKey(e.target.value)}
                    placeholder={hasDanbooruConfig ? '输入新的 API Key（留空保持不变）' : '输入 API Key'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDanbooruApiKey(!showDanbooruApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showDanbooruApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  在 Danbooru 个人资料页面生成 API Key：Profile → API Key
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateDanbooruConfig}
                  disabled={danbooruLoading}
                  className="flex-1 gap-2"
                >
                  {danbooruLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  保存配置
                </Button>
                {hasDanbooruConfig && (
                  <Button
                    onClick={handleClearDanbooruConfig}
                    disabled={danbooruLoading}
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    清除
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gelbooru API 配置 */}
          <div className="flex items-center gap-2 pt-4">
            <h2 className="text-lg font-medium text-foreground">Gelbooru API</h2>
            <span className="text-sm text-muted-foreground">· 使用 Gelbooru 作为数据来源时必填</span>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-pink-500/10">
                  <Key className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <CardTitle className="text-base">API 认证</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {hasGelbooruConfig ? '已配置 User ID 与 API Key' : '未配置（Gelbooru 抓取必须配置）'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* User ID */}
              <div className="space-y-2">
                <Label htmlFor="gelbooru-userid" className="text-sm flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  User ID
                </Label>
                <Input
                  id="gelbooru-userid"
                  type="text"
                  value={gelbooruUserId}
                  onChange={(e) => setGelbooruUserId(e.target.value)}
                  placeholder="输入 Gelbooru 用户 ID"
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="gelbooru-apikey" className="text-sm flex items-center gap-2">
                  <Key className="h-3.5 w-3.5" />
                  API Key
                  {gelbooruMaskedKey && (
                    <span className="text-muted-foreground font-mono text-xs">
                      (当前: {gelbooruMaskedKey})
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="gelbooru-apikey"
                    type={showGelbooruApiKey ? 'text' : 'password'}
                    value={gelbooruApiKey}
                    onChange={(e) => setGelbooruApiKey(e.target.value)}
                    placeholder={hasGelbooruConfig ? '输入新的 API Key（留空保持不变）' : '输入 API Key'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGelbooruApiKey(!showGelbooruApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGelbooruApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  在 Gelbooru 账号设置页生成：Account → Options → API Access Credentials
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleUpdateGelbooruConfig}
                  disabled={gelbooruLoading}
                  className="flex-1 gap-2 min-w-[140px]"
                >
                  {gelbooruLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  保存配置
                </Button>
                {hasGelbooruConfig && (
                  <Button
                    onClick={handleTestGelbooru}
                    disabled={gelbooruTesting}
                    variant="secondary"
                    className="gap-2"
                  >
                    {gelbooruTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    测试连接
                  </Button>
                )}
                {hasGelbooruConfig && (
                  <Button
                    onClick={handleClearGelbooruConfig}
                    disabled={gelbooruLoading}
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    清除
                  </Button>
                )}
              </div>
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
                      {importProgress ? (
                        <div className="w-full space-y-1">
                          <span className="text-sm text-muted-foreground">
                            {importProgress.phase === 'categories' && '处理分类中...'}
                            {importProgress.phase === 'dedup_load' && '加载数据中...'}
                            {importProgress.phase === 'process' && '处理画师数据...'}
                            {importProgress.phase === 'database' && (
                              importProgress.action === 'create' ? '创建画师...' : '更新画师...'
                            )}
                          </span>
                          {importProgress.current !== undefined && importProgress.total !== undefined && importProgress.total > 0 && (
                            <>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {importProgress.current} / {importProgress.total}
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">正在导入...</span>
                      )}
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
