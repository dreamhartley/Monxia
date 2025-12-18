"""
工具函数:画师名称处理、链接生成、作品数量爬取
"""
import re
import logging
import time
import random
import os
import asyncio
from io import BytesIO
from pathlib import Path
from typing import Optional, Dict, Tuple, List
from PIL import Image
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
from playwright.async_api import async_playwright, Page as AsyncPage

logging.basicConfig(level=logging.INFO)

# 数据目录（支持通过环境变量配置，默认为 backend 目录）
DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent))

# 图片存储目录
IMAGES_DIR = DATA_DIR / 'artist_images'
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# 登录背景图存储目录
BACKGROUNDS_DIR = DATA_DIR / 'backgrounds'
BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)

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
# 使用 Playwright 获取作品数量和示例图
# -------------------------------

def download_image_with_page(page: Page, url: str, artist_identifier: str, timeout: int = 30000) -> Optional[str]:
    """
    使用Playwright下载图片到本地
    page: Playwright页面对象
    url: 图片URL
    artist_identifier: 画师标识符 (UUID 或 ID)
    timeout: 超时时间(毫秒)
    返回: 本地文件名(例如 "uuid.jpg") 或 None
    """
    try:
        logging.info(f"正在下载图片: {url[:80]}...")

        # 访问图片URL
        response = page.goto(url, timeout=timeout, wait_until='domcontentloaded')

        if not response or response.status != 200:
            logging.warning(f"图片下载失败: HTTP {response.status if response else 'None'}")
            return None

        # 获取图片内容
        image_content = response.body()

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

def validate_image_url_with_page(page: Page, url: str, timeout: int = 10000) -> bool:
    """
    使用Playwright验证图片URL是否可访问
    page: Playwright页面对象
    url: 图片URL
    timeout: 超时时间(毫秒)
    """
    try:
        # 尝试访问图片URL
        response = page.goto(url, timeout=timeout, wait_until='domcontentloaded')

        # 检查HTTP状态码
        if response and response.status == 200:
            return True
        else:
            logging.debug(f"图片URL返回状态码: {response.status if response else 'None'}")
            return False
    except Exception as e:
        logging.debug(f"验证图片URL失败: {url} - {e}")
        return False

def get_example_image(page: Page, artist_identifier: str, max_retries: int = 5) -> Optional[str]:
    """
    从当前页面随机获取一个有效的示例图片并下载到本地
    返回本地文件名或None
    """
    try:
        # 查找所有post预览图
        post_elements = page.query_selector_all('article.post-preview img.post-preview-image')

        if not post_elements:
            logging.debug("未找到任何post预览图")
            return None

        # 记录已尝试的图片,避免重复
        tried_images = set()

        # 获取浏览器上下文,创建新页面用于下载
        context = page.context
        download_page = context.new_page()

        try:
            for attempt in range(max_retries):
                # 如果所有图片都尝试过了,退出
                if len(tried_images) >= len(post_elements):
                    logging.warning(f"已尝试所有图片,但都无法下载")
                    break

                # 随机选择一个未尝试过的图片
                available_elements = [el for el in post_elements
                                    if el.get_attribute('src') not in tried_images]

                if not available_elements:
                    break

                random_img = random.choice(available_elements)
                img_src = random_img.get_attribute('src')

                if not img_src:
                    logging.debug("图片src为空")
                    continue

                tried_images.add(img_src)

                # 将尺寸部分替换为original
                original_url = re.sub(r'/\d+x\d+/', '/original/', img_src)

                # 尝试下载图片（先尝试原始URL，可能是.jpg）
                logging.info(f"尝试下载图片 ({attempt + 1}/{max_retries}): {original_url[:80]}...")
                filename = download_image_with_page(download_page, original_url, artist_identifier)

                if filename:
                    logging.info(f"图片下载成功: {filename}")
                    return filename
                else:
                    # 如果失败且URL是.jpg格式，尝试.png格式
                    if original_url.lower().endswith('.jpg'):
                        png_url = original_url[:-4] + '.png'
                        logging.info(f"jpg格式失败，尝试png格式: {png_url[:80]}...")
                        filename = download_image_with_page(download_page, png_url, artist_identifier)

                        if filename:
                            logging.info(f"png格式下载成功: {filename}")
                            return filename
                        else:
                            logging.warning(f"jpg和png格式都失败，尝试其他图片...")
                    else:
                        logging.warning(f"图片下载失败，尝试其他图片...")

            logging.warning("未能下载有效的示例图")
            return None
        finally:
            # 关闭下载页面
            download_page.close()

    except Exception as e:
        logging.warning(f"获取示例图失败: {e}")
        return None

