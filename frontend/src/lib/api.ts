import type { ArtistFormat } from './artistString'

const API_BASE = '/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json()
    return data
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    }
  }
}

// 认证相关
export const authApi = {
  login: (username: string, password: string) =>
    request<{ message: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ message: string }>('/logout', {
      method: 'POST',
    }),

  checkAuth: () =>
    request<{ logged_in: boolean; username?: string }>('/check-auth'),
}

// 账户管理相关
export const accountApi = {
  getInfo: () => request<{ username: string }>('/account/info'),

  update: (data: {
    current_password: string
    new_username?: string
    new_password?: string
  }) =>
    request<{ message: string }>('/account/update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// 分类相关
export interface Category {
  id: number
  name: string
  display_order: number
  artist_count: number
  created_at: string
}

export const categoryApi = {
  getAll: () => request<Category[]>('/categories'),

  create: (name: string) =>
    request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  update: (id: number, name: string) =>
    request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  delete: (id: number) =>
    request(`/categories/${id}`, {
      method: 'DELETE',
    }),
}

// 画师相关
export interface Artist {
  id: number
  name_noob: string
  name_nai: string
  danbooru_link: string
  gelbooru_link: string
  post_count: number | null
  notes: string
  image_example: string
  skip_danbooru: boolean
  category_id: number | null
  category_name: string
  categories: Category[]
  created_at: string
  updated_at: string
}

export interface CreateArtistData {
  category_ids: number[]
  name_noob?: string
  name_nai?: string
  danbooru_link?: string
  gelbooru_link?: string
  post_count?: number
  notes?: string
  skip_danbooru?: boolean
}

export const artistApi = {
  getAll: (categoryId?: number) =>
    request<Artist[]>(categoryId ? `/artists?category_id=${categoryId}` : '/artists'),

  getById: (id: number) => request<Artist>(`/artists/${id}`),

  create: (data: CreateArtistData) =>
    request<Artist>('/artists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<CreateArtistData> & { auto_complete?: boolean }) =>
    request<Artist>(`/artists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request(`/artists/${id}`, {
      method: 'DELETE',
    }),

  uploadImage: (id: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return fetch(`${API_BASE}/artists/${id}/upload-image`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then((res) => res.json())
  },
}

// 工具相关
export interface AutoCompleteProgress {
  type: 'start' | 'progress' | 'phase' | 'complete' | 'error'
  phase?: 'names' | 'fetch'
  source?: DataSource
  current?: number
  total?: number
  artist_name?: string
  updated_count?: number
  fetched_count?: number
  image_failed_count?: number
  image_failed_artists?: string[]
  message?: string
  error?: string
}

export const toolsApi = {
  autoComplete: (name_noob: string, name_nai: string, danbooru_link: string, gelbooru_link = '') =>
    request<{ name_noob: string; name_nai: string; danbooru_link: string; gelbooru_link: string }>(
      '/tools/auto-complete',
      {
        method: 'POST',
        body: JSON.stringify({ name_noob, name_nai, danbooru_link, gelbooru_link }),
      }
    ),

  // SSE 流式自动补全
  autoCompleteAllStream: (onProgress: (data: AutoCompleteProgress) => void): (() => void) => {
    const eventSource = new EventSource(`${API_BASE}/tools/auto-complete-all-stream`, {
      withCredentials: true,
    })

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AutoCompleteProgress
        onProgress(data)

        // 完成或错误时关闭连接
        if (data.type === 'complete' || data.type === 'error') {
          eventSource.close()
        }
      } catch (e) {
        console.error('Failed to parse SSE data:', e)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      onProgress({ type: 'error', error: '连接中断' })
    }

    // 返回关闭函数
    return () => eventSource.close()
  },

  fetchPostCounts: (artist_ids: number[]) =>
    request<Record<number, { post_count: number; example_image: string }>>(
      '/tools/fetch-post-counts',
      {
        method: 'POST',
        body: JSON.stringify({ artist_ids }),
      }
    ),
}

// 导入导出相关
export interface ImportProgress {
  type: 'start' | 'phase' | 'phase_complete' | 'progress' | 'complete' | 'error'
  phase?: 'categories' | 'dedup_load' | 'process' | 'database' | 'presets'
  action?: 'create' | 'update'
  current?: number
  total?: number
  total_categories?: number
  total_artists?: number
  total_presets?: number
  to_create?: number
  to_update?: number
  count?: number
  created?: number
  updated?: number
  categories_count?: number
  presets_created?: number
  presets_updated?: number
  created_count?: number
  updated_count?: number
  message?: string
  error?: string
}

export const importExportApi = {
  exportJson: () => request<ExportData>('/export/json'),

  // SSE 流式导入（并发优化版本）
  importJsonStream: (
    data: ExportData,
    onProgress: (data: ImportProgress) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      fetch(`${API_BASE}/import/json-stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No response body')
          }

          const decoder = new TextDecoder()
          let buffer = ''

          const processText = (text: string) => {
            buffer += text
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6)
                  const data = JSON.parse(jsonStr) as ImportProgress
                  onProgress(data)

                  if (data.type === 'complete') {
                    resolve()
                  } else if (data.type === 'error') {
                    reject(new Error(data.error || '导入失败'))
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e)
                }
              }
            }
          }

          const read = (): Promise<void> => {
            return reader.read().then(({ done, value }) => {
              if (done) {
                if (buffer) processText('')
                return
              }
              processText(decoder.decode(value, { stream: true }))
              return read()
            })
          }

          return read()
        })
        .catch((error) => {
          onProgress({ type: 'error', error: error.message })
          reject(error)
        })
    })
  },
}

