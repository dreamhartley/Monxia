"""
配置数据库模块
独立存储管理员账号信息，与画师数据库分开
"""
import sqlite3
import secrets
import hashlib
import os
from contextlib import contextmanager
from typing import Optional, Dict, Any
from pathlib import Path

# 配置数据库文件路径（支持通过环境变量配置，默认为 backend 目录）
DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent))
CONFIG_DATABASE_PATH = DATA_DIR / "config.db"

# 默认管理员账号
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"


def hash_password(password: str, salt: str) -> str:
    """使用 SHA256 哈希密码"""
    return hashlib.sha256((password + salt).encode()).hexdigest()


@contextmanager
def get_config_db():
    """获取配置数据库连接的上下文管理器"""
    conn = sqlite3.connect(CONFIG_DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_config_db():
    """初始化配置数据库表结构"""
    with get_config_db() as conn:
        cursor = conn.cursor()

        # 创建管理员账号表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                secret_key TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 创建 Danbooru API 配置表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS danbooru_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                username TEXT DEFAULT '',
                api_key TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 检查是否已有配置，如果没有则创建默认配置
        cursor.execute("SELECT id FROM admin_config WHERE id = 1")
        if not cursor.fetchone():
            # 生成随机盐值和密钥
            salt = secrets.token_hex(16)
            secret_key = secrets.token_hex(32)
            password_hash = hash_password(DEFAULT_ADMIN_PASSWORD, salt)

            cursor.execute("""
                INSERT INTO admin_config (id, username, password_hash, password_salt, secret_key)
                VALUES (1, ?, ?, ?, ?)
            """, (DEFAULT_ADMIN_USERNAME, password_hash, salt, secret_key))

            print(f"配置数据库初始化成功，默认用户名: {DEFAULT_ADMIN_USERNAME}")
            print("请登录后修改默认密码！")

        conn.commit()


def get_admin_config() -> Optional[Dict[str, Any]]:
    """获取管理员配置"""
    with get_config_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM admin_config WHERE id = 1")
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def get_secret_key() -> str:
    """获取 Flask SECRET_KEY"""
    config = get_admin_config()
    if config:
        return config['secret_key']
    # 如果没有配置，先初始化
    init_config_db()
    config = get_admin_config()
    return config['secret_key']


def get_admin_username() -> str:
    """获取管理员用户名"""
    config = get_admin_config()
    if config:
        return config['username']
    return DEFAULT_ADMIN_USERNAME


def verify_password(username: str, password: str) -> bool:
    """验证管理员密码"""
    config = get_admin_config()
    if not config:
        return False

    if username != config['username']:
        return False

    password_hash = hash_password(password, config['password_salt'])
    return password_hash == config['password_hash']


def update_admin_credentials(
    current_password: str,
    new_username: Optional[str] = None,
    new_password: Optional[str] = None
) -> Dict[str, Any]:
    """
    更新管理员凭证

    Args:
        current_password: 当前密码（用于验证）
        new_username: 新用户名（可选）
        new_password: 新密码（可选）

    Returns:
        Dict 包含 success 和 message/error
    """
    config = get_admin_config()
    if not config:
        return {"success": False, "error": "配置不存在"}

    # 验证当前密码
    current_hash = hash_password(current_password, config['password_salt'])
    if current_hash != config['password_hash']:
        return {"success": False, "error": "当前密码错误"}

    # 至少需要修改一项
    if not new_username and not new_password:
        return {"success": False, "error": "请提供新用户名或新密码"}

    with get_config_db() as conn:
        cursor = conn.cursor()

        updates = []
        params = []

        if new_username:
            if len(new_username) < 3:
                return {"success": False, "error": "用户名至少需要3个字符"}
            updates.append("username = ?")
            params.append(new_username)

        if new_password:
            if len(new_password) < 6:
                return {"success": False, "error": "密码至少需要6个字符"}
            # 生成新的盐值
            new_salt = secrets.token_hex(16)
            new_hash = hash_password(new_password, new_salt)
            updates.append("password_hash = ?")
            updates.append("password_salt = ?")
            params.append(new_hash)
            params.append(new_salt)

        updates.append("updated_at = CURRENT_TIMESTAMP")

        sql = f"UPDATE admin_config SET {', '.join(updates)} WHERE id = 1"
        cursor.execute(sql, params)
        conn.commit()

    message_parts = []
    if new_username:
        message_parts.append("用户名已更新")
    if new_password:
        message_parts.append("密码已更新")

    return {"success": True, "message": "，".join(message_parts)}


# -------------------------------
# Danbooru API 配置管理
# -------------------------------

def get_danbooru_config() -> Optional[Dict[str, Any]]:
    """
    获取 Danbooru API 配置
    返回: {'username': str, 'api_key': str} 或 None
    """
    with get_config_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username, api_key FROM danbooru_config WHERE id = 1")
        row = cursor.fetchone()
        if row:
            return {
                'username': row['username'] or '',
                'api_key': row['api_key'] or ''
            }
        return {'username': '', 'api_key': ''}


def update_danbooru_config(username: str, api_key: str) -> Dict[str, Any]:
    """
    更新 Danbooru API 配置

    Args:
        username: Danbooru 用户名
        api_key: Danbooru API Key

    Returns:
        Dict 包含 success 和 message/error
    """
    with get_config_db() as conn:
        cursor = conn.cursor()

        # 检查是否已有配置
        cursor.execute("SELECT id FROM danbooru_config WHERE id = 1")
        if cursor.fetchone():
            # 更新现有配置
            cursor.execute("""
                UPDATE danbooru_config
                SET username = ?, api_key = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
            """, (username or '', api_key or ''))
        else:
            # 插入新配置
            cursor.execute("""
                INSERT INTO danbooru_config (id, username, api_key)
                VALUES (1, ?, ?)
            """, (username or '', api_key or ''))

        conn.commit()

    return {"success": True, "message": "Danbooru API 配置已更新"}


def clear_danbooru_config() -> Dict[str, Any]:
    """
    清除 Danbooru API 配置
    """
    return update_danbooru_config('', '')


if __name__ == "__main__":
    init_config_db()
    print("配置数据库初始化完成")
