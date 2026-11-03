# Cutover: Vercel to the AWS server

Both sites share the same Neon database until the end, so visitors on either side see the same seats and orders.
Server: `i-006da6098b23cbd0a` (ap-southeast-2), Elastic IP `3.24.111.142`. DNS is at BigRock.

## Before the flip (same day)
1. Check `https://aws.projecty2k.com` is healthy and `/api/event` returns the live passes.
2. On the server set `APP_URL=https://www.projecty2k.com` in `/etc/y2k.env`, then ship a release
   (`scripts/ship-aws.sh`). Indexing switches and canonical host are fixed at build time, so it must rebuild.
3. Do NOT change the Caddyfile yet.

## The flip (BigRock, two edits)
1. `www`: delete the CNAME `6f3d9080570da2ba.vercel-dns-017.com`, then add an **A** record `www` -> `3.24.111.142`.
2. `projecty2k.com`: edit the A record `216.198.79.1` -> `3.24.111.142`.
3. Right after, on the server: `install -m 644 /opt/y2k/deploy/Caddyfile.cutover /etc/caddy/Caddyfile && systemctl reload caddy`
   (sync deploy/ first). Caddy then requests the certificates; check `journalctl -u caddy`.
4. Records are cached for 6-10 hours, so visitors move over gradually. Vercel keeps serving the ones who haven't.
5. Smoke test on the new address: home, checkout page, admin login, scanner, a test ticket email.

## Rollback (any time)
Put the two records back (A `projecty2k.com` -> `216.198.79.1`, CNAME `www` -> `6f3d9080570da2ba.vercel-dns-017.com`).
Same 6-10 hour settling. Vercel is untouched and still has the same Neon data.

## After DNS has settled (a quiet hour)
1. Pause sales (Admin > Passes > sales switch).
2. Dump Neon, load into the server's local Postgres, compare row counts (orders, tickets, payments, staff, proofs).
3. Point `DATABASE_URL` at the local socket, restart, resume sales. Neon stays as a frozen backup.
4. Only then switch Vercel off.
