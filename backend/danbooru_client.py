"""
Danbooru 抓取客户端（Playwright 驱动）

curl_cffi 的浏览器 TLS 指纹模拟已被 Cloudflare 拦下（cf-mitigated: challenge），
因此改用真实 Chromium 浏览器。启动时修正 headless 可识别特征（UA 中的
HeadlessChrome 字样、navigator.webdriver），并让浏览器访问 Danbooru 首页
自动完成人机验证，之后以「页内 fetch」方式请求 API 与下载图片。

为什么用页内 fetch 而不是 APIRequestContext：
实测即使浏览器上下文已通过验证，纯网络栈的 context.request 请求仍会被
Cloudflare 拦截（403 challenge），只有真实页面里执行的 fetch 才能携带完整的
浏览器 JS 环境特征通过验证。因此本模块的所有请求都通过 page.evaluate 中的
fetch 完成。

用法（异步）：
    async with DanbooruClient(concurrency=5) as client:
        count = await client.get_post_count("artist_name", auth_header)
        posts = await client.get_posts("artist_name", limit=10, auth_header=auth_header)
"""
import asyncio
import base64
import json
import logging
import os
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Union
from urllib.parse import urlencode

from PIL import Image

# 数据目录（支持通过环境变量配置，默认为 backend 目录）
DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent))

# 图片存储目录
IMAGES_DIR = DATA_DIR / 'artist_images'
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 登录背景图存储目录
BACKGROUNDS_DIR = DATA_DIR / 'backgrounds'
BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)

DANBOORU_API_BASE = "https://danbooru.donmai.us"

# 是否无头运行；调试时可设 DANBOORU_HEADLESS=0 观察验证过程
BROWSER_HEADLESS = os.environ.get('DANBOORU_HEADLESS', '1') not in ('0', 'false', 'False')

# 单张图片最大体积（字节），防止超大原图经 base64 传输撑爆内存
MAX_IMAGE_BYTES = 40 * 1024 * 1024

# Playwright 默认的 headless UA 带 HeadlessChrome 字样、navigator.webdriver 为 true，
# 是 Cloudflare 识别自动化浏览器的关键信号。UA 里的版本号会在启动时用浏览器实际
# 版本动态拼装，避免与实际 TLS 指纹不一致。
STEALTH_INIT_SCRIPT = "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"

# 页内 fetch 脚本：请求 API 并返回完整响应文本，网络异常返回 status=0
_FETCH_JSON_SCRIPT = """async ([url, headers, timeoutMs]) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 30000);
  try {
    const r = await fetch(url, {headers: headers || {}, signal: controller.signal});
    const text = await r.text();
    return {status: r.status, text: text};
  } catch (e) {
    return {status: 0, text: String(e)};
  } finally {
    clearTimeout(timer);
  }
}"""

# 页内 fetch 脚本：下载图片并以 base64 返回，便于跨进程传递二进制
_FETCH_IMAGE_SCRIPT = """async ([url, timeoutMs]) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 30000);
  try {
    const r = await fetch(url, {headers: {'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'}, signal: controller.signal});
    if (!r.ok) return {status: r.status, b64: '', err: ''};
    const buf = await r.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return {status: r.status, b64: btoa(binary), err: ''};
  } catch (e) {
    return {status: 0, b64: '', err: String(e)};
  } finally {
    clearTimeout(timer);
  }
}"""

# 业务请求头（Origin/Referer/Sec-Fetch 系列由浏览器根据页面真实生成，
# 此处只设置 fetch 允许携带的头部）
DEFAULT_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


def get_auth_header(username: str, api_key: str) -> Dict[str, str]:
    """
    生成 Danbooru API 认证头
    使用 HTTP Basic Auth: base64(username:api_key)
    """
    if not username or not api_key:
        return {}
    credentials = f"{username}:{api_key}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return {"Authorization": f"Basic {encoded}"}