// 画师串相关
export type PresetFormat = ArtistFormat

export interface PresetImage {
  id: number
  filename: string
  display_order: number
}

export interface Preset {
  id: number
  name: string
  description: string
  format: PresetFormat
  text: string
  images: PresetImage[]
  created_at: string
  updated_at: string
}

export interface PresetInput {
  name: string
  description: string
  format: PresetFormat
  text: string
}

/** 备份中的画师串只包含名称 / 格式 / 内容 */
export interface ExportPreset {
  name: string
  format: PresetFormat
  text: string
}

export interface ExportData {
  version?: number
  exported_at?: string
  categories: Category[]
  artists: Artist[]
  presets?: ExportPreset[]
}

export function presetImageUrl(filename: string): string {
  return `/preset-images/${encodeURIComponent(filename)}`
}

export const presetApi = {
  getAll: () => request<Preset[]>('/presets'),

  create: (data: PresetInput) =>
    request<Preset>('/presets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: PresetInput) =>
    request<Preset>(`/presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request(`/presets/${id}`, {
      method: 'DELETE',
    }),

  uploadImages: (id: number, files: File[]) => {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    return fetch(`${API_BASE}/presets/${id}/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then((res) => res.json()) as Promise<
      ApiResponse<{ images: PresetImage[]; failed?: Array<{ name: string; error: string }> }>
    >
  },

  deleteImage: (id: number, imageId: number) =>
    request(`/presets/${id}/images/${imageId}`, {
      method: 'DELETE',
    }),
}

// 登录背景图相关
export interface BackgroundInfo {
  has_custom: boolean
  url: string | null
}

export const backgroundApi = {
  // 获取当前背景图信息（不需要登录）
  getInfo: () => request<BackgroundInfo>('/background'),

  // 上传背景图
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return fetch(`${API_BASE}/background/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then((res) => res.json())
  },

  // 删除自定义背景图
  delete: () =>
    request('/background', {
      method: 'DELETE',
    }),
}

// Danbooru API 配置相关
export interface DanbooruConfig {
  username: string
  api_key_masked: string
  has_config: boolean
}

export const danbooruConfigApi = {
  // 获取当前配置
  get: () => request<DanbooruConfig>('/settings/danbooru'),

  // 更新配置
  update: (data: { username: string; api_key: string }) =>
    request<{ message: string }>('/settings/danbooru', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 清除配置
  clear: () =>
    request<{ message: string }>('/settings/danbooru', {
      method: 'DELETE',
    }),
}

// 数据来源相关
export type DataSource = 'danbooru' | 'gelbooru'

export interface DataSourceSettings {
  source: DataSource
  danbooru: {
    configured: boolean
    username: string
    api_key_masked: string
  }
  gelbooru: {
    configured: boolean
    user_id: string
    api_key_masked: string
  }
  ready: boolean
  warning?: string
}

export const dataSourceApi = {
  get: () => request<DataSourceSettings>('/settings/data-source'),

  update: (source: DataSource) =>
    request<DataSourceSettings>('/settings/data-source', {
      method: 'PUT',
      body: JSON.stringify({ source }),
    }),
}

// Gelbooru API 配置相关
export interface GelbooruConfig {
  user_id: string
  api_key_masked: string
  has_config: boolean
}

export interface GelbooruTestResult {
  ok: boolean
  message: string
  sample_tag?: string
  sample_count?: number
}

export const gelbooruConfigApi = {
  get: () => request<GelbooruConfig>('/settings/gelbooru'),

  update: (data: { user_id: string; api_key: string }) =>
    request<{ message: string }>('/settings/gelbooru', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  clear: () =>
    request<{ message: string }>('/settings/gelbooru', {
      method: 'DELETE',
    }),

  test: () =>
    request<GelbooruTestResult>('/settings/gelbooru/test', {
      method: 'POST',
    }),
}
