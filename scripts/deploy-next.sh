#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# TMUX AUTO-START + AUTO-ATTACH + AUTO-EXIT
# ============================================================
SESSION_NAME="next"
if [ -z "${TMUX:-}" ]; then
  SELF="$(readlink -f "$0")"
  tmux new-session -d -A -s "$SESSION_NAME" "bash '$SELF'"
  echo "Started tmux session '$SESSION_NAME'. Attaching..."
  tmux attach -t "$SESSION_NAME"
  exit 0
fi

# ============================================================
# LOGGING — saved in ~/scripts, previous logs cleared each run
# ============================================================
LOG_DIR="$HOME/scripts"
mkdir -p "$LOG_DIR"

# delete ALL previous deploy logs before starting a new one
find "$LOG_DIR" -maxdepth 1 -name 'deploy-*.log' -type f -delete 2>/dev/null || true

LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1
echo "Logging to $LOG_FILE"

# ============================================================
# CLEANUP — always kills tmux; records failures in the log
# ============================================================
cleanup() {
  local code=$?
  kill "${SUDO_KEEPALIVE_PID:-}" 2>/dev/null || true
  if [ "$code" -ne 0 ]; then
    echo "[deploy] FAILED with exit code $code (line ${ERR_LINE:-unknown})"
  fi
  sleep 2   # let tee flush the last lines to the log file
  tmux kill-session -t "$(tmux display-message -p '#S')" 2>/dev/null || true
}
trap 'ERR_LINE=$LINENO' ERR
trap cleanup EXIT

# ============================================================
# CONFIG — adjust these to match your server layout
# ============================================================
APP_DIR="$HOME/apps/Website-next"
NGINX_CONF="/etc/nginx/sites-available/modelflick.com"
STATE_FILE="$HOME/scripts/.last_deployed_hash"
BLUE_PORT=3001
GREEN_PORT=3002
HEALTHCHECK_PATH="/"          # change if you have a dedicated /health route
HEALTHCHECK_RETRIES=15
HEALTHCHECK_DELAY=2           # seconds between retries
BUILD_ATTEMPTS=4              # how many times to try the docker build
BUILD_RETRY_DELAY=15          # seconds to wait between build attempts

# ============================================================
# COLORS FOR OUTPUT
# ============================================================
GREEN_C='\033[0;32m'; RED_C='\033[0;31m'; YELLOW_C='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN_C}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW_C}[deploy]${NC} $1"; }
err()  { echo -e "${RED_C}[deploy]${NC} $1" >&2; }

# ============================================================
# 1. CACHE SUDO PASSWORD ONCE, KEEP IT ALIVE FOR THE WHOLE SCRIPT
# ============================================================
log "Requesting sudo access (you'll only be asked once)..."
sudo -v
( while true; do sudo -n true; sleep 60; kill -0 "$$" 2>/dev/null || exit; done ) >/dev/null 2>&1 &
SUDO_KEEPALIVE_PID=$!

# ============================================================
# 2. GIT PULL — skip only if this commit was already deployed OK
# ============================================================
cd "$APP_DIR"
log "Fetching latest changes in $APP_DIR ..."
git pull
AFTER_HASH=$(git rev-parse HEAD)
LAST_DEPLOYED=$(cat "$STATE_FILE" 2>/dev/null || true)

if [ "$AFTER_HASH" == "$LAST_DEPLOYED" ]; then
  log "Commit $AFTER_HASH is already deployed. Nothing to do. Exiting."
  exit 0
fi
log "Deploying $AFTER_HASH (last successful deploy: ${LAST_DEPLOYED:-none})."

# ============================================================
# 3. DETERMINE CURRENT ACTIVE COLOR FROM NGINX CONFIG
# ============================================================
CURRENT_PORT=$(grep -oP 'proxy_pass\s+http://127\.0\.0\.1:\K[0-9]+' "$NGINX_CONF" | head -1 || true)

if [ -z "$CURRENT_PORT" ]; then
  err "Could not detect current active port from $NGINX_CONF."
  err "Expected a line like: proxy_pass http://127.0.0.1:3001;"
  exit 1
fi

if [ "$CURRENT_PORT" == "$BLUE_PORT" ]; then
  CURRENT_COLOR="blue"
  TARGET_COLOR="green"
  TARGET_PORT=$GREEN_PORT
elif [ "$CURRENT_PORT" == "$GREEN_PORT" ]; then
  CURRENT_COLOR="green"
  TARGET_COLOR="blue"
  TARGET_PORT=$BLUE_PORT
