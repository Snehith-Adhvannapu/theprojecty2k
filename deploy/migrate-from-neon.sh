#!/usr/bin/env bash
# Copies every table from the Neon database in /etc/y2k.env into the local Postgres, checks the counts, then points the app at
# the local database. Run as root on the server. The app is stopped while it runs, so nothing is written during the copy.
# Neon is left untouched (read only). The old URL is kept in /root/neon-url.backup for rollback.
set -euo pipefail
ENV=/etc/y2k.env
LOCAL_URL='postgresql:///y2k?host=/var/run/postgresql&user=y2k'
NEON=$(set -a; . "$ENV"; echo "$DATABASE_URL")
# Replace the DATABASE_URL line without sed (the URLs contain & and #).
setdb() { V="$1" awk '/^DATABASE_URL=/{print "DATABASE_URL=\"" ENVIRON["V"] "\""; next} {print}' "$ENV" > "$ENV.new" && install -m 640 -o root -g y2k "$ENV.new" "$ENV" && rm -f "$ENV.new"; }
case "$NEON" in *neon.tech*) ;; *) echo "DATABASE_URL is not Neon; nothing to do"; exit 0 ;; esac

N() { psql "$NEON" -v ON_ERROR_STOP=1 -Atq "$@"; }
L() { sudo -u postgres psql y2k -v ON_ERROR_STOP=1 -Atq "$@"; }

echo "== schema check"
Q="select table_name||'.'||column_name||':'||data_type from information_schema.columns where table_schema='public' order by 1"
diff <(N -c "$Q") <(L -c "$Q") > /root/schema.diff && echo "schemas match" || { echo "SCHEMA MISMATCH"; head -20 /root/schema.diff; exit 1; }
TABLES=$(L -c "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")

echo "== stopping app"
systemctl stop y2k
trap 'echo "FAILED: restoring"; setdb "$NEON"; systemctl start y2k' ERR

echo "== copying"
L -c "TRUNCATE $(echo $TABLES | sed 's/ /, /g') RESTART IDENTITY CASCADE"
for t in $TABLES; do
  N -c "\\copy (select * from \"$t\") to stdout" | sudo -u postgres env PGOPTIONS='-c session_replication_role=replica' psql y2k -v ON_ERROR_STOP=1 -Atq -c "\\copy \"$t\" from stdin"
done

echo "== sequences"
L -c "select format('select setval(%L, coalesce((select max(%I) from %I),1), (select count(*)>0 from %I))', pg_get_serial_sequence(quote_ident(table_name), column_name), column_name, table_name, table_name) from information_schema.columns where table_schema='public' and pg_get_serial_sequence(quote_ident(table_name), column_name) is not null" | while read -r stmt; do L -c "$stmt" >/dev/null; done

echo "== counts (table neon local)"
BAD=0
for t in $TABLES; do
  a=$(N -c "select count(*) from \"$t\""); b=$(L -c "select count(*) from \"$t\"")
  echo "$t $a $b"; [ "$a" = "$b" ] || BAD=1
done
[ "$BAD" = 0 ] || { echo "COUNT MISMATCH"; false; }

echo "== switching"
umask 077; echo "$NEON" > /root/neon-url.backup
setdb "$LOCAL_URL"
trap - ERR
systemctl start y2k
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/event || true)
  [ "$code" = 200 ] && break; sleep 1
done
if [ "$code" != 200 ]; then
  echo "HEALTH FAILED: rolling back to Neon"
  setdb "$NEON"; systemctl restart y2k; exit 1
fi
echo "DONE: app now on local Postgres"
