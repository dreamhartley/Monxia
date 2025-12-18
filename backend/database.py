"""
数据库模型和初始化
"""
import sqlite3
import uuid
import os
from contextlib import contextmanager
from typing import Optional, List, Dict, Any
from pathlib import Path

# 数据库文件路径（支持通过环境变量配置，默认为 backend 目录）
DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent))
DATABASE_PATH = DATA_DIR / "artists.db"

@contextmanager
def get_db():
    """获取数据库连接的上下文管理器"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """初始化数据库表结构"""
    with get_db() as conn:
        cursor = conn.cursor()

        # 创建分类表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 创建画师表（新版本：无 category_id 字段）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS artists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE,
                name_noob TEXT,
                name_nai TEXT,
                danbooru_link TEXT,
                post_count INTEGER,
                notes TEXT,
                image_example TEXT,
                skip_danbooru INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 添加 skip_danbooru 字段（如果表已存在但没有此字段）
        try:
            cursor.execute("SELECT skip_danbooru FROM artists LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE artists ADD COLUMN skip_danbooru INTEGER DEFAULT 0")
            print("已添加 skip_danbooru 字段到 artists 表")

        # 添加 uuid 字段（如果表已存在但没有此字段）
        try:
            cursor.execute("SELECT uuid FROM artists LIMIT 1")
        except sqlite3.OperationalError:
            # SQLite 不支持在 ADD COLUMN 中使用 UNIQUE 约束（除非是空表），所以先添加普通列
            cursor.execute("ALTER TABLE artists ADD COLUMN uuid TEXT")
            
            # 为现有记录生成UUID
            import uuid
            cursor.execute("SELECT id FROM artists WHERE uuid IS NULL")
            rows = cursor.fetchall()
            for row in rows:
                new_uuid = str(uuid.uuid4())
                cursor.execute("UPDATE artists SET uuid = ? WHERE id = ?", (new_uuid, row['id']))
            
            # 创建唯一索引
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_uuid ON artists(uuid)")
            print("已添加 uuid 字段到 artists 表并更新现有记录")

        # 创建画师-分类关联表（多对多）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS artist_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artist_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
                UNIQUE(artist_id, category_id)
            )
        """)

        # 创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_artist_categories_artist
            ON artist_categories(artist_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_artist_categories_category
            ON artist_categories(category_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_artists_post_count
            ON artists(post_count DESC)
        """)

        # 创建画师串表 (用于保存常用的画师组合)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS artist_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                noob_text TEXT DEFAULT '',
                nai_text TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 确保有"未分类"选项
        cursor.execute("SELECT id FROM categories WHERE name = '未分类'")
        if not cursor.fetchone():
            cursor.execute("INSERT INTO categories (name) VALUES ('未分类')")

        conn.commit()
        print("数据库初始化成功")

def create_category(name: str) -> int:
    """创建新分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO categories (name) VALUES (?)",
            (name,)
        )
        return cursor.lastrowid

def update_category(category_id: int, name: str) -> bool:
    """更新分类信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE categories SET name = ? WHERE id = ?",
            (name, category_id)
        )
        return cursor.rowcount > 0

def get_all_categories() -> List[Dict[str, Any]]:
    """获取所有分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*, COUNT(DISTINCT ac.artist_id) as artist_count
            FROM categories c
            LEFT JOIN artist_categories ac ON c.id = ac.category_id
            GROUP BY c.id
            ORDER BY c.id
        """)
        return [dict(row) for row in cursor.fetchall()]

def get_artist_categories(artist_id: int) -> List[Dict[str, Any]]:
    """获取画师的所有分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*
            FROM categories c
            JOIN artist_categories ac ON c.id = ac.category_id
            WHERE ac.artist_id = ?
            ORDER BY c.id
        """, (artist_id,))
        return [dict(row) for row in cursor.fetchall()]

def set_artist_categories(artist_id: int, category_ids: List[int]) -> bool:
    """设置画师的分类（替换现有分类）"""
    with get_db() as conn:
        cursor = conn.cursor()

        # 删除现有分类关联
        cursor.execute("DELETE FROM artist_categories WHERE artist_id = ?", (artist_id,))

        # 添加新的分类关联
        for category_id in category_ids:
            cursor.execute("""
                INSERT INTO artist_categories (artist_id, category_id)
                VALUES (?, ?)
            """, (artist_id, category_id))

        return True

def add_artist_category(artist_id: int, category_id: int) -> bool:
    """为画师添加一个分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO artist_categories (artist_id, category_id)
                VALUES (?, ?)
            """, (artist_id, category_id))
            return True
        except sqlite3.IntegrityError:
            # 已存在该关联
            return False

def remove_artist_category(artist_id: int, category_id: int) -> bool:
    """移除画师的一个分类"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM artist_categories
            WHERE artist_id = ? AND category_id = ?
        """, (artist_id, category_id))
        return cursor.rowcount > 0

def create_artist(category_ids: List[int], name_noob: str = "", name_nai: str = "",
                  danbooru_link: str = "", post_count: Optional[int] = None,
                  notes: str = "", image_example: str = "", skip_danbooru: bool = False) -> int:
    """创建新画师（支持多分类）"""
    with get_db() as conn:
        cursor = conn.cursor()

        # 生成UUID
        artist_uuid = str(uuid.uuid4())

        # 插入画师基本信息
        cursor.execute("""
            INSERT INTO artists
            (uuid, name_noob, name_nai, danbooru_link, post_count, notes, image_example, skip_danbooru)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (artist_uuid, name_noob, name_nai, danbooru_link, post_count, notes, image_example, 1 if skip_danbooru else 0))
        artist_id = cursor.lastrowid

        # 添加分类关联
        for category_id in category_ids:
            cursor.execute("""
                INSERT INTO artist_categories (artist_id, category_id)
                VALUES (?, ?)
            """, (artist_id, category_id))

        return artist_id

