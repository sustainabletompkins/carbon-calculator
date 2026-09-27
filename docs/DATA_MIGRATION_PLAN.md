# Data Migration Plan — old Postgres site → Firestore

Written 2026-09-20. Firebase project: `flcf-f7cf1`.

## Strategy: wipe-and-reload, not delta sync

Until cutover, the old site is the only source of truth. Nothing created on the
new site during client review is real (test purchases, test teams), so there is
nothing on the Firestore side worth preserving. That means every refresh can be:

1. Fresh full dump from the old Postgres DB
2. Wipe the legacy-owned collections in Firestore
3. Reload everything from the dump
4. Verify counts and totals against the dump

Same command now, in a week, and at final cutover. No merge logic, no
"what changed since last time" tracking. The whole dataset is ~3,100 docs, so a
full reload takes well under a minute.

Final cutover is the same run with one extra step first: put the old site in
maintenance mode so no purchase lands between the dump and the DNS switch.

## What to bring over

| Old table | Rows (current dump) | Migrate? | Target | Notes |
|---|---|---|---|---|
| offsets | 2,660 (2,511 purchased) | Yes | `offsets` | Purchases and hand-entered gifts 2015→now. See decision 3 below. |
| teams | 42 | Yes | `teams` | Drives the leaderboard. |
| individuals | 119 | Yes | `teams` (`isIndividual: true`) | **Never seeded so far** — Firestore has 0. |
| team_members | 254 | Yes | `teamMembers` | Email → team lookup at checkout. |
| regions | 48 | Yes | `regions` | **Never seeded so far** — Firestore has 0, so `/api/regions` returns empty. |
| users | 98 | Minimal | `users` | Old Devise logins, none created since 2022. Keep id/email/name/zip only (script already strips password hashes). |
| stats | 1 | Only if shown | — | Site-wide totals + `awardees` count. Not in our dumps; new UI doesn't reference it today. |
| cart_items | 5,808 | No | — | Abandoned/transient carts. |
| offsetters, awardees, prizes, prize_winners, pages, message_templates | ? | No (confirm w/ client) | — | Not referenced anywhere in the new UI. Keep the final SQL dump as an archive. |
| identities, simple_captcha_data, active_storage_*, schema_migrations | — | No | — | Rails plumbing. |

Dump freshness today: offsets end 2025-11-14, teams/individuals/members exported
2026-04-06. All stale — a fresh export is step one regardless.

## Problems found in the current scripts (must fix before the next load)

1. **LGL webhook will fire on imported offsets.** `syncOffsetToLittleGreenLight`
   runs on every new `offsets` doc and posts a "Credit Card" gift dated *today*
   to the client's live Little Green Light account. The import doesn't set
   `syncedToLGL`. Existing doc IDs are safe (overwrite = update, not create),
   but a wipe-and-reload or any new legacy ID would post thousands of fake gifts.
   Fix: importer stamps `syncedToLGL: true` and `source: "legacy"` on every
   doc, and the function early-returns on `source === "legacy"`.
2. **Attribution emails.** `notifyOnAttribution` emails the donor when `teamId`
   goes from empty to set. Legacy docs currently dodge this only because they
   use `email` instead of `userEmail`. Add the same `source === "legacy"` guard.
3. **Silent data loss.** psql's `COPY` text format doubles backslashes, so any
   row with a quote in a name is invalid JSON and gets skipped with only a
   console warning. Currently 2 offsets + 1 individual lost (Firestore has 2,658
   legacy offsets vs 2,660 in the dump). Fix at export (see below) and make the
   importer fail hard on any unparseable line.
4. **Teams/individuals are not re-runnable.** They use auto-IDs, so a second run
   duplicates everything. Switch to deterministic IDs: `teams/team-<id>`,
   `teams/ind-<id>`, `teamMembers/<id>`.
5. **legacyId collision.** Teams and individuals share the `teams` collection
   and both use their old numeric id as `legacyId`. Six ids exist in both
   tables (2, 36, 70, 71, 73, 116). `attributeOffsetToTeam` and
   `notifyOnAttribution` look up by `legacyId` alone and take the first hit, so
   a purchase could be credited to the wrong account. Latent today only because
   individuals aren't loaded. Fix: look up by doc ID (`team-116` / `ind-116`)
   or add `isIndividual` to the query.
6. **Two offset shapes.** Legacy docs: `email`, `pounds`, `purchased`,
   `createdAt` (Timestamp). New-app docs: `userEmail`, `carbonPounds`, `status`,
   `createdAt` (ISO string). `getUserOffsets` queries `userEmail`, so legacy
   history is invisible to it. Importer should write the new-app field names
   (keeping the legacy ones alongside is harmless).
7. **Dumps with PII are committed to git** (`users.json` includes
   `encrypted_password`, reset tokens, IPs, `api_secret`; offsets have donor
   names/emails). The commit is local only — not on origin yet. Untrack them
   and gitignore before the next push to the sustainabletompkins GitHub repo.
