import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  List,
  Copy,
  Users,
  AlertCircle,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { presetApi, artistApi, type Preset, type Artist } from '@/lib/api'

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [currentPreset, setCurrentPreset] = useState<Preset | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    artist_ids: [] as number[],
  })
  const [artistSearch, setArtistSearch] = useState('')

  // Artist map for quick lookup
  const artistMap = useMemo(() => {
    const map = new Map<number, Artist>()
    artists.forEach((artist) => map.set(artist.id, artist))
    return map
  }, [artists])

  // Filtered artists for selection
  const filteredArtists = useMemo(() => {
    if (!artistSearch) return artists
    const query = artistSearch.toLowerCase()
    return artists.filter(
      (artist) =>
        artist.name_noob?.toLowerCase().includes(query) ||
        artist.name_nai?.toLowerCase().includes(query)
    )
  }, [artists, artistSearch])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [presetsRes, artistsRes] = await Promise.all([
        presetApi.getAll(),
        artistApi.getAll(),
      ])
      if (presetsRes.success && presetsRes.data) {
        setPresets(presetsRes.data)
      }
      if (artistsRes.success && artistsRes.data) {
        setArtists(artistsRes.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', description: '', artist_ids: [] })
    setArtistSearch('')
  }

  const handleAddPreset = async () => {
    if (!formData.name.trim()) {
      alert('请输入画师串名称')
      return
    }
    if (formData.artist_ids.length === 0) {
      alert('请至少选择一个画师')
      return
    }

    setFormLoading(true)
    try {
      const res = await presetApi.create(
        formData.name,
        formData.description,
        formData.artist_ids
      )
      if (res.success) {
        await loadData()
        setIsAddDialogOpen(false)
        resetForm()
      } else {
        alert(res.error || '创建失败')
      }
    } catch (error) {
      console.error('Failed to create preset:', error)
      alert('创建失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeletePreset = async () => {
    if (!currentPreset) return

    setFormLoading(true)
    try {
      const res = await presetApi.delete(currentPreset.id)
      if (res.success) {
        await loadData()
        setIsDeleteDialogOpen(false)
        setCurrentPreset(null)
      } else {
        alert(res.error || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete preset:', error)
      alert('删除失败')
    } finally {
      setFormLoading(false)
    }
  }

  const getPresetArtists = (preset: Preset): Artist[] => {
    try {
      const ids = JSON.parse(preset.artist_ids) as number[]
      return ids.map((id) => artistMap.get(id)).filter(Boolean) as Artist[]
    } catch {
      return []
    }
  }

  const copyPresetToClipboard = (preset: Preset, format: 'noob' | 'nai') => {
    const presetArtists = getPresetArtists(preset)
    const text = presetArtists
      .map((artist) => (format === 'noob' ? artist.name_noob : artist.name_nai))
      .filter(Boolean)
      .join(', ')
    navigator.clipboard.writeText(text)
  }

  const toggleArtistSelection = (artistId: number) => {
    setFormData((prev) => ({
      ...prev,
      artist_ids: prev.artist_ids.includes(artistId)
        ? prev.artist_ids.filter((id) => id !== artistId)
        : [...prev.artist_ids, artistId],
    }))
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">画师串</h1>
          <p className="text-sm text-muted-foreground">管理常用的画师组合预设</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setIsAddDialogOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          创建画师串
        </Button>
      </header>

      {/* 画师串列表 */}
      <ScrollArea className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">暂无画师串</p>
            <p className="text-sm">创建画师串来快速复用常用的画师组合</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
            {presets.map((preset) => {
              const presetArtists = getPresetArtists(preset)
              return (
                <Card
                  key={preset.id}
                  className="group bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <List className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{preset.name}</CardTitle>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {presetArtists.length} 个画师
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setCurrentPreset(preset)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {preset.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {preset.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {presetArtists.slice(0, 3).map((artist) => (
                        <Badge
                          key={artist.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {artist.name_noob || artist.name_nai}
                        </Badge>
                      ))}
                      {presetArtists.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{presetArtists.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => copyPresetToClipboard(preset, 'noob')}
                      >
                        <Copy className="h-3 w-3" />
                        NOOB
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => copyPresetToClipboard(preset, 'nai')}
                      >
                        <Copy className="h-3 w-3" />
                        NAI
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCurrentPreset(preset)
                          setIsViewDialogOpen(true)
                        }}
                      >
                        查看
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* 创建画师串对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>创建画师串</DialogTitle>
            <DialogDescription>选择多个画师创建一个预设组合</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 py-4 overflow-hidden">
            <div className="space-y-2">
              <Label htmlFor="name">名称 *</Label>
              <Input
                id="name"
                placeholder="输入画师串名称"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                placeholder="添加描述..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <Label>选择画师 *</Label>
                <span className="text-sm text-muted-foreground">
                  已选择 {formData.artist_ids.length} 个
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索画师..."
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="flex-1 border rounded-md p-2 h-48">
                <div className="space-y-1">
                  {filteredArtists.map((artist) => (
                    <label
                      key={artist.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={formData.artist_ids.includes(artist.id)}
                        onCheckedChange={() => toggleArtistSelection(artist.id)}
                      />
                      <span className="text-sm truncate">
                        {artist.name_noob || artist.name_nai || '未命名'}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button onClick={handleAddPreset} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看画师串对话框 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentPreset?.name}</DialogTitle>
            <DialogDescription>{currentPreset?.description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">包含的画师</Label>
            <ScrollArea className="h-64 border rounded-md p-2">
              <div className="space-y-2">
                {currentPreset &&
                  getPresetArtists(currentPreset).map((artist) => (
                    <div
                      key={artist.id}
                      className="flex items-center justify-between p-2 rounded bg-secondary/30"
                    >
                      <span className="text-sm">
                        {artist.name_noob || artist.name_nai}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {artist.post_count?.toLocaleString() || '-'}
                      </Badge>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除画师串 "{currentPreset?.name}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setCurrentPreset(null)
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePreset}
              className="bg-destructive hover:bg-destructive/90"
            >
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