def get_post_count_and_image(page: Page, url: str, artist_identifier: str, artist_name: str, retry_count: int = 3) -> Dict[str, any]:
    """
    从Danbooru获取画师作品数量和示例图
    返回: {'post_count': int, 'example_image': str}  # example_image现在是本地文件名
    """
    for attempt in range(retry_count):
        try:
            logging.info(f"正在访问: {url}")
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(2000)

            post_count = None
            example_image = None

            # 获取示例图(下载到本地)
            example_image = get_example_image(page, artist_identifier)

            # 尝试点击 Artist 链接(如果存在)
            try:
                artist_link = page.wait_for_selector('a#show-excerpt-link.artist-excerpt-link', timeout=5000)
                if artist_link:
                    artist_link.click()
                    page.wait_for_load_state("networkidle")
                    page.wait_for_timeout(1500)
                    post_count_element = page.wait_for_selector('span.text-sm.post-count', timeout=5000)
                    if post_count_element:
                        post_count_text = post_count_element.inner_text()
                        match = re.search(r'\d+', post_count_text)
                        if match:
                            post_count = int(match.group())
            except Exception as e:
                logging.debug(f"未找到 artist-excerpt-link 或点击失败: {e}")

            # 直接在原页面寻找数量信息
            if post_count is None:
                try:
                    search_stats = page.wait_for_selector('div.search-stats', timeout=10000, state='visible')
                    if search_stats:
                        stats_text = search_stats.inner_text()
                        match = re.search(r'(\d+)\s+posts?', stats_text)
                        if match:
                            post_count = int(match.group(1))
                except Exception as e:
                    logging.debug(f"未找到 search-stats 元素: {e}")

            # 尝试备用选择器
            if post_count is None:
                try:
                    alt_selectors = [
                        'div.paginator span',
                        'div#posts-container',
                        'span.post-count'
                    ]
                    for selector in alt_selectors:
                        element = page.query_selector(selector)
                        if element:
                            text = element.inner_text()
                            match = re.search(r'(\d+)\s+posts?', text)
                            if match:
                                post_count = int(match.group(1))
                                break
                except Exception as e:
                    logging.debug(f"备用选择器未找到数据: {e}")

            if post_count is None:
                raise Exception("无法找到作品数量")

            return {
                'post_count': post_count,
                'example_image': example_image
            }

        except Exception as e:
            logging.warning(f"第 {attempt+1} 次尝试获取 {artist_name} 数据失败: {e}")
            if attempt < retry_count - 1:
                wait_time = 3 * (attempt + 1)
                logging.info(f"等待 {wait_time} 秒后重试...")
                time.sleep(wait_time)
            else:
                logging.error(f"未能获取画师 {artist_name} 的数据")

    return {'post_count': None, 'example_image': None}


# -------------------------------
# 异步版本的爬取函数（用于并行处理）
# -------------------------------

async def download_image_with_page_async(page: AsyncPage, url: str, artist_identifier: str, timeout: int = 30000) -> Optional[str]:
    """异步版本：使用Playwright下载图片到本地"""
    try:
        logging.info(f"正在下载图片: {url[:80]}...")
        response = await page.goto(url, timeout=timeout, wait_until='domcontentloaded')

        if not response or response.status != 200:
            logging.warning(f"图片下载失败: HTTP {response.status if response else 'None'}")
            return None

        image_content = await response.body()

        try:
            with Image.open(BytesIO(image_content)) as img:
                if img.mode in ('RGBA', 'P', 'LA'):
                    img = img.convert('RGB')

                filename = f"{artist_identifier}.jpg"
                filepath = IMAGES_DIR / filename

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

    except Exception as e:
        logging.warning(f"下载图片失败: {url} - {e}")
        return None


