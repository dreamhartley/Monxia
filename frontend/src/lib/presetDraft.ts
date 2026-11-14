/**
 * 画师串草稿：元数据存 localStorage，参考图 Blob 存 IndexedDB。
 *
 * v3 起区分两种草稿模式：
 * - create：新建画师串，任意字段有内容即算草稿；
 * - edit：编辑已有画师串，会同时保存原始快照，只有存在未保存改动时才算草稿，
 *   「清空草稿」即放弃改动并恢复原始内容。
 *
 * 旧版草稿（v1 的 noobTags / naiTags、v2 的单模式结构）会在首次读取时自动迁移。
 */
import { useSyncExternalStore } from 'react'
import {
  formatArtistString,
  normalizeArtistName,
  type ArtistFormat,
  type ArtistTag,
} from './artistString'
import { clearDraftImages, deleteDraftImages } from './draftImageStore'

export const PRESET_DRAFT_KEY = 'preset_draft'

export type PresetDraftMode = 'create' | 'edit'

export interface DraftImageRef {
  key: string
  name: string
  width?: number
  height?: number
}

/** 编辑会话开始时画师串已有的参考图（来自服务端，不复制到 IndexedDB） */
export interface DraftPresetImage {
  id: number
  filename: string
  name: string
}

/** 编辑模式的原始快照：用于脏检查与「清空草稿」回填 */
export interface PresetDraftOrigin {
  name: string
  description: string
  format: ArtistFormat
  text: string
  images: DraftPresetImage[]
}

export interface PresetDraftV3 {
  version: 3
  mode: PresetDraftMode
  /** 编辑模式下正在编辑的画师串 id */
  presetId: number | null
  /** 编辑模式的原始快照 */
  origin: PresetDraftOrigin | null
  name: string
  description: string
  format: ArtistFormat
  text: string
  tags: ArtistTag[]
  /** 本轮新添加的参考图（Blob 存在 IndexedDB） */
  images: DraftImageRef[]
  /** 编辑模式下被移除的原有参考图 id */
  removedImageIds: number[]
  updatedAt: string
}

interface LegacyDraft {
  version?: number
  mode?: PresetDraftMode
  presetId?: number | null
  origin?: unknown
  name?: string
  description?: string
  format?: string
  text?: string
  images?: unknown
  removedImageIds?: unknown
  updatedAt?: string
  noobTags?: ArtistTag[]
  naiTags?: ArtistTag[]
}

export function emptyDraft(): PresetDraftV3 {
  return {
    version: 3,
    mode: 'create',
    presetId: null,
    origin: null,
    name: '',
    description: '',
    format: 'noob',
    text: '',
    tags: [],
    images: [],
    removedImageIds: [],
    updatedAt: new Date().toISOString(),
  }
}

function normalizeTags(tags: unknown): ArtistTag[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const result: ArtistTag[] = []
  for (const item of tags) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Partial<ArtistTag>
    if (typeof candidate.name !== 'string') continue
    const name = normalizeArtistName(candidate.name)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const weight = typeof candidate.weight === 'number' && Number.isFinite(candidate.weight)
      ? candidate.weight
      : 1
    result.push({ name, weight })
  }
  return result
}

function normalizeImages(images: unknown): DraftImageRef[] {
  if (!Array.isArray(images)) return []
  const result: DraftImageRef[] = []
  for (const item of images) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Partial<DraftImageRef>
    if (typeof candidate.key !== 'string' || !candidate.key) continue
    result.push({
      key: candidate.key,
      name: typeof candidate.name === 'string' ? candidate.name : '参考图',
      width: typeof candidate.width === 'number' ? candidate.width : undefined,
      height: typeof candidate.height === 'number' ? candidate.height : undefined,
    })
  }
  return result
}

function normalizeIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<number>()
  const result: number[] = []
  for (const item of ids) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue
    if (seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function normalizeOrigin(origin: unknown): PresetDraftOrigin | null {
  if (!origin || typeof origin !== 'object') return null
  const raw = origin as Partial<PresetDraftOrigin>
  const images: DraftPresetImage[] = []
  if (Array.isArray(raw.images)) {
    for (const item of raw.images) {
      if (!item || typeof item !== 'object') continue
      const candidate = item as Partial<DraftPresetImage>
      if (typeof candidate.id !== 'number' || !Number.isFinite(candidate.id)) continue
      if (typeof candidate.filename !== 'string' || !candidate.filename) continue
      images.push({
        id: candidate.id,
        filename: candidate.filename,
        name:
          typeof candidate.name === 'string' && candidate.name
            ? candidate.name
            : `参考图 ${candidate.id}`,
      })
    }
  }
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    format: raw.format === 'nai' ? 'nai' : 'noob',
    text: typeof raw.text === 'string' ? raw.text : '',
    images,
  }
}

