<p align="center">
  <img src="https://files.catbox.moe/yl61f2.jpg" alt="Monxia Banner" width="800">
</p>

# 梦匣 (Monxia)

**画师 Tag 管理工具**

梦匣（Monxia）是一个专为 AI 绘图爱好者设计的画师 Tag 管理工具。它可以帮助你高效地整理、查询和组合画师 Tag（Prompt），支持 NovelAI 和 NoobAI 等常见格式。作品数据支持从 **Danbooru** 或 **Gelbooru** 抓取，可在设置中随时切换。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

<p align="center">
  <img src="https://files.catbox.moe/e2bs05.jpg" alt="Monxia Screenshot" width="800">
</p>

## ✨ 功能特性

- **🎨 画师库管理**
  - 集中管理画师信息，同时保存 NOOB/NAI 两种格式的 Tag 与 Danbooru / Gelbooru 两个站点链接。
  - 支持多分类标签、收藏、搜索、排序（作品数 / 添加时间）与网格 / 列表视图。
  - 单个或批量添加画师，支持手动上传封面、记录备注。
  - 卡片菜单可一键复制 NOOB/NAI 格式、加入画师串草稿，或直接打开该画师的 Danbooru / Gelbooru 页面。

- **🏷️ 智能补全与数据抓取**
  - **双向链接补全**: 输入画师名称即可补全 Tag 格式与两个站点的链接；已有链接会自动换算成另一站点的链接。
  - **数据抓取**: 一键获取画师的作品数量与随机预览图，支持在编辑弹窗中重新抓取单个画师，或对全库执行「一键自动补全」。
  - **双数据源**: 可自由切换 Danbooru / Gelbooru 作为抓取来源，切换即时生效、不会自动重新抓取已有数据。
  - **凭据可配置**: Danbooru 支持可选 API Key（提高配额），Gelbooru 需填写 User ID + API Key，设置页提供「测试连接」。

- **📦 分类与预设**
  - **分类管理**: 自定义分类体系，井井有条地组织成百上千的画师。
  - **画师串 (Presets)**: 将多个常用画师组合成"画师串"，方便在绘图软件中一键调用。

- **🔒 安全与备份**
  - 本地部署，数据完全掌握在自己手中；内置登录认证系统，保护你的私有库。
  - 支持 JSON 全量导出 / 导入，方便备份与迁移。
  - 可自定义登录页背景图。

## 🌐 数据来源（Danbooru / Gelbooru）

进入「设置 → 数据来源」即可选择抓取作品数据时使用的站点：

| 站点 | 凭据要求 | 说明 |
|------|----------|------|
| Danbooru | 可选 | 匿名即可抓取，配置 API Key 后配额更高，速度更稳定。 |
| Gelbooru | **必填** | 需要 User ID 与 API Key，未配置时抓取会提示错误。 |

**Gelbooru 凭据获取**：登录 Gelbooru → `Account → Options → API Access Credentials`，复制其中的 `User ID` 与 `API Key`，填入设置页并点击「保存配置」；可点「测试连接」确认可用。

几点说明：

- 切换数据来源**不会**改动已保存的作品数与封面，只会影响之后发起的抓取。
- 抓取时会自动把当前站点的链接换算成另一站点的链接（例如用 Gelbooru 抓取时补全 Danbooru 链接）；已有的非空链接不会被覆盖。
- 两家站点的画师标签未必完全一致（如 `xxx_(artist)` 之类的消歧后缀），如发现链接对应不上，可在画师编辑弹窗中手动修改 Danbooru / Gelbooru 链接。
- 勾选「跳过自动抓取（作品数与封面）」的画师不会参与任何站点的抓取。

## 🛠️ 技术栈

- **后端**: Python (Flask), SQLite, httpx（Gelbooru API）, Playwright (Chromium，用于通过 Cloudflare 抓取 Danbooru)
- **前端**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui

## 🧩 项目结构

