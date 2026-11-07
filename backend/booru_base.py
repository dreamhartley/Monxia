"""
Booru 抓取客户端公共基类

Danbooru 与 Gelbooru 抓取流程的公共部分：
  - 数据目录与图片目录
  - 统一的帖子结构（get_posts 返回的字典字段）
  - 图片下载后的压缩与保存（Pillow 转 JPEG）

子类只需要实现：
  - start()/close()：建立与释放连接（Danbooru 用 Playwright，Gelbooru 用 HTTP）
  - get_post_count(artist_tag)：作品数量
  - get_posts(artist_tag, limit)：帖子列表，返回统一结构
  - _fetch_bytes(url)：下载原始图片字节
"""
import logging
import os
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image

# 数据目录（支持通过环境变量配置，默认为 backend 目录）
DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent))

# 图片存储目录
IMAGES_DIR = DATA_DIR / 'artist_images'
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 登录背景图存储目录
BACKGROUNDS_DIR = DATA_DIR / 'backgrounds'
BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)

# 单张图片最大体积（字节），防止超大原图撑爆内存
MAX_IMAGE_BYTES = 40 * 1024 * 1024


class BooruError(Exception):
    """Booru 抓取相关的通用异常"""


class BooruAuthError(BooruError):
    """凭据缺失或无效（HTTP 401）"""


class BooruConfigError(BooruError):
    """站点配置不完整（例如未配置 Gelbooru 的 user_id / api_key）"""


class BooruRateLimitError(BooruError):
    """触发站点限流（HTTP 429），且退避重试后仍未恢复"""


class BooruClientBase:
    """
    抓取客户端基类，一个实例对应一次批量抓取任务。

    子类约定 get_posts() 返回统一结构：
        {'id': int, 'image_url': str, 'preview_url': str, 'tags': str}
    """

    source: str = ''

    def __init__(self, concurrency: int = 5, timeout: int = 30):
        self.concurrency = max(1, concurrency)
        self.timeout = timeout

    # -------------------------------
    # 生命周期
    # -------------------------------

    async def start(self) -> None:
        """建立连接（子类实现）"""

    async def close(self) -> None:
        """释放连接（子类实现）"""

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    # -------------------------------
    # 站点接口（子类实现）
    # -------------------------------

    async def get_post_count(self, artist_tag: str) -> Optional[int]:
        """获取画师作品数量"""
        raise NotImplementedError

    async def get_posts(self, artist_tag: str, limit: int = 10) -> List[Dict]:
        """获取画师帖子列表（统一结构）"""
        raise NotImplementedError

    async def get_artist_summary(self, artist_tag: str, limit: int = 10) -> Tuple[Optional[int], List[Dict]]:
        """
        一次拿到「作品数 + 帖子列表」。
        默认实现分两次请求；站点能在同一次响应里给出总数的可以覆盖此方法省一次请求。
        """
        post_count = await self.get_post_count(artist_tag)
        posts = await self.get_posts(artist_tag, limit)
        return post_count, posts

    async def _fetch_bytes(self, url: str, timeout: int = 30) -> Optional[bytes]:
        """下载原始图片字节（子类实现）"""
        raise NotImplementedError

    # -------------------------------
    # 图片下载（公共实现）
    # -------------------------------

    async def download_image(self, url: str, artist_identifier: str, timeout: int = 30) -> Optional[str]:
        """
        下载图片到本地并转换为 JPEG，返回本地文件名（例如 "uuid.jpg"）或 None
        """
        logging.info(f"正在下载图片: {url[:80]}...")
        try:
            image_content = await self._fetch_bytes(url, timeout)
        except BooruError:
            raise
        except Exception as e:
            logging.warning(f"下载图片失败: {url[:80]} - {e}")
            return None

        if not image_content:
            return None

        if len(image_content) > MAX_IMAGE_BYTES:
            logging.warning(
                f"图片超过体积上限 {MAX_IMAGE_BYTES // 1024 // 1024}MB，已跳过: {url[:80]}..."
            )
            return None

        return self._save_jpeg(image_content, artist_identifier)

    @staticmethod
    def _save_jpeg(image_content: bytes, artist_identifier: str) -> Optional[str]:
        """把图片字节压缩为 JPEG 并保存到 artist_images 目录"""
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

                img.save(filepath, 'JPEG', quality=80, optimize=True)
                logging.info(f"图片已转换并保存为 JPEG: {filename}")
                return filename
        except Exception as e:
            logging.error(f"图片处理失败: {e}")
            return None
