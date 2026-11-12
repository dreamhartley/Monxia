/**
 * 画师串统一解析 / 识别 / 生成工具
 *
 * 数据模型里保存的是「纯名称 + 权重」，格式（NOOB / NAI）只在生成字符串时套用。
 * 编辑器与工具页都复用这里的实现，避免出现两套不一致的解析逻辑。
 */

export type ArtistFormat = 'noob' | 'nai'
export type DetectedFormat = ArtistFormat | 'plain' | 'mixed'

export interface ArtistTag {
  name: string
  weight: number
}

export interface ParseResult {
  tags: ArtistTag[]
  detected: DetectedFormat
  hasWeights: boolean
  warnings: string[]
}

const SEPARATOR = /[,，\n]/

/** 还原名称：去首尾空格、下划线转空格、还原 NOOB 转义、去掉 NAI 前缀 */
export function normalizeArtistName(raw: string): string {
  let name = raw.trim()
  name = name.replace(/_/g, ' ')
  name = name.replace(/\\([()])/g, '$1')
  // 允许 "artist: artist:foo" 这类重复前缀
  while (/^artist:\s*/i.test(name)) {
    name = name.replace(/^artist:\s*/i, '')
  }
  return name.trim()
}

export function escapeParens(name: string): string {
  return name.replace(/([()])/g, '\\$1')
}

/** 单个人名格式化为 NOOB（清洗 + 转义括号） */
export function formatNoobName(name: string): string {
  return escapeParens(normalizeArtistName(name))
}

/** 单个人名格式化为 NAI（清洗 + artist: 前缀） */
export function formatNaiName(name: string): string {
  return `artist:${normalizeArtistName(name)}`
}

/** 权重输出：去掉多余的 0，最多保留两位小数 */
export function formatWeight(weight: number): string {
  if (!Number.isFinite(weight)) return '1'
  const rounded = Math.round(weight * 100) / 100
  return String(rounded)
}

/** 页码 / 分隔用：切成顶层片段，保留 NAI 权重组与 NOOB 括号内部内容 */
function splitTopLevel(text: string): string[] {
  const result: string[] = []
  let current = ''
  let depth = 0
  let i = 0

  while (i < text.length) {
    const char = text[i]

    // 转义括号不参与深度计算
    if (char === '\\' && i + 1 < text.length) {
      const next = text[i + 1]
      if (next === '(' || next === ')') {
        current += char + next
        i += 2
        continue
      }
    }

    // 顶层且以数字开头时，尝试识别 NAI 权重组 "1.2::...::"
    if (depth === 0 && /[0-9]/.test(char)) {
      const rest = text.slice(i)
      const weightMatch = rest.match(/^(\d+(?:\.\d+)?)::/)
      if (weightMatch) {
        const close = text.indexOf('::', i + weightMatch[0].length)
        if (close !== -1) {
          current += text.slice(i, close + 2)
          i = close + 2
          continue
        }
      }
    }

    if (char === '(') {
      depth += 1
      current += char
      i += 1
      continue
    }

    if (char === ')') {
      depth = Math.max(0, depth - 1)
      current += char
      i += 1
      continue
    }

    if (depth === 0 && SEPARATOR.test(char)) {
      if (current.trim()) result.push(current.trim())
      current = ''
      i += 1
      continue
    }

    current += char
    i += 1
  }

  if (current.trim()) result.push(current.trim())
  return result
}

function dedupeTags(tags: ArtistTag[]): ArtistTag[] {
  const seen = new Set<string>()
  const result: ArtistTag[] = []
  for (const tag of tags) {
    const key = tag.name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ name: tag.name.trim(), weight: tag.weight })
  }
  return result
}

function parseWeight(value: string): number | null {
  const weight = Number.parseFloat(value)
  if (!Number.isFinite(weight)) return null
  return weight
}

/** 解析 NOOB 括号内容；defaultWeight 会应用到没有显式权重的子项 */
function parseNoobContent(content: string, defaultWeight: number, depthLimit = 8): ArtistTag[] {
  if (depthLimit <= 0) return []
  const tags: ArtistTag[] = []

  for (const part of splitTopLevel(content)) {
    const group = part.match(/^\(([\s\S]*):(\d+(?:\.\d+)?)\)$/)
    if (group) {
      const weight = parseWeight(group[2])
      if (weight === null) continue
      const nested = parseNoobContent(group[1], weight, depthLimit - 1)
      if (nested.length > 0) {
        tags.push(...nested)
      } else {
        const name = normalizeArtistName(group[1])
        if (name) tags.push({ name, weight })
      }
      continue
    }

    const name = normalizeArtistName(part)
    if (name) tags.push({ name, weight: defaultWeight })
  }

  return tags
}

