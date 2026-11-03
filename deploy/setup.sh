#!/bin/bash
# One-time server setup (idempotent). Run as root. Needs deploy/* synced to /opt/y2k/deploy first.
set -euo pipefail
ACC="$(curl -s -H "X-aws-ec2-metadata-token: $(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" http://169.254.169.254/latest/dynamic/instance-identity/document | python3 -c 'import sys,json;print(json.load(sys.stdin)["accountId"])')"
cd /opt/y2k/deploy
sed -i 's/\r$//' *.sh *.service Caddyfile

# Secrets live only on this server. AUTH_SECRET is generated here and never printed.
if [ ! -f /etc/y2k.env ]; then
  umask 077
  cat > /etc/y2k.env <<EOF
NODE_ENV=production
DATABASE_URL=postgresql:///y2k?host=/var/run/postgresql&user=y2k
APP_URL=https://aws.projecty2k.com
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
EMAIL_PROVIDER=ses
EMAIL_FROM=Project Y2K <tickets@mail.projecty2k.com>
AWS_REGION=ap-southeast-2
S3_UPLOADS_BUCKET=y2k-uploads-$ACC
EOF
  chown root:y2k /etc/y2k.env && chmod 640 /etc/y2k.env
fi
echo "Y2K_BACKUP_BUCKET=y2k-backups-$ACC" > /etc/y2k-backup.env
chmod 644 /etc/y2k-backup.env
grep -q AWS_REGION /etc/environment || echo "AWS_DEFAULT_REGION=ap-southeast-2" >> /etc/environment

install -m 755 deploy.sh /opt/y2k/deploy.sh
install -m 755 backup.sh /opt/y2k/backup.sh
install -m 644 y2k.service /etc/systemd/system/y2k.service
install -m 644 Caddyfile /etc/caddy/Caddyfile
echo '0 */3 * * * root AWS_DEFAULT_REGION=ap-southeast-2 /opt/y2k/backup.sh >> /var/log/y2k-backup.log 2>&1' > /etc/cron.d/y2k-backup
chmod 644 /etc/cron.d/y2k-backup
systemctl daemon-reload
systemctl enable y2k
systemctl reload caddy || systemctl restart caddy
echo SETUP_OK
