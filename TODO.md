# VitaPlan — Roadmap & Known Issues

How to use this file: tell Claude (or open a PR) referencing an item's ID.
**Bug reports belong in [GitHub Issues](https://github.com/codeman256/nutrition-app/issues)**
— Claude can read them from there; this file is for the curated roadmap.
`[ ]` todo · `[y]` requested next · `[~]` in progress · `[x]` done.

## Bugs (from real use, 2026-07-19)

- [ ] **B1 — Weight entry in ft/lbs is unusable.** Typing "1" immediately
  becomes "1.10" and won't accept more digits (round-trip kg↔lbs conversion
  fires on every keystroke). Metric entry is fine. Keep imperial fields as
  their own state; only convert on blur/submit.
- [ ] **B2 — Date-of-birth picker is confusing.** Native date input hides the
  day grid until you click the month/year header. Replace with an explicit
  day/month/year control (or a clearer custom picker).
- [ ] **B3 — Trusted origin required to sign up.** Had to add
  `http://10.3.2.10:3011` (and later the proxy domain) or account creation
  failed. Auto-trust the request's own origin so a single-origin deployment
  needs no config; keep the env var for extra origins but surface it in the
  **normal** unraid template settings, not Advanced.
- [ ] **B4 — Barcode scan gives no confirmation.** Hard to capture; when it
  does, show the detected number in a field so the user can confirm it's
  right before/while looking up.
- [x] **B5 — Regimen weekday toggles look unselected.** All 7 days are ON by
  default when a product is enabled, but the styling made the user think they
  were off and they deselected. Make "all days" state obvious (e.g. an
  "Every day" chip / clearer active styling / helper text).

## Correctness (+ on-site education the user asked for)

- [x] **C1 — Vitamin A forms (RAE).** Beta-carotene factor fixed (0.5 mcg RAE
  per mcg β-carotene, 0.3 IU→RAE) and a **form** picker converts mass by form.
  The Centrum NPN import used to add three vitamin-A rows — "acetate 300 [blank
  unit]" plus a doubled "Beta-Carotene 900 mcg" **and** "1500 IU". Fixed:
  `parseUnit` now reads the unit through a reference qualifier ("mcg RAE/EAR" →
  mcg), and the importer collapses a mass/IU twin to one row (keeps 900 mcg,
  drops the 1500 IU duplicate). Import now yields one acetate + one β-carotene
  row, matching the bottle.
- [x] **C5 — IU label confirmation.** Rows for the IU-labelled nutrients
  (A/D/E, β-carotene) echo the calculated conversion on the product form — a
  mass amount shows "= 1,000 IU", an IU amount shows its tracked mass — so the
  user can check the row against the IU printed on the bottle. Unit-tested
  against the Centrum figures (300 mcg RAE = 1000 IU, 900 mcg βC = 1500 IU,
  20 mcg D = 800 IU, 18 mg dl-α E = 40 IU).