class DanbooruClient:
    """Playwright 驱动的 Danbooru API 客户端，一个实例对应一次抓取任务。"""

    def __init__(self, headless: bool = True, concurrency: int = 5):
        self.headless = headless
        self.concurrency = max(1, concurrency)
        self._playwright = None
        self._browser = None
        self._context = None
        self._warmup_page = None
        self._pool_pages: List = []
        self._page_queue: Optional[asyncio.Queue] = None

    @property
    def is_ready(self) -> bool:
        return self._page_queue is not None

    async def __aenter__(self) -> "DanbooruClient":
        await self.start()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    # -------------------------------
    # 生命周期
    # -------------------------------

    async def start(self) -> None:
        """启动浏览器、通过人机验证并建立页面池"""
        from playwright.async_api import async_playwright

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        # UA 版本号与内置 Chromium 实际版本保持一致
        chrome_version = self._browser.version
        user_agent = (
            f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            f"(KHTML, like Gecko) Chrome/{chrome_version} Safari/537.36"
        )
        self._context = await self._browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1366, "height": 768},
            locale="en-US",
            timezone_id="America/Los_Angeles",
        )
        await self._context.add_init_script(STEALTH_INIT_SCRIPT)

        # 专用预热页（用于重新通过验证）+ 并发页面池
        self._warmup_page = await self._context.new_page()
        self._pool_pages = [await self._context.new_page() for _ in range(self.concurrency)]

        # 所有页面并发加载首页完成 Cloudflare 验证
        await asyncio.gather(*[self._solve_challenge(page) for page in [self._warmup_page] + self._pool_pages])

        self._page_queue = asyncio.Queue()
        for page in self._pool_pages:
            self._page_queue.put_nowait(page)

    async def close(self) -> None:
        """关闭浏览器，释放资源"""
        try:
            if self._browser:
                await self._browser.close()
        finally:
            if self._playwright:
                await self._playwright.stop()
            self._playwright = None
            self._browser = None
            self._context = None
            self._warmup_page = None
            self._pool_pages = []
            self._page_queue = None

    # -------------------------------
    # Cloudflare 处理
    # -------------------------------

    @staticmethod
    def _is_challenge_result(result: dict) -> bool:
        """判断页内 fetch 结果是否为 Cloudflare 人机验证页"""
        status = result.get('status', 0)
        if status not in (403, 503):
            return False
        return 'just a moment' in (result.get('text') or '')[:1000].lower() or \
            'just a moment' in (result.get('err') or '')[:1000].lower()

    async def _solve_challenge(self, page, reason: str = "") -> None:
        """
        加载 Danbooru 首页让 Cloudflare 验证在真实浏览器中自动完成，
        将放行 cookie 写入上下文。启动预热与请求被拦截后的重试都复用它。
        """
        prefix = f"（{reason}）" if reason else ""
        try:
            await page.goto(DANBOORU_API_BASE, wait_until="domcontentloaded", timeout=60000)
            # 验证通过后页面会自动刷新为真实内容，轮询标题直到不再是验证页
            for _ in range(10):
                title = await page.title()
                if title and 'just a moment' not in title.lower():
                    logging.info(f"Danbooru 首页验证通过{prefix}")
                    return
                await page.wait_for_timeout(2000)
            logging.warning(f"Danbooru 首页验证未在时限内通过{prefix}")
        except Exception as e:
            logging.warning(f"Danbooru 首页加载失败{prefix}: {e}")

    # -------------------------------
    # 页面池
    # -------------------------------

    async def _acquire_page(self):
        return await self._page_queue.get()

    async def _release_page(self, page) -> None:
        self._page_queue.put_nowait(page)

    # -------------------------------
    # API 请求
    # -------------------------------

    async def get_json(
        self,
        url_path: str,
        params: Optional[Dict[str, str]] = None,
        auth_header: Optional[Dict[str, str]] = None,
        timeout: int = 30,
    ) -> Optional[Union[Dict, List]]:
        """
        通过页内 fetch GET Danbooru API 并解析 JSON。
        url_path 示例: "/counts/posts.json"、"/posts.json"
        被 Cloudflare 拦截时重过验证后重试一次；失败返回 None。
        """
        url = f"{DANBOORU_API_BASE}{url_path}"
        if params:
            url = f"{url}?{urlencode(params)}"
        headers = dict(DEFAULT_HEADERS)
        if auth_header:
            headers.update(auth_header)

        page = await self._acquire_page()
        try:
            for attempt in range(2):
                result = await page.evaluate(
                    _FETCH_JSON_SCRIPT,
                    [url, headers, timeout * 1000],
                )
                if result.get('status') == 200:
                    try:
                        return json.loads(result['text'])
                    except Exception as e:
                        logging.warning(f"解析 JSON 失败 {url_path}: {e}")
                        return None
                if self._is_challenge_result(result):
                    logging.warning(f"请求 {url_path} 被 Cloudflare 拦截，重过验证后重试")
                    await self._solve_challenge(self._warmup_page, reason="重试")
                    continue
                logging.warning(f"请求失败: HTTP {result.get('status')} {url_path}")
                return None
            return None
        finally:
            await self._release_page(page)

    async def get_post_count(
        self,
        artist_tag: str,
        auth_header: Optional[Dict[str, str]] = None,
    ) -> Optional[int]:
        """获取画师作品数量: GET /counts/posts.json?tags={artist_tag}"""
        data = await self.get_json("/counts/posts.json", {"tags": artist_tag}, auth_header)
        if isinstance(data, dict):
            return data.get("counts", {}).get("posts")
        return None

    async def get_posts(
        self,
        artist_tag: str,
        limit: int = 10,
        auth_header: Optional[Dict[str, str]] = None,
    ) -> List[Dict]:
        """获取帖子列表: GET /posts.json?tags={artist_tag}&limit={limit}"""
        data = await self.get_json(
            "/posts.json", {"tags": artist_tag, "limit": limit}, auth_header
        )
        return data if isinstance(data, list) else []

    # -------------------------------
    # 图片下载
    # -------------------------------

    async def download_image(self, url: str, artist_identifier: str, timeout: int = 30) -> Optional[str]:
        """
        通过页内 fetch 下载图片到本地，转换为 JPEG 格式
        返回: 本地文件名(例如 "uuid.jpg") 或 None
        """
        page = await self._acquire_page()
        try:
            image_content = None
            for attempt in range(2):
                result = await page.evaluate(
                    _FETCH_IMAGE_SCRIPT,
                    [url, timeout * 1000],
                )
                if result.get('status') == 200 and result.get('b64'):
                    image_content = base64.b64decode(result['b64'])
                    if len(image_content) > MAX_IMAGE_BYTES:
                        logging.warning(f"图片超过体积上限 {MAX_IMAGE_BYTES // 1024 // 1024}MB，已跳过: {url[:80]}...")
                        return None
                    break
                if self._is_challenge_result(result):
                    logging.warning(f"图片下载被 Cloudflare 拦截，重过验证后重试: {url[:80]}...")
                    await self._solve_challenge(self._warmup_page, reason="图片重试")
                    continue
                logging.warning(f"图片下载失败: HTTP {result.get('status')} {url[:80]}...")
                return None
            if image_content is None:
                return None
        finally:
            await self._release_page(page)

        # 使用 Pillow 处理图片：转换为 JPEG 格式，质量 80%
        try:
            with Image.open(BytesIO(image_content)) as img:
                # 转换为 RGB 模式（处理 PNG 透明通道等）
                if img.mode in ('RGBA', 'P', 'LA'):
                    img = img.convert('RGB')

                # 生成文件名（统一使用 .jpg 后缀）
                filename = f"{artist_identifier}.jpg"
                filepath = IMAGES_DIR / filename

                # 如果已存在同标识符的其他格式图片，先删除
                for old_file in IMAGES_DIR.glob(f"{artist_identifier}.*"):
                    if old_file.name != filename:
                        old_file.unlink()
                        logging.info(f"删除旧图片: {old_file.name}")

                # 保存为 JPEG
                img.save(filepath, 'JPEG', quality=80, optimize=True)
                logging.info(f"图片已转换并保存为 JPEG: {filename}")
                return filename
        except Exception as e:
            logging.error(f"图片处理失败: {e}")
            return None