def get_artists_by_category(category_id: int, sort_by: str = "post_count") -> List[Dict[str, Any]]:
    """获取指定分类下的所有画师（支持多分类）"""
    with get_db() as conn:
        cursor = conn.cursor()
        order_clause = "a.post_count DESC NULLS LAST" if sort_by == "post_count" else "a.id"

        cursor.execute(f"""
            SELECT DISTINCT a.*
            FROM artists a
            JOIN artist_categories ac ON a.id = ac.artist_id
            WHERE ac.category_id = ?
            ORDER BY {order_clause}
        """, (category_id,))

        artists = [dict(row) for row in cursor.fetchall()]

        # 为每个画师添加分类信息
        for artist in artists:
            artist['categories'] = get_artist_categories(artist['id'])
            # 保留 category_name 字段以兼容前端（显示第一个分类）
            if artist['categories']:
                artist['category_name'] = ', '.join([c['name'] for c in artist['categories']])
                artist['category_id'] = artist['categories'][0]['id']  # 兼容性字段
            else:
                artist['category_name'] = '未分类'
                artist['category_id'] = None

        return artists

def get_all_artists() -> List[Dict[str, Any]]:
    """获取所有画师（支持多分类）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM artists
            ORDER BY post_count DESC NULLS LAST
        """)

        artists = [dict(row) for row in cursor.fetchall()]

        # 为每个画师添加分类信息
        for artist in artists:
            artist['categories'] = get_artist_categories(artist['id'])
            # 保留 category_name 字段以兼容前端（显示所有分类）
            if artist['categories']:
                artist['category_name'] = ', '.join([c['name'] for c in artist['categories']])
                artist['category_id'] = artist['categories'][0]['id']  # 兼容性字段
            else:
                artist['category_name'] = '未分类'
                artist['category_id'] = None

        return artists

