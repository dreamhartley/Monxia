#!/bin/bash

echo "=================================================="
echo "       Monxia - Startup Script"
echo "=================================================="
echo

# Save project root directory
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# =============================================
# Environment Check
# =============================================
echo "[Check] Verifying runtime environment..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[Error] Python not found, please install Python 3.10+"
    echo "        Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip"
    echo "        macOS: brew install python3"
    exit 1
fi
PYTHON_VER=$(python3 --version 2>&1 | awk '{print $2}')
echo "[Check] Python version: $PYTHON_VER"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[Error] Node.js not found, please install Node.js 18+"
    echo "        Download: https://nodejs.org/"
    exit 1
fi
NODE_VER=$(node --version 2>&1)
echo "[Check] Node.js version: $NODE_VER"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "[Error] npm not found, please ensure Node.js is installed correctly"
    exit 1
fi

echo "[Check] Environment check passed"
echo

# =============================================
# Step 1: Build frontend static files
# =============================================
echo "[1/5] Checking frontend environment..."

if [ ! -f "frontend/package.json" ]; then
    echo "[Error] Frontend project not found, please ensure frontend directory exists"
    exit 1
fi

cd frontend

# Check if dependencies need to be installed
if [ ! -d "node_modules" ]; then
    echo "[1/5] First run, installing frontend dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[Error] Frontend dependency installation failed"
        exit 1
    fi
fi

# Build frontend (outputs directly to backend/dist)
echo "[2/5] Building frontend static files..."
npm run build
if [ $? -ne 0 ]; then
    echo "[Error] Frontend build failed"
    exit 1
fi

echo "[2/5] Frontend build completed"

# Return to project root directory
cd "$ROOT_DIR"

# =============================================
# Step 2: Setup backend environment
# =============================================
echo "[3/5] Checking backend environment..."

cd backend

# Check if virtual environment exists
FIRST_RUN=0
if [ ! -d "venv" ]; then
    echo "[3/5] First run, creating Python virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "[Error] Failed to create virtual environment, please ensure Python 3.10+ is installed"
        exit 1
    fi
    FIRST_RUN=1
fi

# Activate virtual environment
echo "[3/5] Activating virtual environment..."
source venv/bin/activate

# =============================================
# Step 3: Install dependencies (first run or force update)
# =============================================
if [ $FIRST_RUN -eq 1 ]; then
    echo "[4/5] First run, installing Python dependencies..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "[Error] Python dependency installation failed"
        exit 1
    fi

    echo "[4/5] Installing Playwright browser..."
    playwright install chromium
    if [ $? -ne 0 ]; then
        echo "[Warning] Playwright browser installation failed, some features may not work"
    fi
else
    echo "[4/5] Virtual environment exists, skipping dependency installation"
    echo "      To update dependencies, delete backend/venv directory and run again"
fi

# =============================================
# Step 4: Start service
# =============================================
echo
echo "[5/5] Starting backend service..."
echo

python run.py
