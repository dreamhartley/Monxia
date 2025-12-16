"""
Flask 后端 API 服务
适配 React 前端的前后端分离架构
"""
from flask import Flask, request, jsonify, send_from_directory, session, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from functools import wraps
import os
import json
import secrets
import pandas as pd
from io import BytesIO
from pathlib import Path
import logging
from PIL import Image
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)

# .env 文件路径
ENV_FILE = Path(__file__).parent / '.env'

def ensure_env_file():
    """确保 .env 文件存在，如果不存在则自动创建"""
    if not ENV_FILE.exists():
        logging.info("未找到 .env 文件，正在自动生成...")
        secret_key = secrets.token_hex(32)
        env_content = f"""# 管理员账号配置
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Flask密钥（用于session加密）
SECRET_KEY={secret_key}
"""
        ENV_FILE.write_text(env_content, encoding='utf-8')
        logging.info(f".env 文件已生成: {ENV_FILE}")
        logging.warning("请修改 .env 文件中的默认密码！")

# 确保 .env 文件存在
ensure_env_file()

# 加载.env配置
load_dotenv(ENV_FILE)

from database import (
    init_db, get_all_categories, create_category, update_category, get_all_artists,
    get_artists_by_category, create_artist, update_artist, delete_artist,
    get_artist_by_id, find_duplicate_artists, get_db, get_artist_categories,
    set_artist_categories, check_artist_exists
)
from utils import (
    auto_complete_names, format_noob, format_nai,
    generate_danbooru_link, fetch_post_counts_batch, get_artists_without_images,
    IMAGES_DIR
)

app = Flask(__name__)

# 配置Flask
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 86400 * 7