async def get_example_image_async(page: AsyncPage, artist_identifier: str, max_retries: int = 5) -> Optional[str]:
    """异步版本：从当前页面随机获取一个有效的示例图片并下载到本地"""
    try:
        post_elements = await page.query_selector_all('article.post-preview img.post-preview-image')

        if not post_elements:
            logging.debug("未找到任何post预览图")
            return None

        tried_images = set()
        context = page.context
        download_page = await context.new_page()

        try:
            for attempt in range(max_retries):
                if len(tried_images) >= len(post_elements):
                    logging.warning(f"已尝试所有图片,但都无法下载")
                    break

                available_elements = []
                for el in post_elements:
                    src = await el.get_attribute('src')
                    if src not in tried_images:
                        available_elements.append(el)

                if not available_elements:
                    break

                random_img = random.choice(available_elements)
                img_src = await random_img.get_attribute('src')

                if not img_src:
                    logging.debug("图片src为空")
                    continue

                tried_images.add(img_src)
                original_url = re.sub(r'/\d+x\d+/', '/original/', img_src)

                logging.info(f"尝试下载图片 ({attempt + 1}/{max_retries}): {original_url[:80]}...")
                filename = await download_image_with_page_async(download_page, original_url, artist_identifier)

                if filename:
                    logging.info(f"图片下载成功: {filename}")
                    return filename
                else:
                    if original_url.lower().endswith('.jpg'):
                        png_url = original_url[:-4] + '.png'
                        logging.info(f"jpg格式失败，尝试png格式: {png_url[:80]}...")
                        filename = await download_image_with_page_async(download_page, png_url, artist_identifier)

                        if filename:
                            logging.info(f"png格式下载成功: {filename}")
                            return filename
                        else:
                            logging.warning(f"jpg和png格式都失败，尝试其他图片...")
                    else:
                        logging.warning(f"图片下载失败，尝试其他图片...")

            logging.warning("未能下载有效的示例图")
            return None
        finally:
            await download_page.close()

    except Exception as e:
        logging.warning(f"获取示例图失败: {e}")
        return None