def update_artist(artist_id: int, **kwargs) -> bool:
    """更新画师信息（支持多分类）"""
    allowed_fields = ['name_noob', 'name_nai', 'danbooru_link', 'post_count',
                      'notes', 'image_example', 'skip_danbooru']

    # 处理分类更新（如果提供了 category_ids）
    category_ids = kwargs.pop('category_ids', None)
    if category_ids is not None:
        set_artist_categories(artist_id, category_ids)

    # 兼容旧的 category_id 参数（转换为单个分类）
    category_id = kwargs.pop('category_id', None)
    if category_id is not None and category_ids is None:
        set_artist_categories(artist_id, [category_id])

    # 处理 skip_danbooru 布尔值转换
    if 'skip_danbooru' in kwargs:
        kwargs['skip_danbooru'] = 1 if kwargs['skip_danbooru'] else 0

    updates = {k: v for k, v in kwargs.items() if k in allowed_fields}
    if not updates:
        return category_ids is not None or category_id is not None

    updates['updated_at'] = 'CURRENT_TIMESTAMP'

    set_clause = ", ".join([f"{k} = ?" for k in updates.keys() if k != 'updated_at'])
    set_clause += ", updated_at = CURRENT_TIMESTAMP"

    values = [v for k, v in updates.items() if k != 'updated_at']
    values.append(artist_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            UPDATE artists
            SET {set_clause}
            WHERE id = ?
        """, values)
        return cursor.rowcount > 0

def delete_artist(artist_id: int) -> bool:
    """删除画师"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM artists WHERE id = ?", (artist_id,))
        return cursor.rowcount > 0

def get_artist_by_id(artist_id: int) -> Optional[Dict[str, Any]]:
    """根据ID获取画师（支持多分类）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM artists WHERE id = ?", (artist_id,))
        row = cursor.fetchone()
        if not row:
            return None

        artist = dict(row)

        # 添加分类信息
        artist['categories'] = get_artist_categories(artist_id)

        # 保留 category_name 字段以兼容前端（显示所有分类）
        if artist['categories']:
            artist['category_name'] = ', '.join([c['name'] for c in artist['categories']])
            artist['category_id'] = artist['categories'][0]['id']  # 兼容性字段
        else:
            artist['category_name'] = '未分类'
            artist['category_id'] = None

        return artist

def check_artist_exists(name_noob: str = "", name_nai: str = "", danbooru_link: str = "") -> Optional[Dict[str, Any]]:
    """检查画师是否已存在"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        conditions = []
        params = []
        
        if name_noob:
            conditions.append("name_noob = ?")
            params.append(name_noob)
            
        if name_nai:
            conditions.append("name_nai = ?")
            params.append(name_nai)
            
        if danbooru_link:
            conditions.append("danbooru_link = ?")
            params.append(danbooru_link)
            
        if not conditions:
            return None
            
        query = f"SELECT * FROM artists WHERE {' OR '.join(conditions)} LIMIT 1"
        cursor.execute(query, params)
        row = cursor.fetchone()
        
        if row:
            return dict(row)
        return None

def find_duplicate_artists() -> List[Dict[str, Any]]:
    """查找重复的画师"""
    with get_db() as conn:
        cursor = conn.cursor()
        # 基于danbooru链接或画师名称查找重复
        cursor.execute("""
            WITH artist_identities AS (
                SELECT
                    id,
                    COALESCE(NULLIF(danbooru_link, ''),
                             NULLIF(name_noob, ''),
                             NULLIF(name_nai, '')) as identity
                FROM artists
                WHERE COALESCE(NULLIF(danbooru_link, ''),
                              NULLIF(name_noob, ''),
                              NULLIF(name_nai, '')) IS NOT NULL
            )
            SELECT a.*
            FROM artists a
            WHERE EXISTS (
                SELECT 1
                FROM artist_identities ai1
                JOIN artist_identities ai2 ON ai1.identity = ai2.identity
                WHERE ai1.id = a.id
                  AND ai1.id != ai2.id
            )
            ORDER BY
                COALESCE(a.danbooru_link, a.name_noob, a.name_nai),
                a.id
        """)

        artists = [dict(row) for row in cursor.fetchall()]

        # 为每个画师添加分类信息
        for artist in artists:
            artist['categories'] = get_artist_categories(artist['id'])
            if artist['categories']:
                artist['category_name'] = ', '.join([c['name'] for c in artist['categories']])
            else:
                artist['category_name'] = '未分类'

        return artists

