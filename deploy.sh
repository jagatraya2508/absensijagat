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
if [ "${DEPLOY_REEXEC:-}" != 1 ]; then
  export DEPLOY_REEXEC=1
  exec bash "$CD_DIR/deploy.sh"
fi

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
    echo "[4/4b4] Set status karyawan ANK dan SKB (sekali)..."
    docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' <<'SQL'
INSERT INTO employment_statuses (name, description)
VALUES
  ('OUTSOURCING ANK', 'Tenaga outsourcing dengan ID ANK'),
  ('OUTSOURCING SKB', 'Tenaga outsourcing dengan ID SKB')
ON CONFLICT (name) DO NOTHING;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'gudang_status_ank_skb_v2') THEN
    UPDATE employee_details ed
    SET employment_status = CASE
          WHEN upper(btrim(u.employee_id)) LIKE 'ANK%' THEN 'OUTSOURCING ANK'
          ELSE 'OUTSOURCING SKB'
        END,
        updated_at = CURRENT_TIMESTAMP
    FROM users u
    WHERE ed.user_id = u.id
      AND (upper(btrim(u.employee_id)) LIKE 'ANK%' OR upper(btrim(u.employee_id)) LIKE 'SKB%');

    INSERT INTO employee_details (user_id, employment_status, updated_at)
    SELECT u.id,
           CASE
             WHEN upper(btrim(u.employee_id)) LIKE 'ANK%' THEN 'OUTSOURCING ANK'
             ELSE 'OUTSOURCING SKB'
           END,
           CURRENT_TIMESTAMP
    FROM users u
    WHERE (upper(btrim(u.employee_id)) LIKE 'ANK%' OR upper(btrim(u.employee_id)) LIKE 'SKB%')
      AND NOT EXISTS (SELECT 1 FROM employee_details ed WHERE ed.user_id = u.id);

    INSERT INTO settings (key, value) VALUES ('gudang_status_ank_skb_v2', 'done');
  END IF;
END $$;
SELECT ed.employment_status, COUNT(*) AS jumlah
FROM employee_details ed
JOIN users u ON u.id = ed.user_id
WHERE upper(u.employee_id) LIKE 'ANK%' OR upper(u.employee_id) LIKE 'SKB%'
GROUP BY ed.employment_status
ORDER BY ed.employment_status;
SQL
    echo "[4/4b5] Samakan departemen karyawan gudang berdasarkan nama (sekali)..."
    deptapplied=0
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        if docker compose exec -T -e ALLOW_GUDANG_DEPT_REMAP=1 backend node scripts/set-gudang-departments-by-name.js; then
            deptapplied=1
            break
        fi
        sleep 3
    done
    if [ "$deptapplied" != 1 ]; then
        echo "Gagal menyamakan departemen karyawan gudang."
        exit 1
    fi
    echo "[4/4b6] Set jabatan semua karyawan gudang ke master NAKER (sekali)..."
    docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' <<'SQL'
DO $$
DECLARE
  naker_id INTEGER;
BEGIN
  SELECT id INTO naker_id FROM positions WHERE name = 'NAKER' LIMIT 1;
  IF naker_id IS NULL THEN
    SELECT id INTO naker_id
    FROM positions
    WHERE lower(btrim(name)) IN ('naker', 'nake')
    ORDER BY id
    LIMIT 1;
    IF naker_id IS NULL THEN
      INSERT INTO positions (name, description)
      VALUES ('NAKER', 'Jabatan karyawan gudang')
      RETURNING id INTO naker_id;
    ELSE
      UPDATE positions
      SET name = 'NAKER', updated_at = CURRENT_TIMESTAMP
      WHERE id = naker_id;
    END IF;
  END IF;

  DELETE FROM positions
  WHERE id <> naker_id
    AND lower(btrim(name)) IN ('naker', 'nake');

  IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'gudang_position_naker_exact') THEN
    UPDATE employee_details
    SET position = 'NAKER',
        updated_at = CURRENT_TIMESTAMP;
    INSERT INTO settings (key, value) VALUES ('gudang_position_naker_exact', 'done');
  END IF;
END $$;
SELECT p.name AS master_jabatan, COUNT(ed.id) AS jumlah_karyawan
FROM positions p
LEFT JOIN employee_details ed ON ed.position = p.name
WHERE p.name = 'NAKER'
GROUP BY p.name;
SQL
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
