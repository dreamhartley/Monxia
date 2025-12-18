import { useState, useEffect } from 'react'

/**
 * 监听媒体查询变化的 Hook
 * @param query 媒体查询字符串，如 '(min-width: 768px)'
 * @returns 是否匹配当前媒体查询
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * 判断当前是否为移动端（宽度 < 768px）
 */
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)')
}

/**
 * 判断当前是否为平板端（768px <= 宽度 < 1024px）
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px)') && !useMediaQuery('(min-width: 1024px)')
}

/**
 * 判断当前是否为桌面端（宽度 >= 1024px）
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
