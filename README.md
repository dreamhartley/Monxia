<p align="center">
  <img src="https://files.catbox.moe/yl61f2.jpg" alt="Monxia Banner" width="800">
</p>

# 梦匣 (Monxia)

**画师 Tag 管理工具**

梦匣（Monxia）是一个专为 AI 绘图爱好者设计的画师 Tag 管理工具。它可以帮助你高效地整理、查询和组合画师 Tag（Prompt），支持 NovelAI 和 NoobAI 等常见格式。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

<p align="center">
  <img src="https://files.catbox.moe/e2bs05.jpg" alt="Monxia Screenshot" width="800">
</p>

## ✨ 功能特性

- **🎨 画师库管理**
  - 集中管理画师信息，支持 NOOB/NAI 两种格式的 Tag。
  - 支持多分类标签，灵活整理画师资源。
  - 记录画师的 Danbooru 链接和备注信息。

- **🏷️ 智能补全与抓取**
  - **自动补全**: 输入画师名称，自动补全对应的 Tag 格式和 Danbooru 链接。
  - **数据抓取**: 通过 Danbooru API 一键获取画师的作品数量和最新预览图，支持配置 API Key 认证。

- **📦 分类与预设**
  - **分类管理**: 自定义分类体系，井井有条地组织成百上千的画师。
  - **画师串 (Presets)**: 将多个常用画师组合成"画师串"，方便在绘图软件中一键调用。

- **🔒 安全与隐私**
  - 本地部署，数据完全掌握在自己手中。
  - 内置登录认证系统，保护你的私有库。

## 🛠️ 技术栈

- **后端**: Python (Flask), SQLite, Playwright (Chromium)
- **前端**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui

## 🚀 快速开始

> **推荐**：本地用户可直接下载 [Release](https://github.com/dreamhartley/Monxia/releases) 中的免构建版本，解压后运行 `start.bat`或`start.sh` 即可。

### 默认账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| `admin` | `admin123` | 首次登录后请及时修改密码 |

### 方式一：Docker 部署（推荐）

使用 Docker 一键部署，无需手动配置环境。

```bash
# 构建镜像
docker build -t monxia .

# 运行容器（数据持久化到 ./data 目录）
docker run -d -p 5000:5000 \
  -v ./data:/app/data \
  --name monxia \
  monxia
```

访问 `http://localhost:5000` 即可使用。

### 方式二：一键启动脚本

#### Windows

双击运行项目根目录下的 `start.bat`。

#### Linux / macOS

```bash
chmod +x start.sh  # 首次运行需要添加执行权限
./start.sh
```

脚本会自动：

1. 检查 Python 和 Node.js 环境
2. 安装前端依赖并构建静态文件（输出到 `backend/dist`）
3. 创建 Python 虚拟环境（首次运行）
4. 安装 Python 依赖（首次运行）
5. 启动服务

> 如需更新依赖，删除 `backend/venv` 目录后重新运行脚本即可。

### 方式三：手动部署

#### 前提条件

- [Python 3.10+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)

#### 1. 后端设置

进入 `backend` 目录并安装 Python 依赖：

```bash
cd backend

# 推荐使用虚拟环境
# python -m venv venv
# source venv/bin/activate  # Linux/Mac
# .\venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright Chromium（抓取 Danbooru 必需）
python -m playwright install chromium
```

> Linux 下若浏览器启动报缺少系统库，请执行 `sudo python -m playwright install-deps chromium`。

#### 2. 前端构建

进入 `frontend` 目录并构建前端（构建产物将直接输出到 `backend/dist`）：

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本（输出到 backend/dist）
npm run build
```

#### 3. 启动服务

```bash
cd backend
python run.py
```

服务将运行在 `http://localhost:5000`，同时提供后端 API 和前端页面。

#### 开发模式

如需前端热重载开发：

```bash
# 终端1：启动后端
cd backend
python run.py

# 终端2：启动前端开发服务器
cd frontend
npm run dev
```

前端开发服务器运行在 `http://localhost:5173`。

### 3. 开始使用

1. 打开浏览器访问 `http://localhost:5000`（或开发模式下的 `http://localhost:5173`）。
2. 使用默认管理员账号登录：
   - **用户名**: `admin`
   - **密码**: `admin123`
3. **重要**: 首次登录后，请务必在设置页面修改默认密码。

## 📂 数据存储

所有数据存储在本地，支持通过 `DATA_DIR` 环境变量自定义数据目录。

**默认目录结构**（手动部署时在 `backend/` 下）：

```
backend/
├── dist/             # 前端构建产物
├── artists.db        # 画师、分类和预设数据
├── config.db         # 管理员账号和系统配置
├── artist_images/    # 画师预览图
└── backgrounds/      # 登录背景图
```

**Docker 部署时**（映射到 `./data/`）：

```
data/
├── artists.db
├── config.db
├── artist_images/
└── backgrounds/
```

建议定期备份数据目录。

## 🐳 Docker 相关

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATA_DIR` | 数据存储目录 | `/app/data`（容器内） |
| `FLASK_ENV` | Flask 运行模式 | `production` |

## 📄 许可证

MIT License
