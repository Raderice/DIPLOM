#!/bin/sh
set -e

NGINX_PORT="${PORT:-8080}"
export NGINX_PORT

envsubst '$NGINX_PORT' < /etc/nginx/templates/render.conf.template > /etc/nginx/render.conf

cat > /etc/nginx/nginx.conf <<'EOF'
worker_processes auto;

events {
  worker_connections 1024;
}

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;
  sendfile on;
  keepalive_timeout 65;

  include /etc/nginx/render.conf;
}
EOF

if [ "${RUN_MIGRATIONS:-}" = "true" ]; then
  npm run prisma:migrate -w @board-games/backend
fi

PORT=4000
export PORT

node /app/packages/backend/dist/index.js &
nginx -c /etc/nginx/nginx.conf -g 'daemon off;'
