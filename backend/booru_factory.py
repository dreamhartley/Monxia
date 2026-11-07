"""
Booru 抓取客户端工厂

根据当前设置的数据来源创建对应客户端，并自动读取该站点的凭据：
  - danbooru：Playwright 客户端，凭据可选（匿名也能用，配了 API Key 配额更高）
  - gelbooru：HTTP 客户端，必须配置 user_id + api_key
"""
import logging
import os
from typing import Optional

from booru_base import BooruClientBase, BooruConfigError
from booru_links import SOURCE_GELBOORU, normalize_source

# 各站点的默认并发数（Gelbooru 的 API 请求在客户端内部串行，这里主要控制图片下载并发）
DEFAULT_CONCURRENCY = {
    'danbooru': 5,
    'gelbooru': int(os.environ.get('GELBOORU_CONCURRENCY', '2')),
}


def get_concurrency(source: Optional[str] = None) -> int:
    """获取指定来源的默认并发数"""
    return DEFAULT_CONCURRENCY[normalize_source(source)]


def create_client(source: Optional[str] = None, concurrency: Optional[int] = None) -> BooruClientBase:
    """
    根据数据来源创建抓取客户端。

    Args:
        source: 'danbooru' / 'gelbooru'，为空时读取当前设置
        concurrency: 并发数，为空时按站点取默认值

    Raises:
        BooruConfigError: 该来源所需的凭据未配置
    """
    from config_db import get_data_source, get_danbooru_config, get_gelbooru_config

    resolved_source = normalize_source(source or get_data_source())
    resolved_concurrency = concurrency or get_concurrency(resolved_source)

    if resolved_source == SOURCE_GELBOORU:
        config = get_gelbooru_config()
        if not config.get('user_id') or not config.get('api_key'):
            raise BooruConfigError(
                "Gelbooru 抓取需要 API 凭据，请到「设置 → 数据来源」填写 User ID 与 API Key"
            )
        from gelbooru_client import GelbooruClient
        logging.info(f"使用 Gelbooru 数据源（并发 {resolved_concurrency}）")
        return GelbooruClient(
            user_id=config['user_id'],
            api_key=config['api_key'],
            concurrency=resolved_concurrency,
        )

    from danbooru_client import BROWSER_HEADLESS, DanbooruClient
    config = get_danbooru_config() or {}
    logging.info(f"使用 Danbooru 数据源（并发 {resolved_concurrency}）")
    return DanbooruClient(
        headless=BROWSER_HEADLESS,
        concurrency=resolved_concurrency,
        username=config.get('username', ''),
        api_key=config.get('api_key', ''),
    )
