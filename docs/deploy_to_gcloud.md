# setup

gcloud config set project YOUR_PROJECT_ID
gcloud services enable appengine.googleapis.com
npm run build

# configue app engine

settings in app.yaml
make sure to use dist, not build

# deploy to app engine

gcloud app create --region=us-central
gcloud app deploy
gcloud app browse (to view at url)

# firebase cloud function

npm install -g firebase-tools
firebase login
firebase init functions
firebase deploy --only functions

# how the App Engine service is laid out

One service runs both halves of the app (see app.yaml):

- `/api/*` and `/health` go to the Express server (`server.js`, started by `npm start`)
- everything else is served from the static Vite build in `dist/`

The site and API share an origin, so the browser needs no API URL. A
`VITE_API_URL=http://localhost:3000` in `.env` is fine for local work; production
builds ignore loopback addresses (see `src/utils/apiUrl.js`).

On App Engine the server signs in to Firebase with the project's default service
account, so `scripts/serviceAccountKey.json` is not uploaded (see `.gcloudignore`).

# server secrets (first deploy, and whenever a key changes)

npm run deploy:env

This writes `env_variables.yaml` from the server-only values in `.env`
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the optional
`PUBLIC_API_ORIGINS` / `PUBLIC_API_CACHE_SECONDS`). The file is git-ignored and
is merged into app.yaml at deploy time. Never put secrets in app.yaml itself,
and never give them a `VITE_` prefix.

# after code changes

npm run deploy

(same as `npm run build && gcloud app deploy`)

Check it worked: https://YOUR_PROJECT_ID.ue.r.appspot.com/health should return
`{"status":"Server is running"}`.

After changing firestore.rules: firebase deploy --only firestore:rules
After changing functions/:     firebase deploy --only functions

# public API for fingerlakesclimatefund.org

`/api/public/*` serves the stat counters and Carbon Race leaderboards to the
fund's website. It needs no extra deploy step — it is part of the same Express
server and is already covered by the `/api/.*` handler in app.yaml.

Check it worked:
https://YOUR_PROJECT_ID.ue.r.appspot.com/api/public/stats

Optional, in `.env` before `npm run deploy:env`:

    PUBLIC_API_ORIGINS=https://fingerlakesclimatefund.org,https://www.fingerlakesclimatefund.org
    PUBLIC_API_CACHE_SECONDS=300

Leaving `PUBLIC_API_ORIGINS` unset allows any site to call it from a browser,
which is the sensible default for data that is already public. Consumer-facing
documentation for the fund's web developer is in docs/PUBLIC_API.md.
