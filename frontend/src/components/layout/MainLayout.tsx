import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Palette,
  Tags,
  List,
  Wrench,
  FileUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'

interface MainLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { icon: Palette, label: '画师管理', path: '/' },
  { icon: Tags, label: '分类管理', path: '/categories' },
  { icon: List, label: '画师串', path: '/presets' },
  { icon: Wrench, label: '工具', path: '/tools' },
  { icon: FileUp, label: '导入/导出', path: '/import-export' },
]

export function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-screen flex bg-gradient-to-br from-background via-background to-secondary/20 overflow-hidden">
        {/* 左侧边栏 */}
        <aside
          className={cn(
            'flex flex-col bg-card/80 backdrop-blur-xl border-r border-border/50 transition-all duration-300 ease-in-out',
            collapsed ? 'w-16' : 'w-64'
          )}
        >
          {/* Logo区域 */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border/50">
            {!collapsed && (
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
                梦匣 Monxia
              </h1>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'h-8 w-8 hover:bg-secondary/80',
                collapsed && 'mx-auto'
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 导航菜单 */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                const NavButton = (
                  <Button
                    key={item.path}
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 h-11 transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20'
                        : 'hover:bg-secondary/80',
                      collapsed && 'justify-center px-0'
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    {!collapsed && (
                      <span
                        className={cn(
                          'truncate',
                          isActive ? 'font-medium' : ''
                        )}
                      >
                        {item.label}
                      </span>
                    )}
                  </Button>
                )

                if (collapsed) {
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{NavButton}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return NavButton
              })}
            </nav>
          </ScrollArea>

          {/* 底部用户区域 */}
          <div className="border-t border-border/50 p-2">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="w-full h-9 mt-1 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">登出</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start gap-3 mt-1 h-9 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>登出</span>
              </Button>
            )}
          </div>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </TooltipProvider>
  )
}
