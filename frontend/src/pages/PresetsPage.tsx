import { useState, useEffect, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import {
  Plus,
  Minus,
  Trash2,
  Loader2,
  List,
  Copy,
  Users,
  AlertCircle,
  Edit2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
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

// 画师标签类型
interface ArtistTag {
  name: string
  weight: number // 1.0 表示无权重
}

// -------------------------------
// 画师名称格式化处理
// -------------------------------

// 清洗名称：去除首尾空格，将下划线替换为空格，还原已存在的括号转义
function cleanArtistName(name: string): string {
  // 去除首尾空格，并将下划线替换为空格
  let cleaned = name.trim().replace(/_/g, ' ')
  // 还原括号转义（例如：\(...\) -> (...)）
  cleaned = cleaned.replace(/\\([()])/g, '$1')
  return cleaned
}

// NOOB 格式：先清洗，然后对括号添加反斜杠转义
function formatNoob(name: string): string {
  const cleanName = cleanArtistName(name)
  return cleanName.replace(/([()])/g, '\\$1')
}

// NAI 格式：先清洗，如果不以 "artist:" 开头则添加该前缀
function formatNai(name: string): string {
  const cleaned = cleanArtistName(name)
  if (!cleaned.startsWith('artist:')) {
    return `artist:${cleaned}`
  }
  return cleaned
}

// 从 NAI 格式提取纯名称（去掉 artist: 前缀）
function extractFromNai(name: string): string {
  const cleaned = cleanArtistName(name)
  if (cleaned.startsWith('artist:')) {
    return cleaned.slice(7) // 去掉 "artist:" 前缀
  }
  return cleaned
}

// 从 NOOB 格式提取纯名称（去掉转义）
function extractFromNoob(name: string): string {
  return cleanArtistName(name)
}

// 检测输入是 NAI 格式还是 NOOB 格式
function detectFormat(input: string): 'nai' | 'noob' | 'plain' {
  const trimmed = input.trim()
  if (trimmed.startsWith('artist:')) {
    return 'nai'
  }
  // 检查是否有转义括号（NOOB 格式特征）
  if (/\\[()]/.test(trimmed)) {
    return 'noob'
  }
  return 'plain'
}

// -------------------------------
// 标签解析和生成
// -------------------------------

// 解析 NOOB 格式标签: "ebifurya" 或 "(ebifurya:1.1)"
function parseNoobTag(str: string): ArtistTag {
  const trimmed = str.trim()
  const match = trimmed.match(/^\((.+?):(\d+\.?\d*)\)$/)
  if (match) {
    return { name: match[1], weight: parseFloat(match[2]) }
  }
  return { name: trimmed, weight: 1.0 }
}

// 解析 NAI 格式标签: "artist:ebifurya" 或 "1.1::artist:ebifurya::"
function parseNaiTag(str: string): ArtistTag {
  const trimmed = str.trim()
  // 带权重格式: "1.1::artist:ebifurya::"
  const weightMatch = trimmed.match(/^(\d+\.?\d*)::(.+?)::$/)
  if (weightMatch) {
    return { name: weightMatch[2], weight: parseFloat(weightMatch[1]) }
  }
  // 无权重格式: "artist:ebifurya"
  return { name: trimmed, weight: 1.0 }
}

// 生成 NOOB 格式字符串
function generateNoobTag(tag: ArtistTag): string {
  if (tag.weight === 1.0) {
    return tag.name
  }
  return `(${tag.name}:${tag.weight.toFixed(1)})`
}

// 生成 NAI 格式字符串
function generateNaiTag(tag: ArtistTag): string {
  if (tag.weight === 1.0) {
    return tag.name
  }
  return `${tag.weight.toFixed(1)}::${tag.name}::`
}

// 解析整个字符串为标签数组
function parseNoobStr(str: string): ArtistTag[] {
  if (!str.trim()) return []
  return str.split(/[,，\n]/).map(s => s.trim()).filter(Boolean).map(parseNoobTag)
}

function parseNaiStr(str: string): ArtistTag[] {
  if (!str.trim()) return []
  return str.split(/[,，\n]/).map(s => s.trim()).filter(Boolean).map(parseNaiTag)
}

// 生成整个字符串
function generateNoobStr(tags: ArtistTag[]): string {
  return tags.map(generateNoobTag).join(', ')
}

function generateNaiStr(tags: ArtistTag[]): string {
  return tags.map(generateNaiTag).join(', ')
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentPreset, setCurrentPreset] = useState<Preset | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    name: '',
    description: '',
    artist_ids: [] as number[],
    noob_str: '',
    nai_str: '',
  })

  // 标签编辑状态
  const [noobTags, setNoobTags] = useState<ArtistTag[]>([])
  const [naiTags, setNaiTags] = useState<ArtistTag[]>([])
  const [noobInput, setNoobInput] = useState('')
  const [naiInput, setNaiInput] = useState('')
  const [selectedNoobIndex, setSelectedNoobIndex] = useState<number | null>(null)
  const [selectedNaiIndex, setSelectedNaiIndex] = useState<number | null>(null)

  // Artist map for quick lookup
  const artistMap = useMemo(() => {
    const map = new Map<number, Artist>()
    artists.forEach((artist) => map.set(artist.id, artist))
    return map
  }, [artists])

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
    setFormData({ id: undefined, name: '', description: '', artist_ids: [], noob_str: '', nai_str: '' })
    setNoobTags([])
    setNaiTags([])
    setNoobInput('')
    setNaiInput('')
    setSelectedNoobIndex(null)
    setSelectedNaiIndex(null)
  }

  // 标签操作函数
  const handleNoobKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && noobInput.trim()) {
      e.preventDefault()
      const inputs = noobInput.split(/[,，]/).map(s => s.trim()).filter(Boolean)
      const newTags: ArtistTag[] = []

      for (const input of inputs) {
        const format = detectFormat(input)
        let nameToFormat = input
        let weight = 1.0

        // 检查 NAI 权重格式 weight::name::
        const naiWeightMatch = input.match(/^(\d+\.?\d*)::(.+?)::$/)
        if (naiWeightMatch) {
          weight = parseFloat(naiWeightMatch[1])
          nameToFormat = naiWeightMatch[2]
        } else {
          // 检查 NOOB 权重格式 (name:weight)
          const noobWeightMatch = input.match(/^\((.+?):(\d+\.?\d*)\)$/)
          if (noobWeightMatch) {
            nameToFormat = noobWeightMatch[1]
            weight = parseFloat(noobWeightMatch[2])
          }
        }

        // 根据检测到的格式进行转换
        let formattedName: string
        if (format === 'nai' || naiWeightMatch) {
          // 输入是 NAI 格式，转换为 NOOB 格式
          formattedName = formatNoob(extractFromNai(nameToFormat))
        } else {
          // 普通格式或已经是 NOOB 格式，格式化为 NOOB
          formattedName = formatNoob(nameToFormat)
        }

        newTags.push({ name: formattedName, weight })
      }

      setNoobTags([...noobTags, ...newTags])
      setNoobInput('')
    } else if (e.key === 'Backspace' && !noobInput && noobTags.length > 0) {
      e.preventDefault()
      const lastIndex = noobTags.length - 1
      removeNoobTag(lastIndex)
    }
  }

  const handleNaiKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && naiInput.trim()) {
      e.preventDefault()
      const inputs = naiInput.split(/[,，]/).map(s => s.trim()).filter(Boolean)
      const newTags: ArtistTag[] = []

      for (const input of inputs) {
        const format = detectFormat(input)
        let nameToFormat = input
        let weight = 1.0

        // 检查 NAI 权重格式 weight::name::
        const naiWeightMatch = input.match(/^(\d+\.?\d*)::(.+?)::$/)
        if (naiWeightMatch) {
          weight = parseFloat(naiWeightMatch[1])
          nameToFormat = naiWeightMatch[2]
        } else {
          // 检查 NOOB 权重格式 (name:weight)
          const noobWeightMatch = input.match(/^\((.+?):(\d+\.?\d*)\)$/)
          if (noobWeightMatch) {
            nameToFormat = noobWeightMatch[1]
            weight = parseFloat(noobWeightMatch[2])
          }
        }

        // 根据检测到的格式进行转换
        let formattedName: string
        if (format === 'noob' || (format === 'plain' && /\\[()]/.test(nameToFormat))) {
          // 输入是 NOOB 格式，转换为 NAI 格式
          formattedName = formatNai(extractFromNoob(nameToFormat))
        } else {
          // 普通格式或已经是 NAI 格式，格式化为 NAI
          formattedName = formatNai(nameToFormat)
        }

        newTags.push({ name: formattedName, weight })
      }

      setNaiTags([...naiTags, ...newTags])
      setNaiInput('')
    } else if (e.key === 'Backspace' && !naiInput && naiTags.length > 0) {
      e.preventDefault()
      const lastIndex = naiTags.length - 1
      removeNaiTag(lastIndex)
    }
  }

  const removeNoobTag = (index: number) => {
    setNoobTags(noobTags.filter((_, i) => i !== index))
    if (selectedNoobIndex === index) setSelectedNoobIndex(null)
    else if (selectedNoobIndex !== null && selectedNoobIndex > index) {
      setSelectedNoobIndex(selectedNoobIndex - 1)
    }
  }

  const removeNaiTag = (index: number) => {
    setNaiTags(naiTags.filter((_, i) => i !== index))
    if (selectedNaiIndex === index) setSelectedNaiIndex(null)
    else if (selectedNaiIndex !== null && selectedNaiIndex > index) {
      setSelectedNaiIndex(selectedNaiIndex - 1)
    }
  }

  const adjustNoobWeight = (delta: number) => {
    if (selectedNoobIndex === null) return
    setNoobTags(noobTags.map((tag, i) => {
      if (i === selectedNoobIndex) {
        const newWeight = Math.max(0.1, Math.round((tag.weight + delta) * 10) / 10)
        return { ...tag, weight: newWeight }
      }
      return tag
    }))
  }

  const adjustNaiWeight = (delta: number) => {
    if (selectedNaiIndex === null) return
    setNaiTags(naiTags.map((tag, i) => {
      if (i === selectedNaiIndex) {
        const newWeight = Math.max(0.1, Math.round((tag.weight + delta) * 10) / 10)
        return { ...tag, weight: newWeight }
      }
      return tag
    }))
  }

  const handleSavePreset = async () => {
    if (!formData.name.trim()) {
      alert('请输入画师串名称')
      return
    }

    // 从标签生成字符串
    const noobStr = generateNoobStr(noobTags)
    const naiStr = generateNaiStr(naiTags)

    // Parse artists from strings if provided
    let finalArtistIds = [...formData.artist_ids]

    if (noobStr || naiStr) {
      const noobNames = noobTags.map(t => t.name)
      const naiNames = naiTags.map(t => t.name)

      const matchedIds = new Set<number>(finalArtistIds)

      artists.forEach(artist => {
        if (artist.name_noob && noobNames.some(n => artist.name_noob.toLowerCase() === n.toLowerCase())) {
          matchedIds.add(artist.id)
        }
        if (artist.name_nai && naiNames.some(n => artist.name_nai.toLowerCase() === n.toLowerCase())) {
          matchedIds.add(artist.id)
        }
      })

      finalArtistIds = Array.from(matchedIds)
    }

    if (finalArtistIds.length === 0 && noobTags.length === 0 && naiTags.length === 0) {
      alert('请至少输入画师或选择一个有效的画师')
      return
    }

    setFormLoading(true)
    try {
      let res
      if (formData.id) {
        res = await presetApi.update(
          formData.id,
          formData.name,
          formData.description,
          finalArtistIds,
          noobStr,
          naiStr
        )
      } else {
        res = await presetApi.create(
          formData.name,
          formData.description,
          finalArtistIds,
          noobStr,
          naiStr
        )
      }

      if (res.success) {
        await loadData()
        setIsAddDialogOpen(false)
        resetForm()
      } else {
        alert(res.error || '保存失败')
      }
    } catch (error) {
      console.error('Failed to save preset:', error)
      alert('保存失败')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeletePreset = async (id: number) => {
    setFormLoading(true)
    try {
      const res = await presetApi.delete(id)
      if (res.success) {
        await loadData()
        setIsDeleteDialogOpen(false)
        setIsAddDialogOpen(false) // 如果是在编辑对话框中删除，也关闭编辑对话框
        setCurrentPreset(null)
        resetForm()
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

  const copyTextToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
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
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                        onClick={() => {
                          setFormData({
                            id: preset.id,
                            name: preset.name,
                            description: preset.description,
                            artist_ids: JSON.parse(preset.artist_ids),
                            noob_str: preset.noob_text || '',
                            nai_str: preset.nai_text || '',
                          })
                          // 解析现有字符串为标签
                          setNoobTags(parseNoobStr(preset.noob_text || ''))
                          setNaiTags(parseNaiStr(preset.nai_text || ''))
                          setNoobInput('')
                          setNaiInput('')
                          setSelectedNoobIndex(null)
                          setSelectedNaiIndex(null)
                          setIsAddDialogOpen(true)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {preset.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {preset.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* 创建/编辑画师串对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{formData.id ? '编辑画师串' : '创建画师串'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-6 py-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input
                id="name"
                placeholder="输入画师串名称"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="noob_format" className="text-base">NOOB格式</Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyTextToClipboard(generateNoobStr(noobTags))}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => adjustNoobWeight(-0.1)}
                    disabled={selectedNoobIndex === null}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => adjustNoobWeight(0.1)}
                    disabled={selectedNoobIndex === null}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div
                className="flex flex-wrap items-center gap-1.5 p-2 min-h-[80px] border rounded-md bg-background cursor-text"
                onClick={(e) => {
                  // 点击空白区域时聚焦输入框
                  const input = e.currentTarget.querySelector('input')
                  input?.focus()
                }}
              >
                {noobTags.map((tag, index) => (
                  <div
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedNoobIndex(selectedNoobIndex === index ? null : index)
                    }}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-sm cursor-pointer transition-colors ${
                      selectedNoobIndex === index
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <span>{tag.name}</span>
                    {tag.weight !== 1.0 && (
                      <span className="text-xs opacity-70 ml-0.5">:{tag.weight.toFixed(1)}</span>
                    )}
                  </div>
                ))}
                <input
                  placeholder={noobTags.length === 0 ? "输入画师名称，按回车添加..." : ""}
                  value={noobInput}
                  onChange={(e) => setNoobInput(e.target.value)}
                  onKeyDown={handleNoobKeyDown}
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm h-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="nai_format" className="text-base">NAI格式</Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyTextToClipboard(generateNaiStr(naiTags))}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => adjustNaiWeight(-0.1)}
                    disabled={selectedNaiIndex === null}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => adjustNaiWeight(0.1)}
                    disabled={selectedNaiIndex === null}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div
                className="flex flex-wrap items-center gap-1.5 p-2 min-h-[80px] border rounded-md bg-background cursor-text"
                onClick={(e) => {
                  // 点击空白区域时聚焦输入框
                  const input = e.currentTarget.querySelector('input')
                  input?.focus()
                }}
              >
                {naiTags.map((tag, index) => (
                  <div
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedNaiIndex(selectedNaiIndex === index ? null : index)
                    }}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-sm cursor-pointer transition-colors ${
                      selectedNaiIndex === index
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <span>{tag.name}</span>
                    {tag.weight !== 1.0 && (
                      <span className="text-xs opacity-70 ml-0.5">:{tag.weight.toFixed(1)}</span>
                    )}
                  </div>
                ))}
                <input
                  placeholder={naiTags.length === 0 ? "输入画师名称，按回车添加..." : ""}
                  value={naiInput}
                  onChange={(e) => setNaiInput(e.target.value)}
                  onKeyDown={handleNaiKeyDown}
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm h-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">描述</Label>
              <Input
                id="description"
                placeholder="添加描述..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 flex justify-between items-center w-full">
             <div className="flex-1">
              {formData.id && (
                <Button
                  variant="destructive"
                  onClick={() => {
                     setCurrentPreset({ id: formData.id } as Preset) // 简单的mock对象用于删除确认
                     setIsDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button onClick={handleSavePreset} disabled={formLoading}>
                {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {formData.id ? '保存' : '创建'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* 删除确认对话框 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此画师串吗？此操作不可撤销。
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
              onClick={() => currentPreset && handleDeletePreset(currentPreset.id)}
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