function migrateDraft(raw: LegacyDraft & Partial<PresetDraftV3>): PresetDraftV3 | null {
  const rawVersion: number | undefined = raw.version
  if ((rawVersion === 2 || rawVersion === 3) && Array.isArray(raw.tags)) {
    const tags = normalizeTags(raw.tags)
    const format: ArtistFormat = raw.format === 'nai' ? 'nai' : 'noob'
    const origin = normalizeOrigin(raw.origin)
    const presetId =
      typeof raw.presetId === 'number' && Number.isFinite(raw.presetId) ? raw.presetId : null
    // 缺少原始快照的编辑草稿无法恢复，按新建草稿处理，避免丢内容
    const mode: PresetDraftMode =
      raw.mode === 'edit' && origin && presetId !== null ? 'edit' : 'create'

    return {
      version: 3,
      mode,
      presetId: mode === 'edit' ? presetId : null,
      origin: mode === 'edit' ? origin : null,
      name: typeof raw.name === 'string' ? raw.name : '',
      description: typeof raw.description === 'string' ? raw.description : '',
      format,
      text: typeof raw.text === 'string' && raw.text ? raw.text : formatArtistString(tags, format),
      tags,
      images: normalizeImages(raw.images),
      removedImageIds: mode === 'edit' ? normalizeIds(raw.removedImageIds) : [],
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    }
  }

  // v1：优先 NOOB，其次 NAI
  const noobTags = normalizeTags(raw.noobTags)
  const naiTags = normalizeTags(raw.naiTags)
  const tags = noobTags.length > 0 ? noobTags : naiTags
  const format: ArtistFormat = noobTags.length > 0 ? 'noob' : 'nai'

  const hasContent =
    (typeof raw.name === 'string' && raw.name.trim() !== '') ||
    (typeof raw.description === 'string' && raw.description.trim() !== '') ||
    tags.length > 0

  if (!hasContent) return null

  return {
    version: 3,
    mode: 'create',
    presetId: null,
    origin: null,
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    format,
    text: formatArtistString(tags, format),
    tags,
    images: [],
    removedImageIds: [],
    updatedAt: new Date().toISOString(),
  }
}

function readFromStorage(): PresetDraftV3 | null {
  let rawText: string | null = null
  try {
    rawText = localStorage.getItem(PRESET_DRAFT_KEY)
  } catch {
    return null
  }
  if (!rawText) return null

  try {
    const raw = JSON.parse(rawText) as LegacyDraft & Partial<PresetDraftV3>
    const draft = migrateDraft(raw)
    // 迁移后立即回写，避免每次读取都走旧结构
    if (draft) {
      try {
        localStorage.setItem(PRESET_DRAFT_KEY, JSON.stringify(draft))
      } catch {
        // 回写失败不影响本次读取
      }
    }
    return draft
  } catch {
    return null
  }
}

let cache: PresetDraftV3 | null | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function ensureLoaded(): PresetDraftV3 | null {
  if (cache === undefined) {
    cache = readFromStorage()
  }
  return cache
}

export function getPresetDraft(): PresetDraftV3 | null {
  return ensureLoaded()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePresetDraft(): PresetDraftV3 | null {
  return useSyncExternalStore(subscribe, getPresetDraft, getPresetDraft)
}

/**
 * 草稿是否值得保留。
 * 编辑草稿以「与原始快照相比是否有改动」为准：只是打开看一下不会留下草稿。
 */
export function hasDraftContent(draft: PresetDraftV3 | null): boolean {
  if (!draft) return false

  if (draft.mode === 'edit') {
    const origin = draft.origin
    // 原始快照缺失时按有内容处理，避免误清空
    if (!origin) return true
    if (draft.images.length > 0 || draft.removedImageIds.length > 0) return true
    return (
      draft.name !== origin.name ||
      draft.description !== origin.description ||
      draft.format !== origin.format ||
      draft.text.trim() !== origin.text.trim()
    )
  }

  return (
    draft.tags.length > 0 ||
    draft.images.length > 0 ||
    draft.name.trim() !== '' ||
    draft.description.trim() !== ''
  )
}

export function updatePresetDraft(
  patch: Partial<PresetDraftV3> | ((draft: PresetDraftV3) => PresetDraftV3)
): boolean {
  const current = ensureLoaded() ?? emptyDraft()
  const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
  const mode: PresetDraftMode = next.mode === 'edit' ? 'edit' : 'create'
  const presetId =
    mode === 'edit' && typeof next.presetId === 'number' && Number.isFinite(next.presetId)
      ? next.presetId
      : null
  const origin = mode === 'edit' ? normalizeOrigin(next.origin) : null

  const normalized: PresetDraftV3 = {
    ...emptyDraft(),
    ...next,
    version: 3,
    // 编辑信息不完整的草稿降级为新建草稿
    mode: mode === 'edit' && origin && presetId !== null ? 'edit' : 'create',
    presetId,
    origin,
    tags: normalizeTags(next.tags),
    images: normalizeImages(next.images),
    removedImageIds: mode === 'edit' ? normalizeIds(next.removedImageIds) : [],
    updatedAt: new Date().toISOString(),
  }

  if (normalized.mode === 'create') {
    normalized.presetId = null
    normalized.origin = null
    normalized.removedImageIds = []
  }

  cache = normalized
  let ok = true
  try {
    localStorage.setItem(PRESET_DRAFT_KEY, JSON.stringify(normalized))
  } catch {
    ok = false
  }
  emit()
  return ok
}

export async function clearPresetDraft(): Promise<void> {
  const current = ensureLoaded()
  cache = null
  try {
    localStorage.removeItem(PRESET_DRAFT_KEY)
  } catch {
    // 忽略：内存中已清空
  }
  emit()

  if (current) {
    await deleteDraftImages(current.images.map((image) => image.key))
  } else {
    // 极端情况下元数据读不出来，也尽量清掉遗留草稿图
    await clearDraftImages()
  }
}

// 多标签页同步
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== PRESET_DRAFT_KEY) return
    cache = readFromStorage()
    emit()
  })
}
