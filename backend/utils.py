"""
工具函数:画师名称处理、链接生成、作品数量获取（使用 Danbooru API）
"""
import re
import logging
import random
import os
import asyncio
import base64
from io import BytesIO
from pathlib import Path
from typing import Optional, Dict, Tuple, List
from curl_cffi.requests import AsyncSession
from PIL import Image

logging.basicConfig(level=logging.INFO)

# 数据目录（支持通过环境变量配置，默认为 backend 目录）
DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent))

# 图片存储目录
IMAGES_DIR = DATA_DIR / 'artist_images'
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 登录背景图存储目录
BACKGROUNDS_DIR = DATA_DIR / 'backgrounds'
BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)

# Danbooru API 配置
DANBOORU_API_BASE = "https://danbooru.donmai.us"

# 业务相关请求头
DEFAULT_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://danbooru.donmai.us/",
    "Origin": "https://danbooru.donmai.us",
    # Sec-Fetch 系列：模拟 XHR/API 请求
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

# -------------------------------
# 画师名称处理
# -------------------------------

def clean_artist_name(name: str) -> str:
    """
    清洗名称:去除首尾空格,将下划线替换为空格,并还原已存在的括号转义。
    """
    if not isinstance(name, str):
        return name
    # 去除首尾空格,并将下划线替换为空格
    name = name.strip().replace('_', ' ')
    # 还原括号转义(例如:\(...\) -> (...))
    name = re.sub(r'\\([()])', r'\1', name)
    return name

def format_noob(name: str) -> str:
    """
    NOOB 格式:先清洗,然后对括号添加反斜杠转义。
    """
    clean_name = clean_artist_name(name)
    return re.sub(r'([()])', r'\\\1', clean_name)

def format_nai(name: str) -> str:
    """
    NAI 格式:先清洗,如果不以 "artist:" 开头则添加该前缀。
    """
    cleaned = clean_artist_name(name)
    if not cleaned.startswith("artist:"):
        return f"artist:{cleaned}"
    return cleaned

def generate_danbooru_link(artist_name: str) -> str:
    """
    根据画师名称生成 Danbooru 链接。
    1. 如果名称以 "artist:" 开头,则去除前缀
    2. 去除括号转义
    3. 将所有空格转为下划线
    """
    if not isinstance(artist_name, str) or artist_name.strip() == "":
        return ""
    raw_name = artist_name
    if raw_name.startswith("artist:"):
        raw_name = raw_name[7:]
    raw_name = re.sub(r'\\([()])', r'\1', raw_name)
    # 将所有空格转换为下划线
    converted_artist = "_".join(raw_name.split())
    return f"https://danbooru.donmai.us/posts?tags={converted_artist}"

def extract_artist_from_link(url: str) -> str:
    """
    从 Danbooru 链接反推画师名称
    """
    if not isinstance(url, str) or not url.startswith("https://danbooru.donmai.us/posts?tags="):
        return ""
    extracted = url.replace("https://danbooru.donmai.us/posts?tags=", "")
    return extracted.replace('_', ' ')

def auto_complete_names(name_noob: str, name_nai: str, danbooru_link: str) -> tuple:
    """
    自动补全画师名称
    返回: (name_noob, name_nai, danbooru_link)
    """
    # 首先，对已有的输入进行格式化
    if name_noob and name_noob.strip():
        # 去除可能已存在的转义，重新格式化
        raw_noob = re.sub(r'\\([()])', r'\1', name_noob)
        name_noob = format_noob(raw_noob)

    if name_nai and name_nai.strip():
        # 确保NAI格式正确
        name_nai = format_nai(name_nai)

    # 1. 如果有链接且两个名称都为空,从链接反推
    if danbooru_link and danbooru_link.strip() and (not name_noob or not name_noob.strip()) and (not name_nai or not name_nai.strip()):
        original_artist = extract_artist_from_link(danbooru_link)
        if original_artist:
            name_noob = format_noob(original_artist)
            name_nai = format_nai(original_artist)

    # 2. 如果NOOB存在但NAI缺失
    if name_noob and name_noob.strip() and (not name_nai or not name_nai.strip()):
        raw = re.sub(r'\\([()])', r'\1', name_noob)
        name_nai = format_nai(raw)

    # 3. 如果NAI存在但NOOB缺失
    if name_nai and name_nai.strip() and (not name_noob or not name_noob.strip()):
        raw = name_nai
        if raw.startswith("artist:"):
            raw = raw[7:]
        name_noob = format_noob(raw)

    # 4. 如果链接缺失,根据已有名称生成
    if not danbooru_link or not danbooru_link.strip():
        artist_source = ""
        if name_noob and name_noob.strip():
            artist_source = re.sub(r'\\([()])', r'\1', name_noob)
        elif name_nai and name_nai.strip():
            artist_source = name_nai
            if artist_source.startswith("artist:"):
                artist_source = artist_source[7:]
        if artist_source.strip():
            danbooru_link = generate_danbooru_link(artist_source)

    return name_noob, name_nai, danbooru_link


