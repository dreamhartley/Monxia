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
  ArrowUpDown,
  Star,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  type AutoCompleteProgress,
} from '@/lib/api'
import { Progress } from '@/components/ui/progress'

const API_BASE = '/api'

type ViewMode = 'grid' | 'list'
type SortOption = 'date_desc' | 'date_asc' | 'count_desc' | 'count_asc'

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('artist_view_mode')
    return (saved === 'grid' || saved === 'list') ? saved : 'grid'
  })
  const [sortOption, setSortOption] = useState<SortOption>('count_desc')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('artist_favorites')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [categoryOrder, setCategoryOrder] = useState<number[]>(() => {
    const saved = localStorage.getItem('category_order')
    return saved ? JSON.parse(saved) : []
  })

  // 监听 localStorage 变化（从 CategoriesPage 同步排序）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'category_order' && e.newValue) {
        setCategoryOrder(JSON.parse(e.newValue))
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentArtist, setCurrentArtist] = useState<Artist | null>(null)
  const [isNewArtistEditing, setIsNewArtistEditing] = useState(false)
  const [previewImage, setPreviewImage] = useState<{
    url: string
    origin: { x: number; y: number }
  } | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Auto-complete progress state
  const [autoCompleteProgress, setAutoCompleteProgress] = useState<{
    isOpen: boolean
    phase: 'names' | 'fetch' | ''
    current: number
    total: number
    artistName: string
    message: string
  }>({
    isOpen: false,
    phase: '',
    current: 0,
    total: 0,
    artistName: '',
    message: '',
  })

  // Form states
  const [simpleAddName, setSimpleAddName] = useState('')
  const [formData, setFormData] = useState<CreateArtistData & { notes?: string }>({
    category_ids: [],
    name_noob: '',
    name_nai: '',
    danbooru_link: '',
    post_count: undefined,
    notes: '',
    skip_danbooru: false,
  })

  const getDisplayName = (artist: Artist) => {
    const name = artist.name_nai || artist.name_noob || '未命名'
    return name.replace(/^artist:/, '')
  }

  const toggleFavorite = (artistId: number) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(artistId)) {
        newFavorites.delete(artistId)
      } else {
        newFavorites.add(artistId)
      }
      localStorage.setItem('artist_favorites', JSON.stringify([...newFavorites]))
      return newFavorites
    })
  }

  // 根据本地排序顺序排列分类
  const sortedCategories = useMemo(() => {
    // "未分类"始终排在最前面
    const uncategorized = categories.find(c => c.name === '未分类')
    const otherCategories = categories.filter(c => c.name !== '未分类')

    let sortedOthers: Category[]
    if (categoryOrder.length === 0) {
      sortedOthers = otherCategories
    } else {
      // 按照 categoryOrder 排序，不在 order 中的放最后
      sortedOthers = [...otherCategories].sort((a, b) => {
        const indexA = categoryOrder.indexOf(a.id)
        const indexB = categoryOrder.indexOf(b.id)
        if (indexA === -1 && indexB === -1) return 0
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
    }

    return uncategorized ? [uncategorized, ...sortedOthers] : sortedOthers
  }, [categories, categoryOrder])

  // Filtered artists
  const filteredArtists = useMemo(() => {
    // 格式化1：保留空格（将下划线转为空格，合并多余空格）
    const formatForSearch = (str: string) =>
      str.toLowerCase().replace(/[_\s]+/g, ' ').trim()
    // 格式化2：移除所有分隔符（下划线和空格）
    const compactForSearch = (str: string) =>
      str.toLowerCase().replace(/[_\s]+/g, '')

    const normalizedQuery = formatForSearch(searchQuery)
    const compactQuery = compactForSearch(searchQuery)

    const checkMatch = (text: string | undefined) => {
      if (!text) return false
      return (
        formatForSearch(text).includes(normalizedQuery) ||
        (compactQuery.length > 0 && compactForSearch(text).includes(compactQuery))
      )
    }

    // 模糊匹配：检查 query 中的字符是否按顺序出现在 text 中
    const fuzzyCheck = (text: string | undefined) => {
      if (!text || compactQuery.length === 0) return false
      const compactText = compactForSearch(text)

      let queryIdx = 0
      let textIdx = 0
      while (queryIdx < compactQuery.length && textIdx < compactText.length) {
        if (compactQuery[queryIdx] === compactText[textIdx]) {
          queryIdx++
        }
        textIdx++
      }
      return queryIdx === compactQuery.length
    }

    return artists
      .filter((artist) => {
        // 收藏过滤
        if (showFavoritesOnly && !favorites.has(artist.id)) {
          return false
        }

        const matchesSearch =
          searchQuery === '' ||
          checkMatch(artist.name_noob) ||
          checkMatch(artist.name_nai) ||
          checkMatch(artist.notes) ||
          fuzzyCheck(artist.notes)

        let matchesCategory = false
        if (selectedCategory === 'all') {
          matchesCategory = true
        } else if (selectedCategory === 'incomplete') {
          // 待补全：缺少封面图、作品数为0/空，或（未跳过Danbooru且缺少链接）
          const hasImage = !!artist.image_example
          const hasPostCount = !!artist.post_count && artist.post_count > 0
          const hasLink = !!artist.danbooru_link
          const isSkipped = !!artist.skip_danbooru

          if (isSkipped) {
            // 如果跳过Danbooru，只要有图就算完整（因为无法获取作品数）
            matchesCategory = !hasImage
          } else {
            // 否则需要有图、有作品数、有链接
            matchesCategory = !hasImage || !hasPostCount || !hasLink
          }
        } else {
          matchesCategory = artist.categories?.some(
            (c) => c.id.toString() === selectedCategory
          )
        }

        return matchesSearch && matchesCategory
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'date_desc':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          case 'date_asc':
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          case 'count_desc':
            return (b.post_count || 0) - (a.post_count || 0)
          case 'count_asc':
            return (a.post_count || 0) - (b.post_count || 0)
          default:
            return 0
        }
      })
  }, [artists, searchQuery, selectedCategory, sortOption, showFavoritesOnly, favorites])

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  // Save viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('artist_view_mode', viewMode)
  }, [viewMode])

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
      post_count: undefined,
      notes: '',
      skip_danbooru: false,
    })
    setSimpleAddName('')
  }

  // 打开添加对话框
  const openAddDialog = () => {
    // 首先重置表单状态
    setSimpleAddName('')

    // 如果当前筛选选中了某个分类，自动添加该分类
    let initialCategoryIds: number[] = []
    if (selectedCategory !== 'all' && selectedCategory !== 'incomplete') {
      const categoryId = parseInt(selectedCategory)
      if (!isNaN(categoryId)) {
        initialCategoryIds = [categoryId]
      }
    }

    setFormData({
      category_ids: initialCategoryIds,
      name_noob: '',
      name_nai: '',
      danbooru_link: '',
      post_count: undefined,
      notes: '',
      skip_danbooru: false,
    })

    setIsAddDialogOpen(true)
  }

  // 简化的添加流程
  const handleSimpleAdd = async () => {
    if (formData.category_ids.length === 0) {
      alert('请选择分类')
      return
    }
    if (!simpleAddName.trim()) {
      alert('请输入画师名称')
      return
    }

    setFormLoading(true)
    try {
      // 1. 自动补全名称信息
      const autoCompleteRes = await toolsApi.autoComplete(simpleAddName, '', '')
      let nameData = {
        name_noob: simpleAddName, // 默认使用用户输入
        name_nai: '',
        danbooru_link: '',
      }

      if (autoCompleteRes.success && autoCompleteRes.data) {
        nameData = {
          name_noob: autoCompleteRes.data.name_noob || simpleAddName,
          name_nai: autoCompleteRes.data.name_nai,
          danbooru_link: formData.skip_danbooru
            ? ''
            : autoCompleteRes.data.danbooru_link,
        }
      }

      // 2. 创建画师
      const createData = {
        ...nameData,
        category_ids: formData.category_ids,
        notes: '',
        skip_danbooru: formData.skip_danbooru,
      }

      const createRes = await artistApi.create(createData)

      if (createRes.success && createRes.data) {
        const newArtistId = createRes.data.id

        // 3. 尝试获取作品数据 (如果有链接 且 未跳过Danbooru)
        if (nameData.danbooru_link && !formData.skip_danbooru) {
          await toolsApi.fetchPostCounts([newArtistId])
        }

        // 4. 获取最新数据
        const finalArtistRes = await artistApi.getById(newArtistId)
        if (finalArtistRes.success && finalArtistRes.data) {
          // 5. 切换到编辑模式
          const artist = finalArtistRes.data
          setCurrentArtist(artist)
          // 填充表单数据以供编辑
          setFormData({
            category_ids: artist.categories?.map((c) => c.id) || [],
            name_noob: artist.name_noob || '',
            name_nai: artist.name_nai || '',
            danbooru_link: artist.danbooru_link || '',
            post_count: artist.post_count || undefined,
            notes: artist.notes || '',
            skip_danbooru: artist.skip_danbooru || false,
          })

          setIsNewArtistEditing(true) // 标记为新建编辑
          setIsAddDialogOpen(false)
          setIsEditDialogOpen(true)
          await loadData() // 刷新列表
        }
      } else {
        // 如果是重复画师，询问是否直接编辑现有画师
        if (createRes.error && createRes.error.includes('画师已存在') && createRes.data) {
          if (confirm(`${createRes.error}\n是否直接编辑该画师？`)) {
            const existingArtist = createRes.data as Artist
             // 获取完整信息
             const fullArtistRes = await artistApi.getById(existingArtist.id)
             if (fullArtistRes.success && fullArtistRes.data) {
               const artist = fullArtistRes.data
               setCurrentArtist(artist)
               setFormData({
                 category_ids: artist.categories?.map((c) => c.id) || [],
                 name_noob: artist.name_noob || '',
                 name_nai: artist.name_nai || '',
                 danbooru_link: artist.danbooru_link || '',
                 post_count: artist.post_count || undefined,
                 notes: artist.notes || '',
                 skip_danbooru: artist.skip_danbooru || false,
               })
               
               setIsNewArtistEditing(false) // 不是新建的，是已存在的
               setIsAddDialogOpen(false)
               setIsEditDialogOpen(true)
             }
          }
        } else {
          alert(createRes.error || '创建失败')
        }
      }
    } catch (e) {
      console.error(e)
      alert('处理失败')
    } finally {
      setFormLoading(false)
    }
  }

  // 编辑模式下的手动补全
  const handleManualAutoComplete = async () => {
    if (!currentArtist) return

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
        alert('名称补全成功')
      }

      // 2. 如果有链接，询问是否获取数据
      if (newFormData.danbooru_link && !newFormData.skip_danbooru) {
        if (
          confirm(
            '是否重新获取该画师的作品数据？这可能会覆盖当前的封面图片。'
          )
        ) {
          const countRes = await toolsApi.fetchPostCounts([currentArtist.id])
          if (
            countRes.success &&
            countRes.data &&
            countRes.data[currentArtist.id]
          ) {
            const updatedArtistRes = await artistApi.getById(currentArtist.id)
            if (updatedArtistRes.success && updatedArtistRes.data) {
              setCurrentArtist(updatedArtistRes.data)
              await loadData()
              alert('数据获取完成！')
            }
          } else {
            alert('获取作品数据失败: ' + (countRes.error || '未知错误'))
          }
        }
      }
    } catch (error) {
      console.error('Auto complete failed:', error)
      alert('自动补全失败')
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
        setIsNewArtistEditing(false)
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

  const handleQuickCreateCategory = async () => {
    const name = prompt('请输入新分类名称：')
    if (!name?.trim()) return

    setFormLoading(true)
    try {
      const res = await categoryApi.create(name.trim())
      if (res.success && res.data) {
        // 刷新分类列表
        const categoriesRes = await categoryApi.getAll()
        if (categoriesRes.success && categoriesRes.data) {
          setCategories(categoriesRes.data)
          // 自动选中新分类
          toggleCategorySelection(res.data.id)
        }
      } else {
        alert(res.error || '创建分类失败')
      }
    } catch (error) {
      console.error('Failed to create category:', error)
      alert('创建分类失败')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditDialog = (artist: Artist) => {
    setCurrentArtist(artist)
    setIsNewArtistEditing(false)
    setFormData({
      category_ids: artist.categories?.map((c) => c.id) || [],
      name_noob: artist.name_noob || '',
      name_nai: artist.name_nai || '',
      danbooru_link: artist.danbooru_link || '',
      post_count: artist.post_count || undefined,
      notes: artist.notes || '',
      skip_danbooru: artist.skip_danbooru || false,
    })
    setIsEditDialogOpen(true)
  }

  const handleEditCancel = async () => {
    if (isNewArtistEditing && currentArtist) {
      if (confirm('取消将删除刚刚创建的画师记录，确定吗？')) {
        setFormLoading(true)
        try {
          await artistApi.delete(currentArtist.id)
          await loadData()
          setIsEditDialogOpen(false)
          setCurrentArtist(null)
          resetForm()
          setIsNewArtistEditing(false)
        } catch (error) {
          console.error('Failed to delete temp artist:', error)
          alert('删除失败')
        } finally {
          setFormLoading(false)
        }
      }
    } else {
      setIsEditDialogOpen(false)
      setCurrentArtist(null)
      resetForm()
      setIsNewArtistEditing(false)
    }
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
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setPreviewImage({
                url: `${API_BASE.replace('/api', '')}/images/${artist.image_example}`,
                origin: {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                },
              })
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        {/* 操作菜单 */}
        {renderDropdownMenu(artist)}

        {/* 收藏标记 */}
        {favorites.has(artist.id) && (
          <Star className="absolute top-2 left-2 h-5 w-5 text-[#FFFACD] fill-[#FFFACD] drop-shadow-md" />
        )}

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
        {/* 上半部分：名称、分类、备注 */}
        <div className="flex gap-2 items-start mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate mb-1">
              {getDisplayName(artist)}
            </h3>
            {/* 标签区域 - 单行显示，右侧截断 */}
            <div className="relative overflow-hidden">
              <div className="flex flex-nowrap gap-1 overflow-hidden">
                {artist.categories?.map((cat) => (
                  <Badge key={cat.id} variant="secondary" className="text-xs shrink-0">
                    {cat.name}
                  </Badge>
                ))}
              </div>
              {/* 渐变遮罩 - 当标签可能超出时显示 */}
              {artist.categories && artist.categories.length > 2 && (
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none" />
              )}
            </div>
          </div>
          {/* 备注区域 */}
          {artist.notes && (
            <div className="shrink-0 w-24 h-10 border border-border/50 rounded-md p-1 overflow-y-auto bg-secondary/10 text-[10px] text-muted-foreground leading-tight">
              {artist.notes}
            </div>
          )}
        </div>
        {/* 下半部分：作品数 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">作品数</span>
          <span className="font-medium text-primary">
            {artist.post_count?.toLocaleString() || '-'}
          </span>
        </div>
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
        <div className="w-16 h-16 shrink-0 rounded-lg bg-secondary/30 overflow-hidden relative">
          {artist.image_example ? (
            <img
              src={`${API_BASE.replace('/api', '')}/images/${artist.image_example}`}
              alt={artist.name_noob || artist.name_nai}
              className="w-full h-full object-cover object-top cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setPreviewImage({
                  url: `${API_BASE.replace('/api', '')}/images/${artist.image_example}`,
                  origin: {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  },
                })
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
          {/* 收藏标记 */}
          {favorites.has(artist.id) && (
            <Star className="absolute top-0.5 left-0.5 h-4 w-4 text-[#FFFACD] fill-[#FFFACD] drop-shadow-md" />
          )}
        </div>

        {/* 信息区域 */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {getDisplayName(artist)}
          </h3>
          {/* 标签区域 - 单行显示，右侧截断 */}
          <div className="relative mt-1 overflow-hidden">
            <div className="flex flex-nowrap gap-1 overflow-hidden">
              {artist.categories?.map((cat) => (
                <Badge key={cat.id} variant="secondary" className="text-xs shrink-0">
                  {cat.name}
                </Badge>
              ))}
            </div>
            {/* 渐变遮罩 */}
            {artist.categories && artist.categories.length > 3 && (
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none" />
            )}
          </div>
        </div>

        {/* 备注 (仅当有备注时显示) */}
        {artist.notes && (
          <div className="shrink-0 w-48 h-16 mr-4 border border-border/50 rounded-md p-2 overflow-y-auto bg-secondary/10 text-xs text-muted-foreground">
            {artist.notes}
          </div>
        )}

        {/* 作品数 */}
        <div className="text-right shrink-0">
          <p className="text-sm text-muted-foreground">作品数</p>
          <p className="font-semibold text-primary">
            {artist.post_count?.toLocaleString() || '-'}
          </p>
        </div>

        {/* 操作菜单 */}
        <div className="shrink-0 flex items-center gap-2">
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
        <DropdownMenuItem onClick={() => toggleFavorite(artist.id)}>
          <Star className={`h-4 w-4 mr-2 ${favorites.has(artist.id) ? 'fill-current text-yellow-500' : ''}`} />
          {favorites.has(artist.id) ? '移出收藏' : '加入收藏'}
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
          上传封面
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
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          添加画师
        </Button>
      </header>

      {/* 筛选栏 */}
      <div className="shrink-0 px-6 py-4">
        <div className="max-w-6xl mx-auto flex gap-3 items-center">
        {/* 收藏筛选按钮 */}
        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          size="icon"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="shrink-0"
          title={showFavoritesOnly ? '显示全部' : '仅显示收藏'}
        >
          <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
        </Button>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索画师..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 bg-card/50 border-border/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40 bg-card/50 border-border/50">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="筛选分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            <SelectItem value="incomplete">待补全</SelectItem>
            {sortedCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 排序 */}
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
          <SelectTrigger className="w-40 bg-card/50 border-border/50">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count_desc">作品数 ↓</SelectItem>
            <SelectItem value="count_asc">作品数 ↑</SelectItem>
            <SelectItem value="date_desc">添加时间 ↓</SelectItem>
            <SelectItem value="date_asc">添加时间 ↑</SelectItem>
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
          onClick={() => {
            if (!confirm('确定要对所有画师进行自动数据补全吗？这可能需要一些时间。')) return

            // 打开进度弹窗
            setAutoCompleteProgress({
              isOpen: true,
              phase: 'names',
              current: 0,
              total: 0,
              artistName: '准备中...',
              message: '正在初始化...',
            })

            // 使用流式API
            toolsApi.autoCompleteAllStream((data: AutoCompleteProgress) => {
              if (data.type === 'start') {
                setAutoCompleteProgress((prev) => ({
                  ...prev,
                  total: data.total || 0,
                  message: `共 ${data.total} 个画师`,
                }))
              } else if (data.type === 'progress') {
                setAutoCompleteProgress((prev) => ({
                  ...prev,
                  phase: data.phase || prev.phase,
                  current: data.current || 0,
                  total: data.total || prev.total,
                  artistName: data.artist_name || '',
                  message:
                    data.phase === 'names'
                      ? `正在补全名称信息 (${data.current}/${data.total})`
                      : `正在获取作品数据 (${data.current}/${data.total})`,
                }))
              } else if (data.type === 'phase') {
                setAutoCompleteProgress((prev) => ({
                  ...prev,
                  phase: data.phase || prev.phase,
                  current: 0,
                  total: data.total || 0,
                  message: data.message || '',
                }))
              } else if (data.type === 'complete') {
                setAutoCompleteProgress((prev) => ({
                  ...prev,
                  isOpen: false,
                }))
                alert(data.message || '补全完成')
                loadData()
              } else if (data.type === 'error') {
                setAutoCompleteProgress((prev) => ({
                  ...prev,
                  isOpen: false,
                }))
                alert(data.error || '补全失败')
              }
            })
          }}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          一键自动补全
        </Button>
        </div>
      </div>

      {/* 画师列表 */}
      <ScrollArea className="flex-1 px-6 pb-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              {showFavoritesOnly ? (
                <>
                  <Star className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">暂无收藏</p>
                  <p className="text-sm">点击画师卡片菜单中的「加入收藏」来添加</p>
                </>
              ) : searchQuery ? (
                <>
                  <Search className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">未找到匹配的画师</p>
                  <p className="text-sm">尝试使用其他关键词搜索</p>
                </>
              ) : selectedCategory === 'incomplete' ? (
                <>
                  <Sparkles className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">太棒了！</p>
                  <p className="text-sm">所有画师数据完整</p>
                </>
              ) : selectedCategory !== 'all' ? (
                <>
                  <Filter className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">该分类下暂无画师</p>
                  <p className="text-sm">尝试选择其他分类或添加新画师</p>
                </>
              ) : artists.length === 0 ? (
                <>
                  <AlertCircle className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">暂无画师</p>
                  <p className="text-sm">点击右上角「添加画师」开始添加</p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">未找到画师</p>
                  <p className="text-sm">尝试调整筛选条件</p>
                </>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {filteredArtists.map(renderGridCard)}
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredArtists.map(renderListCard)}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 添加画师对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>添加画师</DialogTitle>
            <DialogDescription>
              添加新画师，支持自动补全信息
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
                      至少选择一个分类
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
                  <SelectContent className="max-h-[200px]">
                    <div className="p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-primary"
                        onClick={(e) => {
                          e.preventDefault()
                          handleQuickCreateCategory()
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        新建分类
                      </Button>
                    </div>
                    <DropdownMenuSeparator />
                    {sortedCategories
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
            <div className="space-y-2">
              <Label htmlFor="simple_name">画师名称 *</Label>
              <Input
                id="simple_name"
                placeholder="输入画师名称或 Danbooru 链接"
                value={simpleAddName}
                onChange={(e) => setSimpleAddName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSimpleAdd()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                输入名称后将自动进行格式化和数据获取
              </p>
            </div>

            {/* 跳过Danbooru */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="add_skip_danbooru"
                  checked={formData.skip_danbooru}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      skip_danbooru: checked as boolean,
                    }))
                  }
                />
                <label
                  htmlFor="add_skip_danbooru"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  跳过 Danbooru 获取
                </label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                勾选后将不会自动从 Danbooru 获取作品数据和封面图片
              </p>
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
            <Button onClick={handleSimpleAdd} disabled={formLoading}>
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
            <DialogTitle>{currentArtist ? getDisplayName(currentArtist) : '编辑画师'}</DialogTitle>
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
                      至少选择一个分类
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
                  <SelectContent className="max-h-[200px]">
                    <div className="p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-primary"
                        onClick={(e) => {
                          e.preventDefault()
                          handleQuickCreateCategory()
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        新建分类
                      </Button>
                    </div>
                    <DropdownMenuSeparator />
                    {sortedCategories
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

            {/* Danbooru 链接 和 作品数量 */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
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
              <div className="w-24 space-y-2">
                <Label htmlFor="edit_post_count">作品数量</Label>
                <Input
                  id="edit_post_count"
                  type="number"
                  min="0"
                  value={formData.post_count === undefined ? '' : formData.post_count}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      post_count: e.target.value === '' ? undefined : parseInt(e.target.value),
                    }))
                  }
                />
              </div>
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
            <div className="space-y-1">
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
              <p className="text-xs text-muted-foreground pl-6">
                勾选后将不会自动从 Danbooru 获取作品数据和封面图片
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleManualAutoComplete}
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
            <Button variant="outline" onClick={handleEditCancel}>
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

      {/* 图片预览 Overlay */}
      <AnimatePresence>
        {previewImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            />
            <motion.img
              src={previewImage.url}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-zoom-out z-10"
              initial={{
                opacity: 0,
                scale: 0.1,
                x: previewImage.origin.x - window.innerWidth / 2,
                y: previewImage.origin.y - window.innerHeight / 2,
              }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(null)
              }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 25,
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* 自动补全进度弹窗 */}
      <AnimatePresence>
        {autoCompleteProgress.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-border rounded-xl shadow-2xl p-6 w-[400px] max-w-[90vw]"
            >
              {/* 标题 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">
                    自动补全中
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {autoCompleteProgress.phase === 'names'
                      ? '阶段 1/2: 补全名称信息'
                      : autoCompleteProgress.phase === 'fetch'
                        ? '阶段 2/2: 获取作品数据'
                        : '准备中...'}
                  </p>
                </div>
              </div>

              {/* 当前处理的画师 */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">当前画师</p>
                <p className="font-medium text-foreground truncate">
                  {autoCompleteProgress.artistName || '-'}
                </p>
              </div>

              {/* 进度条 */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {autoCompleteProgress.message}
                  </span>
                  <span className="text-foreground font-medium">
                    {autoCompleteProgress.total > 0
                      ? `${Math.round((autoCompleteProgress.current / autoCompleteProgress.total) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <Progress
                  value={
                    autoCompleteProgress.total > 0
                      ? (autoCompleteProgress.current / autoCompleteProgress.total) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              {/* 详细进度 */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {autoCompleteProgress.current} / {autoCompleteProgress.total}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
