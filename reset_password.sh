#!/bin/bash

# ========================================================
# Script Reset Password Admin (1-Command via Docker)
# Cara Pakai: ./reset_password.sh [password_baru] [employee_id]
# Contoh: ./reset_password.sh admin123 ADMIN001
# ========================================================

NEW_PASS="${1:-admin123}"
EMP_ID="${2:-ADMIN001}"

echo "=========================================="
echo "🔐 RESETTING ADMIN PASSWORD..."
echo "=========================================="

docker exec absensi-backend node reset_password.js "$NEW_PASS" "$EMP_ID"

echo "=========================================="