- [x] **C2 — DSLD multi-serving labels.** A label with a serving *range*
  (e.g. "1-2 scoops") lists each ingredient once per serving column. Import now
  picks the base serving consistently (`pickServingQuantity`: match the
  column's order, then the exact base amount, then the smallest) instead of
  blindly taking the first entry, and the serving-size string uses that base
  column. Unit-tested; verified against MacroMeal (22.5 g / 45 g).
- [x] **C3 — Folate DFE / folic acid.** RDA is in DFE (folic acid ×1.7), UL
  is in folic-acid mcg (×1.0). We compare to the UL 1:1 (safety-correct). The
  folate row's product-form `note` explains DFE and that %target is slightly
  conservative; the dashboard limit cell carries an info tooltip (`limitNote`)
  saying the UL is for synthetic folic acid, not food folate.
- [x] **C4 — Unit & acronym education.** Column headers carry hover
  definitions (RDA/AI/UL/DV/Unit); the product form has inline `note` help on
  tricky rows (vitamin A, D, E, folate); and the dashboard now has a
  collapsible "Units & abbreviations" glossary defining mcg, mg, IU, RAE, DFE,
  RDA, AI, UL and DV in plain language.

## Dashboard

- [x] **D1 — Units unclear.** Unit column now sits *after* the columns it
  describes, acting as a divider: everything left of it is in that unit,
  everything right is a percentage. Plus a "Show units" toggle — as on the
  label (default), everything in mcg, everything in mg, or IU where it
  applies (vitamins A/D/E only). Conversions are unit-tested.
- [x] **D2 — Move "What if I add…" to the bottom** of the page.
- [x] **D3 — Acronym tooltips** (RDA/AI/UL/DV) on the column headers.
- [x] **D4 — Source citations for status.** "300% over limit on B3 — says
  who?" Each nutrient name links to its NIH fact sheet.
- [x] **D5 — Show % Daily Value** column alongside % target (was F1).
- [x] **D6 — Density at scale.** A "Compact" toggle in the dashboard toolbar
  tightens cell padding, text and icon size so a grid with many products/
  nutrients stays scannable.
- [x] **D8 — Per-form sub-rows for vitamins A/E.** When two or more forms
  contribute (e.g. Centrum's retinyl + β-carotene), the nutrient row now shows
  an indented "└─ Beta-carotene / └─ Retinol" sub-line per form with its own
  per-product amounts and subtotal (in canonical units, summing to the parent
  total). Target/limit/%/status stay on the parent (they're per-nutrient). The
  split is preserved through the weekly-average view. Unit-tested
  (`formBreakdown`).
- [x] **D7 — Weekly-average-per-day view.** An "Avg" tab beside the weekdays
  shows average daily intake — each nutrient's 7-day total ÷ 7, counting
  non-dose days as zero. So a supplement taken 3×/week averages to 3/7 of its
  dose, and a nutrient can read over-limit on its heaviest day yet sit under
  the UL on average. What-if, the over-limit alert, and CSV export all follow
  the selected view. Unit-tested (`averageWeek`).

## Products

- [x] **P1 — Pill designer** per product: shapes (capsule/caplet/round/
  softgel), sizes, an 11-colour palette on the pill itself, and a second
  colour for the other capsule half. Stored as JSON (`pill_style`); legacy
  `pill_color` maps forward. Shown wherever a product has no photo.
- [x] **P2 — Barcode → no nutrients (Centrum via OFF).** A UPC hit with zero
  usable ingredients no longer drops the user into an empty form — it offers to
  hand the found name to the NPN/name search (prefilled and run) or continue
  manually.
- [x] **F5 — OCR preprocessing.** Grayscale → **Otsu binarization** (was a
  contrast stretch), higher working resolution (2600 px), and
  `preserve_interword_spaces` so the name↔amount split survives the dot
  leaders. Helps, but curved/glossy bottles with a wide two-column layout
  still read poorly — NPN import remains the reliable path; F4 (AI reading) is
  the real fix.
- [x] **P3 — Ingredient count on the form.** Add/edit product now shows a
  "N ingredients" badge (filled rows only) so the user can count the bottle's
  lines against what imported.
- [x] **P4 — Distinguish near-identical DSLD hits.** NIH search lists many
  look-alike rows (several "Centrum Specialist Energy"). Results now show the
  **DSLD id**, net contents ("60 Tablet(s)"), product type ("Multi-Vitamin and
  Mineral"), and an off-market flag, plus UPC on the rare hit that has one.
  (Probed the API: `search-filter` returns `upcSku: null` almost always — the
  barcode lives on the full label, not in search — so count/form/id are the
  workable differentiators.)
- [ ] **F4 — Optional AI label reading** (Claude API, bring-your-own-key).
- [x] **F2 — Stock tracking (unit-based).** Products carry a **Dosage** (X
  tablets/capsules/etc., Y times per day/week/month), **qty in container**, and
  **qty remaining** (stamped with an as-of date). Days of supply project from
  **qty remaining ÷ actual regimen consumption** (servings/day on active
  weekdays × units per serving), shown as a badge per card — muted, amber ≤14
  days, red when out; products not in the regimen show no estimate. Dose form,
  dose, container size and pill shape prefill from the API (LNHPD `productdose`,
  DSLD `servingSizes`/`netContents`); qty remaining defaults to a full
  container. Pure projection in `lib/stock.ts`, unit-tested.
- [ ] **F6 — Adherence check-off.**
- [x] **F7 — Non-medical ingredients from the API.** Imported from LNHPD
  `nonmedicinalingredient` and DSLD `otheringredients`. Edited as a plain
  paragraph on the product form but **stored as individual `product_ingredients`
  rows** (`non_medicinal = true`) for later use; excluded from nutrient totals
  and the tracked-count badge.
- [ ] **F8 — Email setup (SMTP).** Optional outbound email so the app can send:
  email-verification / change-email confirmation (currently email changes apply
  directly with no sender), low-stock reminders (from F2), and other
  notifications. Admin-configurable SMTP host/credentials; feature-flag off when
  unset. Until then, account email changes are applied directly server-side.

## Admin & data

- [x] **A1 — First user is admin.** Admin-only `/admin` page: in-browser
  **backup** (download the SQLite DB) and **restore** (upload) — handy for
  copying the local dev DB onto the unraid instance.
- [x] **A2 — Admin controls LNHPD sync schedule** (never / weekly / monthly /
  quarterly) plus a manual re-sync button. `instrumentation.ts` checks the
  schedule after boot and every 6h.
- [x] **R1 — LNHPD sync as a background job** with a polled progress endpoint —
  POST starts it and returns immediately; GET reports live row count.
- [x] **R5 — Backup story** — README "Backup & restore" section + the A1
  in-browser flow.
- [x] **First account is stored admin.** The `user` table gained a `role`
  column; a better-auth create hook stamps `role = "admin"` on the first
  account, and a boot-time backfill flags the earliest user on instances that
  predate the column. `getAdminUserId` prefers the flagged admin, falling back
  to earliest-created.
  only the admin should see the admin page. there can be multi admins if i
  were to manually modify records in db.

## Ops & quality

- [x] **R2 — Docker HEALTHCHECK** for unraid's health indicator (hits
  `/api/health`, which pings the DB).
- [x] **R3 — arm64 image.** The publish job builds `linux/amd64,linux/arm64`
  via buildx + QEMU, so the GHCR image runs on arm boards too. Native modules
  (better-sqlite3, sharp) verified to cross-build for arm64.
- [ ] **R4 — Login rate limiting.**
- [x] **F3 — Printable week view** of the regimen (`/regimen/print`, print CSS
  hides the app chrome).
- [x] **Q1 — Playwright e2e suite** in CI (smoke: health probe, auth redirect,
  sign-up → consent → profile). Runs against `next dev` on a throwaway DB.
- [x] **Q3 — Unit tests use a disposable DB.** The LNHPD tests seed/wipe
  `lnhpd_index`; they now run against `./data/vitaplan.test.db` (set via
  `test.env`, deleted by a globalSetup) so `npm test` no longer clears the
  developer's downloaded ~300k-row index.
- [ ] **Q2 — Automated axe/Lighthouse a11y pass** in CI.
- [x] **Account settings on the profile page** — an "Account" section lets the
  signed-in user change their name, sign-in email, and password (via
  better-auth updateUser / changeEmail / changePassword; email change is enabled
  server-side and applies immediately on this self-hosted, no-email setup).

## Done

- [x] unraid appdata permissions (entrypoint chowns `/data`, drops to
  PUID/PGID 99:100, UMASK) — fixed the first-deploy `SQLITE_CANTOPEN`.
- [x] Auth secret auto-generates into `/data/.auth-secret` when blank.
- [x] Plain-HTTP LAN login (secure cookies opt-in via `USE_SECURE_COOKIES`).
- [x] LNHPD brand search across company name + ingredient dedupe.
