# ================================
# 阶段1: 构建前端
# ================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package.json frontend/package-lock.json* ./

# 安装依赖
RUN npm ci

# 复制前端源码
COPY frontend/ ./

# 构建前端
RUN npm run build

# ================================
# 阶段2: Python 运行时
# ================================
FROM python:3.12-slim AS runtime

# 安装系统依赖（playwright 需要）
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制后端依赖文件
COPY backend/requirements.txt ./backend/

# 安装 Python 依赖
RUN pip install --no-cache-dir -r backend/requirements.txt

# 安装 Playwright 浏览器
RUN playwright install chromium

# 复制后端源码
COPY backend/ ./backend/

# 从阶段1复制前端构建产物到 backend/dist
COPY --from=frontend-builder /app/frontend/dist ./backend/dist

# 创建数据目录（用于存储数据库和图片）
# 目录结构:
#   /app/data/artists.db      - 画师数据库
#   /app/data/config.db       - 配置数据库
#   /app/data/artist_images/  - 画师示例图片
#   /app/data/backgrounds/    - 登录背景图片
RUN mkdir -p /app/data/artist_images /app/data/backgrounds

# 设置环境变量
ENV FLASK_APP=backend/app.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
# 数据目录环境变量（数据库和图片都存储在这里）
ENV DATA_DIR=/app/data

# 暴露端口
EXPOSE 5000

# 声明数据卷
VOLUME ["/app/data"]

# 工作目录切换到 backend
WORKDIR /app/backend

# 启动命令
CMD ["python", "run.py"]
