# AI 画师整理工具 WebUI 版本

一个功能强大、界面友好的 AI 绘图画师标签整理工具。支持画师标签自动补全、分类管理、作品数量获取、去重等功能。

## 功能特性

### 核心功能

1. **画师标签自动补全**
   - NOOB 格式 ↔ NAI 格式互相转换
   - 从 Danbooru 链接反推画师名称
   - 自动生成 Danbooru 链接
   - 智能括号转义处理

2. **分类管理**
   - 创建自定义分类
   - 分类排序
   - 按分类筛选画师

3. **作品数量获取**
   - 使用 Playwright 自动爬取 Danbooru 作品数
   - 支持批量获取
   - 智能重试机制

4. **去重功能**
   - 自动检测重复画师
   - 支持跨分类去重
   - 智能合并提示

5. **画师串管理**
   - 保存常用的画师组合
   - 快速复用画师串
   - 支持备注说明

6. **导入导出**
   - 导出为 JSON 格式
   - 导出为 Excel 格式
   - 从 Excel 导入
   - 从 JSON 导入
   - 兼容原 Python 脚本的 Excel 格式

### 附加功能

- 为画师添加备注
- 添加示例图片
- 现代化响应式界面
- 数据持久化存储 (SQLite)

## 技术栈

### 后端
- **Flask**: Web 框架
- **SQLite**: 数据库
- **Playwright**: 网页爬虫
- **Pandas**: Excel 处理
- **OpenPyXL**: Excel 读写

### 前端
- **纯 HTML/CSS/JavaScript**: 无需构建工具
- **现代化 UI**: 渐变色、卡片式设计、响应式布局
- **Fetch API**: RESTful API 调用

## 安装

### 1. 安装 Python 依赖

```bash
pip install flask flask-cors pandas openpyxl playwright
```

### 2. 安装 Playwright 浏览器

```bash
playwright install chromium
```

### 3. 初始化数据库

```bash
python database.py
```

## 使用方法

### 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 访问 WebUI

在浏览器中打开: `http://localhost:5000`

### 主要操作流程

#### 1. 创建分类

1. 点击"分类管理"标签页
2. 点击"添加分类"按钮
3. 输入分类名称和显示顺序
4. 保存

#### 2. 添加画师

1. 点击"画师管理"标签页
2. 点击"添加画师"按钮
3. 选择分类
4. 输入画师信息 (至少填写一项):
   - NOOB 格式名称
   - NAI 格式名称
   - Danbooru 链接
5. 点击"自动补全"按钮,系统会自动补全其他字段
6. 保存

#### 3. 批量获取作品数

1. 在画师管理页面
2. 点击"批量获取作品数"按钮
3. 系统会自动爬取所有未获取作品数的画师
4. 等待处理完成

#### 4. 查找重复

1. 点击"工具"标签页
2. 点击"查找重复画师"按钮
3. 查看重复结果

#### 5. 创建画师串

1. 点击"画师串"标签页
2. 点击"创建画师串"按钮
3. 输入名称和描述
4. 按住 Ctrl 多选画师
5. 保存

#### 6. 导入现有 Excel 数据

1. 点击"导入/导出"标签页
2. 选择 Excel 文件 (兼容原 Python 脚本格式)
3. 点击"导入 Excel"按钮
4. 等待导入完成

#### 7. 导出数据

- **导出 JSON**: 点击"导出为 JSON"按钮
- **导出 Excel**: 点击"导出为 Excel"按钮

## 项目结构

```
画师整理/
├── app.py              # Flask 后端主程序
├── database.py         # 数据库模型和操作
├── utils.py            # 工具函数 (名称处理、爬虫等)
├── artists.db          # SQLite 数据库文件 (自动生成)
├── run.py              # 原 Python 脚本 (兼容保留)
├── static/
│   ├── index.html      # 前端主页面
│   ├── style.css       # 样式文件
│   └── app.js          # 前端逻辑
└── README.md           # 使用说明
```