function parseSegment(segment: string): ArtistTag[] {
  const trimmed = segment.trim().replace(/[,，]+$/, '').trim()
  if (!trimmed) return []

  // NAI 权重组：1.2::artist:a, artist:b::
  const naiGroup = trimmed.match(/^(\d+(?:\.\d+)?)::([\s\S]*)::$/)
  if (naiGroup) {
    const weight = parseWeight(naiGroup[1])
    if (weight === null) return []
    const tags: ArtistTag[] = []
    for (const part of naiGroup[2].split(/[,，\n]/)) {
      const name = normalizeArtistName(part)
      if (name) tags.push({ name, weight })
    }
    return tags
  }

  // NOOB 权重组：(name:1.2) / ((a:1.2), b:1.1)
  const noobGroup = trimmed.match(/^\(([\s\S]*):(\d+(?:\.\d+)?)\)$/)
  if (noobGroup) {
    const weight = parseWeight(noobGroup[2])
    if (weight === null) return []
    const nested = parseNoobContent(noobGroup[1], weight)
    if (nested.length > 0) return nested
    const name = normalizeArtistName(noobGroup[1])
    return name ? [{ name, weight }] : []
  }

  const name = normalizeArtistName(trimmed)
  return name ? [{ name, weight: 1 }] : []
}

/** 识别整段字符串的格式特征 */
export function detectArtistFormat(text: string): DetectedFormat {
  const naiHits =
    (text.match(/artist:/gi)?.length ?? 0) +
    (text.match(/\d+(?:\.\d+)?::/g)?.length ?? 0)
  const noobHits =
    (text.match(/\\[()]/g)?.length ?? 0) +
    (text.match(/\([^()]*:\d+(?:\.\d+)?\)/g)?.length ?? 0)

  if (naiHits > 0 && noobHits === 0) return 'nai'
  if (noobHits > 0 && naiHits === 0) return 'noob'
  if (naiHits > 0 && noobHits > 0) return 'mixed'
  return 'plain'
}

export function parseArtistString(text: string): ParseResult {
  const warnings: string[] = []
  const tags: ArtistTag[] = []

  for (const segment of splitTopLevel(text)) {
    const parsed = parseSegment(segment)
    if (parsed.length === 0) {
      warnings.push(`无法识别片段：${segment.slice(0, 40)}`)
      continue
    }
    tags.push(...parsed)
  }

  const uniqueTags = dedupeTags(tags)

  if (text.trim() && uniqueTags.length === 0) {
    warnings.push('未解析出任何画师，请检查输入内容')
  }

  return {
    tags: uniqueTags,
    detected: detectArtistFormat(text),
    hasWeights: uniqueTags.some((tag) => tag.weight !== 1),
    warnings,
  }
}

function formatNoobTag(tag: ArtistTag): string {
  const name = escapeParens(tag.name)
  if (tag.weight === 1) return name
  return `(${name}:${formatWeight(tag.weight)})`
}

function formatNaiTag(tag: ArtistTag): string {
  const name = `artist:${tag.name}`
  if (tag.weight === 1) return name
  return `${formatWeight(tag.weight)}::${name}::`
}

/** 生成指定格式的完整字符串；NAI 会把连续同权重标签合并成一组 */
export function formatArtistString(tags: ArtistTag[], format: ArtistFormat): string {
  if (tags.length === 0) return ''

  if (format === 'noob') {
    return tags.map(formatNoobTag).join(', ')
  }

  const parts: string[] = []
  let index = 0
  while (index < tags.length) {
    const tag = tags[index]
    if (tag.weight === 1) {
      parts.push(formatNaiTag(tag))
      index += 1
      continue
    }

    const group: string[] = []
    while (index < tags.length && tags[index].weight === tag.weight) {
      group.push(`artist:${tags[index].name}`)
      index += 1
    }
    parts.push(`${formatWeight(tag.weight)}::${group.join(', ')}::`)
  }

  return parts.join(', ')
}

export function convertArtistString(text: string, target: ArtistFormat): {
  text: string
  tags: ArtistTag[]
  source: DetectedFormat
} {
  const parsed = parseArtistString(text)
  return {
    text: formatArtistString(parsed.tags, target),
    tags: parsed.tags,
    source: parsed.detected,
  }
}
