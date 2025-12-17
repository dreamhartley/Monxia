import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, LogIn, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { backgroundApi } from '@/lib/api'

// 默认背景图路径（放置于 public 目录下）
const DEFAULT_BG_URL = '/default-bg.jpg'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [bgUrl, setBgUrl] = useState<string | null>(null)

  const { login } = useAuth()
  const navigate = useNavigate()

  // 获取背景图
  useEffect(() => {
    const fetchBackground = async () => {
      const res = await backgroundApi.getInfo()
      if (res.success && res.data?.has_custom && res.data.url) {
        setBgUrl(res.data.url)
      }
    }
    fetchBackground()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setIsLoading(true)

    try {
      const result = await login(username, password)
      if (result.success) {
        navigate('/')
      } else {
        setError(result.error || '登录失败')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* 背景层 - 始终显示背景图（自定义或默认） */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgUrl || DEFAULT_BG_URL})` }}
      />
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* 液态玻璃卡片 */}
      <div className="w-full max-w-md relative">
        {/* 外层光晕效果 */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-white/5 blur-[0.5px]" />

        {/* 主卡片容器 */}
        <Card className="relative bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* 内部高光效果 */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/5 via-transparent to-white/10 pointer-events-none" />

          <CardHeader className="space-y-4 text-center pb-2 relative">
            {/* 标题 */}
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent drop-shadow-sm">
              梦匣
            </CardTitle>
            <CardDescription className="text-foreground/70">
              探索造梦的世界
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 relative">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 错误提示 */}
              {error && (
                <div className="p-3 rounded-xl bg-destructive/15 backdrop-blur-sm border border-destructive/25 text-destructive text-sm text-center animate-in fade-in slide-in-from-top-1 duration-200">
                  {error}
                </div>
              )}

              {/* 用户名输入 */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground/90">
                  用户名
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/20 dark:border-white/10 focus-visible:border-white/40 focus-visible:bg-white/15 transition-all rounded-xl placeholder:text-foreground/40"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/90">
                  密码
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/20 dark:border-white/10 focus-visible:border-white/40 focus-visible:bg-white/15 transition-all rounded-xl placeholder:text-foreground/40"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* 登录按钮 */}
              <Button
                type="submit"
                className="w-full bg-white/20 hover:bg-white/30 dark:bg-white/15 dark:hover:bg-white/25 backdrop-blur-sm text-foreground border border-white/25 gap-2 h-11 text-base font-medium shadow-lg shadow-black/10 transition-all hover:shadow-xl hover:border-white/35 rounded-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    登录
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 页脚 */}
      <div className="absolute bottom-4 text-center text-xs text-muted-foreground">
        梦匣 Monxia - 画师 Tag 管理工具
      </div>
    </div>
  )
}
