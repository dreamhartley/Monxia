import { useState, useEffect, useMemo } from 'react'
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
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // 排序状态
  const [categoryOrder, setCategoryOrder] = useState<number[]>(() => {
    const saved = localStorage.getItem('category_order')
    return saved ? JSON.parse(saved) : []
  })
  const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null)
  const [isSortDialogOpen, setIsSortDialogOpen] = useState(false)

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
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
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
  }

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
      <header className="shrink-0 h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">分类管理</h1>
          <p className="text-sm text-muted-foreground">管理画师分类标签</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setIsAddDialogOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          添加分类
        </Button>
      </header>

      {/* 分类列表 */}
      <ScrollArea className="flex-1 p-6">
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
          <div className="max-w-5xl">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCategories.map((category) => (
              <Card
                key={category.id}
                className="group bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Tags className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setCurrentCategory(category)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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
            <Button onClick={handleAddCategory} disabled={formLoading}>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setCurrentCategory(null)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button onClick={handleEditCategory} disabled={formLoading}>
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
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setCurrentCategory(null)
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive hover:bg-destructive/90"
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
              拖拽分类来调整显示顺序，排序会同步到画师管理页面
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {sortableCategories.map((cat) => (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cat.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, cat.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-grab bg-secondary/30 hover:bg-secondary/50 transition-colors ${
                    draggedCategoryId === cat.id ? 'opacity-50' : ''
                  }`}
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
    </div>
  )
}
