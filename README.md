# VitaPlan

Self-hosted daily vitamin & supplement planner. Add the bottles you actually
own, build a weekly schedule, and see — in one spreadsheet-style view — what
every product contributes to your day against the recommended amounts (RDA/AI)
and tolerable upper limits (UL) for your age, sex, and life stage.

Runs as a single Docker container (made for unraid, works anywhere). All data
stays on your server.

## Features

- **Add products four ways**
  - **Barcode** — camera scan or typed UPC, looked up in the
    [NIH Dietary Supplement Label Database](https://dsld.od.nih.gov/) (full
    ingredient amounts) with [Open Food Facts](https://world.openfoodfacts.org/)
    as fallback
  - **Search** — by product name, or by **NPN licence number** for Canadian
    bottles via a locally-synced copy of
    [Health Canada's LNHPD](https://health-products.canada.ca/lnhpd-bdpsnh/index-eng.jsp)
  - **Label photo** — OCR runs *in your browser* (tesseract.js); the photo
    never leaves your device, and the result prefills an editable form
  - **Manual** — type it in; ingredient names auto-match to tracked nutrients
- **Weekly regimen** — servings per day and which weekdays for each product
  (vitamin D daily, B-complex Mon/Wed/Fri, …)
- **Dashboard** — nutrient × product grid per weekday with totals, % of
  target, % of upper limit, status icons, over-limit warnings, CSV export
- **What-if** — pick any product and instantly see whether adding it would
  push anything past its safe limit
- **Profiles** — the same inputs as the USDA DRI calculator (age, sex,
  height/weight in ft-in/lbs or metric, activity, pregnancy/lactation), with
  BMI and estimated calories; reference values from NIH/NASEM tables
- **Multi-user** with email/password login; first-run consent screen;
  mobile-first PWA (installable, bottom-tab navigation); WCAG 2.2 AA targeted

## Install on unraid

1. Docker tab → **Add Container** → paste the template URL:
   `https://raw.githubusercontent.com/codeman256/nutrition-app/main/unraid.xml`
   (or add it via Community Applications once published there).
2. Optionally set **Auth Secret** to a long random string
   (`openssl rand -base64 32`) — left blank, one is generated automatically
   and stored in the Data folder.
3. Apply. The web UI is at `http://SERVER-IP:3005` (or whatever host port you
   mapped). Ownership of the Data folder is fixed automatically on startup.

Updates: the image is rebuilt on every push to `main` and published to
`ghcr.io/codeman256/nutrition-app:latest`. unraid's Docker tab shows when an
update is available (one click), and the *Auto Update Applications* plugin can
apply them automatically.

### Camera scanning needs HTTPS

Browsers only allow camera access on secure origins. Typed barcode entry,
photos, and everything else work fine over plain HTTP on your LAN, but to use
the **camera** scanner from your phone you need HTTPS — the easiest routes are
[Tailscale](https://tailscale.com/) (`tailscale serve` gives you a valid HTTPS
URL for free) or a reverse proxy with a certificate (Nginx Proxy Manager,
Caddy, Traefik). Add the HTTPS origin to **Trusted Origins** in the template.

## Docker Compose

```yaml
services:
  vitaplan:
    image: ghcr.io/codeman256/nutrition-app:latest
    ports:
      - "3005:3005"
    volumes:
      - ./data:/data
    environment:
      BETTER_AUTH_SECRET: "change-me"   # openssl rand -base64 32
    restart: unless-stopped
```

## Backup & restore

The **first account** you create is the instance admin and gets an **Admin**
page (link in the nav). From there you can:

- **Download backup** — a consistent snapshot of the whole SQLite database
  (`vitaplan-YYYY-MM-DD.db`): all accounts, profiles, products, and regimens.
- **Restore from backup** — upload a `.db` file to replace the current
  database. This is how you copy a local/dev database onto your unraid
  instance, or roll back after a mistake.

  ⚠️ Restore **overwrites all current data** with the uploaded file.

Because everything lives in the `/data` volume, you can also just copy
`data/vitaplan.db` (plus `-wal`/`-shm` if present) while the container is
stopped. The Admin download is the safe way to grab a copy while it's running.

The Admin page also controls the Health Canada (LNHPD) index: its last-updated
time, an auto-refresh schedule (never / weekly / monthly / quarterly), and a
manual **Refresh now** button that shows live download progress.

## Development

```bash
npm install
cp .env.example .env.local   # set BETTER_AUTH_SECRET
npm run dev                  # http://localhost:3005
npm test                     # planner engine unit tests
```

Stack: Next.js 15 (App Router, TypeScript), SQLite via Drizzle ORM,
better-auth, Tailwind 4 + shadcn/ui, tesseract.js, @zxing/browser.
Migrations run automatically on startup; data lives in `./data` (or the
`/data` volume in Docker).

## Data sources

- NIH Office of Dietary Supplements — [DSLD](https://dsld.od.nih.gov/) labels
  and [DRI tables](https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx)
- Health Canada — [LNHPD](https://health-products.canada.ca/api/documentation/lnhpd-documentation-en.html)
  licensed natural health products
- [Open Food Facts](https://world.openfoodfacts.org/) (ODbL)

## Disclaimer

VitaPlan is an informational planning tool, not medical advice. Reference
values are population-level guidelines that don't account for your medical
history, medications, or lab results. Talk to a healthcare professional before
changing your supplement routine.

## License

[AGPL-3.0](LICENSE)
