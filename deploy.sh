#!/bin/bash

# ========================================================
# Script Deployment Manual 1-Command (Docker Compose + Host Build)
# Cara Penggunaan: ./deploy.sh
# ========================================================

set -e # Hentikan skrip jika terjadi error pada salah satu perintah

echo "=========================================="
echo "🚀 MEMULAI PROSES DEPLOYMENT (DOCKER)..."
echo "=========================================="

# 1. Pindah ke direktori root proyek tempat script ini berada
CD_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CD_DIR"

# 2. Tarik Kode Terbaru dari Repository Git
echo "📥 [1/4] Menarik kode terbaru dari Git..."
git fetch --all
git reset --hard origin/main
git clean -fd -e backend/uploads/ -e .env
git pull origin main

# 3. Install Dependensi Backend & Frontend di Host Server
echo "📦 [2/4] Menginstall dependensi Backend di Host..."
cd "$CD_DIR/backend"
npm install --production

echo "🎨 [3/4] Menginstall dependensi & Build Frontend di Host..."
cd "$CD_DIR/frontend"
npm install
npm run build

# 4. Update & Restart Service Docker
echo "🐳 [4/4] Menyalakan & Merestart Docker Containers..."
cd "$CD_DIR"
# Bersihkan container lama jika ada bentrok nama
docker rm -f absensi-postgres absensi-backend absensi-frontend 2>/dev/null || true
docker compose up -d
docker compose restart backend

echo "=========================================="
echo "🎉 DEPLOYMENT BERHASIL & CONTAINER AKTIF!"
echo "=========================================="
