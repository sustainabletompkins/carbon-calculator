# Finger Lakes Climate Fund — public API

A read-only JSON API for putting the fund's numbers on another site.
fingerlakesclimatefund.org is the reason it exists, but nothing about it is
specific to that site.

It serves three things:

| | |
|---|---|
| **Headline stats** | Lbs CO₂ offset, gallons of gas avoided, dollars raised, grants awarded |
| **Leaderboards** | Carbon Race teams and individuals, ranked, filterable by region |
| **Regions** | The list to build a region filter from |

**Base URL:** `https://<the carbon calculator site>/api/public`

No API key, no sign-in, GET only. Everything it returns is already public on
the calculator's own leaderboard page. Nothing personal — no donor emails,
addresses or individual transactions — is served here.

---

## Quick reference

```
GET /api/public/stats
GET /api/public/stats?region=tompkins
GET /api/public/leaderboard?type=teams&sort=pounds&limit=10
GET /api/public/leaderboard?type=individuals&region=tompkins,broome
GET /api/public/regions
```

`GET /api/public/` returns this list as JSON, so the API documents itself if
this file ever goes missing.

---

## `GET /stats`

The four counters, plus the supporting numbers behind them.

| Parameter | Values | Default |
|---|---|---|
| `region` | Region id, slug or name. Comma-separate for several. | all regions |

```json
{
  "poundsOffset": 26278461,
  "gallonsGasAvoided": 1313923,
  "dollarsRaised": 325623.45,
  "grantsAwarded": 114,

  "offsetCount": 2672,
  "donationsRaised": 4250,
  "donationCount": 12,
  "totalRaised": 329873.45,
  "teamCount": 42,
  "individualCount": 119,
  "thisYear": { "year": 2026, "poundsOffset": 10135, "dollarsRaised": 845.97, "offsetCount": 14 },

  "region": null,
  "lbsPerGallon": 20,
  "updatedAt": "2026-09-20T16:25:30.285Z"
}
```

Notes:

- `gallonsGasAvoided` is derived: `poundsOffset ÷ lbsPerGallon`, rounded down.
  `lbsPerGallon` is 20 (the EPA figure for a gallon of gasoline) and is
  configurable in the admin, so read it from the response rather than
  hard-coding 20 if you recompute anything.
- `dollarsRaised` counts offset purchases only. Straight donations are
  `donationsRaised`; `totalRaised` is both.
- `grantsAwarded` is a number the fund's staff keep current in the admin —
  nothing in the calculator tracks grants. It is `null` on a region-filtered
  request, because the count is not broken down by region.
- Filtering by region narrows every figure except `grantsAwarded`. An offset
  belongs to the region recorded on the purchase, falling back to the region of
  the team it was credited to.

## `GET /leaderboard`

| Parameter | Values | Default |
|---|---|---|
| `type` | `teams`, `individuals`, `all` | `teams` |
| `region` | Region id, slug or name. Comma-separate for several. | all regions |
| `sort` | `pounds`, `offsets`, `dollars`, `name` | `pounds` |
| `limit` | 1–200 | 25 |
| `offset` | Rows to skip, for paging | 0 |
| `search` | Matches the entry or region name | — |
| `includeEmpty` | `1` to include accounts with no offsets yet | off |

```json
{
  "entries": [
    {
      "rank": 1,
      "id": "6aynBEledDfTD1iqDswh",
      "name": "Sustainable Tompkins",
      "type": "team",
      "pounds": 1704819.82,
      "gallonsGasAvoided": 85240,
      "offsets": 150,
      "dollars": 21300.25,
      "members": 34,
      "image": "",
      "region": { "id": 34, "name": "Tompkins", "slug": "tompkins" }
    }
  ],
  "total": 42,
  "limit": 25,
  "offset": 0,
  "totals": { "pounds": 5377296.82, "offsets": 951, "dollars": 67210.5 },
  "filters": { "type": "teams", "sort": "pounds", "search": null, "region": [] },
  "updatedAt": "2026-09-20T16:25:46.578Z"
}
```

Notes:

- `updatedAt` on `/stats` and `/leaderboard` is when the data was assembled,
  not when you asked for it, so it tells you how stale the copy you got is.
- `rank` is the position in the whole filtered set, so it stays correct as you
  page through with `offset`.
- `total` is the number of entries matching the filter, not the number
  returned. `totals` sums the whole filtered set, not just the page.
- `pounds` and `offsets` are the stored Carbon Race totals for that account, the
  same figures the calculator's leaderboard shows. They are not recomputed from
  the offset records — the fund's totals predate this site and are maintained
  deliberately.
- `region` is `null` for accounts with no region set.
- Accounts that have never offset anything are left out unless you ask for
  `includeEmpty=1`.

## `GET /regions`

Regions that have at least one leaderboard entry — what a filter menu needs.
Add `?all=1` for all 48 counties, including empty ones.

