/**
 * 画师外部站点链接工具。
 *
 * 数据库中同时保存 Danbooru 与 Gelbooru 链接（后端负责双向补全），
 * 这里优先使用已保存的链接；缺失时按画师名称即时推导。
 * 标签转换规则与后端 booru_links.to_booru_tag 保持一致：
 *   1. 去掉 "artist:" 前缀
 *   2. 还原括号转义（\( \) -> ( )）
 *   3. 空白折叠为下划线（"mika pikazo" -> "mika_pikazo"）
 */

export interface ArtistLinkSource {
  name_noob?: string
  name_nai?: string
  gelbooru_link?: string
}

/** 将画师名称转换为 booru 站点使用的标签形式 */
export function toBooruTag(name?: string): string {
  if (!name) return ''
  const tag = name
    .trim()
    .replace(/^artist:/i, '')
    .replace(/\\([()])/g, '$1')
    .trim()
  return tag ? tag.split(/\s+/).join('_') : ''
}

/** 取画师标签：优先 NOOB 名称，其次 NAI 名称 */
export function getArtistTag(artist: ArtistLinkSource): string {
  return toBooruTag(artist.name_noob) || toBooruTag(artist.name_nai)
}

/**
 * 生成 Gelbooru 作品列表链接。
 * 优先使用后端保存的 gelbooru_link（可能被用户手动调整过），
 * 其次才按名称推导；无有效名称时返回空字符串。
 */
export function getGelbooruUrl(artist: ArtistLinkSource): string {
  const stored = (artist.gelbooru_link || '').trim()
  if (stored) return stored

  const tag = getArtistTag(artist)
  if (!tag) return ''
  return `https://gelbooru.com/index.php?page=post&s=list&tags=${encodeURIComponent(tag)}`
}
