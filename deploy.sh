#!/usr/bin/env bash
# =============================================================================
# deploy.sh — loads ./.env (or a path passed as $2) and runs
# `docker stack deploy`, since stack deploy has no built-in .env support.
#
# USAGE:
#   ./deploy.sh memoize                 # uses ./.env, compose.swarm.yml
#   ./deploy.sh memoize path/to/.env    # explicit env file
# =============================================================================

set -euo pipefail

STACK_NAME="${1:?usage: ./deploy.sh <stack-name> [env-file]}"
ENV_FILE="${2:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.swarm.yml}"

[[ -f "$ENV_FILE" ]] || {
    echo "ERROR: env file not found: $ENV_FILE" >&2
    exit 1
}
[[ -f "$COMPOSE_FILE" ]] || {
    echo "ERROR: compose file not found: $COMPOSE_FILE" >&2
    exit 1
}

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "Deploying stack '$STACK_NAME' from $COMPOSE_FILE using $ENV_FILE"
# -E preserves this script's environment (including everything just sourced
# from $ENV_FILE) across sudo. Without it, sudo's default env_reset strips
# these vars before docker stack deploy ever sees them — the image tag
# interpolates to empty even though `source "$ENV_FILE"` worked fine here.
sudo -E docker stack deploy -d --prune -c "$COMPOSE_FILE" "$STACK_NAME"
