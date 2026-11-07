"""
Booru 站点链接与标签工具（纯函数，不依赖其它业务模块）

本工具同时服务 Danbooru 与 Gelbooru：
  - 把画师名称转换成站点标签（空格转下划线、去掉 artist: 前缀、还原括号转义）
  - 生成站点链接
  - 从任一站点链接中解析标签，再转换成另一站点的链接

两家站点的标签命名基本一致，因此可以互相转换；用户发现不一致时可以在
画师编辑弹窗里手动修改对应链接。
"""
import re
from typing import Optional, Tuple
from urllib.parse import quote, unquote

SOURCE_DANBOORU = 'danbooru'
SOURCE_GELBOORU = 'gelbooru'
SUPPORTED_SOURCES = (SOURCE_DANBOORU, SOURCE_GELBOORU)
DEFAULT_SOURCE = SOURCE_DANBOORU

DANBOORU_LINK_PREFIX = 'https://danbooru.donmai.us/posts?tags='
GELBOORU_LINK_PREFIX = 'https://gelbooru.com/index.php?page=post&s=list&tags='

# 从链接中提取 tags 参数（兼容 danbooru 的 ?tags= 与 gelbooru 的 &tags=）
_TAG_PATTERN = re.compile(r'[?&]tags=([^&#]+)')


def normalize_source(source: Optional[str]) -> str:
    """校验并归一化数据来源，非法值回落到默认值"""
    value = (source or '').strip().lower()
    return value if value in SUPPORTED_SOURCES else DEFAULT_SOURCE


def to_booru_tag(name: Optional[str]) -> str:
    """
    画师名称 -> booru 标签
    1. 去掉 "artist:" 前缀
    2. 还原括号转义（\\( \\) -> ( )）
    3. 空白折叠为下划线（"mika pikazo" -> "mika_pikazo"）
    """
    if not name:
        return ''
    tag = name.strip()
    if tag.lower().startswith('artist:'):
        tag = tag[7:]
    tag = re.sub(r'\\([()])', r'\1', tag).strip()
    return '_'.join(tag.split()) if tag else ''


def extract_tag_from_link(link: Optional[str]) -> str:
    """
    从 Danbooru / Gelbooru 链接中解析画师标签
    例：https://danbooru.donmai.us/posts?tags=mika_pikazo -> mika_pikazo
        https://gelbooru.com/index.php?page=post&s=list&tags=mika_pikazo -> mika_pikazo
    """
    if not isinstance(link, str) or not link:
        return ''
    match = _TAG_PATTERN.search(link)
    if not match:
        return ''
    raw = unquote(match.group(1)).replace('+', ' ')
    return '_'.join(raw.split())


def build_link(source: str, tag: str) -> str:
    """根据标签生成站点作品列表链接（括号保持原样，便于阅读）"""
    if not tag:
        return ''
    if normalize_source(source) == SOURCE_GELBOORU:
        return f'{GELBOORU_LINK_PREFIX}{quote(tag, safe="()")}'
    return f'{DANBOORU_LINK_PREFIX}{quote(tag, safe="()")}'


def build_link_from_name(source: str, name: Optional[str]) -> str:
    """根据画师名称生成站点链接"""
    return build_link(source, to_booru_tag(name))


def convert_link(link: Optional[str], target_source: str) -> str:
    """把一个站点的链接转换成目标站点的链接（标签一致时）"""
    tag = extract_tag_from_link(link)
    return build_link(target_source, tag) if tag else ''


def sync_links(
    name_noob: Optional[str],
    name_nai: Optional[str],
    danbooru_link: Optional[str],
    gelbooru_link: Optional[str],
) -> Tuple[str, str]:
    """
    双向补全两个站点的链接，返回 (danbooru_link, gelbooru_link)。

    规则：
      1. 两边都有链接：原样保留（尊重用户手动修改）
      2. 只有一边有：用它的标签生成另一边
      3. 两边都没有：用画师名称（优先 NOOB）生成两边
    """
    danbooru_link = (danbooru_link or '').strip()
    gelbooru_link = (gelbooru_link or '').strip()

    if danbooru_link and gelbooru_link:
        return danbooru_link, gelbooru_link

    if danbooru_link:
        return danbooru_link, convert_link(danbooru_link, SOURCE_GELBOORU) or gelbooru_link

    if gelbooru_link:
        return convert_link(gelbooru_link, SOURCE_DANBOORU) or danbooru_link, gelbooru_link

    tag = to_booru_tag(name_noob) or to_booru_tag(name_nai)
    if not tag:
        return '', ''
    return build_link(SOURCE_DANBOORU, tag), build_link(SOURCE_GELBOORU, tag)


def link_for_source(artist: dict, source: str) -> str:
    """
    取画师在指定来源下的链接。
    优先取已保存的链接，否则按名称即时生成，保证抓取时不会因为缺链接而跳过。
    """
    source = normalize_source(source)
    if source == SOURCE_GELBOORU:
        link = (artist.get('gelbooru_link') or '').strip()
        name = artist.get('name_noob') or artist.get('name_nai')
        return link or build_link_from_name(SOURCE_GELBOORU, name)
    link = (artist.get('danbooru_link') or '').strip()
    name = artist.get('name_noob') or artist.get('name_nai')
    return link or build_link_from_name(SOURCE_DANBOORU, name)
