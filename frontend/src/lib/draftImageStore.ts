/**
 * 草稿参考图的 IndexedDB 存储。
 *
 * 为什么不放 localStorage：多张 base64 图片很容易超过 5MB，且频繁序列化会影响输入。
 */
export interface StoredDraftImage {
  blob: Blob
  name: string
  width: number
  height: number
}

const DB_NAME = 'monxia_drafts'
const STORE_NAME = 'images'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

export async function isDraftImageStoreAvailable(): Promise<boolean> {
  return (await openDb()) !== null
}

export async function putDraftImage(key: string, image: StoredDraftImage): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(image, key)
    return await new Promise((resolve) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function getDraftImage(key: string): Promise<StoredDraftImage | null> {
  const db = await openDb()
  if (!db) return null
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    return await requestToPromise<StoredDraftImage>(tx.objectStore(STORE_NAME).get(key))
  } catch {
    return null
  }
}

export async function deleteDraftImage(key: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    // 忽略
  }
}

export async function deleteDraftImages(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const key of keys) store.delete(key)
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    // 忽略
  }
}

export async function listDraftImageKeys(): Promise<string[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const keys = await requestToPromise<IDBValidKey[]>(tx.objectStore(STORE_NAME).getAllKeys())
    return (keys ?? []).filter((key): key is string => typeof key === 'string')
  } catch {
    return []
  }
}

export async function clearDraftImages(): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    // 忽略
  }
}

/** 清理没有被草稿元数据引用的孤立图片 */
export async function pruneDraftImages(validKeys: string[]): Promise<void> {
  const allKeys = await listDraftImageKeys()
  const valid = new Set(validKeys)
  await deleteDraftImages(allKeys.filter((key) => !valid.has(key)))
}
