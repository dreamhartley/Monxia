"""
工具函数:画师名称处理、链接生成、作品数量与封面抓取（Danbooru / Gelbooru 双数据源）
"""
import re
import logging
import random
import os
import asyncio
from typing import Optional, Dict, Tuple, List

from booru_base import (
    BooruClientBase,
    BooruError,
    IMAGES_DIR,
    BACKGROUNDS_DIR,  # noqa: F401  (app.py 从 utils 导入，保持原有导入路径)
    PRESET_IMAGES_DIR,
)
from booru_links import (
    SOURCE_DANBOORU,
    SOURCE_GELBOORU,
    build_link_from_name,
    extract_tag_from_link,
    link_for_source,
    normalize_source,
    sync_links,
)

logging.basicConfig(level=logging.INFO)

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
    return build_link_from_name(SOURCE_DANBOORU, artist_name)


def generate_gelbooru_link(artist_name: str) -> str:
    """根据画师名称生成 Gelbooru 链接（标签转换规则与 Danbooru 一致）"""
    return build_link_from_name(SOURCE_GELBOORU, artist_name)

def extract_artist_from_link(url: str) -> str:
    """
    从 Booru 链接反推画师名称（Danbooru / Gelbooru 均可）
    """
    tag = extract_tag_from_link(url)
    return tag.replace('_', ' ') if tag else ''

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


def auto_complete_artist(name_noob: str, name_nai: str,
                         danbooru_link: str = "", gelbooru_link: str = "") -> tuple:
    """
    自动补全画师信息（名称 + 两个站点的链接）
    返回: (name_noob, name_nai, danbooru_link, gelbooru_link)

    规则：先按原有逻辑补全名称与 Danbooru 链接，再由任一链接推导出另一站点的
    链接；两边都有链接时原样保留（尊重用户手动修改）。
    """
    # 名称全为空时，允许从 Gelbooru 链接反推名称
    if (not name_noob or not name_noob.strip()) and (not name_nai or not name_nai.strip()):
        source_link = (danbooru_link or gelbooru_link or '').strip()
        if source_link:
            original_artist = extract_artist_from_link(source_link)
            if original_artist:
                name_noob = format_noob(original_artist)
                name_nai = format_nai(original_artist)

    name_noob, name_nai, danbooru_link = auto_complete_names(name_noob, name_nai, danbooru_link)
    danbooru_link, gelbooru_link = sync_links(name_noob, name_nai, danbooru_link, gelbooru_link)
    return name_noob, name_nai, danbooru_link, gelbooru_link


# -------------------------------
# Booru API 辅助函数
# -------------------------------

def extract_artist_tag_from_url(url: str) -> str:
    """
    从 Danbooru / Gelbooru 链接提取画师标签名
    兼容:
      https://danbooru.donmai.us/posts?tags=artist_name
      https://gelbooru.com/index.php?page=post&s=list&tags=artist_name
    """
    return extract_tag_from_link(url)


