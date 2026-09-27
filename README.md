# Finger Lakes Climate Fund — Carbon Calculator

A website where people work out the carbon footprint of their flights, car
trips and home energy use, then pay to offset it. Payments go through Stripe,
records are stored in Firebase, and each purchase is copied to Little Green
Light (the fund's donor database). The site also runs the Carbon Race
leaderboard, an admin dashboard, and a public stats API for other websites.

---

## Before you start

You need three free tools installed on your computer:

1. **Git** — downloads the code. Get it at https://git-scm.com/downloads
2. **Node.js, version 24 or newer** — runs the site. Get the "LTS" version at
   https://nodejs.org. It includes `npm`, which installs the site's building
   blocks.
3. **A terminal** — the text window you type commands into.
   On Mac, open the **Terminal** app. On Windows, open **PowerShell**.

To check they are installed, type these into the terminal. Each should print a
version number:

```
git --version
node --version
```

## 1. Download the code ("clone the repo")

In the terminal, go to the folder where you want the project, then run:

```
git clone https://github.com/sustainabletompkins/carbon-calculator.git
cd carbon-calculator
```

This creates a `carbon-calculator` folder and moves you into it. Run every
command below from inside that folder.

To get the latest changes later, run `git pull` from the same folder.

## 2. Install the building blocks

```
npm install
```

This takes a minute or two the first time. You only need to repeat it if
someone adds a new package.

## 3. Add the secret settings

The site needs API keys (Stripe, Google Maps, Firebase) that are **not** stored
in the code for security reasons. Ask the project maintainer for a copy of the
`.env` file and put it in the `carbon-calculator` folder.

`.env.example` lists every setting the file needs. Never share `.env` publicly
or commit it to Git.

## 4. Run the site on your computer

```
npm run dev:all
```

This starts two things at once: the website and the small server behind it
that handles payments. When the terminal shows a `Local:` address (usually
http://localhost:5173), open it in your browser.

To stop it, click the terminal and press **Ctrl + C**.

To test a purchase, use Stripe's test card `4242 4242 4242 4242`, any future
expiry date and any 3-digit CVC. This works only with the test keys; no real
money is charged.

## 5. Run the tests

```
npm test
```

This checks that the offset price calculations are correct. A good result
ends with `fail 0`. If anything fails, the lines above it show which check
went wrong.

To check the code for style problems, run `npm run lint`.

---

## Other commands

| Command | What it does |
|---|---|
| `npm run deploy` | Builds the site and publishes it to Google App Engine (needs Google Cloud access, see below) |
| `npm run admin:list` | Shows who can use the admin dashboard |
| `npm run admin:grant -- someone@example.com` | Gives a Google account admin access |
| `npm run admin:revoke -- someone@example.com` | Removes admin access |
| `npm run migrate:all` | Reloads data from the old site's database (see the migration plan) |

## Further documentation

- [docs/PUBLIC_API.md](docs/PUBLIC_API.md) — how other websites can show the fund's stats and leaderboards
- [docs/deploy_to_gcloud.md](docs/deploy_to_gcloud.md) — publishing the site to Google Cloud
- [docs/STRIPE_SETUP.md](docs/STRIPE_SETUP.md) — payment setup
- [docs/FIREBASE_WEBHOOK_INTEGRATION.md](docs/FIREBASE_WEBHOOK_INTEGRATION.md) — how purchases are sent to Little Green Light
- [docs/DATA_MIGRATION_PLAN.md](docs/DATA_MIGRATION_PLAN.md) — moving data over from the old site

## Where things live (for developers)

| Path | Contents |
|---|---|
| `src/` | The website (React) |
| `server.js`, `*Routes.js` | The server: payments, admin, race and public API |
| `functions/` | Firebase Cloud Functions (Little Green Light sync, emails) |
| `scripts/` | One-off tools: data migration, admin access |
| `test/` | Automated tests |
