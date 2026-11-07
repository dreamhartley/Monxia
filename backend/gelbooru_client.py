"""
Gelbooru 抓取客户端（纯 HTTP，httpx 驱动）

Gelbooru 没有 Danbooru 那样的 Cloudflare 人机验证，普通 HTTP 请求即可，因此
不需要 Playwright。但它的 API 从 2022 年起要求每次请求都带账号凭据：

    https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1
        &api_key=<API Key>&user_id=<User ID>

返回 JSON 的根节点带 `@attributes`（含 limit/offset/count），帖子在 `post` 中；
作品总数直接取 `@attributes.count`，所以「作品数 + 帖子列表」一次请求即可拿到。

限流说明（VPS / 机房 IP 尤其明显）：
  - Gelbooru 对 API 请求有频率限制，超限直接返回 429；机房 IP 的阈值更低。
  - 因此这里对 API 请求做全局串行 + 固定间隔，并对 429 做退避重试，
    触发限流时自动拉长间隔（本次任务内生效），避免越重试越被封。
  - 可用环境变量调整：
        GELBOORU_MIN_INTERVAL   API 请求最小间隔秒数（默认 1.0）
        GELBOORU_PROXY          可选，HTTP(S) 代理地址，如 http://127.0.0.1:7890

另外实测：图片 CDN（img*.gelbooru.com）会校验来源，不带
`Referer: https://gelbooru.com/` 时返回的是 HTML 拦截页而不是图片，
所以下载图片时必须带上该请求头。

用法（异步）：
    async with GelbooruClient(user_id='...', api_key='...') as client:
        count, posts = await client.get_artist_summary("artist_name", limit=10)
"""
import asyncio
import logging
import os
import random
import time
from typing import Dict, List, Optional, Tuple, Union

import httpx

from booru_base import (
    BooruAuthError,
    BooruClientBase,
    BooruConfigError,
    BooruRateLimitError,
)

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

# 默认请求间隔（秒）：机房 IP 被限流时可通过环境变量调大
DEFAULT_MIN_INTERVAL = float(os.environ.get('GELBOORU_MIN_INTERVAL', '1.0'))
# 触发 429 后单次最长等待（秒）
MAX_BACKOFF_SECONDS = 120.0
# 触发 429 后最多重试次数
MAX_RATE_LIMIT_RETRIES = 4
# 未提供 Retry-After 时的默认等待
DEFAULT_429_WAIT = 15.0
# 图片下载的最小间隔（秒），CDN 与 API 分别限流
DEFAULT_IMAGE_INTERVAL = float(os.environ.get('GELBOORU_IMAGE_INTERVAL', '0.4'))
# 可选代理
GELBOORU_PROXY = os.environ.get('GELBOORU_PROXY', '').strip() or None

# Gelbooru 返回的帖子字段里，优先使用体积适中的 sample，其次才用原图
_SAMPLE_KEYS = ("sample_url", "file_url", "preview_url")


def _parse_retry_after(value: Optional[str]) -> Optional[float]:
    """解析 Retry-After（秒数），无法解析时返回 None"""
    if not value:
        return None
    try:
        return max(0.0, float(value.strip()))
    except (TypeError, ValueError):
        return None


