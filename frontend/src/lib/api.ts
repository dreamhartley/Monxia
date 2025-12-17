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
  autoComplete: (name_noob: string, name_nai: string, danbooru_link: string) =>
    request<{ name_noob: string; name_nai: string; danbooru_link: string }>(
      '/tools/auto-complete',
      {
        method: 'POST',
        body: JSON.stringify({ name_noob, name_nai, danbooru_link }),
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
export const importExportApi = {
  exportJson: () => request<{ categories: Category[]; artists: Artist[] }>('/export/json'),

  importJson: (data: { categories: Category[]; artists: Artist[] }) =>
    request('/import/json', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// 画师串相关
export interface Preset {
  id: number
  name: string
  description: string
  noob_text?: string
  nai_text?: string
  created_at: string
  updated_at: string
}

export const presetApi = {
  getAll: () => request<Preset[]>('/presets'),

  create: (name: string, description: string, noob_text: string, nai_text: string) =>
    request<{ id: number }>('/presets', {
      method: 'POST',
      body: JSON.stringify({ name, description, noob_text, nai_text }),
    }),

  update: (id: number, name: string, description: string, noob_text: string, nai_text: string) =>
    request(`/presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, noob_text, nai_text }),
    }),

  delete: (id: number) =>
    request(`/presets/${id}`, {
      method: 'DELETE',
    }),
}