8. `migrateOffsetsToFirestore.js` uses the client SDK through public security
   rules. Move it to the Admin SDK like the other scripts; this also lets us
   tighten `firestore.rules` before launch.

## Build: one command

`npm run migrate:all -- --dump data_dump/<date> --project flcf-f7cf1` doing:

1. **Export script** (`scripts/exportLegacy.sh`) — one psql call per table using
   `\copy (SELECT row_to_json(t) FROM <table> t) TO 'x.json' WITH (FORMAT csv, QUOTE E'\x01', DELIMITER E'\x02')`
   or simply `psql -At -c "SELECT row_to_json(t) ..."`, either of which avoids
   the backslash-doubling bug. Users export selects only the safe columns.
   Output goes to a dated, gitignored folder.
2. **Preflight** — parse every line (hard fail on errors), check referential
   integrity, print counts. Known today: 53 offsets point at individuals that
   no longer exist, 25 offsets have both a team and an individual.
3. **Wipe** `offsets`, `teams`, `teamMembers`, `regions`, `users`, `cartItems`
   (requires typing the project id to confirm).
4. **Load** with deterministic IDs, `source: "legacy"`, `syncedToLGL: true`.
5. **Verify** — per-collection counts and sum of imported pounds/dollars must
   match the dump (today: 24,976,940 lbs / $309,260 across 2,660 offsets).
   Writes a small report we can forward to the client.
6. `--dry-run` flag for steps 3–4.

Team totals: import the old site's stored `pounds`/`count` as-is. They don't
equal the sum of offsets for 35 of 42 teams (the old app evidently adjusted them
separately), so don't recompute — the leaderboard should match what the old
site shows.

## Timeline

- **Now:** fix items 1–8, get a fresh dump, run the load, hand to client.
- **Review week:** client tests with Stripe **test** keys. Tell them anything
  they create will be erased. Decide whether LGL stays connected (below).
- **~1 week:** fresh dump → same command. Test data disappears, new real
  purchases from the old site appear.
- **Cutover:** old site to maintenance mode → dump → same command → verify
  report → switch Stripe to live keys + live webhook → DNS. Keep the old DB
  read-only for a few weeks as a fallback.

## Decisions (2026-09-20)

1. **LGL sync gets an on/off flag.** `LGL_SYNC_ENABLED` param on the Cloud
   Function (hardcoded URL moves to config too). Off during import and client
   review, on at cutover. Importer still stamps `syncedToLGL: true` +
   `source: "legacy"` as a second safety net, so flipping the flag on later
   can never replay history.
2. **Old site already pushed gifts to LGL**, so historic gifts are there. No
   LGL backfill needed.
3. ~~Skip unpurchased offsets (149).~~ **Revised 2026-09-27: import them.**
   None has a Stripe session; they're donations, grants and checks staff
   entered by hand (7.63M lbs, $95,340, all at $25/ton), and the old site
   credited them to their accounts. Skipping them left 43 accounts with
   pounds but no offsets.
7. **Account totals are rebuilt from the offsets (2026-09-27).** The old
   site's stored `pounds`, `count` and `members` had drifted from its own
   rows, so each account gets pounds = its dollars ÷ $0.0125, count = its
   offset rows, members = its member rows. Offsets sold at the old $20/ton
   price (2015 to Oct 2016) keep their recorded pounds. The leaderboard no
   longer matches the old site (16.04M → 17.54M lbs).
4. **Recurring gifts: non-issue.** Checked the cart dump: `frequency` is
   `one_time` on all 5,808 rows and `schedule` is always null.
   `offset_interval` (year/quarter/month) is the *period being offset*
   ("1 year of car travel"), not a billing schedule. No Stripe subscriptions.
5. **Teams vs individuals: one model, one flag.** Both live in `teams`;
   `isIndividual` separates the two leaderboard columns and the checkout
   lookup (individual = matched by own email, team = matched via
   `teamMembers`). Migrated docs get deterministic IDs (`team-<id>` /
   `ind-<id>`), and offsets/teamMembers link to them with `teamDocId` — the
   same convention the admin ledger (`adminRoutes.js`) uses. Numeric `teamId`
   stays for reference only, which sidesteps the 6-id collision.
6. **Use the existing (Nov 2025 / Apr 2026) dumps for the first client load.**
   Staleness is harmless since every later run replaces everything.

## Status (2026-09-20)

Built: `npm run migrate:all` (see `scripts/MIGRATION_GUIDE.md`), LGL kill
switch + legacy guards in `functions/index.js`, `teamDocId` attribution in
checkout, dumps moved to gitignored `data_dump/`. Old per-table scripts removed.
Not yet done: deploy functions, run the real load.

Still open: separate staging Firebase project (not needed for this plan).