# -------------------------------
# Danbooru API 辅助函数
# -------------------------------

def extract_artist_tag_from_url(url: str) -> str:
    """
    从 Danbooru 链接提取画师标签名
    https://danbooru.donmai.us/posts?tags=artist_name -> artist_name
    """
    if not isinstance(url, str):
        return ""
    # 处理各种可能的 URL 格式
    if "tags=" in url:
        # 提取 tags 参数
        match = re.search(r'tags=([^&]+)', url)
        if match:
            return match.group(1)
    return ""


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


async def get_post_count_api(
    session: AsyncSession,
    artist_tag: str,
    auth_header: Dict[str, str] = None
) -> Optional[int]:
    """
    通过 API 获取作品数量
    GET /counts/posts.json?tags={artist_tag}
    返回: {"counts": {"posts": 数量}}
    """
    try:
        headers = {**DEFAULT_HEADERS}
        if auth_header:
            headers.update(auth_header)

        response = await session.get(
            f"{DANBOORU_API_BASE}/counts/posts.json",
            params={"tags": artist_tag},
            headers=headers,
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            return data.get("counts", {}).get("posts")
        else:
            logging.warning(f"获取作品数量失败: HTTP {response.status_code}")
            return None
    except Exception as e:
        logging.warning(f"获取作品数量异常: {e}")
        return None


async def get_posts_api(
    session: AsyncSession,
    artist_tag: str,
    limit: int = 10,
    auth_header: Dict[str, str] = None
) -> List[Dict]:
    """
    通过 API 获取帖子列表
    GET /posts.json?tags={artist_tag}&limit={limit}
    """
    try:
        headers = {**DEFAULT_HEADERS}
        if auth_header:
            headers.update(auth_header)

        response = await session.get(
            f"{DANBOORU_API_BASE}/posts.json",
            params={"tags": artist_tag, "limit": limit},
            headers=headers,
            timeout=30
        )

        if response.status_code == 200:
            return response.json()
        else:
            logging.warning(f"获取帖子列表失败: HTTP {response.status_code}")
            return []
    except Exception as e:
        logging.warning(f"获取帖子列表异常: {e}")
        return []


async def download_image_api(
    session: AsyncSession,
    url: str,
    artist_identifier: str,
    timeout: int = 30
) -> Optional[str]:
    """
    下载图片到本地，转换为 JPEG 格式
    返回: 本地文件名(例如 "uuid.jpg") 或 None
    """
    try:
        logging.info(f"正在下载图片: {url[:80]}...")

        # 图片下载使用不同的 Sec-Fetch 头（跨站图片请求）
        image_headers = {
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://danbooru.donmai.us/",
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
        }

        response = await session.get(
            url,
            headers=image_headers,
            timeout=timeout,
            allow_redirects=True
        )

        if response.status_code != 200:
            logging.warning(f"图片下载失败: HTTP {response.status_code}")
            return None

        image_content = response.content

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

    except Exception as e:
        logging.warning(f"下载图片失败: {url} - {e}")
        return None


async def get_example_image_api(
    session: AsyncSession,
    artist_tag: str,
    artist_identifier: str,
    auth_header: Dict[str, str] = None,
    max_retries: int = 5
) -> Optional[str]:
    """
    获取画师的示例图片并下载到本地
    随机从前10张图片中选择一张下载
    """
    try:
        # 获取帖子列表
        posts = await get_posts_api(session, artist_tag, limit=10, auth_header=auth_header)

        if not posts:
            logging.debug(f"未找到画师 {artist_tag} 的帖子")
            return None

        # 过滤出有图片URL的帖子
        valid_posts = [p for p in posts if p.get('large_file_url') or p.get('file_url')]

        if not valid_posts:
            logging.debug(f"未找到有效的图片帖子")
            return None

        # 记录已尝试的图片
        tried_posts = set()

        for attempt in range(min(max_retries, len(valid_posts))):
            # 随机选择一个未尝试过的帖子
            available_posts = [p for p in valid_posts if p.get('id') not in tried_posts]

            if not available_posts:
                break

            post = random.choice(available_posts)
            tried_posts.add(post.get('id'))

            # 优先使用 large_file_url（较小），否则使用 file_url（原图）
            image_url = post.get('large_file_url') or post.get('file_url')

            if not image_url:
                continue

            logging.info(f"尝试下载图片 ({attempt + 1}/{max_retries}): {image_url[:80]}...")
            filename = await download_image_api(session, image_url, artist_identifier)

            if filename:
                logging.info(f"图片下载成功: {filename}")
                return filename
            else:
                logging.warning(f"图片下载失败，尝试其他图片...")

        logging.warning("未能下载有效的示例图")
        return None

    except Exception as e:
        logging.warning(f"获取示例图失败: {e}")
        return None


async def fetch_artist_data(
    session: AsyncSession,
    artist: dict,
    auth_header: Dict[str, str] = None,
    retry_count: int = 3
) -> Tuple[int, Optional[Dict]]:
    """
    获取单个画师的作品数量和示例图
    返回: (artist_id, {'post_count': int, 'example_image': str} 或 None)
    """
    artist_id = artist['id']
    artist_identifier = artist.get('uuid') or str(artist_id)
    url = artist.get('danbooru_link', '')
    name = artist.get('name', 'Unknown')

    if not url or not url.strip():
        return artist_id, None

    # 从 URL 提取画师标签
    artist_tag = extract_artist_tag_from_url(url)
    if not artist_tag:
        logging.warning(f"无法从 URL 提取画师标签: {url}")
        return artist_id, None

    for attempt in range(retry_count):
        try:
            logging.info(f"正在获取画师 {name} 的数据...")

            # 并行获取作品数量和示例图
            post_count_task = get_post_count_api(session, artist_tag, auth_header)
            example_image_task = get_example_image_api(session, artist_tag, artist_identifier, auth_header)

            post_count, example_image = await asyncio.gather(
                post_count_task,
                example_image_task
            )

            if post_count is not None:
                logging.info(f"画师 {name} - 作品数量: {post_count}, 示例图: {example_image or 'None'}")
                return artist_id, {
                    'post_count': post_count,
                    'example_image': example_image
                }
            else:
                raise Exception("无法获取作品数量")

        except Exception as e:
            logging.warning(f"第 {attempt+1} 次尝试获取 {name} 数据失败: {e}")
            if attempt < retry_count - 1:
                wait_time = 2 * (attempt + 1)
                logging.info(f"等待 {wait_time} 秒后重试...")
                await asyncio.sleep(wait_time)
            else:
                logging.error(f"未能获取画师 {name} 的数据")

    return artist_id, None


# -------------------------------
# 批量获取函数（公开接口）
# -------------------------------

def _get_danbooru_auth() -> Dict[str, str]:
    """
    获取 Danbooru API 认证信息
    从配置数据库读取，如果未配置则返回空字典
    """
    try:
        from config_db import get_danbooru_config
        config = get_danbooru_config()
        if config and config.get('username') and config.get('api_key'):
            return get_auth_header(config['username'], config['api_key'])
    except Exception as e:
        logging.debug(f"获取 Danbooru 认证信息失败: {e}")
    return {}


async def _fetch_post_counts_batch_async(artists: list, concurrency: int = 5) -> dict:
    """
    内部异步函数：批量获取画师作品数量
    """
    results = {}

    if not artists:
        return results

    # 获取认证信息
    auth_header = _get_danbooru_auth()

    # 过滤有效画师（有链接的）
    valid_artists = [a for a in artists if a.get('danbooru_link', '').strip()]

    if not valid_artists:
        return results

    # 使用信号量控制并发数
    semaphore = asyncio.Semaphore(concurrency)

    # 创建持久化的客户端，使用 chrome 浏览器指纹
    async with AsyncSession(impersonate="chrome136") as session:
        async def fetch_with_semaphore(artist: dict) -> Tuple[int, Optional[Dict]]:
            async with semaphore:
                result = await fetch_artist_data(session, artist, auth_header)
                # 短暂等待避免请求过快
                await asyncio.sleep(0.65)
                return result

        # 创建所有任务并并行执行
        tasks = [fetch_with_semaphore(artist) for artist in valid_artists]
        task_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 收集结果
        for item in task_results:
            if isinstance(item, Exception):
                logging.error(f"任务异常: {item}")
                continue
            artist_id, result = item
            if result is not None:
                results[artist_id] = result

    return results


def fetch_post_counts_batch(artists: list, concurrency: int = 5) -> dict:
    """
    批量获取画师作品数量和示例图（并行版本）
    artists: 列表,每个元素是字典 {'id': ..., 'uuid': ..., 'danbooru_link': ..., 'name': ...}
    concurrency: 并行请求数量，默认5个
    返回: {artist_id: {'post_count': int, 'example_image': str}}
    """
    return asyncio.run(_fetch_post_counts_batch_async(artists, concurrency))


def fetch_post_counts_streaming(artists: list, concurrency: int = 5):
    """
    流式批量获取画师作品数量和示例图（并行生成器版本，用于SSE）
    artists: 列表,每个元素是字典 {'id': ..., 'uuid': ..., 'danbooru_link': ..., 'name': ...}
    concurrency: 并行请求数量，默认5个
    生成: {'type': 'progress', ...} 或 {'type': 'result', ...}
    """
    import queue
    import threading

    total = len(artists)
    if total == 0:
        return

    # 过滤有效画师（有链接的）
    valid_artists = [a for a in artists if a.get('danbooru_link', '').strip()]
    valid_total = len(valid_artists)

    if valid_total == 0:
        yield {'type': 'progress', 'current': total, 'total': total, 'artist_name': '完成'}
        return

    # 线程安全的结果队列
    result_queue = queue.Queue()

    async def _streaming_worker():
        """异步工作函数"""
        completed_count = 0

        # 获取认证信息
        auth_header = _get_danbooru_auth()

        # 使用信号量控制并发数
        semaphore = asyncio.Semaphore(concurrency)

        # 创建持久化的客户端，使用 chrome 浏览器指纹
        async with AsyncSession(impersonate="chrome136") as session:
            async def process_artist(artist: dict, worker_id: int):
                nonlocal completed_count
                async with semaphore:
                    artist_id = artist['id']
                    artist_identifier = artist.get('uuid') or str(artist_id)
                    url = artist.get('danbooru_link', '')
                    name = artist.get('name', 'Unknown')

                    completed_count += 1
                    result_queue.put({
                        'type': 'progress',
                        'current': completed_count,
                        'total': valid_total,
                        'artist_name': name
                    })

                    if not url or not url.strip():
                        return

                    try:
                        artist_tag = extract_artist_tag_from_url(url)
                        if not artist_tag:
                            return

                        logging.info(f"[Worker-{worker_id}] 正在获取画师 {name} 的数据...")

                        # 并行获取数据
                        post_count_task = get_post_count_api(session, artist_tag, auth_header)
                        example_image_task = get_example_image_api(session, artist_tag, artist_identifier, auth_header)

                        post_count, example_image = await asyncio.gather(
                            post_count_task,
                            example_image_task
                        )

                        if post_count is not None:
                            result_queue.put({
                                'type': 'result',
                                'artist_id': artist_id,
                                'artist_name': name,
                                'result': {
                                    'post_count': post_count,
                                    'example_image': example_image
                                }
                            })
                            logging.info(f"[Worker-{worker_id}] 画师 {name} - 作品数量: {post_count}, 示例图: {example_image or 'None'}")
                        else:
                            logging.warning(f"[Worker-{worker_id}] 未能获取画师 {name} 的数据")
                    except Exception as e:
                        logging.error(f"[Worker-{worker_id}] 处理画师 {name} 时出错: {e}")
                    finally:
                        # 短暂等待避免请求过快
                        await asyncio.sleep(0.15)

            # 创建所有任务并并行执行
            tasks = [
                process_artist(artist, i % concurrency)
                for i, artist in enumerate(valid_artists)
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

        # 发送完成信号
        result_queue.put({'type': 'done'})

    def run_async_in_thread():
        """在新线程中运行异步事件循环"""
        asyncio.run(_streaming_worker())

    # 启动异步工作线程
    worker_thread = threading.Thread(target=run_async_in_thread)
    worker_thread.start()

    # 主线程从队列读取结果并 yield
    while True:
        try:
            item = result_queue.get(timeout=120)  # 2分钟超时
            if item['type'] == 'done':
                break
            yield item
        except queue.Empty:
            # 检查线程是否还在运行
            if not worker_thread.is_alive():
                break

    worker_thread.join()


def get_artists_without_images(artists: list) -> list:
    """
    查找没有示例图的画师
    artists: 列表,每个元素是字典 {'id': ..., 'image_example': ...}
    返回: 没有本地图片文件的画师ID列表
    """
    missing_ids = []

    for artist in artists:
        artist_id = artist.get('id')
        image_filename = artist.get('image_example', '').strip()

        # 检查是否有文件名
        if not image_filename:
            missing_ids.append(artist_id)
            continue

        # 检查文件是否存在
        image_path = IMAGES_DIR / image_filename
        if not image_path.exists():
            logging.warning(f"画师ID {artist_id} 的图片文件不存在: {image_filename}")
            missing_ids.append(artist_id)

    return missing_ids