async def download_image_api(
    client: BooruClientBase,
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
        return await client.download_image(url, artist_identifier, timeout)
    except BooruError:
        raise
    except Exception as e:
        logging.warning(f"下载图片失败: {url} - {e}")
        return None


async def get_artist_summary_api(
    client: BooruClientBase,
    artist_tag: str,
    limit: int = 10,
) -> Tuple[Optional[int], List[Dict]]:
    """
    一次获取作品数量与帖子列表。
    Danbooru 分两次请求；Gelbooru 可在一次响应里同时拿到（少一次请求，降低被限流的概率）。
    """
    try:
        return await client.get_artist_summary(artist_tag, limit)
    except BooruError:
        raise
    except Exception as e:
        logging.warning(f"获取画师数据异常: {e}")
        return None, []


async def pick_and_download_image(
    client: BooruClientBase,
    posts: List[Dict],
    artist_identifier: str,
    max_retries: int = 5
) -> Optional[str]:
    """
    从已获取的帖子列表中随机挑一张图下载（避免重复请求帖子列表）
    """
    try:
        if not posts:
            logging.debug("未找到画师的帖子")
            return None

        # 过滤出有图片URL的帖子
        valid_posts = [p for p in posts if p.get('image_url')]

        if not valid_posts:
            logging.debug("未找到有效的图片帖子")
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

            # 客户端已按站点归一化：优先较小的 sample / large 版本
            image_url = post.get('image_url')

            if not image_url:
                continue

            logging.info(f"尝试下载图片 ({attempt + 1}/{max_retries}): {image_url[:80]}...")
            filename = await download_image_api(client, image_url, artist_identifier)

            if filename:
                logging.info(f"图片下载成功: {filename}")
                return filename
            else:
                logging.warning(f"图片下载失败，尝试其他图片...")

        logging.warning("未能下载有效的示例图")
        return None

    except BooruError:
        raise
    except Exception as e:
        logging.warning(f"获取示例图失败: {e}")
        return None


async def fetch_artist_data(
    client: BooruClientBase,
    artist: dict,
    source: str = SOURCE_DANBOORU,
    retry_count: int = 3
) -> Tuple[int, Optional[Dict]]:
    """
    获取单个画师的作品数量和示例图（按当前数据来源）
    返回: (artist_id, {'post_count', 'example_image', 'danbooru_link'?, 'gelbooru_link'?} 或 None)
    """
    artist_id = artist['id']
    artist_identifier = artist.get('uuid') or str(artist_id)
    name = artist.get('name', 'Unknown')
    source = normalize_source(source)

    # 取当前来源下的链接：优先已保存的，缺失时按名称即时生成
    url = link_for_source(artist, source)
    if not url:
        logging.debug(f"画师 {name} 缺少可用的 {source} 链接，跳过")
        return artist_id, None

    # 从 URL 提取画师标签
    artist_tag = extract_artist_tag_from_url(url)
    if not artist_tag:
        logging.warning(f"无法从 URL 提取画师标签: {url}")
        return artist_id, None

    # 双向补全两个站点的链接（用户已手动填写的不会被覆盖）
    danbooru_link, gelbooru_link = sync_links(
        artist.get('name_noob'),
        artist.get('name_nai'),
        artist.get('danbooru_link'),
        artist.get('gelbooru_link'),
    )
    link_updates = {}
    if danbooru_link and danbooru_link != (artist.get('danbooru_link') or '').strip():
        link_updates['danbooru_link'] = danbooru_link
    if gelbooru_link and gelbooru_link != (artist.get('gelbooru_link') or '').strip():
        link_updates['gelbooru_link'] = gelbooru_link

    for attempt in range(retry_count):
        try:
            logging.info(f"正在获取画师 {name} 的数据（来源: {source}）...")

            # 一次请求拿到作品数与帖子列表（Gelbooru 只需一次请求），再从结果里挑图
            post_count, posts = await get_artist_summary_api(client, artist_tag, limit=10)
            example_image = await pick_and_download_image(client, posts, artist_identifier)

            if post_count is not None:
                logging.info(f"画师 {name} - 作品数量: {post_count}, 示例图: {example_image or 'None'}")
                result = {
                    'post_count': post_count,
                    'example_image': example_image
                }
                result.update(link_updates)
                return artist_id, result
            else:
                raise Exception("无法获取作品数量")

        except BooruError:
            # 凭据 / 配置 / 限流类错误无需在这里重试（客户端内部已做退避），直接上报
            raise
        except Exception as e:
            logging.warning(f"第 {attempt+1} 次尝试获取 {name} 数据失败: {e}")
            if attempt < retry_count - 1:
                wait_time = 2 * (attempt + 1)
                logging.info(f"等待 {wait_time} 秒后重试...")
                await asyncio.sleep(wait_time)
            else:
                logging.error(f"未能获取画师 {name} 的数据")

    return artist_id, link_updates or None


# -------------------------------
# 批量获取函数（公开接口）
# -------------------------------

async def _fetch_post_counts_batch_async(artists: list, concurrency: Optional[int] = None,
                                         source: Optional[str] = None) -> dict:
    """
    内部异步函数：批量获取画师作品数量
    """
    from booru_factory import create_client, get_concurrency

    results = {}

    if not artists:
        return results

    source = normalize_source(source)
    concurrency = concurrency or get_concurrency(source)

    # 过滤有效画师（当前来源下有可用链接的）
    valid_artists = [a for a in artists if link_for_source(a, source)]

    if not valid_artists:
        return results

    # 按来源创建客户端（Danbooru 为浏览器页面池，Gelbooru 为 HTTP 客户端）
    client = create_client(source, concurrency)
    await client.start()

    try:
        # 使用信号量控制并发数
        semaphore = asyncio.Semaphore(concurrency)
        # Gelbooru 客户端内部已做请求节流，这里只留极小间隔让出事件循环
        interval = 0.65 if source == SOURCE_DANBOORU else 0.05

        async def fetch_with_semaphore(artist: dict) -> Tuple[int, Optional[Dict]]:
            async with semaphore:
                result = await fetch_artist_data(client, artist, source)
                # 短暂等待避免请求过快
                await asyncio.sleep(interval)
                return result

        # 创建所有任务并并行执行
        tasks = [fetch_with_semaphore(artist) for artist in valid_artists]
        task_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 收集结果；凭据 / 限流类错误直接上报，避免把 429 伪装成「画师抓取失败」
        for item in task_results:
            if isinstance(item, BooruError):
                raise item
            if isinstance(item, Exception):
                logging.error(f"任务异常: {item}")
                continue
            artist_id, result = item
            if result is not None:
                results[artist_id] = result
    finally:
        await client.close()

    return results


def fetch_post_counts_batch(artists: list, concurrency: Optional[int] = None,
                            source: Optional[str] = None) -> dict:
    """
    批量获取画师作品数量和示例图（并行版本）
    artists: 列表,每个元素是字典 {'id', 'uuid', 'danbooru_link', 'gelbooru_link', 'name' ...}
    concurrency: 并行请求数量，为空时按站点取默认值
    source: 数据来源，为空时读取当前设置
    返回: {artist_id: {'post_count': int, 'example_image': str}}
    """
    return asyncio.run(_fetch_post_counts_batch_async(artists, concurrency, source))


def fetch_post_counts_streaming(artists: list, concurrency: Optional[int] = None,
                                source: Optional[str] = None):
    """
    流式批量获取画师作品数量和示例图（并行生成器版本，用于SSE）
    artists: 列表,每个元素是字典 {'id', 'uuid', 'danbooru_link', 'gelbooru_link', 'name' ...}
    concurrency: 并行请求数量，为空时按站点取默认值
    source: 数据来源，为空时读取当前设置
    生成: {'type': 'progress', ...} 或 {'type': 'result', ...} 或 {'type': 'error', ...}
    """
    import queue
    import threading

    from booru_factory import create_client, get_concurrency

    source = normalize_source(source)
    concurrency = concurrency or get_concurrency(source)

    total = len(artists)
    if total == 0:
        return

    # 过滤有效画师（当前来源下有可用链接的）
    valid_artists = [a for a in artists if link_for_source(a, source)]
    valid_total = len(valid_artists)

    if valid_total == 0:
        yield {'type': 'progress', 'current': total, 'total': total, 'artist_name': '完成'}
        return

    # 线程安全的结果队列
    result_queue = queue.Queue()

    async def _streaming_worker():
        """异步工作函数"""
        completed_count = 0

        # 按来源创建客户端
        try:
            client = create_client(source, concurrency)
            await client.start()
        except BooruError as e:
            logging.error(f"启动 {source} 抓取客户端失败: {e}")
            result_queue.put({'type': 'error', 'error': str(e)})
            result_queue.put({'type': 'done'})
            return
        except Exception as e:
            logging.error(f"启动 {source} 抓取客户端失败: {e}")
            result_queue.put({'type': 'error', 'error': str(e)})
            result_queue.put({'type': 'done'})
            return

        try:
            # 使用信号量控制并发数
            semaphore = asyncio.Semaphore(concurrency)
            aborted = False

            async def process_artist(artist: dict, worker_id: int):
                nonlocal completed_count, aborted
                async with semaphore:
                    if aborted:
                        return
                    artist_id = artist['id']
                    artist_identifier = artist.get('uuid') or str(artist_id)
                    url = link_for_source(artist, source)
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

                        logging.info(f"[Worker-{worker_id}] 正在获取画师 {name} 的数据（来源: {source}）...")

                        # 一次请求拿到作品数与帖子列表（Gelbooru 只需一次），再从中挑图
                        post_count, posts = await get_artist_summary_api(client, artist_tag, limit=10)
                        example_image = await pick_and_download_image(client, posts, artist_identifier)

                        # 双向补全两个站点的链接
                        danbooru_link, gelbooru_link = sync_links(
                            artist.get('name_noob'),
                            artist.get('name_nai'),
                            artist.get('danbooru_link'),
                            artist.get('gelbooru_link'),
                        )
                        link_updates = {}
                        if danbooru_link and danbooru_link != (artist.get('danbooru_link') or '').strip():
                            link_updates['danbooru_link'] = danbooru_link
                        if gelbooru_link and gelbooru_link != (artist.get('gelbooru_link') or '').strip():
                            link_updates['gelbooru_link'] = gelbooru_link

                        if post_count is not None:
                            result = {
                                'post_count': post_count,
                                'example_image': example_image
                            }
                            result.update(link_updates)
                            result_queue.put({
                                'type': 'result',
                                'artist_id': artist_id,
                                'artist_name': name,
                                'result': result
                            })
                            logging.info(f"[Worker-{worker_id}] 画师 {name} - 作品数量: {post_count}, 示例图: {example_image or 'None'}")
                        elif link_updates:
                            # 即便抓取失败，也把补全好的链接回传保存
                            result_queue.put({
                                'type': 'result',
                                'artist_id': artist_id,
                                'artist_name': name,
                                'result': link_updates
                            })
                            logging.warning(f"[Worker-{worker_id}] 未能获取画师 {name} 的数据")
                        else:
                            logging.warning(f"[Worker-{worker_id}] 未能获取画师 {name} 的数据")
                    except BooruError as e:
                        # 凭据/配置类错误：终止整批任务并反馈给前端
                        aborted = True
                        result_queue.put({'type': 'error', 'error': str(e)})
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
        finally:
            await client.close()

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