async def get_post_count_and_image_async(page: AsyncPage, url: str, artist_identifier: str, artist_name: str, retry_count: int = 3) -> Dict[str, any]:
    """异步版本：从Danbooru获取画师作品数量和示例图"""
    for attempt in range(retry_count):
        try:
            logging.info(f"正在访问: {url}")
            await page.goto(url, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(2000)

            post_count = None
            example_image = None

            example_image = await get_example_image_async(page, artist_identifier)

            try:
                artist_link = await page.wait_for_selector('a#show-excerpt-link.artist-excerpt-link', timeout=5000)
                if artist_link:
                    await artist_link.click()
                    await page.wait_for_load_state("networkidle")
                    await page.wait_for_timeout(1500)
                    post_count_element = await page.wait_for_selector('span.text-sm.post-count', timeout=5000)
                    if post_count_element:
                        post_count_text = await post_count_element.inner_text()
                        match = re.search(r'\d+', post_count_text)
                        if match:
                            post_count = int(match.group())
            except Exception as e:
                logging.debug(f"未找到 artist-excerpt-link 或点击失败: {e}")

            if post_count is None:
                try:
                    search_stats = await page.wait_for_selector('div.search-stats', timeout=10000, state='visible')
                    if search_stats:
                        stats_text = await search_stats.inner_text()
                        match = re.search(r'(\d+)\s+posts?', stats_text)
                        if match:
                            post_count = int(match.group(1))
                except Exception as e:
                    logging.debug(f"未找到 search-stats 元素: {e}")

            if post_count is None:
                try:
                    alt_selectors = [
                        'div.paginator span',
                        'div#posts-container',
                        'span.post-count'
                    ]
                    for selector in alt_selectors:
                        element = await page.query_selector(selector)
                        if element:
                            text = await element.inner_text()
                            match = re.search(r'(\d+)\s+posts?', text)
                            if match:
                                post_count = int(match.group(1))
                                break
                except Exception as e:
                    logging.debug(f"备用选择器未找到数据: {e}")

            if post_count is None:
                raise Exception("无法找到作品数量")

            return {
                'post_count': post_count,
                'example_image': example_image
            }

        except Exception as e:
            logging.warning(f"第 {attempt+1} 次尝试获取 {artist_name} 数据失败: {e}")
            if attempt < retry_count - 1:
                wait_time = 3 * (attempt + 1)
                logging.info(f"等待 {wait_time} 秒后重试...")
                await asyncio.sleep(wait_time)
            else:
                logging.error(f"未能获取画师 {artist_name} 的数据")

    return {'post_count': None, 'example_image': None}


async def _fetch_single_artist(semaphore: asyncio.Semaphore, context, artist: dict, worker_id: int) -> Tuple[int, Optional[Dict]]:
    """异步获取单个画师数据（带信号量控制并发）"""
    async with semaphore:
        artist_id = artist['id']
        artist_identifier = artist.get('uuid') or str(artist_id)
        url = artist.get('danbooru_link', '')
        name = artist.get('name', 'Unknown')

        if not url or not url.strip():
            return artist_id, None

        page = await context.new_page()
        page.set_default_timeout(60000)
        page.set_default_navigation_timeout(60000)

        try:
            logging.info(f"[Worker-{worker_id}] 正在获取画师 {name} 的数据...")
            result = await get_post_count_and_image_async(page, url, artist_identifier, name)

            if result['post_count'] is not None:
                logging.info(f"[Worker-{worker_id}] 画师 {name} - 作品数量: {result['post_count']}, 示例图: {result['example_image'] or 'None'}")
                return artist_id, result
            else:
                logging.warning(f"[Worker-{worker_id}] 未能获取画师 {name} 的数据")
                return artist_id, None
        finally:
            await page.close()
            # 短暂等待避免请求过快
            await asyncio.sleep(0.5)


async def _fetch_post_counts_batch_async(artists: list, concurrency: int = 8) -> dict:
    """内部异步函数：批量获取画师作品数量"""
    results = {}

    if not artists:
        return results

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            locale='en-US',
            timezone_id="Asia/Shanghai",
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            is_mobile=False,
            has_touch=False,
            extra_http_headers={
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-US,en;q=0.9",
                "DNT": "1",
                "Priority": "u=1, i",
                "Sec-CH-UA": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                "Sec-CH-UA-Mobile": "?0",
                "Sec-CH-UA-Platform": '"Windows"',
            }
        )
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3],
            });
        """)

        # 使用信号量控制并发数
        semaphore = asyncio.Semaphore(concurrency)

        # 过滤有效画师
        valid_artists = [a for a in artists if a.get('danbooru_link', '').strip()]

        # 创建所有任务
        tasks = [
            _fetch_single_artist(semaphore, context, artist, i % concurrency)
            for i, artist in enumerate(valid_artists)
        ]

        # 并行执行所有任务
        task_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 收集结果
        for item in task_results:
            if isinstance(item, Exception):
                logging.error(f"任务异常: {item}")
                continue
            artist_id, result = item
            if result is not None:
                results[artist_id] = result

        await browser.close()

    return results


def fetch_post_counts_batch(artists: list, concurrency: int = 8) -> dict:
    """
    批量获取画师作品数量和示例图（并行版本）
    artists: 列表,每个元素是字典 {'id': ..., 'uuid': ..., 'danbooru_link': ..., 'name': ...}
    concurrency: 并行页面数量，默认8个
    返回: {artist_id: {'post_count': int, 'example_image': str}}
    """
    return asyncio.run(_fetch_post_counts_batch_async(artists, concurrency))

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


def fetch_post_counts_streaming(artists: list, concurrency: int = 8):
    """
    流式批量获取画师作品数量和示例图（并行生成器版本，用于SSE）
    artists: 列表,每个元素是字典 {'id': ..., 'uuid': ..., 'danbooru_link': ..., 'name': ...}
    concurrency: 并行页面数量，默认8个
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

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                locale='en-US',
                timezone_id="Asia/Shanghai",
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=1,
                is_mobile=False,
                has_touch=False,
                extra_http_headers={
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip, deflate, br, zstd",
                    "Accept-Language": "en-US,en;q=0.9",
                    "DNT": "1",
                    "Priority": "u=1, i",
                    "Sec-CH-UA": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                    "Sec-CH-UA-Mobile": "?0",
                    "Sec-CH-UA-Platform": '"Windows"',
                }
            )
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3],
                });
            """)

            semaphore = asyncio.Semaphore(concurrency)

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

                    page = await context.new_page()
                    page.set_default_timeout(60000)
                    page.set_default_navigation_timeout(60000)

                    try:
                        logging.info(f"[Worker-{worker_id}] 正在获取画师 {name} 的数据...")
                        result = await get_post_count_and_image_async(page, url, artist_identifier, name)

                        if result['post_count'] is not None:
                            result_queue.put({
                                'type': 'result',
                                'artist_id': artist_id,
                                'artist_name': name,
                                'result': result
                            })
                            logging.info(f"[Worker-{worker_id}] 画师 {name} - 作品数量: {result['post_count']}, 示例图: {result['example_image'] or 'None'}")
                        else:
                            logging.warning(f"[Worker-{worker_id}] 未能获取画师 {name} 的数据")
                    finally:
                        await page.close()
                        await asyncio.sleep(0.5)

            # 创建所有任务并并行执行
            tasks = [
                process_artist(artist, i % concurrency)
                for i, artist in enumerate(valid_artists)
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

            await browser.close()

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
