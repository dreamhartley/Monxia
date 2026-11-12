/**
 * 画师串草稿：元数据存 localStorage，参考图 Blob 存 IndexedDB。
 *
 * 旧版草稿（noobTags / naiTags 两套数组）会在首次读取时自动迁移到 v2。
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

export interface DraftImageRef {
  key: string
  name: string
  width?: number
  height?: number
}

export interface PresetDraftV2 {
  version: 2
  name: string
  description: string
  format: ArtistFormat
  text: string
  tags: ArtistTag[]
  images: DraftImageRef[]
  updatedAt: string
}

interface LegacyDraft {
  name?: string
  description?: string
  noobTags?: ArtistTag[]
  naiTags?: ArtistTag[]
}

export function emptyDraft(): PresetDraftV2 {
  return {
    version: 2,
    name: '',
    description: '',
    format: 'noob',
    text: '',
    tags: [],
    images: [],
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

function migrateDraft(raw: LegacyDraft & Partial<PresetDraftV2>): PresetDraftV2 | null {
  if (raw.version === 2 && Array.isArray(raw.tags)) {
    const tags = normalizeTags(raw.tags)
    const format: ArtistFormat = raw.format === 'nai' ? 'nai' : 'noob'
    return {
      version: 2,
      name: typeof raw.name === 'string' ? raw.name : '',
      description: typeof raw.description === 'string' ? raw.description : '',
      format,
      text: typeof raw.text === 'string' && raw.text ? raw.text : formatArtistString(tags, format),
      tags,
      images: normalizeImages(raw.images),
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
    version: 2,
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    format,
    text: formatArtistString(tags, format),
    tags,
    images: [],
    updatedAt: new Date().toISOString(),
  }
}

function readFromStorage(): PresetDraftV2 | null {
  let rawText: string | null = null
  try {
    rawText = localStorage.getItem(PRESET_DRAFT_KEY)
  } catch {
    return null
  }
  if (!rawText) return null

  try {
    const raw = JSON.parse(rawText) as LegacyDraft & Partial<PresetDraftV2>
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

let cache: PresetDraftV2 | null | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function ensureLoaded(): PresetDraftV2 | null {
  if (cache === undefined) {
    cache = readFromStorage()
  }
  return cache
}

export function getPresetDraft(): PresetDraftV2 | null {
  return ensureLoaded()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePresetDraft(): PresetDraftV2 | null {
  return useSyncExternalStore(subscribe, getPresetDraft, getPresetDraft)
}

export function hasDraftContent(draft: PresetDraftV2 | null): boolean {
  if (!draft) return false
  return (
    draft.tags.length > 0 ||
    draft.images.length > 0 ||
    draft.name.trim() !== '' ||
    draft.description.trim() !== ''
  )
}

export function updatePresetDraft(
  patch: Partial<PresetDraftV2> | ((draft: PresetDraftV2) => PresetDraftV2)
): boolean {
  const current = ensureLoaded() ?? emptyDraft()
  const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
  const normalized: PresetDraftV2 = {
    ...emptyDraft(),
    ...next,
    version: 2,
    tags: normalizeTags(next.tags),
    images: normalizeImages(next.images),
    updatedAt: new Date().toISOString(),
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
