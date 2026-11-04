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
    echo "[4/4b] Set tunjangan apresiasi menjadi harian..."
    (cd "$CD_DIR/backend" && node scripts/set-appreciation-daily.js)
    echo "DEPLOY JAGAT SELESAI"
else
    echo "[4/4] Restart Docker containers..."
    docker rm -f absensi-postgres absensi-backend absensi-frontend 2>/dev/null || true
    docker compose up -d
    docker compose restart backend
    echo "[4/4b] Set tunjangan gudang menjadi harian (sekali)..."
    ready=0
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        if docker compose exec -T db sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
            ready=1
            break
        fi
        sleep 3
    done
    if [ "$ready" != 1 ]; then
        echo "Database gudang belum siap, tunjangan harian belum diubah."
        exit 1
    fi
    docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' <<'SQL'
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS transport_allowance_period VARCHAR(10) DEFAULT 'monthly';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS meal_allowance_period VARCHAR(10) DEFAULT 'monthly';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS appreciation_allowance_period VARCHAR(10) DEFAULT 'monthly';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'gudang_allowance_daily_applied') THEN
    UPDATE employee_details
    SET transport_allowance_period = 'daily',
        meal_allowance_period = 'daily',
        appreciation_allowance_period = 'daily';
    INSERT INTO settings (key, value) VALUES ('gudang_allowance_daily_applied', 'done');
  END IF;
END $$;
SELECT COUNT(*) AS karyawan_tunjangan_harian
FROM employee_details
WHERE transport_allowance_period = 'daily'
  AND meal_allowance_period = 'daily'
  AND appreciation_allowance_period = 'daily';
SQL
    echo "[4/4b2] Tambah master departemen gudang (sekali)..."
    docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'gudang_departments_20261104') THEN
    INSERT INTO departments (name)
    VALUES
      ('ADMIN'),
      ('CHECKER'),
      ('CLEANING SERVICE'),
      ('DRIVER CD'),
      ('DRIVER FUSO'),
      ('DRIVER G-MAX'),
      ('KENEK CD'),
      ('KENEK FUSO'),
      ('KENEK TRONTON'),
      ('LOGISTIK'),
      ('MEKANIK'),
      ('PROD FF & TEMPEL'),
      ('PROD RESIN & POTONG'),
      ('PROD SORTIR')
    ON CONFLICT (name) DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('gudang_departments_20261104', 'done');
  END IF;
END $$;
SELECT name FROM departments
WHERE name IN (
  'ADMIN', 'CHECKER', 'CLEANING SERVICE', 'DRIVER CD', 'DRIVER FUSO', 'DRIVER G-MAX',
  'KENEK CD', 'KENEK FUSO', 'KENEK TRONTON', 'LOGISTIK', 'MEKANIK',
  'PROD FF & TEMPEL', 'PROD RESIN & POTONG', 'PROD SORTIR'
)
ORDER BY name;
SQL
    echo "[4/4b3] Samakan ID karyawan gudang berdasarkan nama (sekali)..."
    idapplied=0
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        if docker compose exec -T -e ALLOW_GUDANG_ID_REMAP=1 backend node scripts/set-gudang-employee-ids.js; then
            idapplied=1
            break
        fi
        sleep 3
    done
    if [ "$idapplied" != 1 ]; then
        echo "Gagal menyamakan ID karyawan gudang."
        exit 1
    fi
    echo "[4/4c] Set tunjangan apresiasi menjadi harian..."
    applied=0
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        if docker compose exec -T backend node scripts/set-appreciation-daily.js; then
            applied=1
            break
        fi
        sleep 3
    done
    if [ "$applied" != 1 ]; then
        echo "Gagal mengubah tunjangan apresiasi menjadi harian."
        exit 1
    fi
    echo "DEPLOY GUDANG SELESAI"
fi
