import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Filter,
  Sparkles,
  AlertCircle,
  LayoutGrid,
  List,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  artistApi,
  categoryApi,
  toolsApi,
  type Artist,
  type Category,
  type CreateArtistData,
} from '@/lib/api'

const API_BASE = '/api'

type ViewMode = 'grid' | 'list'

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentArtist, setCurrentArtist] = useState<Artist | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Form states
  const [formData, setFormData] = useState<CreateArtistData & { notes?: string }>({
    category_ids: [],
    name_noob: '',
    name_nai: '',
    danbooru_link: '',
    notes: '',
    skip_danbooru: false,
  })

  // Filtered artists
  const filteredArtists = useMemo(() => {
    return artists.filter((artist) => {
      const matchesSearch =
        searchQuery === '' ||
        artist.name_noob?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artist.name_nai?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artist.notes?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory =
        selectedCategory === 'all' ||
        artist.categories?.some((c) => c.id.toString() === selectedCategory)

      return matchesSearch && matchesCategory
    })
  }, [artists, searchQuery, selectedCategory])

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [artistsRes, categoriesRes] = await Promise.all([
        artistApi.getAll(),
        categoryApi.getAll(),
      ])
      if (artistsRes.success && artistsRes.data) {
        setArtists(artistsRes.data)
      }
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      category_ids: [],
      name_noob: '',
      name_nai: '',
      danbooru_link: '',
      notes: '',
      skip_danbooru: false,
    })
  }

  const handleAutoComplete = async () => {
    setFormLoading(true)
    try {
      // 1. 补全名称和链接
      const res = await toolsApi.autoComplete(
        formData.name_noob || '',
        formData.name_nai || '',
        formData.danbooru_link || ''
      )
      
      let newFormData = { ...formData }

      if (res.success && res.data) {
        newFormData = {
          ...newFormData,
          name_noob: res.data!.name_noob,
          name_nai: res.data!.name_nai,
          danbooru_link: res.data!.danbooru_link,
        }
        setFormData(newFormData)
      }

      // 2. 如果有链接且不跳过Danbooru检测，尝试获取作品数量和示例图片
      if (newFormData.danbooru_link && !newFormData.skip_danbooru) {
        // 如果是编辑模式，使用当前画师ID
        // 如果是添加模式，需要先临时创建画师记录（因为后端接口需要artist_id）
        let targetArtistId = currentArtist?.id

        if (!targetArtistId) {
          // 添加模式：先保存基本信息
           if (newFormData.category_ids.length === 0) {
             alert('请先选择分类以便进行自动数据获取')
             setFormLoading(false)
             return
           }
           const createRes = await artistApi.create(newFormData)
           if (createRes.success && createRes.data) {
             targetArtistId = createRes.data.id
             // 更新为编辑模式，防止重复创建
             setCurrentArtist(createRes.data)
             setIsAddDialogOpen(false)
             setIsEditDialogOpen(true)
             // 刷新列表以显示新添加的画师
             await loadData()
           } else {
             console.error('Failed to create temp artist:', createRes.error)
             // 如果创建失败，仅保留名称补全结果
             setFormLoading(false)
             return
           }
        }

        if (targetArtistId) {
            const countRes = await toolsApi.fetchPostCounts([targetArtistId])
            if (countRes.success && countRes.data && countRes.data[targetArtistId]) {
                // 重新获取画师最新信息（包含可能更新的图片）
                const updatedArtistRes = await artistApi.getById(targetArtistId)
                if (updatedArtistRes.success && updatedArtistRes.data) {
                    // 更新当前编辑的画师信息
                    setCurrentArtist(updatedArtistRes.data)
                    // 刷新列表
                    await loadData()
                    alert('自动补全完成！')
                }
            } else {
                alert('获取作品数据失败: ' + (countRes.error || '未知错误'))
            }
        }
      } else {
          alert('名称补全成功')
      }
    } catch (error) {
      console.error('Auto complete failed:', error)
      alert('自动补全失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleAddArtist = async () => {
    if (formData.category_ids.length === 0) {
      alert('请至少选择一个分类')
      return
    }
    if (!formData.name_noob && !formData.name_nai) {
      alert('请至少填写一个画师名称')
      return
    }

    setFormLoading(true)
    try {
      const res = await artistApi.create(formData)
      if (res.success) {
        await loadData()
        setIsAddDialogOpen(false)
        resetForm()
      } else {
        alert(res.error || '创建失败')
      }
    } catch (error) {
      console.error('Failed to create artist:', error)
      alert('创建失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditArtist = async () => {
    if (!currentArtist) return

    setFormLoading(true)
    try {
      const res = await artistApi.update(currentArtist.id, formData)
      if (res.success) {
        await loadData()
        setIsEditDialogOpen(false)
        setCurrentArtist(null)
        resetForm()
      } else {
        alert(res.error || '更新失败')
      }
    } catch (error) {
      console.error('Failed to update artist:', error)
      alert('更新失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteArtist = async () => {
    if (!currentArtist) return

    setFormLoading(true)
    try {
      const res = await artistApi.delete(currentArtist.id)
      if (res.success) {
        await loadData()
        setIsDeleteDialogOpen(false)
        setCurrentArtist(null)
      } else {
        alert(res.error || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete artist:', error)
      alert('删除失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleUploadImage = async (file: File, artistId: number) => {
    setFormLoading(true)
    try {
      const res = await artistApi.uploadImage(artistId, file)
      if (res.success) {
        await loadData()
      } else {
        alert(res.error || '上传失败')
      }
    } catch (error) {
      console.error('Failed to upload image:', error)
      alert('上传失败')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditDialog = (artist: Artist) => {
    setCurrentArtist(artist)
    setFormData({
      category_ids: artist.categories?.map((c) => c.id) || [],
      name_noob: artist.name_noob || '',
      name_nai: artist.name_nai || '',
      danbooru_link: artist.danbooru_link || '',
      notes: artist.notes || '',
      skip_danbooru: artist.skip_danbooru || false,
    })
    setIsEditDialogOpen(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const toggleCategorySelection = (categoryId: number) => {
    setFormData((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId],
    }))
  }

  // 渲染网格视图卡片
  const renderGridCard = (artist: Artist) => (
    <Card
      key={artist.id}
      className="group bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden"
    >
      {/* 图片区域 */}
      <div className="aspect-video bg-secondary/30 relative overflow-hidden">
        {artist.image_example ? (
          <img
            src={`${API_BASE.replace('/api', '')}/images/${artist.image_example}`}
            alt={artist.name_noob || artist.name_nai}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        {/* 操作菜单 */}
        {renderDropdownMenu(artist)}
      </div>

      {/* 隐藏的文件输入框 */}
      <input
        type="file"
        id={`file-input-${artist.id}`}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleUploadImage(file, artist.id)
          }
          // 清空input，允许重复上传同一文件
          e.target.value = ''
        }}
      />

      {/* 信息区域 */}
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground truncate mb-1">
          {artist.name_noob || artist.name_nai || '未命名'}
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {artist.categories?.map((cat) => (
            <Badge key={cat.id} variant="secondary" className="text-xs">
              {cat.name}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>作品数</span>
          <span className="font-medium text-primary">
            {artist.post_count?.toLocaleString() || '-'}
          </span>
        </div>
        {artist.notes && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {artist.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )

  // 渲染列表视图卡片
  const renderListCard = (artist: Artist) => (
    <Card
      key={artist.id}
      className="group bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
    >
      <CardContent className="p-3 flex items-center gap-4">
        {/* 缩略图 */}
        <div className="w-16 h-16 shrink-0 rounded-lg bg-secondary/30 overflow-hidden">
          {artist.image_example ? (
            <img
              src={`${API_BASE.replace('/api', '')}/images/${artist.image_example}`}
              alt={artist.name_noob || artist.name_nai}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {artist.name_noob || artist.name_nai || '未命名'}
          </h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {artist.categories?.slice(0, 3).map((cat) => (
              <Badge key={cat.id} variant="secondary" className="text-xs">
                {cat.name}
              </Badge>
            ))}
            {artist.categories && artist.categories.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{artist.categories.length - 3}
              </Badge>
            )}
          </div>
          {artist.notes && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {artist.notes}
            </p>
          )}
        </div>

        {/* 作品数 */}
        <div className="text-right shrink-0">
          <p className="text-sm text-muted-foreground">作品数</p>
          <p className="font-semibold text-primary">
            {artist.post_count?.toLocaleString() || '-'}
          </p>
        </div>

        {/* 操作菜单 */}
        <div className="shrink-0">
          {renderDropdownMenu(artist, true)}
        </div>
        {/* 隐藏的文件输入框 */}
        <input
          type="file"
          id={`file-input-${artist.id}`}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              handleUploadImage(file, artist.id)
            }
            // 清空input，允许重复上传同一文件
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )

  // 渲染下拉菜单
  const renderDropdownMenu = (artist: Artist, isListView = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={
            isListView
              ? 'h-8 w-8 bg-secondary/50'
              : 'absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm'
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openEditDialog(artist)}>
          <Edit className="h-4 w-4 mr-2" />
          编辑
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const input = document.getElementById(
              `file-input-${artist.id}`
            ) as HTMLInputElement
            input?.click()
          }}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          上传图片
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {artist.name_noob && (
          <DropdownMenuItem onClick={() => copyToClipboard(artist.name_noob)}>
            <Copy className="h-4 w-4 mr-2" />
            复制 NOOB 格式
          </DropdownMenuItem>
        )}
        {artist.name_nai && (
          <DropdownMenuItem onClick={() => copyToClipboard(artist.name_nai)}>
            <Copy className="h-4 w-4 mr-2" />
            复制 NAI 格式
          </DropdownMenuItem>
        )}
        {artist.danbooru_link && (
          <DropdownMenuItem
            onClick={() => window.open(artist.danbooru_link, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            打开 Danbooru
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentArtist(artist)
            setIsDeleteDialogOpen(true)
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">画师管理</h1>
          <p className="text-sm text-muted-foreground">管理你的画师收藏库</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          添加画师
        </Button>
      </header>

      {/* 筛选栏 */}
      <div className="shrink-0 px-6 py-4 flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索画师..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card/50 border-border/50"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40 bg-card/50 border-border/50">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="筛选分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 视图切换 */}
        <div className="flex border rounded-md bg-card/50 border-border/50">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          刷新
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            if (!confirm('确定要对所有画师进行自动数据补全吗？这可能需要一些时间。')) return
            setLoading(true)
            try {
              const res = await toolsApi.autoCompleteAll()
              if (res.success) {
                alert(res.message)
                loadData()
              } else {
                alert(res.error || '补全失败')
              }
            } catch (error) {
              console.error('Auto complete all failed:', error)
              alert('补全失败')
            } finally {
              setLoading(false)
            }
          }}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          一键自动补全
        </Button>
      </div>

      {/* 画师列表 */}
      <ScrollArea className="flex-1 px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredArtists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">未找到画师</p>
            <p className="text-sm">尝试调整搜索条件或添加新画师</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredArtists.map(renderGridCard)}
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl">
            {filteredArtists.map(renderListCard)}
          </div>
        )}
      </ScrollArea>

      {/* 添加画师对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>添加画师</DialogTitle>
            <DialogDescription>
              添加新画师到你的收藏库，至少填写一个名称格式
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 分类选择 */}
            <div className="space-y-2">
              <Label>分类 *</Label>
              <div className="border border-input rounded-md p-3 space-y-3">
                {/* 已选分类标签 */}
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {formData.category_ids.length > 0 ? (
                    formData.category_ids.map((id) => {
                      const cat = categories.find((c) => c.id === id)
                      if (!cat) return null
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="pl-2 pr-1 py-1 flex items-center gap-1"
                        >
                          {cat.name}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 hover:bg-transparent text-muted-foreground hover:text-foreground rounded-full"
                            onClick={() => toggleCategorySelection(id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground flex items-center">
                      尚未选择分类
                    </span>
                  )}
                </div>

                {/* 分类选择下拉框 */}
                <Select
                  value=""
                  onValueChange={(value) => {
                    const id = parseInt(value)
                    if (!formData.category_ids.includes(id)) {
                      toggleCategorySelection(id)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择分类添加..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((cat) => !formData.category_ids.includes(cat.id))
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 名称输入 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name_noob">NOOB 格式</Label>
                <Input
                  id="name_noob"
                  placeholder="artist \(circle\)"
                  value={formData.name_noob}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name_noob: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_nai">NAI 格式</Label>
                <Input
                  id="name_nai"
                  placeholder="artist:name (circle)"
                  value={formData.name_nai}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name_nai: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Danbooru 链接 */}
            <div className="space-y-2">
              <Label htmlFor="danbooru_link">Danbooru 链接</Label>
              <Input
                id="danbooru_link"
                placeholder="https://danbooru.donmai.us/posts?tags=..."
                value={formData.danbooru_link}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    danbooru_link: e.target.value,
                  }))
                }
              />
            </div>

            {/* 备注 */}
            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                placeholder="添加备注..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
              />
            </div>

            {/* 跳过Danbooru */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={formData.skip_danbooru}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    skip_danbooru: checked as boolean,
                  }))
                }
              />
              <span className="text-sm">跳过 Danbooru 获取</span>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAutoComplete}
              disabled={formLoading}
              className="gap-2 mr-auto"
            >
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              自动补全
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button onClick={handleAddArtist} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑画师对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑画师</DialogTitle>
            <DialogDescription>修改画师信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 分类选择 */}
            <div className="space-y-2">
              <Label>分类 *</Label>
              <div className="border border-input rounded-md p-3 space-y-3">
                {/* 已选分类标签 */}
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {formData.category_ids.length > 0 ? (
                    formData.category_ids.map((id) => {
                      const cat = categories.find((c) => c.id === id)
                      if (!cat) return null
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="pl-2 pr-1 py-1 flex items-center gap-1"
                        >
                          {cat.name}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 hover:bg-transparent text-muted-foreground hover:text-foreground rounded-full"
                            onClick={() => toggleCategorySelection(id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground flex items-center">
                      尚未选择分类
                    </span>
                  )}
                </div>

                {/* 分类选择下拉框 */}
                <Select
                  value=""
                  onValueChange={(value) => {
                    const id = parseInt(value)
                    if (!formData.category_ids.includes(id)) {
                      toggleCategorySelection(id)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择分类添加..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((cat) => !formData.category_ids.includes(cat.id))
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 名称输入 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_name_noob">NOOB 格式</Label>
                <Input
                  id="edit_name_noob"
                  value={formData.name_noob}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name_noob: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_name_nai">NAI 格式</Label>
                <Input
                  id="edit_name_nai"
                  value={formData.name_nai}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name_nai: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Danbooru 链接 */}
            <div className="space-y-2">
              <Label htmlFor="edit_danbooru_link">Danbooru 链接</Label>
              <Input
                id="edit_danbooru_link"
                value={formData.danbooru_link}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    danbooru_link: e.target.value,
                  }))
                }
              />
            </div>

            {/* 备注 */}
            <div className="space-y-2">
              <Label htmlFor="edit_notes">备注</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
              />
            </div>

            {/* 跳过Danbooru */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={formData.skip_danbooru}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    skip_danbooru: checked as boolean,
                  }))
                }
              />
              <span className="text-sm">跳过 Danbooru 获取</span>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAutoComplete}
              disabled={formLoading}
              className="gap-2 mr-auto"
            >
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              自动补全
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setCurrentArtist(null)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button onClick={handleEditArtist} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
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
              确定要删除画师 "
              {currentArtist?.name_noob || currentArtist?.name_nai}"
              吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setCurrentArtist(null)
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArtist}
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
