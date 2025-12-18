# ================================
# Stage 1: Build frontend
# ================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend dependency files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build frontend (outputs to ../backend/dist)
RUN npm run build

# ================================
# Stage 2: Python runtime
# ================================
FROM python:3.12-slim AS runtime

# Install system dependencies (required by Playwright)
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

# Copy backend dependency file
COPY backend/requirements.txt ./backend/

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Install Playwright browser
RUN playwright install chromium

# Copy backend source code
COPY backend/ ./backend/

# Copy frontend build output from stage 1 (already built to backend/dist)
COPY --from=frontend-builder /app/backend/dist ./backend/dist

# Create data directories (for database and images)
# Directory structure:
#   /app/data/artists.db      - Artist database
#   /app/data/config.db       - Config database
#   /app/data/artist_images/  - Artist sample images
#   /app/data/backgrounds/    - Login background images
RUN mkdir -p /app/data/artist_images /app/data/backgrounds

# Set environment variables
ENV FLASK_APP=backend/app.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
# Data directory environment variable (database and images stored here)
ENV DATA_DIR=/app/data

# Expose port
EXPOSE 5000

# Declare data volume
VOLUME ["/app/data"]

# Switch working directory to backend
WORKDIR /app/backend

# Startup command
CMD ["python", "run.py"]