else
  err "Current nginx port ($CURRENT_PORT) doesn't match known blue ($BLUE_PORT) or green ($GREEN_PORT) ports."
  exit 1
fi

log "Currently active: $CURRENT_COLOR (port $CURRENT_PORT)"
log "Deploying to:      $TARGET_COLOR (port $TARGET_PORT)"

# ============================================================
# 4. BUILD (WITH RETRIES) AND START THE TARGET COLOR
# ============================================================
COMPOSE_FILE="docker-compose.${TARGET_COLOR}.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  err "Compose file not found: $COMPOSE_FILE"
  exit 1
fi

BUILD_OK=false
for attempt in $(seq 1 "$BUILD_ATTEMPTS"); do
  log "Building $TARGET_COLOR image (attempt $attempt/$BUILD_ATTEMPTS)..."
  if docker compose --progress=plain -f "$COMPOSE_FILE" build; then
    BUILD_OK=true
    break
  fi
  if [ "$attempt" -lt "$BUILD_ATTEMPTS" ]; then
    warn "Build failed. Retrying in ${BUILD_RETRY_DELAY}s (cached layers make retries fast)..."
    sleep "$BUILD_RETRY_DELAY"
  fi
done

if [ "$BUILD_OK" != true ]; then
  err "Build failed after $BUILD_ATTEMPTS attempts. Old $CURRENT_COLOR container untouched. Aborting."
  exit 1
fi

log "Starting $TARGET_COLOR container..."
docker compose --progress=plain -f "$COMPOSE_FILE" up -d

# ============================================================
# 5. HEALTH CHECK THE NEW CONTAINER BEFORE SWITCHING TRAFFIC
# ============================================================
log "Health-checking $TARGET_COLOR on 127.0.0.1:$TARGET_PORT ..."
HEALTHY=false
for i in $(seq 1 "$HEALTHCHECK_RETRIES"); do
  if curl -sf -o /dev/null "http://127.0.0.1:${TARGET_PORT}${HEALTHCHECK_PATH}"; then
    HEALTHY=true
    break
  fi
  warn "  attempt $i/$HEALTHCHECK_RETRIES not ready yet, retrying in ${HEALTHCHECK_DELAY}s..."
  sleep "$HEALTHCHECK_DELAY"
done

if [ "$HEALTHY" != true ]; then
  err "$TARGET_COLOR container did not become healthy after $HEALTHCHECK_RETRIES attempts."
  err "Leaving nginx pointed at $CURRENT_COLOR (old container untouched). Aborting."
  err "Container logs (last 100 lines):"
  docker logs --tail 100 "next-${TARGET_COLOR}" 2>&1 || true
  exit 1
fi
log "$TARGET_COLOR is healthy."

# ============================================================
# 6. SWITCH NGINX TO THE NEW COLOR'S PORT
# ============================================================
log "Updating nginx config: $CURRENT_PORT -> $TARGET_PORT ..."
sudo sed -i "s/proxy_pass http:\/\/127\.0\.0\.1:${CURRENT_PORT};/proxy_pass http:\/\/127.0.0.1:${TARGET_PORT};/" "$NGINX_CONF"

log "Testing nginx config..."
if ! sudo nginx -t; then
  err "nginx config test failed! Reverting port change."
  sudo sed -i "s/proxy_pass http:\/\/127\.0\.0\.1:${TARGET_PORT};/proxy_pass http:\/\/127.0.0.1:${CURRENT_PORT};/" "$NGINX_CONF"
  err "Reverted. $TARGET_COLOR container is still running but not receiving traffic."
  exit 1
fi

log "Reloading nginx..."
sudo systemctl reload nginx
log "Traffic now routed to $TARGET_COLOR (port $TARGET_PORT)."

# ============================================================
# 7. STOP AND REMOVE THE OLD (NOW-INACTIVE) COLOR CONTAINER
# ============================================================
log "Stopping and removing old $CURRENT_COLOR container..."
docker stop "next-${CURRENT_COLOR}" 2>/dev/null || warn "next-${CURRENT_COLOR} was not running."
docker rm "next-${CURRENT_COLOR}" 2>/dev/null || warn "next-${CURRENT_COLOR} was not present."

# ============================================================
# 8. RECORD SUCCESSFUL DEPLOY (only reached if everything above passed)
# ============================================================
echo "$AFTER_HASH" > "$STATE_FILE"
log "Deploy complete. Active color is now: $TARGET_COLOR (port $TARGET_PORT)"