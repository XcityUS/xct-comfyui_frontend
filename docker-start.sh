#!/bin/sh
set -e

# Railway (and most platforms) inject a PORT; default to 80 for local runs.
: "${PORT:=80}"
export PORT

# Render the nginx config from the template, substituting only ${PORT}
# (so nginx runtime vars like $uri are preserved).
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Fail fast with a clear message if the generated config is invalid.
nginx -t

echo "DIAG2 PORT=[${PORT}]"
echo "DIAG2 LISTEN LINES:"
grep -i listen /etc/nginx/conf.d/default.conf || true
echo "DIAG2 RAILWAY VARS:"
env | grep -iE "PORT|RAILWAY_TCP|RAILWAY_PRIVATE" | sed 's/=.*/=<set>/' || true

exec nginx -g 'daemon off;'
