import { useState, useEffect } from 'react'
import {
  Loader2,
  Sparkles,
  Copy as CopyIcon,
  AlertTriangle,
  Image as ImageIcon,
  Play,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toolsApi, artistApi, type Artist } from '@/lib/api'

interface DuplicateGroup {
  name: string
  artists: Artist[]
}

export default function ToolsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  // Auto-complete states
  const [autoCompleteData, setAutoCompleteData] = useState({
    name_noob: '',
    name_nai: '',
    danbooru_link: '',
  })
  const [autoCompleteResult, setAutoCompleteResult] = useState<typeof autoCompleteData | null>(null)
  const [autoCompleteLoading, setAutoCompleteLoading] = useState(false)

  // Duplicate detection states
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)

  // Fetch post counts states
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchProgress, setFetchProgress] = useState(0)
  const [fetchResult, setFetchResult] = useState<{
    success: number
    failed: number
    message: string
  } | null>(null)

  // Image validation states
  const [missingImageIds, setMissingImageIds] = useState<number[]>([])
  const [imageValidationLoading, setImageValidationLoading] = useState(false)

  useEffect(() => {
    loadArtists()
  }, [])

  const loadArtists = async () => {
    setLoading(true)
    try {
      const res = await artistApi.getAll()
      if (res.success && res.data) {
        setArtists(res.data)
      }
    } catch (error) {
      console.error('Failed to load artists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoComplete = async () => {
    setAutoCompleteLoading(true)
    try {
      const res = await toolsApi.autoComplete(
        autoCompleteData.name_noob,
        autoCompleteData.name_nai,
        autoCompleteData.danbooru_link
      )
      if (res.success && res.data) {
        setAutoCompleteResult(res.data)
      } else {
        alert(res.error || '自动补全失败')
      }
    } catch (error) {
      console.error('Auto complete failed:', error)
      alert('自动补全失败')
    } finally {
      setAutoCompleteLoading(false)
    }
  }

  const handleFindDuplicates = async () => {
    setDuplicateLoading(true)
    try {
      const res = await toolsApi.findDuplicates()
      if (res.success && res.data) {
        // Group duplicates by name
        const groups: Record<string, Artist[]> = {}
        ;(res.data as unknown as Artist[]).forEach((artist) => {
          const key = artist.name_noob || artist.name_nai || ''
          if (!groups[key]) {
            groups[key] = []
          }
          groups[key].push(artist)
        })
        const duplicateGroups = Object.entries(groups)
          .filter(([_, artists]) => artists.length > 1)
          .map(([name, artists]) => ({ name, artists }))
        setDuplicates(duplicateGroups)
        setIsDuplicateDialogOpen(true)
      }
    } catch (error) {
      console.error('Find duplicates failed:', error)
      alert('查找重复失败')
    } finally {
      setDuplicateLoading(false)
    }
  }

  const handleFetchPostCounts = async () => {
    const artistsToFetch = artists.filter(
      (a) => !a.skip_danbooru && a.danbooru_link && !a.post_count
    )
    if (artistsToFetch.length === 0) {
      alert('没有需要获取的画师')
      return
    }

    setFetchLoading(true)
    setFetchProgress(0)
    setFetchResult(null)

    try {
      const artistIds = artistsToFetch.map((a) => a.id)
      const res = await toolsApi.fetchPostCounts(artistIds)

      if (res.success) {
        const details = (res as { details?: { success?: number; failed?: string[] } }).details
        setFetchResult({
          success: details?.success || 0,
          failed: details?.failed?.length || 0,
          message: res.message || '获取完成',
        })
        await loadArtists()
      } else {
        alert(res.error || '获取失败')
      }
    } catch (error) {
      console.error('Fetch post counts failed:', error)
      alert('获取作品数失败')
    } finally {
      setFetchLoading(false)
      setFetchProgress(100)
    }
  }

  const handleValidateImages = async () => {
    setImageValidationLoading(true)
    try {
      const res = await toolsApi.validateImages()
      if (res.success && res.data) {
        setMissingImageIds(res.data)
      }
    } catch (error) {
      console.error('Validate images failed:', error)
      alert('检查图片失败')
    } finally {
      setImageValidationLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const artistsWithoutPostCount = artists.filter(
    (a) => !a.skip_danbooru && a.danbooru_link && !a.post_count
  ).length

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">工具</h1>
          <p className="text-sm text-muted-foreground">画师名称补全、去重检测等实用工具</p>
        </div>
      </header>

      {/* 工具列表 */}
      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
          {/* 自动补全工具 */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>名称自动补全</CardTitle>
                  <CardDescription>
                    输入任意格式，自动补全其他格式
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ac_noob">NOOB 格式</Label>
                  <Input
                    id="ac_noob"
                    placeholder="artist \(circle\)"
                    value={autoCompleteData.name_noob}
                    onChange={(e) =>
                      setAutoCompleteData((prev) => ({
                        ...prev,
                        name_noob: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac_nai">NAI 格式</Label>
                  <Input
                    id="ac_nai"
                    placeholder="artist:name (circle)"
                    value={autoCompleteData.name_nai}
                    onChange={(e) =>
                      setAutoCompleteData((prev) => ({
                        ...prev,
                        name_nai: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac_link">Danbooru 链接</Label>
                  <Input
                    id="ac_link"
                    placeholder="https://danbooru.donmai.us/posts?tags=..."
                    value={autoCompleteData.danbooru_link}
                    onChange={(e) =>
                      setAutoCompleteData((prev) => ({
                        ...prev,
                        danbooru_link: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                onClick={handleAutoComplete}
                disabled={autoCompleteLoading}
                className="w-full gap-2"
              >
                {autoCompleteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                自动补全
              </Button>

              {/* 结果显示 */}
              {autoCompleteResult && (
                <div className="mt-4 p-3 rounded-lg bg-secondary/30 space-y-2">
                  <p className="text-sm font-medium">补全结果:</p>
                  <div className="space-y-1">
                    {autoCompleteResult.name_noob && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">NOOB:</span>
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-0.5 bg-background rounded text-xs">
                            {autoCompleteResult.name_noob}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              copyToClipboard(autoCompleteResult.name_noob)
                            }
                          >
                            <CopyIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {autoCompleteResult.name_nai && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">NAI:</span>
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-0.5 bg-background rounded text-xs">
                            {autoCompleteResult.name_nai}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              copyToClipboard(autoCompleteResult.name_nai)
                            }
                          >
                            <CopyIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {autoCompleteResult.danbooru_link && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">链接:</span>
                        <a
                          href={autoCompleteResult.danbooru_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs truncate max-w-[200px]"
                        >
                          {autoCompleteResult.danbooru_link}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 重复检测工具 */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <AlertTriangle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <CardTitle>重复检测</CardTitle>
                  <CardDescription>查找并处理重复的画师条目</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                检测数据库中名称相同的画师条目，帮助你清理重复数据。
              </p>
              <Button
                onClick={handleFindDuplicates}
                disabled={duplicateLoading || loading}
                variant="outline"
                className="w-full gap-2"
              >
                {duplicateLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                查找重复
              </Button>
            </CardContent>
          </Card>

          {/* 批量获取作品数 */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Play className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>批量获取作品数</CardTitle>
                  <CardDescription>
                    从 Danbooru 获取画师作品数量和示例图
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">待获取画师数</span>
                <Badge variant="secondary">{artistsWithoutPostCount}</Badge>
              </div>
              {fetchLoading && (
                <div className="space-y-2">
                  <Progress value={fetchProgress} />
                  <p className="text-xs text-muted-foreground text-center">
                    正在获取中...
                  </p>
                </div>
              )}
              {fetchResult && (
                <div className="p-3 rounded-lg bg-secondary/30 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>成功: {fetchResult.success}</span>
                  </div>
                  {fetchResult.failed > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span>失败: {fetchResult.failed}</span>
                    </div>
                  )}
                </div>
              )}
              <Button
                onClick={handleFetchPostCounts}
                disabled={fetchLoading || loading || artistsWithoutPostCount === 0}
                className="w-full gap-2"
              >
                {fetchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                开始获取
              </Button>
            </CardContent>
          </Card>

          {/* 图片验证工具 */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <ImageIcon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <CardTitle>示例图检查</CardTitle>
                  <CardDescription>检查缺失示例图的画师</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                找出没有示例图片的画师，方便批量补充。
              </p>
              {missingImageIds.length > 0 && (
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-sm">
                    发现{' '}
                    <span className="font-semibold text-primary">
                      {missingImageIds.length}
                    </span>{' '}
                    个画师缺失示例图
                  </p>
                </div>
              )}
              <Button
                onClick={handleValidateImages}
                disabled={imageValidationLoading || loading}
                variant="outline"
                className="w-full gap-2"
              >
                {imageValidationLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                检查图片
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* 重复画师对话框 */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>重复画师检测结果</DialogTitle>
            <DialogDescription>
              发现 {duplicates.length} 组重复的画师
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 py-4">
            {duplicates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>没有发现重复的画师</p>
              </div>
            ) : (
              <div className="space-y-4">
                {duplicates.map((group, index) => (
                  <Card key={index} className="bg-secondary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{group.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {group.artists.map((artist) => (
                          <div
                            key={artist.id}
                            className="flex items-center justify-between p-2 rounded bg-background/50"
                          >
                            <div>
                              <p className="text-sm font-medium">ID: {artist.id}</p>
                              <p className="text-xs text-muted-foreground">
                                {artist.categories
                                  ?.map((c) => c.name)
                                  .join(', ') || '无分类'}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {artist.post_count?.toLocaleString() || '-'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setIsDuplicateDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
