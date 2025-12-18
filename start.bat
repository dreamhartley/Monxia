@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==================================================
echo        梦匣 Monxia - 启动脚本
echo ==================================================
echo.

:: 保存项目根目录
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: =============================================
:: 环境检查
:: =============================================
echo [检查] 正在检查运行环境...

:: 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.10+
    echo        下载地址: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PYTHON_VER=%%i"
echo [检查] Python 版本: %PYTHON_VER%

:: 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo        下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version 2^>^&1') do set "NODE_VER=%%i"
echo [检查] Node.js 版本: %NODE_VER%

:: 检查 npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 npm，请确保 Node.js 安装正确
    pause
    exit /b 1
)

echo [检查] 环境检查通过
echo.

:: =============================================
:: 步骤1: 构建前端静态文件
:: =============================================
echo [1/5] 检查前端环境...

if not exist "frontend\package.json" (
    echo [错误] 未找到前端项目，请确保 frontend 目录存在
    pause
    exit /b 1
)

cd frontend

:: 检查是否需要安装依赖
if not exist "node_modules" (
    echo [1/5] 首次运行，安装前端依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
)

:: 构建前端
echo [2/5] 构建前端静态文件...
call npm run build
if errorlevel 1 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)

:: 复制构建产物到 backend/dist
echo [2/5] 复制前端文件到 backend\dist...
if exist "%ROOT_DIR%backend\dist" rmdir /s /q "%ROOT_DIR%backend\dist"
xcopy /s /e /i /q "dist" "%ROOT_DIR%backend\dist"

echo [2/5] 前端构建完成

:: 返回项目根目录
cd /d "%ROOT_DIR%"

:: =============================================
:: 步骤2: 设置后端环境
:: =============================================
echo [3/5] 检查后端环境...

cd backend

:: 检查虚拟环境是否存在
if not exist "venv" (
    echo [3/5] 首次运行，创建 Python 虚拟环境...
    python -m venv venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败，请确保已安装 Python 3.10+
        pause
        exit /b 1
    )
    set "FIRST_RUN=1"
) else (
    set "FIRST_RUN=0"
)

:: 激活虚拟环境
echo [3/5] 激活虚拟环境...
call venv\Scripts\activate.bat

:: =============================================
:: 步骤3: 安装依赖（首次运行或强制更新）
:: =============================================
if "!FIRST_RUN!"=="1" (
    echo [4/5] 首次运行，安装 Python 依赖...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] Python 依赖安装失败
        pause
        exit /b 1
    )

    echo [4/5] 安装 Playwright 浏览器...
    playwright install chromium
    if errorlevel 1 (
        echo [警告] Playwright 浏览器安装失败，部分功能可能不可用
    )
) else (
    echo [4/5] 虚拟环境已存在，跳过依赖安装
    echo      如需更新依赖，请删除 backend\venv 目录后重新运行
)

:: =============================================
:: 步骤4: 启动服务
:: =============================================
echo.
echo [5/5] 启动后端服务...
echo.

python run.py

:: 如果服务退出，暂停以便查看错误信息
pause
