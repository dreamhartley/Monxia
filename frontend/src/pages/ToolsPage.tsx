import { Wrench } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArtistFormatConverter } from '@/components/tools/ArtistFormatConverter'

export default function ToolsPage() {
  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-border/50 bg-card/30 px-4 backdrop-blur-sm md:h-16 md:px-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground md:text-xl">工具</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">实用工具集合</p>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-5xl space-y-4 pb-10">
          <ArtistFormatConverter />

          <Card className="border-dashed bg-card/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-muted/60 p-2.5">
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">更多工具</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    更多实用工具即将推出，敬请期待
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent />
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