class GelbooruClient(BooruClientBase):
    """Gelbooru DAPI 客户端，一个实例对应一次抓取任务。"""

    source = 'gelbooru'

    def __init__(self, user_id: str = '', api_key: str = '',
                 concurrency: int = 2, timeout: int = 30,
                 min_interval: Optional[float] = None,
                 proxy: Optional[str] = None):
        super().__init__(concurrency=concurrency, timeout=timeout)
        self.user_id = (user_id or '').strip()
        self.api_key = (api_key or '').strip()
        self.min_interval = max(0.2, min_interval if min_interval is not None else DEFAULT_MIN_INTERVAL)
        self.proxy = proxy or GELBOORU_PROXY
        self._client: Optional[httpx.AsyncClient] = None
        # 全局串行 + 间隔：Gelbooru 的 API 限流按账号/IP 计，并发只会更快触发 429
        self._api_lock: Optional[asyncio.Lock] = None
        self._last_api_at: float = 0.0
        # 触发限流后的全局冷却时间点（所有 worker 共享）
        self._cooldown_until: float = 0.0
        self._image_lock: Optional[asyncio.Lock] = None
        self._last_image_at: float = 0.0

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
            proxy=self.proxy,
            limits=httpx.Limits(
                max_connections=max(4, self.concurrency * 2),
                max_keepalive_connections=self.concurrency,
            ),
        )
        self._api_lock = asyncio.Lock()
        self._image_lock = asyncio.Lock()
        if self.proxy:
            logging.info("Gelbooru 使用代理: %s", self.proxy)

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # -------------------------------
    # 限流控制
    # -------------------------------

    async def _wait_for_image_slot(self) -> None:
        """图片 CDN 单独做轻量限速"""
        assert self._image_lock is not None
        async with self._image_lock:
            now = time.monotonic()
            target = self._last_image_at + DEFAULT_IMAGE_INTERVAL
            if target > now:
                await asyncio.sleep(target - now)
            self._last_image_at = time.monotonic()

    async def _request(self, query: Dict[str, Union[str, int]]) -> Optional[httpx.Response]:
        """在全局锁内等到自己的时间片，然后发出一次请求（请求本身也串行）"""
        assert self._api_lock is not None and self._client is not None
        async with self._api_lock:
            now = time.monotonic()
            target = max(self._last_api_at + self.min_interval, self._cooldown_until)
            if target > now:
                await asyncio.sleep(target - now)
            # 加一点抖动，避免多个进程同频
            self._last_api_at = time.monotonic() + random.uniform(0, 0.05)
            try:
                return await self._client.get(GELBOORU_API_URL, params=query)
            except httpx.HTTPError as e:
                logging.warning(f"Gelbooru 请求失败: {e}")
                return None

    def _enter_cooldown(self, wait_seconds: float) -> None:
        """触发 429 后进入全局冷却，并拉长后续请求间隔"""
        wait_seconds = min(max(wait_seconds, 1.0), MAX_BACKOFF_SECONDS)
        self._cooldown_until = max(self._cooldown_until, time.monotonic() + wait_seconds)
        # 本次任务内自适应降速，最多降到 5 秒一次
        self.min_interval = min(self.min_interval * 1.5, 5.0)
        logging.warning(
            "Gelbooru 触发限流（429），暂停 %.0f 秒后重试，后续请求间隔调整为 %.1f 秒",
            wait_seconds, self.min_interval,
        )

    # -------------------------------
    # API 请求
    # -------------------------------

    async def _api(self, params: Dict[str, Union[str, int]]) -> Optional[Union[Dict, List]]:
        """请求 Gelbooru DAPI，返回解析后的 JSON；429 时退避重试"""
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

        for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
            response = await self._request(query)
            if response is None:
                return None

            if response.status_code == 429:
                retry_after = _parse_retry_after(response.headers.get('Retry-After'))
                wait_seconds = retry_after if retry_after is not None else DEFAULT_429_WAIT
                if attempt >= MAX_RATE_LIMIT_RETRIES:
                    raise BooruRateLimitError(
                        "Gelbooru 持续限流（429），请稍后再试；VPS/机房 IP 可调大 "
                        "GELBOORU_MIN_INTERVAL 或配置 GELBOORU_PROXY"
                    )
                self._enter_cooldown(wait_seconds)
                continue

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

        raise BooruRateLimitError("Gelbooru 请求被限流，重试次数已用尽")

    async def get_post_count(self, artist_tag: str) -> Optional[int]:
        """获取画师作品数量（limit=1，读取 @attributes.count）"""
        data = await self._api({"s": "post", "tags": artist_tag, "limit": 1})
        if not isinstance(data, dict):
            return None
        return _extract_count(data)

    async def get_posts(self, artist_tag: str, limit: int = 10) -> List[Dict]:
        """
        获取帖子列表，返回统一结构: {'id', 'image_url', 'preview_url', 'tags'}
        """
        data = await self._api({"s": "post", "tags": artist_tag, "limit": limit})
        return _normalize_posts(data)

    async def get_artist_summary(self, artist_tag: str, limit: int = 10) -> Tuple[Optional[int], List[Dict]]:
        """
        一次请求同时取「作品数 + 帖子列表」。
        Gelbooru 的帖子列表响应本身就带 @attributes.count，没必要分两次请求，
        少一次请求就少一次触发 429 的机会。
        """
        data = await self._api({"s": "post", "tags": artist_tag, "limit": limit})
        return _extract_count(data), _normalize_posts(data)

    async def check_credentials(self) -> Dict:
        """探测凭据是否可用，供设置页「测试连接」使用"""
        data = await self._api({"s": "tag", "names": "takepoison"})
        tag_list = data.get('tag') if isinstance(data, dict) else None
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

        await self._wait_for_image_slot()
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

        if response.status_code == 429:
            # 图片 CDN 限流：稍等后当作失败处理，交给上层换一张图
            logging.warning("Gelbooru 图片 CDN 限流（429），跳过该图片")
            self._last_image_at = time.monotonic() + 5.0
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


def _extract_count(data) -> Optional[int]:
    """从 DAPI 响应根节点的 @attributes 中取作品总数"""
    if not isinstance(data, dict):
        return None
    attributes = data.get('@attributes') or {}
    try:
        return int(attributes.get('count'))
    except (TypeError, ValueError):
        return None


def _normalize_posts(data) -> List[Dict]:
    """把 Gelbooru 帖子统一成 {id, image_url, preview_url, tags}"""
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


__all__ = ['GelbooruClient', 'GELBOORU_API_URL', 'GELBOORU_BASE']
