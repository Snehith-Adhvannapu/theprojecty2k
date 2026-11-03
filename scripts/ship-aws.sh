#!/bin/bash
# Push to production on AWS: push main to GitHub, upload the committed tree, build and restart on the server over SSM.
# Rolls back automatically if the new release fails its health check (see deploy/deploy.sh). Needs the `y2k` AWS profile.
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-y2k}" AWS_PAGER="" AWS_DEFAULT_REGION=ap-southeast-2 MSYS_NO_PATHCONV=1
INSTANCE="${Y2K_INSTANCE:-i-006da6098b23cbd0a}"
BUCKET="${Y2K_BACKUP_BUCKET:-y2k-backups-754626102524}"

[ -z "$(git status --porcelain -- . ':!.impeccable')" ] || { echo "Uncommitted changes: commit first (only committed code is shipped)."; exit 1; }
git push -q origin HEAD
SHA="$(git rev-parse --short HEAD)"
TMP="${TEMP:-/tmp}/y2k-release-$SHA.tgz"
git archive --format=tar.gz -o "$TMP" HEAD
aws s3 cp "$TMP" "s3://$BUCKET/releases/$SHA.tgz" --only-show-errors
aws s3 sync deploy "s3://$BUCKET/deploy" --only-show-errors

CMD="aws s3 sync s3://$BUCKET/deploy /opt/y2k/deploy --only-show-errors && sed -i 's/\r\$//' /opt/y2k/deploy/*.sh && install -m 755 /opt/y2k/deploy/deploy.sh /opt/y2k/deploy.sh && set -a && . /etc/y2k-backup.env && set +a && export AWS_DEFAULT_REGION=ap-southeast-2 && /opt/y2k/deploy.sh releases/$SHA.tgz > /var/log/y2k-deploy.log 2>&1; echo exit=\$?; grep -E 'HEALTHY|UNHEALTHY' /var/log/y2k-deploy.log"
CID=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name AWS-RunShellScript --timeout-seconds 1800 \
  --parameters "$(python -c 'import json,sys;print(json.dumps({"commands":[sys.argv[1]],"executionTimeout":["1800"]}))' "$CMD")" --query Command.CommandId --output text)
echo "Deploying $SHA (command $CID)..."
for _ in $(seq 1 300); do
  S=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || true)
  case "$S" in Success|Failed|TimedOut|Cancelled) break;; esac
  sleep 5
done
aws ssm get-command-invocation --command-id "$CID" --instance-id "$INSTANCE" --query StandardOutputContent --output text | iconv -c -t ascii
[ "$S" = "Success" ]