## API 文档

### 画师相关

- `GET /api/artists` - 获取所有画师
- `GET /api/artists?category_id=1` - 按分类获取画师
- `GET /api/artists/:id` - 获取单个画师
- `POST /api/artists` - 创建画师
- `PUT /api/artists/:id` - 更新画师
- `DELETE /api/artists/:id` - 删除画师

### 分类相关

- `GET /api/categories` - 获取所有分类
- `POST /api/categories` - 创建分类
- `DELETE /api/categories/:id` - 删除分类

### 工具相关

- `POST /api/tools/auto-complete` - 自动补全名称
- `POST /api/tools/fetch-post-counts` - 批量获取作品数
- `GET /api/tools/find-duplicates` - 查找重复

### 导入导出

- `GET /api/export/json` - 导出 JSON
- `GET /api/export/excel` - 导出 Excel
- `POST /api/import/json` - 导入 JSON
- `POST /api/import/excel` - 导入 Excel

### 画师串相关

- `GET /api/presets` - 获取所有画师串
- `POST /api/presets` - 创建画师串
- `DELETE /api/presets/:id` - 删除画师串

## 名称格式说明

### NOOB 格式
- 空格保留
- 括号需要转义: `artist \(circle\)`
- 不需要前缀

### NAI 格式
- 空格保留
- 括号不转义: `artist (circle)`
- 需要 `artist:` 前缀: `artist:artist (circle)`

### Danbooru 链接
- 格式: `https://danbooru.donmai.us/posts?tags=artist_name`
- 空格替换为下划线
- 括号不转义

## 数据库结构

### categories 表
- `id`: 主键
- `name`: 分类名称
- `display_order`: 显示顺序
- `created_at`: 创建时间

### artists 表
- `id`: 主键
- `category_id`: 分类 ID (外键)
- `name_noob`: NOOB 格式名称
- `name_nai`: NAI 格式名称
- `danbooru_link`: Danbooru 链接
- `post_count`: 作品数量
- `notes`: 备注
- `image_example`: 示例图片链接
- `created_at`: 创建时间
- `updated_at`: 更新时间

### artist_presets 表
- `id`: 主键
- `name`: 画师串名称
- `description`: 描述
- `artist_ids`: 画师 ID 列表 (JSON 格式)
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 与原 Python 脚本的区别

### 优势

1. **更直观的界面**: Web UI 比 Excel 更易用
2. **实时操作**: 无需等待整个处理流程完成
3. **数据持久化**: SQLite 数据库,性能更好
4. **功能扩展**: 画师串、备注、图例等新功能
5. **跨平台**: 浏览器访问,不依赖 Excel

### 兼容性

- 完全兼容原 Excel 格式
- 可以导入原脚本生成的 Excel 文件
- 导出的 Excel 文件与原格式一致

## 常见问题

### Q: 作品数量获取失败?
A: 检查网络连接,Danbooru 可能需要代理访问。可以在 `utils.py` 中配置代理。

### Q: 如何批量导入现有数据?
A: 使用"导入/导出"功能,支持导入原 Python 脚本生成的 Excel 文件。

### Q: 数据存储在哪里?
A: 所有数据存储在 `artists.db` SQLite 数据库文件中。

### Q: 如何备份数据?
A:
1. 复制 `artists.db` 文件
2. 或使用"导出 JSON"功能导出所有数据

### Q: 可以同时运行原脚本和 WebUI 吗?
A: 不建议。它们使用不同的数据存储方式 (Excel vs SQLite)。建议完全迁移到 WebUI。

## 开发计划

- [ ] 支持图片上传到本地
- [ ] 批量编辑功能
- [ ] 画师标签搜索
- [ ] 统计图表展示
- [ ] 用户认证系统
- [ ] Docker 部署支持

## 许可证

本项目基于原 Python 脚本改造,保持相同用途。

## 联系方式

如有问题或建议,请提交 Issue。