```json
[
  { "id": 34, "name": "Tompkins", "slug": "tompkins", "teams": 27, "individuals": 41, "pounds": 4668022.82, "offsets": 716 }
]
```

Anywhere a `region` parameter is accepted, you can pass the `id` (`34`), the
`slug` (`tompkins`) or the `name` (`Tompkins`, case-insensitive). Slugs are
stable and the friendliest thing to put in a URL. An unknown region is a `400`,
not an empty result, so a typo shows up instead of silently reporting zero.

---

## Using it

### Caching

Every response carries `Cache-Control: public, max-age=300` and is also cached
on the server for the same five minutes, so hitting these endpoints on every
page view of a busy site is fine — it does not translate into database reads.

The flip side is staleness: a new offset purchase, or a change made in the
admin, takes up to five minutes to reach the API and up to another five to get
past a browser that already has a copy — call it ten minutes worst case. Saving
in the admin clears the server's cache immediately, so the usual wait is just
whatever the visitor's browser is holding. These are lifetime totals; nothing
here needs to be to-the-second.

Because of that caching there is no rate limit, and none of these endpoints
require a key. If you fetch server-side and cache on your end too, an hour is a
perfectly reasonable TTL.

### From a browser

CORS is open to any origin by default. If the fund ever wants to restrict it,
set `PUBLIC_API_ORIGINS` on the server to a comma-separated list of sites
(`https://fingerlakesclimatefund.org,https://www.fingerlakesclimatefund.org`)
— server-to-server callers are unaffected either way.

### Counters, drop-in

Paste into a WordPress page (a Custom HTML block), a template, or anywhere else
that takes markup. Replace `API` with the calculator's address.

```html
<div class="flcf-stats">
  <div><strong data-stat="poundsOffset">—</strong><span>Lbs CO2 Offset</span></div>
  <div><strong data-stat="gallonsGasAvoided">—</strong><span>Gallons Gas Avoided</span></div>
  <div><strong data-stat="dollarsRaised">—</strong><span>$ In Offsets Raised</span></div>
  <div><strong data-stat="grantsAwarded">—</strong><span>Grants Awarded</span></div>
</div>

<script>
  (function () {
    var API = "https://YOUR-CALCULATOR-SITE";
    fetch(API + "/api/public/stats")
      .then(function (r) { return r.json(); })
      .then(function (s) {
        document.querySelectorAll(".flcf-stats [data-stat]").forEach(function (el) {
          var v = s[el.dataset.stat];
          el.textContent = v == null ? "—" : Math.round(v).toLocaleString("en-US");
        });
      })
      .catch(function () { /* leave the placeholders in place */ });
  })();
</script>
```

### Leaderboard with a region filter, drop-in

```html
<label>Region
  <select id="flcf-region"><option value="">All regions</option></select>
</label>
<ol id="flcf-board"></ol>

<script>
  (function () {
    var API = "https://YOUR-CALCULATOR-SITE";
    var select = document.getElementById("flcf-region");
    var board = document.getElementById("flcf-board");

    fetch(API + "/api/public/regions")
      .then(function (r) { return r.json(); })
      .then(function (regions) {
        regions.forEach(function (r) {
          select.insertAdjacentHTML("beforeend",
            '<option value="' + r.slug + '">' + r.name + " (" + (r.teams + r.individuals) + ")</option>");
        });
      });

    function render() {
      var url = API + "/api/public/leaderboard?type=teams&limit=10" +
        (select.value ? "&region=" + encodeURIComponent(select.value) : "");
      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          board.innerHTML = data.entries.length
            ? data.entries.map(function (e) {
                return "<li><span>" + e.name + "</span> " +
                  "<b>" + Math.round(e.pounds).toLocaleString("en-US") + " lbs</b></li>";
              }).join("")
            : "<li>No teams in this region yet.</li>";
        });
    }

    select.addEventListener("change", render);
    render();
  })();
</script>
```

---

## Where the numbers come from

Leaderboard rows are the stored totals on each Carbon Race account. The
headline stats are the offsets ledger, plus a **baseline** the fund sets once.

The baseline exists because the old site published running totals that its own
records do not add up to. Rather than have the counters jump when this site
takes over, an admin enters what the old site shows and the difference is kept
as a fixed baseline — so the published numbers carry over and then grow with
real activity. Admin → **Public API** does this arithmetic, and is also where
`grantsAwarded` and the lbs-per-gallon figure are set.

One consequence worth knowing: if the fund corrects historical records in the
admin, the baseline is not automatically re-derived, so the published totals
move by the size of the correction. That is usually what you want; if it is
not, adjust the baseline by the same amount.

## Compatibility

Fields get added; they do not get renamed or removed. Anything genuinely
incompatible goes to a new path rather than changing these. `GET /api/public/`
reports `version`.

## Related

- `docs/deploy_to_gcloud.md` — how this is deployed and served
- `publicRoutes.js` — the implementation
- `lib/ledger.js` — how offset records are normalised into the ledger the
  stats are summed from
