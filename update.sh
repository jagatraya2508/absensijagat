#!/bin/bash

# Script Update Otomatis untuk Absensi App
# Cara pakai: ./update.sh

echo "=========================="
echo "  UPDATE ABSENSI APP  "
echo "=========================="

# Pindah ke direktori tempat script ini berada
cd "$(dirname "$0")"

# 1. Tarik kode terbaru dari Git
echo "[1/4] Pulling latest code..."
git config pull.rebase false
git pull origin main

# 2. Install dependencies (jika ada update library)
echo "[2/4] Installing dependencies..."
# Menggunakan script install:all dari package.json
npm run install:all

# 2b. Run Database Migrations
echo "[2b] Running Database Migrations..."
echo "Running migration: migrate_ritase_split.js"
node migrate_ritase_split.js
cd backend
echo "Running migration: migrate_off_day.js"
node migrate_off_day.js
echo "Running migration: migrate_off_days_table.js"
node migrate_off_days_table.js
echo "Running migration: migrate_change_off.js"
node migrate_change_off.js
cd ..

# 3. Build Frontend
echo "[3/4] Building Frontend..."
cd frontend
npm run build
cd ..

# 4. Restart Server
echo "[4/4] Restarting Server..."
# Cek apakah PM2 terinstall (Process Manager untuk Node.js)
if command -v pm2 &> /dev/null
then
    pm2 restart all
    echo "✅ Server restarted with PM2."
else
    echo "⚠️ PM2 not found. Pastikan Anda merestart service manual jika tidak menggunakan PM2."
    echo "   (Contoh: systemctl restart absensi atau matikan & nyalakan ulang node)"
fi

echo "=========================="
echo "✅ UPDATE SUCCESSFUL!"
echo "=========================="
