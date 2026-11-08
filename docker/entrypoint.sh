#!/bin/sh
set -eu
: "${FIZGIG_PASSWORD:?Supply FIZGIG_PASSWORD through the central secret store}"
if [ "${#FIZGIG_PASSWORD}" -lt 12 ]; then
    echo 'FIZGIG_PASSWORD must have at least 12 characters' >&2
    exit 1
fi
mkdir -p /workspace/user_data /workspace/cache /workspace/output_loras
python3 -m fizgig_local apply --initialize-state
# Source/dependencies are baked into the image. Never call upstream's cloud entrypoint.
exec python3 /opt/Fizgig/fizgig.py --web --host 0.0.0.0 --port 8081
