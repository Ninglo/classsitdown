#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="/root/work/classsitdown"
STAGING_DIR="/srv/classsitdown-staging"
SERVICE="classsitdown-staging-7781.service"

echo "[1/5] Running backend tests..."
(cd "$SOURCE_DIR/backend" && npm test)

echo "[2/5] Building frontend..."
(cd "$SOURCE_DIR/frontend" && npm run build)

echo "[3/5] Syncing files to staging..."
rsync -a --delete "$SOURCE_DIR/" "$STAGING_DIR/"
mkdir -p "$STAGING_DIR/data"

echo "[4/5] Restarting staging service..."
systemctl restart "$SERVICE"
sleep 2

echo "[5/5] Checking staging health..."
curl -fsS http://127.0.0.1:7781/api/health
echo
echo "Staging deploy finished."
