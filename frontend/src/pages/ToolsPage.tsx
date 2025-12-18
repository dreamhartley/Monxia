import { Wrench } from 'lucide-react'

export default function ToolsPage() {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">工具</h1>
          <p className="text-sm text-muted-foreground">实用工具集合</p>
        </div>
      </header>

      {/* 开发中提示 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Wrench className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">功能开发中</h2>
            <p className="text-sm text-muted-foreground">
              更多实用工具即将推出，敬请期待
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
