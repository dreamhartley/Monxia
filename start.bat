@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==================================================
echo        Monxia - Startup Script
echo ==================================================
echo.

:: Save project root directory
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: =============================================
:: Environment Check
:: =============================================
echo [Check] Verifying runtime environment...

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [Error] Python not found, please install Python 3.10+
    echo         Download: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PYTHON_VER=%%i"
echo [Check] Python version: %PYTHON_VER%

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [Error] Node.js not found, please install Node.js 18+
    echo         Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version 2^>^&1') do set "NODE_VER=%%i"
echo [Check] Node.js version: %NODE_VER%

:: Check npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo [Error] npm not found, please ensure Node.js is installed correctly
    pause
    exit /b 1
)

echo [Check] Environment check passed
echo.

:: =============================================
:: Step 1: Build frontend static files
:: =============================================
echo [1/5] Checking frontend environment...

if not exist "frontend\package.json" (
    echo [Error] Frontend project not found, please ensure frontend directory exists
    pause
    exit /b 1
)

cd frontend

:: Check if dependencies need to be installed
if not exist "node_modules" (
    echo [1/5] First run, installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo [Error] Frontend dependency installation failed
        pause
        exit /b 1
    )
)

:: Build frontend (outputs directly to backend/dist)
echo [2/5] Building frontend static files...
call npm run build
if errorlevel 1 (
    echo [Error] Frontend build failed
    pause
    exit /b 1
)

echo [2/5] Frontend build completed

:: Return to project root directory
cd /d "%ROOT_DIR%"

:: =============================================
:: Step 2: Setup backend environment
:: =============================================
echo [3/5] Checking backend environment...

cd backend

:: Check if virtual environment exists
if not exist "venv" (
    echo [3/5] First run, creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [Error] Failed to create virtual environment, please ensure Python 3.10+ is installed
        pause
        exit /b 1
    )
    set "FIRST_RUN=1"
) else (
    set "FIRST_RUN=0"
)

:: Activate virtual environment
echo [3/5] Activating virtual environment...
call venv\Scripts\activate.bat

:: =============================================
:: Step 3: Install dependencies (first run or force update)
:: =============================================
if "!FIRST_RUN!"=="1" (
    echo [4/5] First run, installing Python dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [Error] Python dependency installation failed
        pause
        exit /b 1
    )
) else (
    echo [4/5] Virtual environment exists, skipping dependency installation
    echo       To update dependencies, delete backend\venv directory and run again
)

:: =============================================
:: Step 4: Start service
:: =============================================
echo.
echo [5/5] Starting backend service...
echo.

python run.py

:: Pause if service exits to view error messages
pause
