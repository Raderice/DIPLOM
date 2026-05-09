#!/bin/sh
set -e

NGINX_PORT="${PORT:-8080}"
export NGINX_PORT

mkdir -p /etc/nginx/conf.d

envsubst '$NGINX_PORT' < /etc/nginx/templates/render.conf.template > /etc/nginx/conf.d/default.conf

if [ "${RUN_MIGRATIONS:-}" = "true" ]; then
  npm run prisma:migrate -w @board-games/backend
fi

PORT=4000
export PORT

node /app/packages/backend/dist/index.js &
nginx -g 'daemon off;'
