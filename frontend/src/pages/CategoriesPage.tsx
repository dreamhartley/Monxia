import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Tags,
  AlertCircle,
  GripVertical,
  ArrowUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { categoryApi, type Category } from '@/lib/api'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // 排序状态
  const [categoryOrder, setCategoryOrder] = useState<number[]>(() => {
    const saved = localStorage.getItem('category_order')
    return saved ? JSON.parse(saved) : []
  })
  const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<number | null>(null)
  const [isSortDialogOpen, setIsSortDialogOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 触摸拖拽状态
  const touchStateRef = useRef<{
    categoryId: number
    startX: number
    startY: number
    isDragging: boolean
    longPressTimer: ReturnType<typeof setTimeout> | null
  } | null>(null)

  // 自动滚动状态
  const autoScrollRef = useRef<{
    animationId: number | null
    direction: 'up' | 'down' | null
    speed: number
  }>({ animationId: null, direction: null, speed: 0 })

  // 拖拽幽灵元素状态
  const [dragGhost, setDragGhost] = useState<{
    visible: boolean
    x: number
    y: number
    content: string
  } | null>(null)

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
  })

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

  // 可排序的分类（不包含"未分类"）
  const sortableCategories = useMemo(() => {
    return sortedCategories.filter(c => c.name !== '未分类')
  }, [sortedCategories])

  // 保存分类排序到 localStorage
  const saveCategoryOrder = (newOrder: number[]) => {
    setCategoryOrder(newOrder)
    localStorage.setItem('category_order', JSON.stringify(newOrder))
  }

  // 拖拽排序处理
  const handleDragStart = (e: React.DragEvent, categoryId: number) => {
    setDraggedCategoryId(categoryId)
    e.dataTransfer.effectAllowed = 'move'

    // 隐藏原生拖拽预览
    const emptyImg = new Image()
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(emptyImg, 0, 0)

    // 创建幽灵元素
    const category = sortableCategories.find(c => c.id === categoryId)
    if (category) {
      setDragGhost({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        content: category.name,
      })
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    // 更新幽灵元素位置（drag 事件的最后一次触发时 clientX/Y 可能为 0）
    if (e.clientX !== 0 || e.clientY !== 0) {
      setDragGhost(prev => prev ? {
        ...prev,
        x: e.clientX,
        y: e.clientY,
      } : null)
    }
  }

  const handleDragOver = (e: React.DragEvent, targetCategoryId?: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // 更新拖拽目标
    if (targetCategoryId !== undefined && draggedCategoryId !== null) {
      setDragOverCategoryId(targetCategoryId)
    }

    const container = scrollContainerRef.current
    if (container) {
      const { top, bottom } = container.getBoundingClientRect()
      const clientY = e.clientY
      const threshold = 60
      const speed = 10

      if (clientY < top + threshold) {
        container.scrollTop -= speed
      } else if (clientY > bottom - threshold) {
        container.scrollTop += speed
      }
    }
  }

  const handleDrop = (e: React.DragEvent, targetCategoryId: number) => {
    e.preventDefault()
    if (draggedCategoryId === null || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId(null)
      return
    }

    const currentOrder = categoryOrder.length > 0
      ? categoryOrder
      : categories.map(c => c.id)

    const draggedIndex = currentOrder.indexOf(draggedCategoryId)
    const targetIndex = currentOrder.indexOf(targetCategoryId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedCategoryId(null)
      return
    }

    const newOrder = [...currentOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedCategoryId)

    saveCategoryOrder(newOrder)
    setDraggedCategoryId(null)
  }

  const handleDragEnd = () => {
    setDraggedCategoryId(null)
    setDragOverCategoryId(null)
    setDragGhost(null)
  }

  // 触摸拖拽处理 - 长按触发
  const handleTouchStart = (categoryId: number, e: React.TouchEvent) => {
    const touch = e.touches[0]
    const category = sortableCategories.find(c => c.id === categoryId)

    // 设置长按定时器
    const longPressTimer = setTimeout(() => {
      if (touchStateRef.current && !touchStateRef.current.isDragging) {
        touchStateRef.current.isDragging = true
        setDraggedCategoryId(categoryId)
        // 创建幽灵元素
        if (category && touchStateRef.current) {
          setDragGhost({
            visible: true,
            x: touchStateRef.current.startX,
            y: touchStateRef.current.startY,
            content: category.name,
          })
        }
        // 添加触觉反馈（如果支持）
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }
    }, 300) // 300ms 长按阈值

    touchStateRef.current = {
      categoryId,
      startX: touch.clientX,
      startY: touch.clientY,
      isDragging: false,
      longPressTimer,
    }
  }

  // 清理长按定时器
  const clearLongPressTimer = () => {
    if (touchStateRef.current?.longPressTimer) {
      clearTimeout(touchStateRef.current.longPressTimer)
      touchStateRef.current.longPressTimer = null
    }
  }

  // 使用 useEffect 添加非 passive 的触摸事件监听器
  useEffect(() => {
    if (!isSortDialogOpen) return

    // 延迟获取容器，确保 DOM 已渲染
    const timeoutId = setTimeout(() => {
      const container = scrollContainerRef.current
      if (!container) return

      const handleTouchMoveNative = (e: TouchEvent) => {
        if (!touchStateRef.current) return

        const touch = e.touches[0]
        const { startX, startY, isDragging } = touchStateRef.current
        const deltaX = Math.abs(touch.clientX - startX)
        const deltaY = Math.abs(touch.clientY - startY)

        // 如果还没开始拖拽，检查是否移动过多（取消长按）
        if (!isDragging && (deltaX > 10 || deltaY > 10)) {
          // 移动过多，取消长按定时器，允许正常滚动
          clearLongPressTimer()
          return
        }

        // 如果正在拖拽
        if (isDragging) {
          if (e.cancelable) {
            e.preventDefault() // 防止滚动
          }

          // 更新幽灵元素位置（如果不存在则创建）
          const category = sortableCategories.find(c => c.id === touchStateRef.current?.categoryId)
          setDragGhost(prev => {
            if (prev) {
              return {
                ...prev,
                x: touch.clientX,
                y: touch.clientY,
              }
            } else if (category) {
              // 幽灵元素不存在但正在拖拽，创建它
              return {
                visible: true,
                x: touch.clientX,
                y: touch.clientY,
                content: category.name,
              }
            }
            return null
          })

          // 自动滚动：当触摸点接近容器边缘时
          const containerRect = container.getBoundingClientRect()
          const threshold = 60 // 触发滚动的边缘区域
          const maxSpeed = 8 // 最大滚动速度

          // 计算滚动方向和速度
          let scrollDirection: 'up' | 'down' | null = null
          let scrollSpeed = 0

          if (touch.clientY < containerRect.top + threshold) {
            // 接近顶部，向上滚动 - 使用平滑的速度曲线
            const distance = containerRect.top + threshold - touch.clientY
            const ratio = Math.min(1, distance / threshold)
            scrollSpeed = ratio * ratio * maxSpeed // 二次曲线，更平滑
            scrollDirection = 'up'
          } else if (touch.clientY > containerRect.bottom - threshold) {
            // 接近底部，向下滚动
            const distance = touch.clientY - (containerRect.bottom - threshold)
            const ratio = Math.min(1, distance / threshold)
            scrollSpeed = ratio * ratio * maxSpeed
            scrollDirection = 'down'
          }

          // 更新滚动参数（动画会自动读取最新值）
          autoScrollRef.current.direction = scrollDirection
          autoScrollRef.current.speed = scrollSpeed

          // 只在需要滚动且动画未启动时启动动画
          if (scrollDirection && scrollSpeed > 0 && !autoScrollRef.current.animationId) {
            const performScroll = () => {
              if (!container) return

              const { direction, speed } = autoScrollRef.current
              if (!direction || speed <= 0) {
                // 停止滚动
                autoScrollRef.current.animationId = null
                return
              }

              if (direction === 'up') {
                container.scrollTop -= speed
              } else {
                container.scrollTop += speed
              }

              autoScrollRef.current.animationId = requestAnimationFrame(performScroll)
            }

            autoScrollRef.current.animationId = requestAnimationFrame(performScroll)
          }

          // 找到触摸点下的元素
          const items = container.querySelectorAll('[data-category-id]')
          let foundTarget = false
          for (const item of items) {
            const rect = item.getBoundingClientRect()
            if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
              const targetId = parseInt(item.getAttribute('data-category-id') || '-1', 10)
              if (targetId !== -1) {
                setDragOverCategoryId(targetId)
                foundTarget = true
              }
              break
            }
          }
          if (!foundTarget) {
            setDragOverCategoryId(null)
          }
        }
      }

      const handleTouchEndNative = () => {
        if (!touchStateRef.current) return

        // 清理长按定时器
        clearLongPressTimer()

        // 停止自动滚动
        if (autoScrollRef.current.animationId) {
          cancelAnimationFrame(autoScrollRef.current.animationId)
          autoScrollRef.current.animationId = null
          autoScrollRef.current.direction = null
          autoScrollRef.current.speed = 0
        }

        const { categoryId, isDragging } = touchStateRef.current

        if (isDragging && dragOverCategoryId !== null && dragOverCategoryId !== categoryId) {
          const currentOrder = categoryOrder.length > 0
            ? categoryOrder
            : categories.map(c => c.id)

          const draggedIndex = currentOrder.indexOf(categoryId)
          const targetIndex = currentOrder.indexOf(dragOverCategoryId)

          if (draggedIndex !== -1 && targetIndex !== -1) {
            const newOrder = [...currentOrder]
            newOrder.splice(draggedIndex, 1)
            newOrder.splice(targetIndex, 0, categoryId)
            saveCategoryOrder(newOrder)
          }
        }

        // 清理状态
        setDraggedCategoryId(null)
        setDragOverCategoryId(null)
        setDragGhost(null) // 隐藏幽灵元素
        touchStateRef.current = null
      }

      container.addEventListener('touchmove', handleTouchMoveNative, { passive: false })
      container.addEventListener('touchend', handleTouchEndNative)
      container.addEventListener('touchcancel', handleTouchEndNative)

      // 存储清理函数
      ;(scrollContainerRef as any)._cleanup = () => {
        container.removeEventListener('touchmove', handleTouchMoveNative)
        container.removeEventListener('touchend', handleTouchEndNative)
        container.removeEventListener('touchcancel', handleTouchEndNative)
      }
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      clearLongPressTimer()
      // 清理自动滚动
      if (autoScrollRef.current.animationId) {
        cancelAnimationFrame(autoScrollRef.current.animationId)
        autoScrollRef.current.animationId = null
      }
      if ((scrollContainerRef as any)._cleanup) {
        (scrollContainerRef as any)._cleanup()
        ;(scrollContainerRef as any)._cleanup = null
      }
    }
  }, [isSortDialogOpen, dragOverCategoryId, categoryOrder, categories, sortableCategories])

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const res = await categoryApi.getAll()
      if (res.success && res.data) {
        setCategories(res.data.sort((a, b) => a.display_order - b.display_order))
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '' })
  }

  const handleAddCategory = async () => {
    if (!formData.name.trim()) {
      alert('请输入分类名称')
      return
    }

    setFormLoading(true)
    try {
      const res = await categoryApi.create(formData.name)
      if (res.success) {
        await loadCategories()
        setIsAddDialogOpen(false)
        resetForm()
      } else {
        alert(res.error || '创建失败')
      }
    } catch (error) {
      console.error('Failed to create category:', error)
      alert('创建失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditCategory = async () => {
    if (!currentCategory || !formData.name.trim()) return

    setFormLoading(true)
    try {
      const res = await categoryApi.update(
        currentCategory.id,
        formData.name
      )
      if (res.success) {
        await loadCategories()
        setIsEditDialogOpen(false)
        setCurrentCategory(null)
        resetForm()
      } else {
        alert(res.error || '更新失败')
      }
    } catch (error) {
      console.error('Failed to update category:', error)
      alert('更新失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (!currentCategory) return

    setFormLoading(true)
    try {
      const res = await categoryApi.delete(currentCategory.id)
      if (res.success) {
        await loadCategories()
        setIsDeleteDialogOpen(false)
        setCurrentCategory(null)
      } else {
        alert(res.error || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('删除失败')
    } finally {
      setFormLoading(false)
    }
  }

  const openEditDialog = (category: Category) => {
    setCurrentCategory(category)
    setFormData({
      name: category.name,
    })
    setIsEditDialogOpen(true)
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 顶部标题栏 */}
      <header className="shrink-0 h-14 md:h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-semibold text-foreground">分类管理</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">管理画师分类标签</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setIsAddDialogOpen(true)
          }}
          className="gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">添加分类</span>
          <span className="sm:hidden">添加</span>
        </Button>
      </header>

      {/* 分类列表 */}
      <ScrollArea className="flex-1 p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">暂无分类</p>
            <p className="text-sm">点击上方按钮添加第一个分类</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            {/* 工具栏 */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                共 {categories.length} 个分类
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsSortDialogOpen(true)}
              >
                <ArrowUpDown className="h-4 w-4" />
                调整排序
              </Button>
            </div>

            {/* 分类卡片 */}
            <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 pb-4">
              {sortedCategories.map((category) => (
              <Card
                key={category.id}
                className="group bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer aspect-square sm:aspect-auto"
                onClick={() => navigate(`/artists?category=${category.id}`)}
              >
                {/* 移动端正方形布局 */}
                <div className="sm:hidden h-full flex flex-col items-center justify-center p-2 text-center relative">
                  {/* 移动端操作按钮 - 始终显示 */}
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 bg-background/60 backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDialog(category)
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 bg-background/60 backdrop-blur-sm text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentCategory(category)
                        setIsDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10 mb-1.5">
                    <Tags className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium line-clamp-2 leading-tight">{category.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {category.artist_count || 0} 位画师
                  </span>
                </div>

                {/* 桌面端布局 */}
                <CardHeader className="hidden sm:block p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <Tags className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-base font-medium">{category.name}</CardTitle>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDialog(category)
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCurrentCategory(category)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="hidden sm:block p-4 pt-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">画师数量</span>
                    <span className="font-semibold text-primary">
                      {category.artist_count || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* 添加分类对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加分类</DialogTitle>
            <DialogDescription>创建一个新的画师分类</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">分类名称 *</Label>
              <Input
                id="name"
                placeholder="输入分类名称"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button className="flex-1" onClick={handleAddCategory} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑分类对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
            <DialogDescription>修改分类信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_name">分类名称 *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsEditDialogOpen(false)
                setCurrentCategory(null)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button className="flex-1" onClick={handleEditCategory} disabled={formLoading}>
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
              确定要删除分类 "{currentCategory?.name}"
              吗？该分类下的画师不会被删除，但会失去此分类标签。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
            <AlertDialogCancel
              className="flex-1 mt-0"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setCurrentCategory(null)
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteCategory}
            >
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 分类排序弹窗 */}
      <Dialog open={isSortDialogOpen} onOpenChange={setIsSortDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>调整分类排序</DialogTitle>
            <DialogDescription>
              长按分类开始拖拽，调整显示顺序
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div
              ref={scrollContainerRef}
              className="space-y-1 max-h-[300px] overflow-y-auto"
              onDragOver={(e) => handleDragOver(e)}
            >
              {sortableCategories.map((cat) => (
                <div
                  key={cat.id}
                  data-category-id={cat.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cat.id)}
                  onDrag={handleDrag}
                  onDragOver={(e) => handleDragOver(e, cat.id)}
                  onDrop={(e) => handleDrop(e, cat.id)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(cat.id, e)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-grab bg-secondary/30 hover:bg-secondary/50 transition-colors select-none ${
                    draggedCategoryId === cat.id ? 'opacity-50' : ''
                  } ${dragOverCategoryId === cat.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSortDialogOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 触摸拖拽幽灵元素 */}
      {dragGhost && dragGhost.visible && (
        <div
          className="fixed pointer-events-none z-[9999] flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-primary text-primary-foreground shadow-lg opacity-90"
          style={{
            left: dragGhost.x,
            top: dragGhost.y,
            transform: 'translate(-50%, -50%) scale(1.05)',
          }}
        >
          <GripVertical className="h-4 w-4" />
          <span>{dragGhost.content}</span>
        </div>
      )}
    </div>
  )
}
