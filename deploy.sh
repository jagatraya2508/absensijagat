#!/bin/bash

# ========================================================
# Deploy 1-command
# - Gudang: Docker Compose
# - Jagat: PM2 + nginx host (jangan naikkan stack Docker)
# Cara Penggunaan: ./deploy.sh
# ========================================================

set -e

CD_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CD_DIR"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

use_pm2=false
if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe absensi-backend-5000 >/dev/null 2>&1 \
        || pm2 describe absensijagat-backend-5000 >/dev/null 2>&1; then
        use_pm2=true
    fi
fi

if [ "$use_pm2" = true ]; then
    echo "=========================================="
    echo "DEPLOY ABSENSI JAGAT (PM2)"
    echo "=========================================="
else
    echo "=========================================="
    echo "DEPLOY ABSENSI GUDANG (DOCKER)"
    echo "=========================================="
fi

echo "[1/4] Menarik kode terbaru dari Git..."
git fetch --all
git reset --hard origin/main
git clean -fd -e backend/uploads/ -e .env -e backend/.env
git pull origin main || true

echo "[2/4] Install dependensi backend..."
cd "$CD_DIR/backend"
npm install --production

echo "[3/4] Install dependensi & build frontend..."
cd "$CD_DIR/frontend"
npm install
npm run build

cd "$CD_DIR"
if [ "$use_pm2" = true ]; then
    echo "[4/4] Restart PM2 backend..."
    pm2 restart absensi-backend-5000 \
        || pm2 restart absensijagat-backend-5000 \
        || pm2 restart backend
    echo "DEPLOY JAGAT SELESAI"
else
    echo "[4/4] Restart Docker containers..."
    docker rm -f absensi-postgres absensi-backend absensi-frontend 2>/dev/null || true
    docker compose up -d
    docker compose restart backend
    echo "DEPLOY GUDANG SELESAI"
fi
