#!/bin/sh
set -e

# Railway (and most platforms) inject a PORT; default to 80 for local runs.
: "${PORT:=80}"
export PORT

# ComfyUI backend origin for the same-origin API proxy. Defaults to the
# comfyui-backend service over Railway private networking (IPv6, same
# project/environment). Override with a public origin to point elsewhere.
: "${COMFYUI_BACKEND_ORIGIN:=http://comfyui-backend.railway.internal:8188}"
export COMFYUI_BACKEND_ORIGIN

# Render the nginx config from the template, substituting only our variables
# (so nginx runtime vars like $uri are preserved).
envsubst '${PORT} ${COMFYUI_BACKEND_ORIGIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Fail fast with a clear message if the generated config is invalid.
nginx -t

echo "Serving static site on port ${PORT}"
exec nginx -g 'daemon off;'
