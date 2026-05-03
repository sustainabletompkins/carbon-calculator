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
