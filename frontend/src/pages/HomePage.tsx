import { LogOut, Palette, Tags, Wrench, FileUp, List, Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const { username, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const features = [
    {
      icon: Palette,
      title: '画师管理',
      description: '添加、编辑和管理你的画师收藏',
      color: 'text-primary',
    },
    {
      icon: Tags,
      title: '分类管理',
      description: '为画师创建和组织分类标签',
      color: 'text-accent',
    },
    {
      icon: List,
      title: '画师串',
      description: '创建常用的画师组合预设',
      color: 'text-primary',
    },
    {
      icon: Wrench,
      title: '工具',
      description: '自动补全、去重检测等实用工具',
      color: 'text-accent',
    },
    {
      icon: FileUp,
      title: '导入/导出',
      description: '支持 JSON 和 Excel 格式',
      color: 'text-primary',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* 头部导航 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            梦匣 Monxia
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              欢迎, <span className="text-foreground font-medium">{username}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              登出
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* 欢迎区域 */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
            二次元画师 Tag 整理
          </h2>
          <p className="text-muted-foreground text-lg">
            整理和管理你的画师标签库，让创作灵感井然有序
          </p>
        </div>

        {/* 功能预览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-secondary/50 ${feature.color}`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 占位符提示 */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 border-dashed">
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/50 mb-4">
              <Construction className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              功能开发中
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              主界面功能正在开发中，敬请期待...
              <br />
              登录功能已完成，你可以正常使用登录/登出功能。
            </p>
          </CardContent>
        </Card>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          梦匣 Monxia - 二次元画师 Tag 整理工具
        </div>
      </footer>
    </div>
  )
}
