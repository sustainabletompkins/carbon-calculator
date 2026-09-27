# Legacy data migration

One command rebuilds Firestore from a dump of the old Postgres database. It is
wipe-and-reload, so it can be run as many times as needed until launch.
Background and decisions: [docs/DATA_MIGRATION_PLAN.md](../docs/DATA_MIGRATION_PLAN.md).

## 1. Get a dump

On a machine with access to the old database (`-At` avoids the backslash
doubling that `COPY ... TO STDOUT` causes):

```bash
D=data_dump/$(date +%F); mkdir -p $D
for t in offsets teams individuals team_members regions; do
  psql -d flcf -At -c "SELECT row_to_json(t) FROM $t t" > $D/$t.json
done
psql -d flcf -At -c "SELECT row_to_json(t) FROM (SELECT id, created_at, email, first_name, name, zipcode FROM users) t" > $D/users.json
```

`data_dump/` is gitignored and excluded from deploys. Dumps contain donor names
and emails — never commit them.

## 2. Check it

```bash
npm run migrate:all -- --dump data_dump/2026-09-27 --dry-run
```

Parses every row (aborts on any bad line), prints counts, totals and
referential-integrity warnings. Writes nothing.

## 3. Load it

Confirm `LGL_SYNC_ENABLED=false` in `functions/.env` is what's deployed, then:

```bash
npm run migrate:all -- --dump data_dump/2026-09-27 --project flcf-f7cf1
```

Deletes `offsets`, `teams`, `teamMembers`, `regions`, `users`, `cartItems`,
reloads them, then verifies counts and pound/dollar totals against the dump.
A report is written to `data_dump/reports/`. **Everything created on the new
site since the last run is erased** — that is intentional before launch.

## 4. Launch day

1. Put the old site in maintenance mode, take a final dump.
2. `npm run migrate:all -- --dump <final> --project flcf-f7cf1 --final`
   — `--final` locks the script so it can never wipe live data.
3. Set `LGL_SYNC_ENABLED=true` in `functions/.env`, `firebase deploy --only functions`.
4. Switch Stripe to live keys, then DNS.

## What gets imported

| Old table | Firestore | Doc ID |
|---|---|---|
| offsets (purchased, plus gifts entered by hand) | `offsets` | `<id>` |
| teams | `teams` (`isIndividual: false`) | `team-<id>` |
| individuals | `teams` (`isIndividual: true`) | `ind-<id>` |
| team_members | `teamMembers` | `<id>` |
| regions | `regions` | `<id>` |
| users (id, email, names, zip only) | `users` | `<id>` |

Every imported doc has `source: "legacy"`. Offsets also get `syncedToLGL: true`
(the old site already sent them to Little Green Light) and `teamDocId`, the
authoritative link to the team/individual — numeric legacy ids overlap between
the two tables (2, 36, 70, 71, 73, 116), so `teamId` alone is ambiguous.