# 配置CORS，支持React前端开发服务器
# 前端可能运行在 3000 (Create React App) 或 5173 (Vite) 端口
CORS(app,
     supports_credentials=True,
     origins=[
         'http://localhost:3000',
         'http://127.0.0.1:3000',
         'http://localhost:5173',
         'http://127.0.0.1:5173',
         'http://localhost:5174',
         'http://127.0.0.1:5174',
     ],
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# 从环境变量读取管理员账号（必须通过 .env 配置）
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')

if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    raise RuntimeError("请在 .env 文件中配置 ADMIN_USERNAME 和 ADMIN_PASSWORD")

# 每次请求时刷新 session，确保活跃用户不会被登出
@app.before_request
def refresh_session():
    session.permanent = True
    session.modified = True

# 登录验证装饰器
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return jsonify({"success": False, "error": "未登录"}), 401
        return f(*args, **kwargs)
    return decorated_function

# 允许的图片格式
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 初始化数据库
init_db()

# -------------------------------
# 图片文件服务
# -------------------------------

@app.route('/images/<path:filename>')
def serve_image(filename):
    """提供画师示例图片"""
    return send_from_directory(IMAGES_DIR, filename)

# -------------------------------
# 认证 API
# -------------------------------

@app.route('/api/login', methods=['POST'])
def api_login():
    """登录"""
    try:
        data = request.json
        username = data.get('username', '')
        password = data.get('password', '')

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session.permanent = True  # 设置 session 为永久
            session['logged_in'] = True
            session['username'] = username
            return jsonify({"success": True, "message": "登录成功"})
        else:
            return jsonify({"success": False, "error": "用户名或密码错误"}), 401
    except Exception as e:
        logging.error(f"登录失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def api_logout():
    """登出"""
    session.clear()
    return jsonify({"success": True, "message": "已登出"})

@app.route('/api/check-auth', methods=['GET'])
def api_check_auth():
    """检查登录状态"""
    if session.get('logged_in'):
        return jsonify({"success": True, "logged_in": True, "username": session.get('username')})
    else:
        return jsonify({"success": True, "logged_in": False})

# -------------------------------
# 分类管理 API
# -------------------------------

@app.route('/api/categories', methods=['GET'])
@login_required
def api_get_categories():
    """获取所有分类"""
    try:
        categories = get_all_categories()
        return jsonify({"success": True, "data": categories})
    except Exception as e:
        logging.error(f"获取分类失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/categories', methods=['POST'])
@login_required
def api_create_category():
    """创建新分类"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)

        if not name:
            return jsonify({"success": False, "error": "分类名称不能为空"}), 400

        category_id = create_category(name, display_order)
        return jsonify({"success": True, "data": {"id": category_id, "name": name}})
    except Exception as e:
        logging.error(f"创建分类失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
@login_required
def api_update_category(category_id):
    """更新分类"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        display_order = data.get('display_order', 0)

        if not name:
            return jsonify({"success": False, "error": "分类名称不能为空"}), 400

        success = update_category(category_id, name, display_order)
        if success:
            return jsonify({"success": True, "data": {"id": category_id, "name": name, "display_order": display_order}})
        else:
            return jsonify({"success": False, "error": "分类不存在"}), 404
    except Exception as e:
        logging.error(f"更新分类失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
@login_required
def api_delete_category(category_id):
    """删除分类"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM categories WHERE id = ?", (category_id,))
            if cursor.rowcount > 0:
                return jsonify({"success": True})
            else:
                return jsonify({"success": False, "error": "分类不存在"}), 404
    except Exception as e:
        logging.error(f"删除分类失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------------
# 画师管理 API
# -------------------------------

@app.route('/api/artists', methods=['GET'])
@login_required
def api_get_artists():
    """获取所有画师或按分类获取"""
    try:
        category_id = request.args.get('category_id', type=int)

        if category_id:
            artists = get_artists_by_category(category_id)
        else:
            artists = get_all_artists()

        return jsonify({"success": True, "data": artists})
    except Exception as e:
        logging.error(f"获取画师失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/artists/<int:artist_id>', methods=['GET'])
@login_required
def api_get_artist(artist_id):
    """获取单个画师信息"""
    try:
        artist = get_artist_by_id(artist_id)
        if artist:
            return jsonify({"success": True, "data": artist})
        else:
            return jsonify({"success": False, "error": "画师不存在"}), 404
    except Exception as e:
        logging.error(f"获取画师失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/artists', methods=['POST'])
@login_required
def api_create_artist():
    """创建新画师（支持多分类）"""
    try:
        data = request.json
        category_ids = data.get('category_ids', [])

        # 兼容旧的 category_id 字段
        if not category_ids and data.get('category_id'):
            category_ids = [data.get('category_id')]

        # 验证：必须至少选择一个分类
        if not category_ids:
            return jsonify({"success": False, "error": "必须至少选择一个分类"}), 400

        # 验证：必须至少填写一个名称（NOOB或NAI）
        name_noob = data.get('name_noob', '').strip()
        name_nai = data.get('name_nai', '').strip()

        if not name_noob and not name_nai:
            return jsonify({"success": False, "error": "画师名称（NOOB或NAI格式）至少需要填写一个"}), 400

        danbooru_link = data.get('danbooru_link', '').strip()
        notes = data.get('notes', '').strip()
        image_example = data.get('image_example', '').strip()
        skip_danbooru = data.get('skip_danbooru', False)

        # 自动补全名称
        name_noob, name_nai, danbooru_link = auto_complete_names(name_noob, name_nai, danbooru_link)

        # 检查重复
        existing_artist = check_artist_exists(name_noob, name_nai, danbooru_link)
        if existing_artist:
            exist_name = existing_artist.get('name_noob') or existing_artist.get('name_nai') or '未知'
            return jsonify({
                "success": False,
                "error": f"画师已存在: {exist_name} (ID: {existing_artist['id']})",
                "data": existing_artist
            }), 409

        artist_id = create_artist(
            category_ids=category_ids,
            name_noob=name_noob,
            name_nai=name_nai,
            danbooru_link=danbooru_link,
            notes=notes,
            image_example=image_example,
            skip_danbooru=skip_danbooru
        )

        artist = get_artist_by_id(artist_id)
        return jsonify({"success": True, "data": artist})
    except Exception as e:
        logging.error(f"创建画师失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/artists/<int:artist_id>', methods=['PUT'])
@login_required
def api_update_artist(artist_id):
    """更新画师信息（支持多分类）"""
    try:
        data = request.json

        # 如果需要自动补全
        if data.get('auto_complete', False):
            artist = get_artist_by_id(artist_id)
            if artist:
                name_noob = data.get('name_noob', artist.get('name_noob', ''))
                name_nai = data.get('name_nai', artist.get('name_nai', ''))
                danbooru_link = data.get('danbooru_link', artist.get('danbooru_link', ''))

                name_noob, name_nai, danbooru_link = auto_complete_names(name_noob, name_nai, danbooru_link)

                data['name_noob'] = name_noob
                data['name_nai'] = name_nai
                data['danbooru_link'] = danbooru_link

        # 移除不需要的字段
        data.pop('auto_complete', None)

        # 处理分类更新
        category_ids = data.get('category_ids', None)
        if category_ids is not None:
            data['category_ids'] = category_ids

        # 兼容旧的 category_id 字段
        if 'category_id' in data and category_ids is None:
            data['category_ids'] = [data['category_id']]
            data.pop('category_id')

        success = update_artist(artist_id, **data)

        if success:
            artist = get_artist_by_id(artist_id)
            return jsonify({"success": True, "data": artist})
        else:
            return jsonify({"success": False, "error": "更新失败"}), 400
    except Exception as e:
        logging.error(f"更新画师失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/artists/<int:artist_id>', methods=['DELETE'])
@login_required
def api_delete_artist(artist_id):
    """删除画师"""
    try:
        # 删除对应的图片文件
        artist = get_artist_by_id(artist_id)
        if artist and artist.get('image_example'):
            image_path = IMAGES_DIR / artist['image_example']
            if image_path.exists():
                image_path.unlink()
                logging.info(f"删除图片文件: {artist['image_example']}")

        success = delete_artist(artist_id)
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "画师不存在"}), 404
    except Exception as e:
        logging.error(f"删除画师失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/artists/<int:artist_id>/upload-image', methods=['POST'])
@login_required
def api_upload_artist_image(artist_id):
    """上传画师示例图片"""
    try:
        # 检查画师是否存在
        artist = get_artist_by_id(artist_id)
        if not artist:
            return jsonify({"success": False, "error": "画师不存在"}), 404

        # 检查文件
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "未上传文件"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "未选择文件"}), 400

        if not allowed_file(file.filename):
            return jsonify({"success": False, "error": "不支持的文件格式"}), 400

        # 删除旧图片
        if artist.get('image_example'):
            old_image_path = IMAGES_DIR / artist['image_example']
            if old_image_path.exists():
                old_image_path.unlink()
                logging.info(f"删除旧图片: {artist['image_example']}")

        # 优先使用UUID作为文件名，统一保存为 .jpg
        artist_identifier = artist.get('uuid') or str(artist_id)
        filename = f"{artist_identifier}.jpg"
        filepath = IMAGES_DIR / filename

        # 使用 Pillow 处理图片
        try:
            # 读取上传的文件内容
            file_content = file.read()
            with Image.open(BytesIO(file_content)) as img:
                # 转换为 RGB 模式
                if img.mode in ('RGBA', 'P', 'LA'):
                    img = img.convert('RGB')
                
                # 保存为 JPEG，质量 80%
                img.save(filepath, 'JPEG', quality=80, optimize=True)
                logging.info(f"上传并转换图片: {filename}")
        except Exception as e:
            logging.error(f"图片处理失败: {e}")
            return jsonify({"success": False, "error": "无效的图片文件"}), 400

        # 更新数据库
        update_artist(artist_id, image_example=filename)

        return jsonify({
            "success": True,
            "data": {
                "filename": filename,
                "url": f"/images/{filename}"
            }
        })

    except Exception as e:
        logging.error(f"上传图片失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------
# 工具 API
# -------------------------------

@app.route('/api/tools/auto-complete', methods=['POST'])
@login_required
def api_auto_complete():
    """自动补全画师名称"""
    try:
        data = request.json
        name_noob = data.get('name_noob', '')
        name_nai = data.get('name_nai', '')
        danbooru_link = data.get('danbooru_link', '')

        name_noob, name_nai, danbooru_link = auto_complete_names(name_noob, name_nai, danbooru_link)

        return jsonify({
            "success": True,
            "data": {
                "name_noob": name_noob,
                "name_nai": name_nai,
                "danbooru_link": danbooru_link
            }
        })
    except Exception as e:
        logging.error(f"自动补全失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/tools/auto-complete-all', methods=['POST'])
@login_required
def api_auto_complete_all():
    """一键补全所有画师数据（名称、链接、作品数、示例图）"""
    try:
        artists = get_all_artists()
        updated_count = 0
        details = []
        
        # 1. 补全名称和链接
        for artist in artists:
            artist_id = artist['id']
            name_noob = artist.get('name_noob', '')
            name_nai = artist.get('name_nai', '')
            danbooru_link = artist.get('danbooru_link', '')

            new_noob, new_nai, new_link = auto_complete_names(name_noob, name_nai, danbooru_link)

            # 检查是否有变更
            if (new_noob != name_noob or
                new_nai != name_nai or
                new_link != danbooru_link):
                
                update_artist(
                    artist_id,
                    name_noob=new_noob,
                    name_nai=new_nai,
                    danbooru_link=new_link
                )
                updated_count += 1
                details.append({
                    "id": artist_id,
                    "name_noob": new_noob,
                    "name_nai": new_nai,
                    "danbooru_link": new_link,
                    "type": "basic_info"
                })
                # 更新内存中的对象，以便后续步骤使用最新链接
                artist['name_noob'] = new_noob
                artist['name_nai'] = new_nai
                artist['danbooru_link'] = new_link

        # 2. 筛选需要获取作品数据的画师
        # 条件：有链接 且 未跳过 且 (作品数为空 或 没有示例图)
        artists_to_fetch = []
        for artist in artists:
            if artist.get('skip_danbooru'):
                continue
                
            link = artist.get('danbooru_link')
            if not link:
                continue
                
            needs_fetch = False
            # 检查作品数
            if artist.get('post_count') is None or artist.get('post_count') == 0:
                needs_fetch = True
            
            # 检查示例图
            if not artist.get('image_example'):
                needs_fetch = True
            else:
                # 检查图片文件是否真的存在
                image_path = IMAGES_DIR / artist['image_example']
                if not image_path.exists():
                    needs_fetch = True
            
            if needs_fetch:
                name = artist.get('name_noob') or artist.get('name_nai') or 'Unknown'
                artists_to_fetch.append({
                    'id': artist['id'],
                    'uuid': artist.get('uuid'),
                    'danbooru_link': link,
                    'name': name
                })

        # 3. 批量获取作品数据
        fetched_count = 0
        if artists_to_fetch:
            logging.info(f"开始为 {len(artists_to_fetch)} 个画师获取作品数据...")
            results = fetch_post_counts_batch(artists_to_fetch)
            
            for artist_id, result in results.items():
                update_data = {}
                if result.get('post_count') is not None:
                    update_data['post_count'] = result['post_count']
                if result.get('example_image'):
                    update_data['image_example'] = result['example_image']
                
                if update_data:
                    update_artist(artist_id, **update_data)
                    fetched_count += 1
                    details.append({
                        "id": artist_id,
                        "type": "fetch_data",
                        "data": update_data
                    })

        total_updated = updated_count + fetched_count
        message = f"已自动补全 {updated_count} 个画师的基本信息"
        if fetched_count > 0:
            message += f"，并成功获取了 {fetched_count} 个画师的作品数据"
        elif len(artists_to_fetch) > 0:
            message += f"，尝试获取 {len(artists_to_fetch)} 个画师的作品数据但未成功"

        return jsonify({
            "success": True,
            "data": {
                "updated_count": total_updated,
                "details": details
            },
            "message": message
        })
    except Exception as e:
        logging.error(f"一键补全失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/tools/fetch-post-counts', methods=['POST'])
@login_required
def api_fetch_post_counts():
    """批量获取作品数量和示例图"""
    try:
        data = request.json
        artist_ids = data.get('artist_ids', [])

        if not artist_ids:
            return jsonify({"success": False, "error": "未指定画师ID"}), 400

        # 获取画师信息
        artists = []
        artist_id_to_name = {}
        for artist_id in artist_ids:
            artist = get_artist_by_id(artist_id)
            if artist:
                name = artist.get('name_noob') or artist.get('name_nai') or 'Unknown'
                artist_id_to_name[artist_id] = name
                artists.append({
                    'id': artist['id'],
                    'uuid': artist.get('uuid'),
                    'danbooru_link': artist.get('danbooru_link', ''),
                    'name': name
                })

        # 批量获取作品数量和示例图
        results = fetch_post_counts_batch(artists)

        # 更新数据库并统计结果
        updated_count = 0
        failed_artists = []
        warnings = []

        for artist_id in artist_ids:
            if artist_id in results:
                result = results[artist_id]
                update_data = {}

                if result.get('post_count') is not None:
                    update_data['post_count'] = result['post_count']
                if result.get('example_image'):
                    update_data['image_example'] = result['example_image']

                if update_data:
                    update_artist(artist_id, **update_data)
                    updated_count += 1

                    # 检查是否有警告（获取了作品数但没有图片）
                    if result.get('post_count') is not None and not result.get('example_image'):
                        artist_name = artist_id_to_name.get(artist_id, f"ID:{artist_id}")
                        warnings.append(f"{artist_name}: 获取到作品数量但未能下载示例图片")
            else:
                # 完全失败的画师
                artist_name = artist_id_to_name.get(artist_id, f"ID:{artist_id}")
                failed_artists.append(artist_name)

        # 构建响应消息
        messages = []
        if updated_count > 0:
            messages.append(f"成功获取 {updated_count} 个画师的数据")
        if warnings:
            messages.append(f"警告: {len(warnings)} 个画师未能下载图片")
        if failed_artists:
            messages.append(f"失败: {len(failed_artists)} 个画师未能获取数据")

        return jsonify({
            "success": True,
            "data": results,
            "message": "; ".join(messages),
            "details": {
                "total": len(artist_ids),
                "success": updated_count,
                "warnings": warnings,
                "failed": failed_artists
            }
        })
    except Exception as e:
        logging.error(f"获取作品数量失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/tools/find-duplicates', methods=['GET'])
@login_required
def api_find_duplicates():
    """查找重复画师"""
    try:
        duplicates = find_duplicate_artists()
        return jsonify({"success": True, "data": duplicates})
    except Exception as e:
        logging.error(f"查找重复失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/tools/validate-images', methods=['POST'])
@login_required
def api_validate_images():
    """检查缺失示例图的画师"""
    try:
        # 获取所有画师
        all_artists = get_all_artists()

        # 查找缺失图片的画师
        missing_image_ids = get_artists_without_images(all_artists)

        return jsonify({
            "success": True,
            "data": missing_image_ids,
            "message": f"检测完成,发现 {len(missing_image_ids)} 个画师缺失示例图"
        })
    except Exception as e:
        logging.error(f"检查示例图失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------
# 导入导出 API
# -------------------------------

@app.route('/api/export/json', methods=['GET'])
@login_required
def api_export_json():
    """导出为JSON"""
    try:
        categories = get_all_categories()
        artists = get_all_artists()

        data = {
            "categories": categories,
            "artists": artists
        }

        return jsonify({"success": True, "data": data})
    except Exception as e:
        logging.error(f"导出JSON失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/export/excel', methods=['GET'])
@login_required
def api_export_excel():
    """导出为Excel"""
    try:
        artists = get_all_artists()

        # 转换为DataFrame
        df_data = []
        for artist in artists:
            df_data.append({
                '分类': artist.get('category_name', ''),
                '画师名称-NOOB': artist.get('name_noob', ''),
                '画师名称-NAI': artist.get('name_nai', ''),
                'Danbooru链接': artist.get('danbooru_link', ''),
                '统计': artist.get('post_count', ''),
                '备注': artist.get('notes', ''),
                '图例': artist.get('image_example', '')
            })

        df = pd.DataFrame(df_data)

        # 保存为Excel
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='画师分类', index=False)

        output.seek(0)

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='画师整理.xlsx'
        )
    except Exception as e:
        logging.error(f"导出Excel失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/import/json', methods=['POST'])
@login_required
def api_import_json():
    """导入JSON数据（支持多分类）"""
    try:
        data = request.json

        categories_data = data.get('categories', [])
        artists_data = data.get('artists', [])

        # 导入分类
        category_map = {}  # 旧ID -> 新ID
        for cat in categories_data:
            old_id = cat.get('id')
            new_id = create_category(cat['name'], cat.get('display_order', 0))
            category_map[old_id] = new_id

        # 导入画师
        for artist in artists_data:
            # 处理多分类
            category_ids = []

            # 新格式：categories 字段
            if 'categories' in artist:
                for cat in artist['categories']:
                    old_cat_id = cat.get('id')
                    if old_cat_id in category_map:
                        category_ids.append(category_map[old_cat_id])

            # 旧格式：category_id 字段
            elif 'category_id' in artist:
                old_category_id = artist.get('category_id')
                new_category_id = category_map.get(old_category_id)
                if new_category_id:
                    category_ids = [new_category_id]

            # 如果没有分类，使用"未分类"
            if not category_ids:
                uncategorized = next((c for c in get_all_categories() if c['name'] == '未分类'), None)
                if uncategorized:
                    category_ids = [uncategorized['id']]

            if category_ids:
                create_artist(
                    category_ids=category_ids,
                    name_noob=artist.get('name_noob', ''),
                    name_nai=artist.get('name_nai', ''),
                    danbooru_link=artist.get('danbooru_link', ''),
                    post_count=artist.get('post_count'),
                    notes=artist.get('notes', ''),
                    image_example=artist.get('image_example', '')
                )

        return jsonify({
            "success": True,
            "message": f"成功导入 {len(categories_data)} 个分类和 {len(artists_data)} 个画师"
        })
    except Exception as e:
        logging.error(f"导入JSON失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/import/excel', methods=['POST'])
@login_required
def api_import_excel():
    """导入Excel文件（支持多分类，用逗号分隔）"""
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "未上传文件"}), 400

        file = request.files['file']
        df = pd.read_excel(file, sheet_name="画师分类")

        # 处理分类
        df['分类'] = df['分类'].ffill()

        category_map = {}
        imported_count = 0

        for _, row in df.iterrows():
            category_names = str(row.get('分类', '未分类')).strip()

            # 支持多分类（用逗号、分号或顿号分隔）
            category_list = [c.strip() for c in category_names.replace('；', ',').replace('、', ',').split(',') if c.strip()]

            if not category_list:
                category_list = ['未分类']

            # 创建或获取分类ID
            category_ids = []
            for category_name in category_list:
                if category_name not in category_map:
                    categories = get_all_categories()
                    existing = next((c for c in categories if c['name'] == category_name), None)
                    if existing:
                        category_map[category_name] = existing['id']
                    else:
                        category_id = create_category(category_name)
                        category_map[category_name] = category_id

                category_ids.append(category_map[category_name])

            # 创建画师
            create_artist(
                category_ids=category_ids,
                name_noob=str(row.get('画师名称-NOOB', '')),
                name_nai=str(row.get('画师名称-NAI', '')),
                danbooru_link=str(row.get('Danbooru链接', '')),
                post_count=int(row['统计']) if pd.notna(row.get('统计')) else None,
                notes=str(row.get('备注', '')),
                image_example=str(row.get('图例', ''))
            )
            imported_count += 1

        return jsonify({
            "success": True,
            "message": f"成功导入 {imported_count} 个画师"
        })
    except Exception as e:
        logging.error(f"导入Excel失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------------
# 画师串(预设)管理 API
# -------------------------------

@app.route('/api/presets', methods=['GET'])
@login_required
def api_get_presets():
    """获取所有画师串"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM artist_presets ORDER BY updated_at DESC")
            presets = [dict(row) for row in cursor.fetchall()]
            return jsonify({"success": True, "data": presets})
    except Exception as e:
        logging.error(f"获取画师串失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/presets', methods=['POST'])
@login_required
def api_create_preset():
    """创建画师串"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        artist_ids = data.get('artist_ids', [])

        if not name or not artist_ids:
            return jsonify({"success": False, "error": "名称和画师列表不能为空"}), 400

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO artist_presets (name, description, artist_ids)
                VALUES (?, ?, ?)
            """, (name, description, json.dumps(artist_ids)))

            preset_id = cursor.lastrowid

        return jsonify({"success": True, "data": {"id": preset_id}})
    except Exception as e:
        logging.error(f"创建画师串失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/presets/<int:preset_id>', methods=['DELETE'])
@login_required
def api_delete_preset(preset_id):
    """删除画师串"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM artist_presets WHERE id = ?", (preset_id,))
            if cursor.rowcount > 0:
                return jsonify({"success": True})
            else:
                return jsonify({"success": False, "error": "画师串不存在"}), 404
    except Exception as e:
        logging.error(f"删除画师串失败: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------------
# 健康检查
# -------------------------------

@app.route('/api/health', methods=['GET'])
def api_health():
    """健康检查接口"""
    return jsonify({"success": True, "message": "API is running"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
