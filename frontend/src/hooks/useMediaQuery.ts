import { useCallback, useSyncExternalStore } from 'react'

/**
 * 监听媒体查询变化的 Hook
 * @param query 媒体查询字符串，如 '(min-width: 768px)'
 * @returns 是否匹配当前媒体查询
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', onStoreChange)
      return () => mediaQuery.removeEventListener('change', onStoreChange)
    },
    [query]
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** 判断当前是否为移动端（宽度 < 768px） */
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)')
}

/** 判断当前是否为平板端（768px <= 宽度 < 1024px） */
export function useIsTablet(): boolean {
  const isTabletWidth = useMediaQuery('(min-width: 768px)')
  const isDesktopWidth = useMediaQuery('(min-width: 1024px)')
  return isTabletWidth && !isDesktopWidth
}

/** 判断当前是否为桌面端（宽度 >= 1024px） */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