def get_all_artists_for_dedup() -> Dict[str, Dict[str, Any]]:
    """
    获取所有画师数据用于去重检测
    返回: {
        'by_noob': {name_noob: artist_dict},
        'by_nai': {name_nai: artist_dict},
        'by_link': {danbooru_link: artist_dict}
    }
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM artists")

        by_noob = {}
        by_nai = {}
        by_link = {}

        for row in cursor.fetchall():
            artist = dict(row)
            if artist.get('name_noob'):
                by_noob[artist['name_noob']] = artist
            if artist.get('name_nai'):
                by_nai[artist['name_nai']] = artist
            if artist.get('danbooru_link'):
                by_link[artist['danbooru_link']] = artist

        return {
            'by_noob': by_noob,
            'by_nai': by_nai,
            'by_link': by_link
        }


def batch_create_artists(artists_data: List[Dict[str, Any]]) -> List[int]:
    """
    批量创建画师
    artists_data: [{
        'category_ids': [...],
        'name_noob': '',
        'name_nai': '',
        'danbooru_link': '',
        'post_count': None,
        'notes': '',
        'image_example': '',
        'skip_danbooru': False
    }, ...]
    返回: 新创建的画师ID列表
    """
    if not artists_data:
        return []

    created_ids = []

    with get_db() as conn:
        cursor = conn.cursor()

        for artist in artists_data:
            artist_uuid = str(uuid.uuid4())

            cursor.execute("""
                INSERT INTO artists
                (uuid, name_noob, name_nai, danbooru_link, post_count, notes, image_example, skip_danbooru)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                artist_uuid,
                artist.get('name_noob', ''),
                artist.get('name_nai', ''),
                artist.get('danbooru_link', ''),
                artist.get('post_count'),
                artist.get('notes', ''),
                artist.get('image_example', ''),
                1 if artist.get('skip_danbooru') else 0
            ))

            artist_id = cursor.lastrowid
            created_ids.append(artist_id)

            # 添加分类关联
            for category_id in artist.get('category_ids', []):
                cursor.execute("""
                    INSERT INTO artist_categories (artist_id, category_id)
                    VALUES (?, ?)
                """, (artist_id, category_id))

        return created_ids


def batch_update_artists(updates: List[Dict[str, Any]]) -> int:
    """
    批量更新画师
    updates: [{
        'id': artist_id,
        'category_ids': [...],  # 可选
        'name_noob': '',
        'name_nai': '',
        ...
    }, ...]
    返回: 更新的画师数量
    """
    if not updates:
        return 0

    allowed_fields = ['name_noob', 'name_nai', 'danbooru_link', 'post_count',
                      'notes', 'image_example', 'skip_danbooru']
    updated_count = 0

    with get_db() as conn:
        cursor = conn.cursor()

        for update in updates:
            artist_id = update.get('id')
            if not artist_id:
                continue

            # 处理分类更新
            category_ids = update.get('category_ids')
            if category_ids is not None:
                cursor.execute("DELETE FROM artist_categories WHERE artist_id = ?", (artist_id,))
                for category_id in category_ids:
                    cursor.execute("""
                        INSERT INTO artist_categories (artist_id, category_id)
                        VALUES (?, ?)
                    """, (artist_id, category_id))

            # 处理其他字段更新
            field_updates = {k: v for k, v in update.items() if k in allowed_fields}

            if 'skip_danbooru' in field_updates:
                field_updates['skip_danbooru'] = 1 if field_updates['skip_danbooru'] else 0

            if field_updates:
                set_clause = ", ".join([f"{k} = ?" for k in field_updates.keys()])
                set_clause += ", updated_at = CURRENT_TIMESTAMP"

                values = list(field_updates.values())
                values.append(artist_id)

                cursor.execute(f"""
                    UPDATE artists
                    SET {set_clause}
                    WHERE id = ?
                """, values)

                if cursor.rowcount > 0:
                    updated_count += 1
            elif category_ids is not None:
                updated_count += 1

        return updated_count


if __name__ == "__main__":
    init_db()
