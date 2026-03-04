#!/usr/bin/env bash
# OTEL Integration Test Runner
#
# Single command to spin up Docker Compose, push a trace, verify it in Jaeger,
# and tear down. Exit code 0 = feature works, 1 = something is broken.
#
# Usage:
#   ./run-test.sh           # full lifecycle
#   ./run-test.sh --no-down # leave containers running for manual inspection

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

NO_DOWN=false
for arg in "$@"; do
  case "$arg" in
    --no-down) NO_DOWN=true ;;
  esac
done

cleanup() {
  if [ "$NO_DOWN" = false ]; then
    echo ""
    echo "  🧹 Tearing down Docker Compose..."
    docker compose down --remove-orphans 2>/dev/null || true
  else
    echo ""
    echo "  ℹ️  Containers left running (--no-down). Tear down with: docker compose down"
    echo "  🔗 Jaeger UI: http://localhost:16686"
  fi
}
trap cleanup EXIT

# ── Preflight ──
if ! command -v docker &>/dev/null; then
  echo "  ❌ Docker is not installed or not in PATH."
  echo "     Install Docker Desktop: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo "  ❌ Docker daemon is not running."
  echo "     Start Docker Desktop and try again."
  exit 1
fi

# ── Start services ──
echo ""
echo "  🐳 Starting OTEL Collector + Jaeger..."
docker compose up -d --wait

# Wait for collector health
echo "  ⏳ Waiting for collector to be healthy..."
RETRIES=0
MAX_RETRIES=15
until curl -sf http://localhost:13133/ >/dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "  ❌ Collector did not become healthy after ${MAX_RETRIES} attempts."
    docker compose logs otel-collector
    exit 1
  fi
  sleep 1
done
echo "  ✅ Collector is healthy."

# ── Run verification script ──
echo ""
npx tsx verify-otel.ts
EXIT_CODE=$?

exit $EXIT_CODE
