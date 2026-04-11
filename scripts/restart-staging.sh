#!/usr/bin/env bash
set -euo pipefail

systemctl restart classsitdown-staging-7781.service
sleep 2
curl -fsS http://127.0.0.1:7781/api/health
echo