```
Monxia/
├── backend/
│   ├── app.py              # Flask 应用：API 路由、登录认证、静态文件托管
│   ├── run.py              # 启动入口（开发模式）
│   ├── database.py         # 业务数据库（artists.db）：画师 / 分类 / 画师串
│   ├── config_db.py        # 配置数据库（config.db）：账号、数据来源、API 凭据
│   ├── utils.py            # 名称格式化、补全与抓取管线编排
│   ├── booru_links.py      # 画师标签 / 双站点链接生成与互转
│   ├── booru_base.py       # 抓取客户端基类（统一帖子结构、图片压缩存盘）
│   ├── booru_factory.py    # 按数据来源创建 Danbooru / Gelbooru 客户端
│   ├── danbooru_client.py  # Danbooru 客户端（Playwright 过 Cloudflare）
│   └── gelbooru_client.py  # Gelbooru 客户端（httpx + API 凭据）
└── frontend/
    ├── src/pages/          # 画师管理 / 分类 / 画师串 / 工具 / 设置 / 登录
    ├── src/components/     # 布局与 shadcn/ui 组件
    └── src/lib/            # API 封装、画师链接工具
```

## 🚀 快速开始

> **推荐**：本地用户可直接下载 [Release](https://github.com/dreamhartley/Monxia/releases) 中的免构建版本，解压后运行 `start.bat`或`start.sh` 即可。

### 默认账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| `admin` | `admin123` | 首次登录后请及时修改密码 |

### 方式一：Docker 部署（推荐）

使用 Docker 一键部署，无需手动配置环境。仓库已提供 `docker-compose.yml`：

```bash
# 构建并后台启动（数据持久化到 ./data）
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止（数据保留在 ./data）
docker compose down
```

也可以直接用 Docker 命令：

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

# 安装 Playwright Chromium（使用 Danbooru 数据源时必需；Gelbooru 走普通 HTTP，无需浏览器）
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

## 🎯 开始使用

1. 打开浏览器访问 `http://localhost:5000`（或开发模式下的 `http://localhost:5173`）。
2. 使用默认管理员账号登录：
   - **用户名**: `admin`
   - **密码**: `admin123`
3. **重要**: 首次登录后，请务必在设置页面修改默认密码。
4. 建议先到「设置 → 数据来源」选择抓取站点：默认 Danbooru（可匿名使用）；若要使用 Gelbooru，请先填入 User ID 与 API Key 并点「测试连接」。
5. 回到「画师管理」页，点击右上角「添加画师」输入画师名称即可；已有画师可点「一键自动补全」批量抓取作品数与封面。

## 📂 数据存储

所有数据存储在本地，支持通过 `DATA_DIR` 环境变量自定义数据目录。

**默认目录结构**（手动部署时在 `backend/` 下）：

```
backend/
├── dist/             # 前端构建产物
├── artists.db        # 画师、分类和预设数据（含 Danbooru / Gelbooru 链接）
├── config.db         # 管理员账号、数据来源与 API 凭据等系统配置
├── artist_images/    # 画师预览图
└── backgrounds/      # 登录背景图
```

> `config.db` 中保存了 Danbooru / Gelbooru 的 API 凭据，仅存于本地，请勿上传到公开仓库；如凭据泄露，可在对应站点重置后到设置页更新。

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
| `TZ` | 容器时区（影响日志时间戳） | `Asia/Shanghai`（`docker-compose.yml` 中设置） |

## ❓ 常见问题

**抓取全部失败，提示 Gelbooru 凭据无效？**
Gelbooru 的 API 必须携带账号凭据。请到「设置 → Gelbooru API」填写 User ID 与 API Key（在 Gelbooru 的 `Account → Options → API Access Credentials` 中获取），保存后点「测试连接」确认。

**同样是这个画师，两个站点作品数不一样？**
属正常现象：Danbooru 与 Gelbooru 的收录范围、审核标准和标签规范不同，作品数差异较大时可分别在两个站点核对。

**抓取提示成功，但卡片没有封面？**
说明只拿到了作品数、图片下载失败（原图过大或帖子已删除）。可打开画师编辑弹窗点「自动补全」并确认重新抓取，或手动上传封面。

**画师链接点进去没有结果？**
两家站点的画师标签可能不一致（如带 `_(artist)` 消歧后缀）。在画师编辑弹窗里手动修改 Danbooru / Gelbooru 链接即可，之后抓取会使用修改后的链接。

## 📄 许可证

MIT License
