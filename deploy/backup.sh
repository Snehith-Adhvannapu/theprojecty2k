#!/bin/bash
# Postgres dump to S3. Cron runs this every 3 hours; the bucket expires old dumps after 45 days.
set -euo pipefail
source /etc/y2k-backup.env
F="/var/backups/y2k/y2k-$(date -u +%Y%m%d-%H%M).sql.gz"
sudo -u postgres pg_dump y2k | gzip > "$F"
aws s3 cp "$F" "s3://$Y2K_BACKUP_BUCKET/db/$(basename "$F")" --only-show-errors
find /var/backups/y2k -name '*.sql.gz' -mtime +2 -delete
echo "backup ok $(basename "$F") $(stat -c %s "$F") bytes"
