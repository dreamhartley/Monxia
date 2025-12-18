import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Palette,
  Tags,
  List,
  Wrench,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface MainLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { icon: Palette, label: '画师管理', path: '/' },
  { icon: Tags, label: '分类管理', path: '/categories' },
  { icon: List, label: '画师串', path: '/presets' },
  { icon: Wrench, label: '工具', path: '/tools' },
  { icon: Settings, label: '设置', path: '/settings' },
]

export function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleNavigate = (path: string) => {
    navigate(path)
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  // 导航菜单内容（复用于桌面端侧边栏和移动端抽屉）
  const NavContent = ({ inSheet = false }: { inSheet?: boolean }) => (
    <>
      <nav className={cn('space-y-1', inSheet ? 'px-0' : 'px-2')}>
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
                !inSheet && collapsed && 'justify-center px-0'
              )}
              onClick={() => handleNavigate(item.path)}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              {(inSheet || !collapsed) && (
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

          if (!inSheet && collapsed) {
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{NavButton}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return <div key={item.path}>{NavButton}</div>
        })}
      </nav>
    </>
  )

  // 移动端布局
  if (isMobile) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20 overflow-hidden">
          {/* 移动端顶部栏 */}
          <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border/50 bg-card/80 backdrop-blur-xl">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Monxia
            </h1>

            {/* 占位保持居中 */}
            <div className="w-10" />
          </header>

          {/* 移动端导航抽屉 */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-64 p-0 bg-card/95 backdrop-blur-xl">
              <SheetHeader className="h-14 flex flex-row items-center justify-start px-4 border-b border-border/50">
                <SheetTitle className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Monxia
                </SheetTitle>
              </SheetHeader>

              <ScrollArea className="flex-1 py-4 px-2">
                <NavContent inSheet />
              </ScrollArea>

              <div className="border-t border-border/50 p-2">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full justify-start gap-3 h-11 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-5 w-5" />
                  <span>登出</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* 主内容区域 */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </main>
        </div>
      </TooltipProvider>
    )
  }

  // 桌面端布局
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
                Monxia
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
            <NavContent />
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
