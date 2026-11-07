"""
Gelbooru 抓取客户端（纯 HTTP，httpx 驱动）

Gelbooru 没有 Danbooru 那样的 Cloudflare 人机验证，普通 HTTP 请求即可，因此
不需要 Playwright。但它的 API 从 2022 年起要求每次请求都带账号凭据：

    https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1
        &api_key=<API Key>&user_id=<User ID>

返回 JSON 的根节点带 `@attributes`（含 limit/offset/count），帖子在 `post` 中；
作品总数直接取 `@attributes.count`。

另外实测：图片 CDN（img*.gelbooru.com）会校验来源，不带
`Referer: https://gelbooru.com/` 时返回的是 HTML 拦截页而不是图片，
所以下载图片时必须带上该请求头。

用法（异步）：
    async with GelbooruClient(user_id='...', api_key='...') as client:
        count = await client.get_post_count("artist_name")
        posts = await client.get_posts("artist_name", limit=10)
"""
import logging
from typing import Dict, List, Optional, Union

import httpx

from booru_base import BooruAuthError, BooruClientBase, BooruConfigError

# httpx 默认把完整 URL 打进 INFO 日志，而 Gelbooru 的 API Key 就在查询串里，
# 因此这里压低底层日志级别，避免凭据出现在日志中。
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

GELBOORU_BASE = "https://gelbooru.com"
GELBOORU_API_URL = f"{GELBOORU_BASE}/index.php"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    # 图片 CDN 校验来源，带上站点首页作为 Referer
    "Referer": f"{GELBOORU_BASE}/",
}

# Gelbooru 返回的帖子字段里，优先使用体积适中的 sample，其次才用原图
_SAMPLE_KEYS = ("sample_url", "file_url", "preview_url")


class GelbooruClient(BooruClientBase):
    """Gelbooru DAPI 客户端，一个实例对应一次抓取任务。"""

    source = 'gelbooru'

    def __init__(self, user_id: str = '', api_key: str = '',
                 concurrency: int = 3, timeout: int = 30):
        super().__init__(concurrency=concurrency, timeout=timeout)
        self.user_id = (user_id or '').strip()
        self.api_key = (api_key or '').strip()
        self._client: Optional[httpx.AsyncClient] = None

    # -------------------------------
    # 生命周期
    # -------------------------------

    async def start(self) -> None:
        if not self.user_id or not self.api_key:
            raise BooruConfigError(
                "Gelbooru 抓取需要 API 凭据，请到「设置 → 数据来源」填写 User ID 与 API Key"
            )
        timeout = httpx.Timeout(self.timeout, connect=10.0)
        self._client = httpx.AsyncClient(
            headers=DEFAULT_HEADERS,
            timeout=timeout,
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=max(4, self.concurrency * 2),
                max_keepalive_connections=self.concurrency,
            ),
        )

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # -------------------------------
    # API 请求
    # -------------------------------

    async def _api(self, params: Dict[str, Union[str, int]]) -> Optional[Union[Dict, List]]:
        """请求 Gelbooru DAPI，返回解析后的 JSON"""
        if self._client is None:
            raise BooruConfigError("Gelbooru 客户端尚未启动")

        query = {
            "page": "dapi",
            "q": "index",
            "json": 1,
            "api_key": self.api_key,
            "user_id": self.user_id,
        }
        query.update(params)

        try:
            response = await self._client.get(GELBOORU_API_URL, params=query)
        except httpx.HTTPError as e:
            logging.warning(f"Gelbooru 请求失败: {e}")
            return None

        if response.status_code == 401:
            raise BooruAuthError("Gelbooru 凭据无效（401），请到设置页检查 User ID 与 API Key")
        if response.status_code != 200:
            logging.warning(f"Gelbooru 请求失败: HTTP {response.status_code}")
            return None

        try:
            return response.json()
        except ValueError as e:
            logging.warning(f"解析 Gelbooru 响应失败: {e}")
            return None

    async def get_post_count(self, artist_tag: str) -> Optional[int]:
        """获取画师作品数量（limit=1，读取 @attributes.count）"""
        data = await self._api({"s": "post", "tags": artist_tag, "limit": 1})
        if not isinstance(data, dict):
            return None
        attributes = data.get('@attributes') or {}
        count = attributes.get('count')
        try:
            return int(count)
        except (TypeError, ValueError):
            return None

    async def get_posts(self, artist_tag: str, limit: int = 10) -> List[Dict]:
        """
        获取帖子列表，返回统一结构: {'id', 'image_url', 'preview_url', 'tags'}
        """
        data = await self._api({"s": "post", "tags": artist_tag, "limit": limit})
        if not isinstance(data, dict):
            return []

        posts = data.get('post') or []
        if isinstance(posts, dict):
            posts = [posts]

        normalized = []
        for post in posts:
            if not isinstance(post, dict):
                continue
            image_url = ''
            for key in _SAMPLE_KEYS:
                if post.get(key):
                    image_url = post[key]
                    break
            if not image_url:
                continue
            normalized.append({
                'id': post.get('id'),
                'image_url': image_url,
                'preview_url': post.get('preview_url') or image_url,
                'tags': post.get('tags', ''),
            })
        return normalized

    async def check_credentials(self) -> Dict:
        """探测凭据是否可用，供设置页「测试连接」使用"""
        data = await self._api({"s": "tag", "names": "takepoison"})
        tag_list = (data or {}).get('tag') if isinstance(data, dict) else None
        if isinstance(tag_list, dict):
            tag_list = [tag_list]
        if not tag_list:
            return {"ok": False, "message": "凭据可用，但未取到测试标签数据"}
        return {
            "ok": True,
            "message": "Gelbooru 凭据有效",
            "sample_tag": tag_list[0].get('name', 'takepoison'),
            "sample_count": tag_list[0].get('count'),
        }

    # -------------------------------
    # 图片下载
    # -------------------------------

    async def _fetch_bytes(self, url: str, timeout: int = 30) -> Optional[bytes]:
        """
        下载图片字节。
        注意：Gelbooru 图片 CDN 需要 Referer，否则返回 HTML 拦截页。
        """
        if self._client is None:
            raise BooruConfigError("Gelbooru 客户端尚未启动")

        try:
            response = await self._client.get(
                url,
                timeout=httpx.Timeout(timeout, connect=10.0),
                headers={
                    "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
                    "Referer": f"{GELBOORU_BASE}/",
                },
            )
        except httpx.HTTPError as e:
            logging.warning(f"Gelbooru 图片下载失败: {url[:80]} - {e}")
            return None

        if response.status_code != 200:
            logging.warning(f"Gelbooru 图片下载失败: HTTP {response.status_code} {url[:80]}")
            return None

        content_type = response.headers.get('content-type', '')
        if not content_type.startswith('image/'):
            # 命中防盗链拦截页，按失败处理
            logging.warning(f"Gelbooru 返回非图片内容（{content_type}），已跳过: {url[:80]}")
            return None

        return response.content


__all__ = ['GelbooruClient', 'GELBOORU_API_URL', 'GELBOORU_BASE']
