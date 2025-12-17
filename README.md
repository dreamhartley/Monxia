# 梦匣 (Monxia)

**AI 绘图画师 Tag 管理工具**

梦匣（Monxia）是一个专为 AI 绘图爱好者设计的本地 Tag 管理工具。它可以帮助你高效地整理、查询和组合画师 Tag（Prompt），支持 NovelAI 和 Stable Diffusion 等常见格式。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)

## ✨ 功能特性

- **🎨 画师库管理**
  - 集中管理画师信息，支持 NOOB/NAI 两种格式的 Tag。
  - 支持多分类标签，灵活整理画师资源。
  - 记录画师的 Danbooru 链接和备注信息。

- **🏷️ 智能补全与抓取**
  - **自动补全**: 输入画师名称，自动补全对应的 Tag 格式和 Danbooru 链接。
  - **数据抓取**: 集成 Playwright 爬虫，一键获取画师的作品数量和最新预览图。

- **📦 分类与预设**
  - **分类管理**: 自定义分类体系，井井有条地组织成百上千的画师。
  - **画师串 (Presets)**: 将多个常用画师组合成“画师串”，方便在绘图软件中一键调用。

- **🔒 安全与隐私**
  - 本地部署，数据完全掌握在自己手中。
  - 内置登录认证系统，保护你的私有库。

## 🛠️ 技术栈

- **后端**: Python (Flask), SQLite, Playwright (用于数据抓取)
- **前端**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui

## 🚀 快速开始

### 前提条件

- [Python 3.10+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)

### 1. 后端设置

进入 `backend` 目录并安装 Python 依赖：

```bash
cd backend

# 推荐使用虚拟环境
# python -m venv venv
# source venv/bin/activate  # Linux/Mac
# .\venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器内核 (用于抓取预览图)
playwright install chromium
```

启动后端服务：

```bash
python run.py
```
后端服务将运行在 `http://localhost:5000`。

### 2. 前端设置

进入 `frontend` 目录并安装 Node 依赖：

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
前端页面将运行在 `http://localhost:5173` (具体端口视终端输出而定)。

### 3. 开始使用

1. 打开浏览器访问前端地址（如 `http://localhost:5173`）。
2. 使用默认管理员账号登录：
   - **用户名**: `admin`
   - **密码**: `admin123`
3. **重要**: 首次登录后，请务必在设置页面修改默认密码。

## 📂 数据存储

所有数据均存储在本地 SQLite 数据库中，文件位于 `backend/` 目录下：
- `artists.db`: 存储画师、分类和预设数据。
- `config.db`: 存储管理员账号和系统配置。
- `artist_images/`: 存储下载的画师预览图。

建议定期备份这些文件。

## 📝 开发计划

- [x] 画师/分类/预设 基础 CRUD
- [x] 自动补全与 Danbooru 数据抓取
- [x] 用户认证系统
- [ ] 批量导入/导出功能优化
- [ ] 更多绘图网站的数据源支持
- [ ] 一键构建与部署脚本

## 📄 许可证

MIT License
