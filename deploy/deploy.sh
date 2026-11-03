#!/bin/bash
# Deploy one release on the server. Run as root (via SSM). Usage: deploy.sh <s3-key-of-release-tarball>
set -euo pipefail
BUCKET="${Y2K_BACKUP_BUCKET:?set Y2K_BACKUP_BUCKET}"
KEY="${1:?release key}"
NAME="$(date +%Y%m%d%H%M%S)"
DIR="/opt/y2k/releases/$NAME"

mkdir -p "$DIR"
aws s3 cp "s3://$BUCKET/$KEY" /tmp/y2k-release.tgz --only-show-errors
tar xzf /tmp/y2k-release.tgz -C "$DIR"
rm -f /tmp/y2k-release.tgz
chown -R y2k:y2k "$DIR"

# Build as the app user with the production env loaded (NEXT_PUBLIC_* values are baked in at build time).
sudo -u y2k bash -lc "cd '$DIR' && set -a && . /etc/y2k.env && set +a && npm ci --include=dev --no-audit --no-fund && npm run build"

PREV="$(readlink -f /opt/y2k/current || true)"
ln -sfn "$DIR" /opt/y2k/current
systemctl restart y2k

# Health check; roll back if the new release does not come up.
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/api/event; then echo "HEALTHY $NAME"; break; fi
  sleep 2
  if [ "$i" = 30 ]; then
    echo "UNHEALTHY, rolling back"
    [ -n "$PREV" ] && ln -sfn "$PREV" /opt/y2k/current && systemctl restart y2k
    exit 1
  fi
done

# Keep the last 3 releases.
ls -1dt /opt/y2k/releases/* | tail -n +4 | xargs -r rm -rf
